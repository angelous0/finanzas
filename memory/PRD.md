# Finanzas 4.0 - Product Requirements Document

## Original Problem Statement
Create a QuickBooks-like system for treasury, control, and minimal accounting called "Finanzas 4.0" using PostgreSQL.

## Database Configuration
- **PostgreSQL**: `postgres://admin:admin@72.60.241.216:9090/datos?sslmode=disable`
- **Schema**: `finanzas2` for all new objects
- **Table prefix**: `cont_`

## Odoo Credentials
- **Ambission**: URL: `https://ambission.app-gestion.net`, DB: `ambission`, User: `admin_ambission@ambission.com`, Pass: `ambission123`
- **Proyecto Moda**: User: `proyectomoda@ambission.com`, Pass: `proyectomoda123`

## Tech Stack
- **Backend**: FastAPI + PostgreSQL (asyncpg)
- **Frontend**: React + TailwindCSS + Shadcn/UI

---

## Modules & Status - All Complete
1. Base Catalogs, 2. Órdenes de Compra (with IGV incluido/excluido), 3. Facturas Proveedor, 4. Pagos Centralizados, 5. Letras de Cambio, 6. Gastos, 7. Adelantos Empleado, 8. Planilla, 9. Ventas POS (Odoo), 10. Conciliación Bancaria, 11. CxP/CxC

### Pending: Presupuestos, Reportes Financieros

---

## Critical Bug Fix (2026-02-06): CxP no se actualizaba al pagar letras
- **Problem**: Cuando se pagaban letras de una factura canjeada, la CxP mantenía el saldo original
- **Fix**: Al pagar una letra, ahora se recalcula `saldo_pendiente` de la CxP sumando los saldos restantes de todas las letras de esa factura
- **File**: `server.py` línea ~1700, sección de aplicaciones tipo 'letra'
- **Tested**: Pago letra completa → CxP parcial, pago todas letras → CxP pagado (saldo=0)

## Previous Fixes (2026-02-05)
- IGV Calculation fix (igv_incluido flag)
- Company Filter for Adelantos/Planilla
- Exhaustive financial test (10/10 flows pass)

---

## Priority Backlog
### P1: Dashboard/reportes Ventas POS, PDF recibos, Refactor server.py
### P2: Alertas, Presupuestos, Reportes financieros
### P3: Refactor componentes frontend

## Key Files
- `/app/backend/server.py`, `/app/backend/models.py`
- `/app/frontend/src/pages/`, `/app/frontend/src/services/api.js`
- `/app/test_reports/iteration_4.json`
