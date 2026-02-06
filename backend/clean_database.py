"""
Script de limpieza de base de datos Finanzas 4.0
Elimina TODOS los datos transaccionales, preservando catálogos base.
"""
import asyncio
import asyncpg

DATABASE_URL = "postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable"

TABLES_TO_CLEAN = [
    # Dependencias primero (tablas hijas)
    "finanzas2.cont_conciliacion_linea",
    "finanzas2.cont_conciliacion",
    "finanzas2.cont_movimiento_bancario",
    "finanzas2.cont_planilla_detalle",
    "finanzas2.cont_planilla",
    "finanzas2.cont_adelanto_empleado",
    "finanzas2.cont_pago_detalle",
    "finanzas2.cont_pago",
    "finanzas2.cont_letra",
    "finanzas2.cont_factura_proveedor_linea",
    "finanzas2.cont_factura_proveedor",
    "finanzas2.cont_cxp",
    "finanzas2.cont_oc_linea",
    "finanzas2.cont_oc",
    "finanzas2.cont_gasto_linea",
    "finanzas2.cont_gasto",
    "finanzas2.cont_venta_pos_linea",
    "finanzas2.cont_venta_pos",
]

async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        for table in TABLES_TO_CLEAN:
            try:
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
                await conn.execute(f"DELETE FROM {table}")
                print(f"  Limpiado {table}: {count} registros eliminados")
            except Exception as e:
                print(f"  Saltado {table}: {e}")
        
        # Reset sequences
        sequences = await conn.fetch("""
            SELECT sequence_name FROM information_schema.sequences 
            WHERE sequence_schema = 'finanzas2'
        """)
        for seq in sequences:
            sname = seq['sequence_name']
            # Only reset sequences for transactional tables
            skip_keywords = ['empresa', 'moneda', 'tipo_cambio', 'categoria', 'centro_costo', 
                           'linea_negocio', 'cuenta_financiera', 'tercero', 'empleado_detalle']
            if not any(kw in sname for kw in skip_keywords):
                try:
                    await conn.execute(f"ALTER SEQUENCE finanzas2.{sname} RESTART WITH 1")
                    print(f"  Secuencia reiniciada: {sname}")
                except:
                    pass
        
        print("\n=== LIMPIEZA COMPLETADA ===")
        
        # Verify catalogs preserved
        empresas = await conn.fetchval("SELECT COUNT(*) FROM finanzas2.cont_empresa")
        monedas = await conn.fetchval("SELECT COUNT(*) FROM finanzas2.cont_moneda")
        categorias = await conn.fetchval("SELECT COUNT(*) FROM finanzas2.cont_categoria")
        terceros = await conn.fetchval("SELECT COUNT(*) FROM finanzas2.cont_tercero")
        cuentas = await conn.fetchval("SELECT COUNT(*) FROM finanzas2.cont_cuenta_financiera")
        print(f"\nCatálogos preservados:")
        print(f"  Empresas: {empresas}")
        print(f"  Monedas: {monedas}")
        print(f"  Categorías: {categorias}")
        print(f"  Terceros (prov+empl): {terceros}")
        print(f"  Cuentas financieras: {cuentas}")
        
    finally:
        await conn.close()

asyncio.run(main())
