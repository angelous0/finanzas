# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera completo con FastAPI backend + React frontend + PostgreSQL.

## Arquitectura
- **Backend**: FastAPI monolítico (`server.py`) con `asyncpg` para PostgreSQL
- **Frontend**: React con React-Bootstrap, Axios, react-router-dom
- **Base de datos**: PostgreSQL, esquema `finanzas2`
- **Deploy**: Docker en EasyPanel

## Funcionalidades Implementadas
- Dashboard, empresas, monedas, categorías, terceros
- Órdenes de compra, facturas proveedor, gastos
- Pagos, letras, ventas POS, planillas, adelantos
- Reportes financieros, correlativos atómicos, centro costo, línea negocio
- Fecha contable en facturas y gastos
- **Campos SUNAT auto-calculados**: base_gravada, igv_sunat, base_no_gravada desde líneas (readOnly en frontend, recálculo server-side)
- **Export CompraAPP (SUNAT)** con columnas:
  - Vou.Origen (fijo '01'), Vou.Numero (correlativo atómico 6 dígitos por empresa+año, persistido en BD), Vou.Fecha (fecha_contable dd/mm/yyyy)
  - Doc, Numero, Fec.Doc, Fec.Venc, Codigo, B.I.O.G y E.(A), AD. NO GRAV., I.S.C., IGV(A)

## Backlog
- P1: Refactorizar server.py usando APIRouter
- P2: Custom hook useFormSubmit
