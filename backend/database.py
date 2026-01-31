import os
import asyncpg
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Global connection pool
pool: Optional[asyncpg.Pool] = None

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable')

async def init_db():
    """Initialize PostgreSQL connection pool and create schema"""
    global pool
    try:
        logger.info(f"Connecting to PostgreSQL...")
        pool = await asyncpg.create_pool(
            dsn=DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("PostgreSQL connection pool created successfully")
        
        # Create schema and tables
        await create_schema()
        return pool
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        raise

async def get_pool() -> asyncpg.Pool:
    """Get the database connection pool"""
    global pool
    if pool is None:
        await init_db()
    return pool

async def close_db():
    """Close the database connection pool"""
    global pool
    if pool:
        await pool.close()
        pool = None
        logger.info("PostgreSQL connection pool closed")

async def create_schema():
    """Create the finanzas2 schema and all tables"""
    global pool
    if not pool:
        return
    
    async with pool.acquire() as conn:
        # Create schema
        await conn.execute("CREATE SCHEMA IF NOT EXISTS finanzas2")
        await conn.execute("SET search_path TO finanzas2, public")
        
        # Create ENUMs
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.tipo_tercero AS ENUM ('cliente', 'proveedor', 'personal');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.tipo_categoria AS ENUM ('ingreso', 'egreso');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.estado_oc AS ENUM ('borrador', 'enviada', 'recibida', 'facturada', 'cancelada');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.estado_factura AS ENUM ('pendiente', 'parcial', 'pagado', 'canjeado', 'anulada');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.estado_letra AS ENUM ('pendiente', 'parcial', 'pagada', 'vencida', 'protestada', 'anulada');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.tipo_pago AS ENUM ('ingreso', 'egreso');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)
        
        await conn.execute("""
            DO $$ BEGIN
                CREATE TYPE finanzas2.estado_presupuesto AS ENUM ('borrador', 'aprobado', 'cerrado');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        """)

        # cont_empresa
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_empresa (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(200) NOT NULL,
                ruc VARCHAR(20),
                direccion TEXT,
                telefono VARCHAR(50),
                email VARCHAR(100),
                logo_url TEXT,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_moneda
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_moneda (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(10) NOT NULL UNIQUE,
                nombre VARCHAR(50) NOT NULL,
                simbolo VARCHAR(5) NOT NULL,
                es_principal BOOLEAN DEFAULT FALSE,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_tipo_cambio
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_tipo_cambio (
                id SERIAL PRIMARY KEY,
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                fecha DATE NOT NULL,
                tasa_compra DECIMAL(12, 4) NOT NULL,
                tasa_venta DECIMAL(12, 4) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(moneda_id, fecha)
            )
        """)

        # cont_categoria (jerárquica)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_categoria (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(20),
                nombre VARCHAR(100) NOT NULL,
                tipo finanzas2.tipo_categoria NOT NULL,
                padre_id INTEGER REFERENCES finanzas2.cont_categoria(id),
                descripcion TEXT,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_centro_costo
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_centro_costo (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(20),
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_linea_negocio
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_linea_negocio (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(20),
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_cuenta_financiera (banco/caja)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_cuenta_financiera (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                tipo VARCHAR(20) NOT NULL, -- banco, caja
                banco VARCHAR(100),
                numero_cuenta VARCHAR(50),
                cci VARCHAR(30),
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                saldo_actual DECIMAL(15, 2) DEFAULT 0,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_tercero (unificado)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_tercero (
                id SERIAL PRIMARY KEY,
                tipo_documento VARCHAR(20), -- DNI, RUC, CE, etc
                numero_documento VARCHAR(20),
                nombre VARCHAR(200) NOT NULL,
                nombre_comercial VARCHAR(200),
                direccion TEXT,
                telefono VARCHAR(50),
                email VARCHAR(100),
                es_cliente BOOLEAN DEFAULT FALSE,
                es_proveedor BOOLEAN DEFAULT FALSE,
                es_personal BOOLEAN DEFAULT FALSE,
                terminos_pago_dias INTEGER DEFAULT 0,
                limite_credito DECIMAL(15, 2) DEFAULT 0,
                notas TEXT,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_empleado_detalle (extensión para personal)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_empleado_detalle (
                id SERIAL PRIMARY KEY,
                tercero_id INTEGER REFERENCES finanzas2.cont_tercero(id) UNIQUE,
                fecha_ingreso DATE,
                cargo VARCHAR(100),
                salario_base DECIMAL(12, 2),
                cuenta_bancaria VARCHAR(50),
                banco VARCHAR(100),
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_articulo_ref (referencia a public.prod_inventario)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_articulo_ref (
                id SERIAL PRIMARY KEY,
                prod_inventario_id INTEGER,
                codigo VARCHAR(50),
                nombre VARCHAR(200),
                descripcion TEXT,
                precio_referencia DECIMAL(12, 2),
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_oc (Órdenes de Compra)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_oc (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(20) NOT NULL UNIQUE,
                fecha DATE NOT NULL,
                proveedor_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                estado finanzas2.estado_oc DEFAULT 'borrador',
                subtotal DECIMAL(15, 2) DEFAULT 0,
                igv DECIMAL(15, 2) DEFAULT 0,
                total DECIMAL(15, 2) DEFAULT 0,
                notas TEXT,
                factura_generada_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_oc_linea
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_oc_linea (
                id SERIAL PRIMARY KEY,
                oc_id INTEGER REFERENCES finanzas2.cont_oc(id) ON DELETE CASCADE,
                articulo_id INTEGER REFERENCES finanzas2.cont_articulo_ref(id),
                descripcion TEXT,
                cantidad DECIMAL(12, 4) NOT NULL,
                precio_unitario DECIMAL(12, 4) NOT NULL,
                igv_aplica BOOLEAN DEFAULT TRUE,
                subtotal DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_factura_proveedor
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_factura_proveedor (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(30) NOT NULL,
                proveedor_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                beneficiario_nombre VARCHAR(200),
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                fecha_factura DATE NOT NULL,
                fecha_vencimiento DATE,
                terminos_dias INTEGER DEFAULT 0,
                tipo_documento VARCHAR(20) DEFAULT 'factura',
                estado finanzas2.estado_factura DEFAULT 'pendiente',
                subtotal DECIMAL(15, 2) DEFAULT 0,
                igv DECIMAL(15, 2) DEFAULT 0,
                total DECIMAL(15, 2) DEFAULT 0,
                saldo_pendiente DECIMAL(15, 2) DEFAULT 0,
                impuestos_incluidos BOOLEAN DEFAULT FALSE,
                notas TEXT,
                oc_origen_id INTEGER REFERENCES finanzas2.cont_oc(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_factura_proveedor_linea
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_factura_proveedor_linea (
                id SERIAL PRIMARY KEY,
                factura_id INTEGER REFERENCES finanzas2.cont_factura_proveedor(id) ON DELETE CASCADE,
                categoria_id INTEGER REFERENCES finanzas2.cont_categoria(id),
                articulo_id INTEGER REFERENCES finanzas2.cont_articulo_ref(id),
                descripcion TEXT,
                linea_negocio_id INTEGER REFERENCES finanzas2.cont_linea_negocio(id),
                centro_costo_id INTEGER REFERENCES finanzas2.cont_centro_costo(id),
                importe DECIMAL(15, 2) NOT NULL,
                igv_aplica BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_cxp (Cuentas por Pagar)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_cxp (
                id SERIAL PRIMARY KEY,
                factura_id INTEGER REFERENCES finanzas2.cont_factura_proveedor(id) ON DELETE CASCADE UNIQUE,
                proveedor_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                monto_original DECIMAL(15, 2) NOT NULL,
                saldo_pendiente DECIMAL(15, 2) NOT NULL,
                fecha_vencimiento DATE,
                estado finanzas2.estado_factura DEFAULT 'pendiente',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_pago
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_pago (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(20) NOT NULL,
                tipo finanzas2.tipo_pago NOT NULL,
                fecha DATE NOT NULL,
                cuenta_financiera_id INTEGER REFERENCES finanzas2.cont_cuenta_financiera(id),
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                monto_total DECIMAL(15, 2) NOT NULL,
                referencia VARCHAR(100),
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_pago_detalle (multi-medio)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_pago_detalle (
                id SERIAL PRIMARY KEY,
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id) ON DELETE CASCADE,
                cuenta_financiera_id INTEGER REFERENCES finanzas2.cont_cuenta_financiera(id),
                medio_pago VARCHAR(50) NOT NULL, -- efectivo, transferencia, cheque, tarjeta
                monto DECIMAL(15, 2) NOT NULL,
                referencia VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_pago_aplicacion (vincula pagos con documentos)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_pago_aplicacion (
                id SERIAL PRIMARY KEY,
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id) ON DELETE CASCADE,
                tipo_documento VARCHAR(50) NOT NULL, -- factura, letra, gasto, planilla, adelanto, cxc
                documento_id INTEGER NOT NULL,
                monto_aplicado DECIMAL(15, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_letra
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_letra (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(30) NOT NULL,
                factura_id INTEGER REFERENCES finanzas2.cont_factura_proveedor(id),
                proveedor_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                monto DECIMAL(15, 2) NOT NULL,
                fecha_emision DATE NOT NULL,
                fecha_vencimiento DATE NOT NULL,
                estado finanzas2.estado_letra DEFAULT 'pendiente',
                saldo_pendiente DECIMAL(15, 2) NOT NULL,
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_gasto
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_gasto (
                id SERIAL PRIMARY KEY,
                numero VARCHAR(20) NOT NULL,
                fecha DATE NOT NULL,
                proveedor_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                beneficiario_nombre VARCHAR(200),
                moneda_id INTEGER REFERENCES finanzas2.cont_moneda(id),
                subtotal DECIMAL(15, 2) DEFAULT 0,
                igv DECIMAL(15, 2) DEFAULT 0,
                total DECIMAL(15, 2) DEFAULT 0,
                tipo_documento VARCHAR(20),
                numero_documento VARCHAR(50),
                notas TEXT,
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_gasto_linea
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_gasto_linea (
                id SERIAL PRIMARY KEY,
                gasto_id INTEGER REFERENCES finanzas2.cont_gasto(id) ON DELETE CASCADE,
                categoria_id INTEGER REFERENCES finanzas2.cont_categoria(id),
                descripcion TEXT,
                linea_negocio_id INTEGER REFERENCES finanzas2.cont_linea_negocio(id),
                centro_costo_id INTEGER REFERENCES finanzas2.cont_centro_costo(id),
                importe DECIMAL(15, 2) NOT NULL,
                igv_aplica BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_adelanto_empleado
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_adelanto_empleado (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                fecha DATE NOT NULL,
                monto DECIMAL(12, 2) NOT NULL,
                motivo TEXT,
                pagado BOOLEAN DEFAULT FALSE,
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id),
                descontado BOOLEAN DEFAULT FALSE,
                planilla_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_planilla
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_planilla (
                id SERIAL PRIMARY KEY,
                periodo VARCHAR(20) NOT NULL, -- 2024-01-Q1, 2024-01-Q2
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                total_bruto DECIMAL(15, 2) DEFAULT 0,
                total_adelantos DECIMAL(15, 2) DEFAULT 0,
                total_descuentos DECIMAL(15, 2) DEFAULT 0,
                total_neto DECIMAL(15, 2) DEFAULT 0,
                estado VARCHAR(20) DEFAULT 'borrador', -- borrador, aprobada, pagada
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_planilla_detalle
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_planilla_detalle (
                id SERIAL PRIMARY KEY,
                planilla_id INTEGER REFERENCES finanzas2.cont_planilla(id) ON DELETE CASCADE,
                empleado_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                salario_base DECIMAL(12, 2) DEFAULT 0,
                bonificaciones DECIMAL(12, 2) DEFAULT 0,
                adelantos DECIMAL(12, 2) DEFAULT 0,
                otros_descuentos DECIMAL(12, 2) DEFAULT 0,
                neto_pagar DECIMAL(12, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_venta_pos (desde Odoo)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_venta_pos (
                id SERIAL PRIMARY KEY,
                odoo_id INTEGER UNIQUE,
                date_order TIMESTAMP,
                name VARCHAR(100),
                tipo_comp VARCHAR(50),
                num_comp VARCHAR(50),
                partner_id INTEGER,
                partner_name VARCHAR(200),
                tienda_id INTEGER,
                tienda_name VARCHAR(200),
                vendedor_id INTEGER,
                vendedor_name VARCHAR(200),
                company_id INTEGER,
                company_name VARCHAR(200),
                x_pagos TEXT,
                quantity_total DECIMAL(12, 4),
                amount_total DECIMAL(15, 2),
                state VARCHAR(50),
                reserva_pendiente DECIMAL(15, 2) DEFAULT 0,
                reserva_facturada DECIMAL(15, 2) DEFAULT 0,
                is_cancel BOOLEAN DEFAULT FALSE,
                order_cancel VARCHAR(100),
                reserva BOOLEAN DEFAULT FALSE,
                is_credit BOOLEAN DEFAULT FALSE,
                reserva_use_id INTEGER,
                estado_local VARCHAR(50) DEFAULT 'pendiente',
                cxc_id INTEGER,
                synced_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # cont_venta_pos_pago (pagos asignados manualmente a ventas POS)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_venta_pos_pago (
                id SERIAL PRIMARY KEY,
                venta_pos_id INTEGER REFERENCES finanzas2.cont_venta_pos(id) ON DELETE CASCADE,
                forma_pago VARCHAR(50) NOT NULL,
                monto DECIMAL(15, 2) NOT NULL,
                referencia VARCHAR(100),
                fecha_pago DATE DEFAULT CURRENT_DATE,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                created_by VARCHAR(100)
            )
        """)
        
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_venta_pos_pago_venta 
            ON finanzas2.cont_venta_pos_pago(venta_pos_id)
        """)

        # cont_cxc (Cuentas por Cobrar)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_cxc (
                id SERIAL PRIMARY KEY,
                venta_pos_id INTEGER REFERENCES finanzas2.cont_venta_pos(id),
                cliente_id INTEGER REFERENCES finanzas2.cont_tercero(id),
                monto_original DECIMAL(15, 2) NOT NULL,
                saldo_pendiente DECIMAL(15, 2) NOT NULL,
                fecha_vencimiento DATE,
                estado VARCHAR(20) DEFAULT 'pendiente',
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_presupuesto
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_presupuesto (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                anio INTEGER NOT NULL,
                version INTEGER DEFAULT 1,
                estado finanzas2.estado_presupuesto DEFAULT 'borrador',
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_presupuesto_linea
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_presupuesto_linea (
                id SERIAL PRIMARY KEY,
                presupuesto_id INTEGER REFERENCES finanzas2.cont_presupuesto(id) ON DELETE CASCADE,
                categoria_id INTEGER REFERENCES finanzas2.cont_categoria(id),
                centro_costo_id INTEGER REFERENCES finanzas2.cont_centro_costo(id),
                linea_negocio_id INTEGER REFERENCES finanzas2.cont_linea_negocio(id),
                mes INTEGER NOT NULL, -- 1-12
                monto_presupuestado DECIMAL(15, 2) DEFAULT 0,
                monto_real DECIMAL(15, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_banco_mov_raw (movimientos importados)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_banco_mov_raw (
                id SERIAL PRIMARY KEY,
                cuenta_financiera_id INTEGER REFERENCES finanzas2.cont_cuenta_financiera(id),
                banco VARCHAR(50),
                fecha DATE,
                descripcion TEXT,
                referencia VARCHAR(100),
                cargo DECIMAL(15, 2),
                abono DECIMAL(15, 2),
                saldo DECIMAL(15, 2),
                raw_data JSONB,
                procesado BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_banco_mov (normalizado)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_banco_mov (
                id SERIAL PRIMARY KEY,
                raw_id INTEGER REFERENCES finanzas2.cont_banco_mov_raw(id),
                cuenta_financiera_id INTEGER REFERENCES finanzas2.cont_cuenta_financiera(id),
                fecha DATE NOT NULL,
                tipo VARCHAR(20) NOT NULL, -- cargo, abono
                monto DECIMAL(15, 2) NOT NULL,
                descripcion TEXT,
                referencia VARCHAR(100),
                conciliado BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_conciliacion
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_conciliacion (
                id SERIAL PRIMARY KEY,
                cuenta_financiera_id INTEGER REFERENCES finanzas2.cont_cuenta_financiera(id),
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                saldo_inicial DECIMAL(15, 2),
                saldo_final DECIMAL(15, 2),
                diferencia DECIMAL(15, 2),
                estado VARCHAR(20) DEFAULT 'borrador',
                notas TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # cont_conciliacion_linea
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS finanzas2.cont_conciliacion_linea (
                id SERIAL PRIMARY KEY,
                conciliacion_id INTEGER REFERENCES finanzas2.cont_conciliacion(id) ON DELETE CASCADE,
                banco_mov_id INTEGER REFERENCES finanzas2.cont_banco_mov(id),
                pago_id INTEGER REFERENCES finanzas2.cont_pago(id),
                tipo VARCHAR(50), -- pago, gasto, factura, ingreso
                documento_id INTEGER,
                monto DECIMAL(15, 2),
                conciliado BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        logger.info("Schema finanzas2 and all tables created successfully")
