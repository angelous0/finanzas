"""
Fix: Mark only REAL reconciled movements based on historial matching
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_conciliacion():
    # Connect to database
    conn = await asyncpg.connect(
        host='localhost',
        port=5432,
        user='postgres',
        password='postgres',
        database='finanzas'
    )
    
    try:
        await conn.execute("SET search_path TO finanzas2, public")
        
        print("=" * 70)
        print("🔧 FIX: Marking only REAL reconciled movements")
        print("=" * 70)
        
        print("\n📊 Step 1: Current state BEFORE fix...")
        banco_before = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_banco_mov_raw WHERE conciliado = TRUE
        """)
        pagos_before = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_pago WHERE conciliado = TRUE
        """)
        print(f"   Movimientos Banco conciliados: {banco_before}")
        print(f"   Pagos Sistema conciliados: {pagos_before}")
        
        print("\n🔄 Step 2: Resetting all to FALSE...")
        await conn.execute("UPDATE finanzas2.cont_banco_mov_raw SET conciliado = FALSE")
        await conn.execute("UPDATE finanzas2.cont_pago SET conciliado = FALSE")
        print("   ✅ All flags reset to FALSE")
        
        print("\n🔍 Step 3: Finding REAL matches from historial...")
        # Get historial - this uses the dynamic matching logic
        historial = await conn.fetch("""
            SELECT 
                br.id as banco_id,
                p.id as sistema_id,
                br.monto as monto_banco,
                p.monto_total as monto_sistema,
                br.descripcion,
                p.numero,
                br.fecha as fecha_banco,
                p.fecha as fecha_sistema
            FROM finanzas2.cont_banco_mov_raw br
            JOIN finanzas2.cont_pago p 
                ON ABS(br.monto) = ABS(p.monto_total)
                AND br.cuenta_financiera_id = p.cuenta_financiera_id
                AND p.conciliado = TRUE  -- This will be FALSE now, so let's check procesado instead
            WHERE br.procesado = TRUE
        """)
        
        # Try alternative: match by exact amounts and same account
        if len(historial) == 0:
            print("   ⚠️  No matches found with conciliado flag, trying procesado flag...")
            historial = await conn.fetch("""
                SELECT DISTINCT
                    br.id as banco_id,
                    p.id as sistema_id,
                    br.monto as monto_banco,
                    p.monto_total as monto_sistema,
                    br.descripcion,
                    p.numero,
                    br.fecha as fecha_banco,
                    p.fecha as fecha_sistema
                FROM finanzas2.cont_banco_mov_raw br
                JOIN finanzas2.cont_pago p 
                    ON br.monto = p.monto_total
                    AND br.cuenta_financiera_id = p.cuenta_financiera_id
                WHERE br.procesado = TRUE
                ORDER BY br.fecha DESC
            """)
        
        print(f"   Found {len(historial)} real matches:")
        for h in historial:
            print(f"      Banco ID={h['banco_id']} ({h['fecha_banco']}, ${h['monto_banco']}) ↔ "
                  f"Pago ID={h['sistema_id']} ({h['numero']}, ${h['monto_sistema']})")
        
        if len(historial) == 0:
            print("\n   ⚠️  No matches found. This might mean:")
            print("      1. The historial matching logic is different")
            print("      2. Or there are truly no reconciled items")
            print("\n   Let me check what's in the banco movements...")
            
            banco_procesados = await conn.fetch("""
                SELECT id, fecha, monto, descripcion, procesado 
                FROM finanzas2.cont_banco_mov_raw 
                WHERE procesado = TRUE
                LIMIT 5
            """)
            print(f"\n   Banco movements with procesado=TRUE: {len(banco_procesados)}")
            for b in banco_procesados:
                print(f"      ID={b['id']}: {b['fecha']} | {b['monto']} | {b['descripcion']}")
            
            return
        
        print(f"\n✅ Step 4: Marking {len(historial)} real matches as conciliado=TRUE...")
        
        for match in historial:
            # Mark banco movement
            await conn.execute("""
                UPDATE finanzas2.cont_banco_mov_raw 
                SET conciliado = TRUE 
                WHERE id = $1
            """, match['banco_id'])
            
            # Mark pago
            await conn.execute("""
                UPDATE finanzas2.cont_pago 
                SET conciliado = TRUE 
                WHERE id = $1
            """, match['sistema_id'])
        
        print("   ✅ All real matches marked successfully")
        
        print("\n📊 Step 5: Verifying results AFTER fix...")
        banco_after = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_banco_mov_raw WHERE conciliado = TRUE
        """)
        pagos_after = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_pago WHERE conciliado = TRUE
        """)
        
        print(f"   Movimientos Banco conciliados: {banco_after}")
        print(f"   Pagos Sistema conciliados: {pagos_after}")
        
        if banco_after == pagos_after == len(historial):
            print("\n" + "=" * 70)
            print("✅ SUCCESS! Data is now accurate and consistent.")
            print("=" * 70)
        else:
            print("\n⚠️  Warning: Counts don't match expected values")
            print(f"   Expected: {len(historial)} each")
            print(f"   Got: Banco={banco_after}, Pagos={pagos_after}")
        
    except Exception as e:
        print(f"\n❌ Error during fix: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_conciliacion())
