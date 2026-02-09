# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera multiempresa. Módulos: OC, Facturas Proveedor, Gastos, Pagos, Letras, Planilla, Adelantos, CxP, CxC, Ventas POS, Conciliación Bancaria, Presupuestos, Reportes.

## Arquitectura
- **Backend:** FastAPI + asyncpg (PostgreSQL) - `/app/backend/server.py`
- **Frontend:** React + Tailwind CSS - `/app/frontend/src/`
- **BD:** PostgreSQL schemas `finanzas2` (contabilidad) y `produccion` (artículos)
- **Multiempresa:** empresa_id obligatorio en todos los endpoints

## Implementado

### Multi-Tenancy (DONE)
- empresa_id en 31 tablas, FastAPI dependency, Axios interceptor, EmpresaGuard
- Todas las páginas reactivas al cambio de empresa

### Correlativos Seguros (DONE)
- Tabla cont_correlativos con UNIQUE(empresa_id, tipo_documento, prefijo)
- Función atómica get_next_correlativo() con INSERT ON CONFLICT UPDATE
- Sync automático al startup

### Reportes Financieros (DONE)
- Balance General, Estado de Resultados, Flujo de Caja: filtran por empresa_id
- Reporte de Pagos: filtros por Centro de Costo, Línea de Negocio, Cuenta, Tipo, Fechas + Export CSV

### Centro de Costo + Línea de Negocio (DONE)
- Campos en cont_empleado_detalle y cont_pago
- Empleados: formulario con CC y LN
- Pagos de planilla/adelanto: heredan CC/LN del empleado
- Editar en Centros de Costo y Líneas de Negocio

### Protección doble-click (DONE)
- submitting state en 16 módulos

### Ventas POS (DONE)
- Ingresos solo cuentan ventas confirmadas (estado_local = 'confirmada')
- Botón Desconfirmar en tabla de confirmadas
- Desconfirmar funciona sin pagos oficiales vinculados

### Bug Fixes (DONE)
- get_planilla: empresa_id como parámetro
- Reportes financieros filtran por empresa_id
- Gasto linea INSERT parameter order
- EmpleadoDetalleCreate: tercero_id optional

### Test Exhaustivo (DONE - 2026-02-09)
- 20 módulos testeados: 30/30 backend + frontend 100%
- Base de datos limpiada a cero post-test

## Backlog
### P1
- Investigar venta B003-17918 con pagos duplicados

### P2
- Simplificar SQL repetitivo en server.py
- Validar saldos negativos antes de pagos
- UNIQUE constraint en planilla periodo
