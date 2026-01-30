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
- **Backend**: FastAPI + PostgreSQL (asyncpg) + SQLAlchemy
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **UI Components**: `/app/frontend/src/components/ui/`

---

## Modules & Status

### 1. Base Catalogs ✅ COMPLETE
- `cont_empresa` - CRUD complete with edit
- `cont_moneda` - Working
- `cont_tipo_cambio` - Working
- `cont_categoria` - CRUD complete
- `cont_centro_costo` - CRUD complete
- `cont_linea_negocio` - CRUD complete
- `cont_cuenta_financiera` - Working
- `cont_tercero` - CRUD complete (proveedores)

### UI Components Created (2026-01-30):
- `SearchableSelect.jsx` - Searchable dropdown for forms with create new option
- `TableSearchSelect.jsx` - Compact searchable dropdown for table cells

### 2. Supplier Invoice (Factura Proveedor) ✅ COMPLETE
**Completed (2026-01-30):**
- UI modal matching user's screenshot
- Hide "beneficiario" field when proveedor selected
- "Detalles del artículo" section with:
  - ARTÍCULO dropdown from `public.prod_inventario`
  - MODELO/CORTE dropdown from `public.prod_registros` + `prod_modelos`
  - Auto-fill UND and PRECIO from inventory
  - IMPORTE auto-calculation
  - IGV checkbox
  - Add/duplicate/remove article actions
- CxP auto-created when saving invoice ✅

### 3. Accounts Payable (CxP) ✅ COMPLETE
- CxP auto-created when invoice is saved
- CxP saldo updates when payments are applied
- CxP estado syncs with invoice (pendiente → parcial → pagado)

### 4. Centralized Payments ✅ COMPLETE
- Partial payments supported
- Multi-method payments (transferencia, efectivo, cheque, tarjeta)
- Auto-updates invoice saldo and estado
- Auto-updates CxP saldo and estado
- Tested: 500 invoice → 300 partial → 200 final = pagado

### 5. Purchase Orders (OC) ✅ SCAFFOLDED
- `cont_oc`, `cont_oc_linea` tables created
- Basic CRUD endpoints exist
- Print functionality pending
- Conversion to invoice pending

### 6. Bills of Exchange (Letras) 🔴 NOT IMPLEMENTED
- `cont_letra` table exists
- Generate from invoices pending
- Change invoice status to "CANJEADO" pending

### 7. Expenses (Gastos) 🔴 NOT IMPLEMENTED
- `cont_gasto` table exists
- Force immediate payment on creation pending

### 8. Payroll 🔴 NOT IMPLEMENTED
- `cont_adelanto_empleado`, `cont_planilla` tables exist
- Employee management pending
- Payroll calculation pending

### 9. POS Sales (Ventas POS) 🔴 NOT IMPLEMENTED
- Odoo integration pending
- `odoo_service.py` has placeholder code

### 10. Budgets 🔴 NOT IMPLEMENTED
- `cont_presupuesto` table exists
- Budget vs actual reporting pending

### 11. Bank Reconciliation 🔴 NOT IMPLEMENTED
- Excel import pending
- Reconciliation logic pending

### 12. Reports 🔴 NOT IMPLEMENTED
- Cash Flow report pending
- Income Statement pending
- Balance Sheet pending

---

## Key Files
- `/app/backend/server.py` - All API endpoints (monolithic, needs refactoring)
- `/app/backend/models.py` - SQLAlchemy models
- `/app/backend/database.py` - DB connection
- `/app/frontend/src/pages/FacturasProveedor.jsx` - Supplier invoice page
- `/app/frontend/src/services/api.js` - API client functions

## API Endpoints Added (2026-01-30)
- `GET /api/inventario` - List items from `public.prod_inventario`
- `GET /api/modelos-cortes` - List modelos/cortes from `public.prod_registros`
- `GET /api/modelos` - List models from `public.prod_modelos`

---

## Priority Backlog

### P0 (Critical)
1. Implement CxP auto-creation on invoice save
2. Implement payment application logic

### P1 (High)
3. Odoo integration for POS sales
4. Complete CRUD for base catalogs
5. OC to Invoice conversion

### P2 (Medium)
6. Bills of Exchange (Letras) module
7. Expenses module with immediate payment
8. Payroll module

### P3 (Low)
9. Budgets vs Actual
10. Bank Reconciliation
11. Financial Reports
12. Refactor server.py into multiple routers
