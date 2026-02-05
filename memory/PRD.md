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
- **UI Components**: `/app/frontend/src/components/ui/`

---

## Modules & Status

### 1. Base Catalogs - COMPLETE
### 2. Supplier Invoice (Factura Proveedor) - COMPLETE
### 3. Accounts Payable (CxP) - COMPLETE
### 4. Centralized Payments - COMPLETE
### 5. Purchase Orders (OC) - COMPLETE
### 6. Bills of Exchange (Letras) - COMPLETE
### 7. Expenses (Gastos) - COMPLETE
### 8. Payroll (Planilla/Adelantos) - COMPLETE
- Employee management with salary details
- Payroll generation with pre-filled salaries
- Adelantos (advances) with payment tracking
- Company filter (empresa_id) for both modules

### 9. POS Sales (Ventas POS) - COMPLETE
- Odoo integration via XML-RPC
- Sales sync, confirmation, payment tracking

### 10. Bank Reconciliation - COMPLETE
- Excel import of bank movements
- Manual and automatic reconciliation
- Generate grouped bank expenses
- Historical records

### 11. Budgets - NOT IMPLEMENTED
### 12. Reports - NOT IMPLEMENTED

---

## Recent Fixes (2026-02-05)

### IGV Calculation Fix in OrdenesCompra - COMPLETE
- Added `igv_incluido` flag to OCCreate model
- Backend now correctly handles both IGV-included and IGV-excluded prices
- When igv_incluido=true: base = precio/1.18, igv = precio - base
- When igv_incluido=false: base = precio, igv = base * 0.18
- Result is consistent: same input produces same stored values regardless of toggle
- **Files**: `models.py` (OCCreate), `server.py` (create_orden_compra), `OrdenesCompra.jsx` (handleSubmit)

### Company Filter for Adelantos/Planilla - COMPLETE
- Backend `/api/adelantos` now accepts `empresa_id` parameter
- Backend `/api/planillas` now accepts `empresa_id` parameter
- Frontend Adelantos.jsx and Planilla.jsx use `useEmpresa()` context
- Data refreshes automatically when switching companies
- **Files**: `server.py`, `Adelantos.jsx`, `Planilla.jsx`, `api.js`

### Venta B003-17918 - NOT FOUND
- Searched through 1066 sales, sale does not exist in current data
- Likely cleaned up or never synced

---

## Priority Backlog

### P0 (Critical) - All Complete

### P1 (High)
1. Visual dashboard/reports for Ventas POS
2. Print/email PDF receipt for sales
3. Refactor server.py into modular routers

### P2 (Medium)
4. Alerts/notifications for pending sales
5. Budgets module (cont_presupuesto)
6. Financial Reports (Cash Flow, Income Statement)

### P3 (Low)
7. Refactor large frontend components (VentasPOS.jsx, ConciliacionBancaria.jsx, OrdenesCompra.jsx)
8. Balance Sheet report

## Key Files
- `/app/backend/server.py` - All API endpoints (monolithic)
- `/app/backend/models.py` - Pydantic models
- `/app/backend/database.py` - DB connection
- `/app/frontend/src/pages/OrdenesCompra.jsx`
- `/app/frontend/src/pages/Adelantos.jsx`
- `/app/frontend/src/pages/Planilla.jsx`
- `/app/frontend/src/services/api.js`
- `/app/frontend/src/context/EmpresaContext.jsx`
