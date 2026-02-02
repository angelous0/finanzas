"""
Script para crear registros históricos de conciliaciones existentes
"""
import asyncio
import asyncpg
from datetime import date

async def main():
    DATABASE_URL = 'postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable'
    conn = await asyncpg.connect(dsn=DATABASE_URL)
    await conn.execute('SET search_path TO finanzas2, public')
    
    try:
        # Get all conciliados movements grouped by cuenta
        print("=== Creando registros históricos para conciliaciones existentes ===\n")
        
        # Get conciliados from banco
        banco_conciliados = await conn.fetch("""
            SELECT id, cuenta_financiera_id, monto, fecha
            FROM cont_banco_mov_raw 
            WHERE conciliado = TRUE
            ORDER BY cuenta_financiera_id, fecha
        """)
        
        # Get conciliados from pagos
        pagos_conciliados = await conn.fetch("""
            SELECT id, cuenta_financiera_id, monto_total, fecha
            FROM cont_pago 
            WHERE conciliado = TRUE
            ORDER BY cuenta_financiera_id, fecha
        """)
        
        print(f"Movimientos banco conciliados: {len(banco_conciliados)}")
        print(f"Pagos conciliados: {len(pagos_conciliados)}\n")
        
        # Group by cuenta_financiera_id
        cuentas_banco = {}
        for mov in banco_conciliados:
            cuenta_id = mov['cuenta_financiera_id']
            if cuenta_id not in cuentas_banco:
                cuentas_banco[cuenta_id] = []
            cuentas_banco[cuenta_id].append(mov)
        
        cuentas_pagos = {}
        for pago in pagos_conciliados:
            cuenta_id = pago['cuenta_financiera_id']
            if cuenta_id not in cuentas_pagos:
                cuentas_pagos[cuenta_id] = []
            cuentas_pagos[cuenta_id].append(pago)
        
        # Create conciliacion records for each cuenta
        all_cuentas = set(list(cuentas_banco.keys()) + list(cuentas_pagos.keys()))
        
        for cuenta_id in all_cuentas:
            banco_movs = cuentas_banco.get(cuenta_id, [])
            pago_movs = cuentas_pagos.get(cuenta_id, [])
            
            if not banco_movs and not pago_movs:
                continue
            
            total_banco = sum(float(m['monto']) for m in banco_movs)
            total_pagos = sum(float(p['monto_total']) for p in pago_movs)
            
            print(f"Cuenta {cuenta_id}: {len(banco_movs)} banco + {len(pago_movs)} pagos")
            
            # Create conciliacion record
            today = date.today()
            conciliacion = await conn.fetchrow("""
                INSERT INTO cont_conciliacion 
                (cuenta_financiera_id, fecha_inicio, fecha_fin, saldo_final, estado, notas)
                VALUES ($1, $2, $2, $3, 'completado', $4)
                RETURNING id
            """, cuenta_id, today, total_banco,
                f"Conciliación histórica: {len(banco_movs)} mov. banco + {len(pago_movs)} pagos")
            
            conciliacion_id = conciliacion['id']
            print(f"  ✅ Conciliación creada: ID {conciliacion_id}")
            
            # Create detail records for pagos
            for pago in pago_movs:
                await conn.execute("""
                    INSERT INTO cont_conciliacion_linea 
                    (conciliacion_id, pago_id, tipo, monto, conciliado)
                    VALUES ($1, $2, 'pago', $3, TRUE)
                """, conciliacion_id, pago['id'], pago['monto_total'])
            
            print(f"  ✅ {len(pago_movs)} detalles de pago creados\n")
        
        print("=== ✅ COMPLETADO ===")
        print(f"Total conciliaciones creadas: {len(all_cuentas)}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
