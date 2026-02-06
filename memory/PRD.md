# Finanzas 4.0 - Product Requirements Document

## Original Problem Statement
Create a QuickBooks-like system for treasury, control, and minimal accounting called "Finanzas 4.0" using PostgreSQL.

## Database Configuration
- **PostgreSQL**: `postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable`
- **Schema**: `finanzas2` for all new objects
- **Table prefix**: `cont_` (e.g., `cont_factura_proveedor`)
- **External tables referenced**: `public.prod_inventario`, `public.prod_registros`, `public.prod_modelos`

## Odoo Credentials
- **Empresa Ambission**: URL: `https://ambission.app-gestion.net`, DB: `ambission`, User: `admin_ambission@ambission.com`, Pass: `ambission123`
- **Empresa Proyecto Moda**: URL: `https://ambission.app-gestion.net`, DB: `ambission`, User: `proyectomoda@ambission.com`, Pass: `proyectomoda123`

## Tech Stack
- **Backend**: FastAPI + PostgreSQL (asyncpg)
- **Frontend**: React + TailwindCSS + Shadcn/UI

---

## Modules & Status

### Complete Modules
1. **Base Catalogs** - Empresas, Monedas, Categorías, Centros Costo, Líneas Negocio, Cuentas Financieras, Terceros
2. **Órdenes de Compra** - CRUD + conversión a factura + cálculo IGV incluido/excluido
3. **Facturas Proveedor** - CRUD + líneas + CxP automática
4. **Pagos Centralizados** - Pagos parciales, múltiples métodos, aplicaciones a facturas/letras
5. **Letras de Cambio** - Generación desde factura, pagos parciales, estados
6. **Gastos** - Con pago inmediato obligatorio, múltiples métodos de pago
7. **Adelantos Empleado** - Creación, pago, descuento en planilla
8. **Planilla** - Generación con detalles por empleado, pago masivo
9. **Ventas POS** - Sincronización Odoo, confirmación, pagos
10. **Conciliación Bancaria** - Importación Excel, conciliación manual/automática
11. **CxP / CxC** - Tracking automático de cuentas por pagar/cobrar

### Pending Modules
- Presupuestos (cont_presupuesto)
- Reportes financieros (Flujo de caja, Estado de resultados, Balance)

---

## Recent Work (2026-02-06)

### Exhaustive Financial Test - COMPLETE
- Database cleaned and all transactional data recreated from scratch
- 10/10 flows tested successfully:
  - OC → Factura → Pagos parciales → Pagada
  - Factura → 3 Letras → Pago completo + parcial
  - Gastos con pago inmediato (efectivo + transferencia)
  - Adelantos con pago inmediato y posterior
  - Planilla con descuento de adelantos + pago masivo
  - Ventas POS sync Odoo + confirmación
  - OC con IGV incluido vs excluido
  - Dashboard KPIs verificados

### IGV Calculation Fix (2026-02-05)
- Added `igv_incluido` flag to OCCreate model
- Backend correctly handles both modes

### Company Filter (2026-02-05)
- Adelantos and Planilla endpoints accept `empresa_id`

---

## Priority Backlog

### P1 (High)
- Visual dashboard/reports for Ventas POS
- Print/email PDF receipt for sales
- Refactor server.py into modular routers

### P2 (Medium)
- Alerts/notifications for pending sales
- Budgets module
- Financial Reports

### P3 (Low)
- Refactor large frontend components
- Balance Sheet report

## Key Files
- `/app/backend/server.py` - All API endpoints
- `/app/backend/models.py` - Pydantic models
- `/app/frontend/src/pages/` - All page components
- `/app/frontend/src/services/api.js` - API client
- `/app/test_reports/iteration_4.json` - Latest test results
