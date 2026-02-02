"""
Migration: Add conciliado column to cont_movimiento_banco and update existing records
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def migrate():
    # Connect to database
    db_url = os.getenv('DATABASE_URL') or os.getenv('MONGO_URL')
    if not db_url or 'mongodb' in db_url:
        # Use default PostgreSQL connection
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='postgres',
            database='finanzas'
        )
    else:
        conn = await asyncpg.connect(db_url)
    
    try:
        await conn.execute("SET search_path TO finanzas2, public")
        
        print("🔧 Step 1: Adding 'conciliado' column to cont_banco_mov_raw...")
        await conn.execute("""
            ALTER TABLE finanzas2.cont_banco_mov_raw 
            ADD COLUMN IF NOT EXISTS conciliado BOOLEAN DEFAULT FALSE
        """)
        print("✅ Column added successfully")
        
        print("\n🔧 Step 2: Creating index on conciliado column...")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_banco_mov_raw_conciliado 
            ON finanzas2.cont_banco_mov_raw(conciliado)
        """)
        print("✅ Index created successfully")
        
        print("\n🔧 Step 3: Setting conciliado based on procesado flag...")
        # The column 'conciliado' will mirror 'procesado' for banco movements
        result = await conn.execute("""
            UPDATE finanzas2.cont_banco_mov_raw
            SET conciliado = procesado
        """)
        print(f"✅ Updated banco movements: conciliado now matches procesado")
        
        print("\n🔧 Step 4: Verifying results...")
        # Count conciliados
        banco_conciliados = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_banco_mov_raw WHERE conciliado = TRUE
        """)
        banco_procesados = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_banco_mov_raw WHERE procesado = TRUE
        """)
        pagos_conciliados = await conn.fetchval("""
            SELECT COUNT(*) FROM finanzas2.cont_pago WHERE conciliado = TRUE
        """)
        
        print(f"   Movimientos banco conciliados: {banco_conciliados}")
        print(f"   Movimientos banco procesados: {banco_procesados}")
        print(f"   Pagos sistema conciliados: {pagos_conciliados}")
        
        if banco_conciliados == historial_count and pagos_conciliados == historial_count:
            print("\n✅ Migration completed successfully! All records are consistent.")
        else:
            print(f"\n⚠️  Warning: Counts don't match. Please review.")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())
