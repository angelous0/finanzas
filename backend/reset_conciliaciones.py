"""
Script para RESETEAR todas las conciliaciones y empezar de nuevo
"""
import asyncio
import asyncpg

async def reset_all():
    DATABASE_URL = 'postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable'
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    await conn.execute('SET search_path TO finanzas2, public')
    
    try:
        print("=== RESETEANDO TODAS LAS CONCILIACIONES ===\n")
        
        # 1. Eliminar todos los registros de conciliación
        print("1. Eliminando registros históricos de conciliaciones...")
        deleted_lineas = await conn.execute("DELETE FROM cont_conciliacion_linea")
        deleted_conciliaciones = await conn.execute("DELETE FROM cont_conciliacion")
        print(f"   ✅ {deleted_lineas} líneas de conciliación eliminadas")
        print(f"   ✅ {deleted_conciliaciones} registros de conciliación eliminados\n")
        
        # 2. Marcar TODOS los movimientos del banco como NO conciliados
        print("2. Marcando movimientos del banco como NO conciliados...")
        updated_banco = await conn.execute("""
            UPDATE cont_banco_mov_raw 
            SET conciliado = FALSE, procesado = FALSE
            WHERE conciliado = TRUE OR procesado = TRUE
        """)
        print(f"   ✅ {updated_banco} movimientos del banco actualizados\n")
        
        # 3. Marcar TODOS los pagos del sistema como NO conciliados
        print("3. Marcando pagos del sistema como NO conciliados...")
        updated_pagos = await conn.execute("""
            UPDATE cont_pago 
            SET conciliado = FALSE
            WHERE conciliado = TRUE
        """)
        print(f"   ✅ {updated_pagos} pagos del sistema actualizados\n")
        
        # 4. Verificar estado final
        print("4. Verificando estado final...")
        
        # Contar pendientes del banco
        banco_pendientes = await conn.fetchrow("""
            SELECT COUNT(*) as total FROM cont_banco_mov_raw WHERE conciliado = FALSE
        """)
        banco_conciliados = await conn.fetchrow("""
            SELECT COUNT(*) as total FROM cont_banco_mov_raw WHERE conciliado = TRUE
        """)
        
        # Contar pendientes del sistema
        pagos_pendientes = await conn.fetchrow("""
            SELECT COUNT(*) as total FROM cont_pago WHERE conciliado = FALSE
        """)
        pagos_conciliados = await conn.fetchrow("""
            SELECT COUNT(*) as total FROM cont_pago WHERE conciliado = TRUE
        """)
        
        # Contar conciliaciones
        total_conciliaciones = await conn.fetchrow("""
            SELECT COUNT(*) as total FROM cont_conciliacion
        """)
        
        print("\n=== ESTADO FINAL ===")
        print(f"Movimientos Banco Pendientes: {banco_pendientes['total']}")
        print(f"Movimientos Banco Conciliados: {banco_conciliados['total']}")
        print(f"Pagos Sistema Pendientes: {pagos_pendientes['total']}")
        print(f"Pagos Sistema Conciliados: {pagos_conciliados['total']}")
        print(f"Total Conciliaciones en Historial: {total_conciliaciones['total']}")
        
        print("\n✅ ¡RESETEO COMPLETADO!")
        print("Ahora puedes empezar a conciliar desde cero.")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(reset_all())
