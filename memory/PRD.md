# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera completo con FastAPI backend + React frontend + PostgreSQL. Incluye módulos de ventas, gastos, facturas proveedor, empleados, nómina e informes financieros.

## Arquitectura
- **Backend**: FastAPI monolítico (`server.py`) con `asyncpg` para PostgreSQL
- **Frontend**: React con React-Bootstrap, Axios, react-router-dom
- **Base de datos**: PostgreSQL, esquema `finanzas2`
- **Deploy**: Docker en EasyPanel

## Funcionalidades Implementadas
- Dashboard con KPIs
- Gestión de empresas, monedas, categorías, terceros
- Órdenes de compra, facturas proveedor, gastos
- Sistema de pagos y letras
- Ventas POS (sync con Odoo)
- Planillas y adelantos de empleados
- Reportes financieros (Estado de resultados, balance general, flujo de caja)
- Correlativos atómicos por empresa
- Centro de costo y línea de negocio en empleados y pagos
- Reporte de pagos avanzado
- Fecha contable en facturas y gastos
- **Export CompraAPP (SUNAT)**: Endpoint GET /api/export/compraapp genera Excel
- **Campos SUNAT auto-calculados**: base_gravada, igv_sunat, base_no_gravada se calculan automáticamente desde líneas de detalle tanto en frontend (readOnly) como backend (server-side). ISC editable. Reglas: igv_aplica=true con impuestos incluidos → base=importe/1.18, igv=importe-base; sin incluidos → base=importe, igv=base*0.18; igv_aplica=false → base_no_gravada+=importe.

## Backlog
- P1: Refactorizar server.py (6000+ líneas) usando APIRouter de FastAPI
- P2: Extraer lógica de `submitting` en custom hook reutilizable
