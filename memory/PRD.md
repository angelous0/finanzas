# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera con múltiples módulos: Órdenes de Compra, Facturas Proveedor, Gastos, Pagos, Letras, Planilla, Adelantos, CxP, Conciliación Bancaria, etc. Conectado a PostgreSQL con schemas `finanzas2` y `produccion`.

## Arquitectura
- **Backend:** FastAPI + asyncpg (PostgreSQL) - `/app/backend/server.py`
- **Frontend:** React + Tailwind CSS - `/app/frontend/src/`
- **Base de datos:** PostgreSQL con schemas `finanzas2` (contabilidad) y `produccion` (artículos)

## Lo implementado

### Sesiones anteriores
- Cálculo IGV en Órdenes de Compra (flag igv_incluido)
- Filtro por empresa_id en Adelantos y Planilla
- Bug de saldo en CxP al pagar Letras
- Bugs visuales en modal de Letras
- Migración de fuente de datos de artículos a schema `produccion`
- Rediseño UI de Categorías (vista jerárquica, edición)
- Jerarquía de categorías en vistas de detalle de Facturas y Gastos
- Testeo financiero exhaustivo

### Sesión actual (2026-02-09)
- Jerarquía de categorías en formularios de creación/edición de Facturas y Gastos (endpoint `/api/categorias` devuelve `nombre_completo`)
- Aumento de ancho del formulario de Gastos (modal-xl = 1100px)
- Fix de modelos Pydantic (FacturaLinea, GastoLinea) para exponer campos de categoría padre

## Backlog Priorizado

### P1
- Investigar venta B003-17918 con pagos duplicados

### P2 (Refactoring)
- Simplificar consultas SQL repetitivas en contabilidad.py (JOINs de categorías) - considerar vistas de BD

## Endpoints clave
- `/api/categorias` - GET (con nombre_completo), POST, PUT, DELETE
- `/api/facturas-proveedor` - CRUD
- `/api/gastos` - CRUD
- `/api/letras-proveedor/{id}/pagar` - Actualiza saldos en cxp y factura
- `/api/articulos`, `/api/inventario`, `/api/modelos-cortes` - Schema produccion

## Schema BD clave
- `cont_categoria`: {id, nombre, tipo, padre_id}
- `cont_factura_proveedor`: {id, numero_factura, total, saldo_pendiente}
- `cont_cxp`: {id, factura_id, monto_original, saldo, estado}
- `cont_letras_proveedor`: {id, cxp_id, monto, saldo, estado}
- `produccion.prod_inventario`: {id (UUID), nombre, codigo}
