# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera completo con FastAPI backend + React frontend + PostgreSQL.

## Arquitectura
- **Backend**: FastAPI monolítico (`server.py`) con `asyncpg` para PostgreSQL
- **Frontend**: React con React-Bootstrap, Axios, react-router-dom
- **Base de datos**: PostgreSQL, esquema `finanzas2`

## Funcionalidades Implementadas
- Dashboard, empresas, monedas, categorías, terceros
- Órdenes de compra, facturas proveedor, gastos, pagos, letras
- Ventas POS, planillas, adelantos, reportes financieros
- Correlativos atómicos, centro costo, línea negocio, fecha contable
- Campos SUNAT auto-calculados (base_gravada, igv_sunat, base_no_gravada)
- Export CompraAPP con voucher (Vou.Origen, Vou.Numero, Vou.Fecha)
- **Módulo Cuentas Contables**: tabla cont_cuenta (CRUD), cont_config_empresa (3 defaults), cuenta_gasto_id en categorías
- **Export CompraAPP con cuentas**: Cta Gastos (categoría > default), Cta IGV (si IGV>0), Cta x Pagar (si saldo>0)
- **Export CompraAPP 61 columnas fijas** (Feb 2026): Orden hardcodeado de 61 columnas SUNAT. Columnas definidas se llenan, el resto existe pero vacío (NULL). Fechas dd/mm/yyyy. Celdas vacías realmente NULL (no "0.00").

## BD Schema Clave
- `cont_cuenta`: id, empresa_id, codigo (UNIQUE), nombre, tipo, es_activa
- `cont_config_empresa`: empresa_id(PK), cta_gastos_default_id, cta_igv_default_id, cta_xpagar_default_id
- `cont_categoria.cuenta_gasto_id`: FK a cont_cuenta

## Columnas Definidas compraAPP (v1)
- 1-8: Vou.Origen(01), Vou.Numero, Vou.Fecha, Doc, Numero, Fec.Doc, Fec.Venc., Codigo
- 9: B.I.O.G y E. (A) = base_gravada
- 12: AD. NO GRAV. = base_no_gravada
- 13: I.S.C. = isc
- 14: IGV (A) = igv_sunat
- 22-25: Cta Gastos, Cta IGV, Cta O. Trib.(vacío), Cta x Pagar

## Backlog
- P1: Refactorizar server.py usando APIRouter
- P2: Custom hook useFormSubmit
