"""
Migration: Add empresa_id to all transactional and config-per-empresa tables.
Global tables (cont_moneda, cont_tipo_cambio, cont_empresa) are excluded.
Steps: 1) Add nullable column  2) Backfill with empresa_id=3  3) Set NOT NULL + FK + index
"""
import asyncio
import asyncpg

DATABASE_URL = 'postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable'
DEFAULT_EMPRESA_ID = 3

# Tables that ALREADY have empresa_id column (just need backfill + NOT NULL)
TABLES_WITH_COLUMN = [
    'cont_adelanto_empleado', 'cont_conciliacion', 'cont_conciliacion_linea',
    'cont_cuenta_financiera', 'cont_cxc', 'cont_cxp',
    'cont_factura_proveedor', 'cont_gasto', 'cont_letra',
    'cont_oc', 'cont_pago', 'cont_planilla', 'cont_tercero',
]

# Tables that NEED empresa_id column added
TABLES_NEED_COLUMN = [
    'cont_categoria', 'cont_centro_costo', 'cont_linea_negocio',
    'cont_presupuesto', 'cont_presupuesto_linea',
    'cont_banco_mov', 'cont_banco_mov_raw',
    'cont_venta_pos', 'cont_venta_pos_pago', 'cont_venta_pos_linea',
    'cont_articulo_ref', 'cont_empleado_detalle',
    'cont_oc_linea', 'cont_factura_proveedor_linea',
    'cont_gasto_linea', 'cont_pago_detalle', 'cont_pago_aplicacion',
    'cont_planilla_detalle',
]

ALL_TABLES = TABLES_WITH_COLUMN + TABLES_NEED_COLUMN


async def migrate():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Step 1: Add nullable empresa_id column where missing
        print("=== Step 1: Adding empresa_id columns ===")
        for table in TABLES_NEED_COLUMN:
            try:
                await conn.execute(f"""
                    ALTER TABLE finanzas2.{table}
                    ADD COLUMN IF NOT EXISTS empresa_id INTEGER
                """)
                print(f"  + {table}: column added (or already exists)")
            except Exception as e:
                print(f"  ! {table}: {e}")

        # Step 2: Backfill NULLs with default empresa
        print(f"\n=== Step 2: Backfill NULLs with empresa_id={DEFAULT_EMPRESA_ID} ===")
        for table in ALL_TABLES:
            try:
                result = await conn.execute(f"""
                    UPDATE finanzas2.{table}
                    SET empresa_id = {DEFAULT_EMPRESA_ID}
                    WHERE empresa_id IS NULL
                """)
                count = int(result.split()[-1])
                if count > 0:
                    print(f"  ~ {table}: {count} rows updated")
                else:
                    print(f"  . {table}: no NULLs")
            except Exception as e:
                print(f"  ! {table}: {e}")

        # Step 3: Set NOT NULL constraint
        print("\n=== Step 3: Set NOT NULL ===")
        for table in ALL_TABLES:
            try:
                await conn.execute(f"""
                    ALTER TABLE finanzas2.{table}
                    ALTER COLUMN empresa_id SET NOT NULL
                """)
                print(f"  + {table}: NOT NULL set")
            except Exception as e:
                if 'already' in str(e).lower() or 'contain null' not in str(e).lower():
                    print(f"  . {table}: already NOT NULL or {e}")
                else:
                    print(f"  ! {table}: {e}")

        # Step 4: Add FK constraints (skip if already exists)
        print("\n=== Step 4: Add FK constraints ===")
        for table in ALL_TABLES:
            fk_name = f"fk_{table}_empresa"
            try:
                exists = await conn.fetchval(f"""
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = '{fk_name}'
                    AND table_schema = 'finanzas2'
                """)
                if not exists:
                    await conn.execute(f"""
                        ALTER TABLE finanzas2.{table}
                        ADD CONSTRAINT {fk_name}
                        FOREIGN KEY (empresa_id) REFERENCES finanzas2.cont_empresa(id)
                    """)
                    print(f"  + {table}: FK added")
                else:
                    print(f"  . {table}: FK already exists")
            except Exception as e:
                print(f"  ! {table}: {e}")

        # Step 5: Add indexes for empresa_id
        print("\n=== Step 5: Add indexes ===")
        for table in ALL_TABLES:
            idx_name = f"idx_{table}_empresa_id"
            try:
                await conn.execute(f"""
                    CREATE INDEX IF NOT EXISTS {idx_name}
                    ON finanzas2.{table}(empresa_id)
                """)
                print(f"  + {table}: index created")
            except Exception as e:
                print(f"  ! {table}: {e}")

        # Verify
        print("\n=== Verification ===")
        for table in ALL_TABLES:
            total = await conn.fetchval(f"SELECT COUNT(*) FROM finanzas2.{table}")
            nulls = await conn.fetchval(f"SELECT COUNT(*) FROM finanzas2.{table} WHERE empresa_id IS NULL")
            print(f"  {table}: total={total}, nulls={nulls}")

        print("\n=== Migration complete ===")

    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(migrate())
