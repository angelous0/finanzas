# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera multiempresa. Módulos: OC, Facturas Proveedor, Gastos, Pagos, Letras, Planilla, Adelantos, CxP, CxC, Ventas POS, Conciliación Bancaria, Presupuestos, Reportes.

## Arquitectura
- **Backend:** FastAPI + asyncpg (PostgreSQL) - `/app/backend/server.py`
- **Frontend:** React + Tailwind CSS - `/app/frontend/src/`
- **BD:** PostgreSQL schemas `finanzas2` (contabilidad) y `produccion` (artículos)
- **Multiempresa:** empresa_id obligatorio en todos los endpoints no-globales

## Esquema Multiempresa (Implementado)
- **Dependency:** `get_empresa_id()` extrae empresa_id de query param o header `X-Empresa-Id`
- **Frontend interceptor:** axios interceptor inyecta empresa_id desde localStorage
- **EmpresaGuard:** Previene renderizado antes de que empresaActual esté disponible
- **Reactividad:** Todas las páginas (19) tienen empresaActual como dependencia useEffect
- **Tablas globales (sin empresa_id):** cont_empresa, cont_moneda, cont_tipo_cambio
- **Tablas por empresa:** 31 tablas con empresa_id NOT NULL FK
- **DDL:** database.py refleja schema real con constraints e índices

## Lo implementado

### Sesiones anteriores
- Cálculo IGV, filtros empresa, bugs CxP/Letras, migración produccion schema
- Rediseño categorías, jerarquía en formularios, ancho formulario gastos

### Sesión 2026-02-09 (Fork 1)
- **A) Multiempresa completo:**
  - Migración BD: empresa_id en 31 tablas, NOT NULL, FK, índices
  - Backend: Dependency FastAPI, 79+ endpoints, INSERTs/SELECTs/UPDATEs/DELETEs filtrados
  - Frontend: Interceptor axios, EmpresaGuard, 19 páginas reactivas al cambio de empresa
  - Correlativos por empresa en generate_*_number()
  - Modelos Pydantic con empresa_id en response
  - Tests: 100% (28/28 backend + frontend)

### Sesión 2026-02-09 (Fork 2 - actual)
- **Bug fix P0: Reportes financieros no filtraban por empresa_id**
  - `reporte_balance_general`: Agregado `AND empresa_id = $1` en queries de activos, CxP y letras
  - `reporte_estado_resultados`: Agregado `AND empresa_id = $3` en queries de ingresos (ventas POS) y egresos (gastos)
  - Creado componente completo `EstadoResultados.jsx` con KPI cards y filtros de fecha (reemplaza placeholder)
  - Tests: 100% (16/16 backend + frontend verificado)

- **B) Correlativos seguros implementados:**
  - Tabla `cont_correlativos` con UNIQUE(empresa_id, tipo_documento, prefijo)
  - Función atómica `get_next_correlativo()` usa INSERT...ON CONFLICT...UPDATE RETURNING
  - Reemplazadas 4 funciones: generate_oc_number, generate_factura_number, generate_pago_number, generate_gasto_number
  - Agregado UNIQUE constraint en cont_factura_proveedor(empresa_id, numero)
  - Sincronización automática en startup (`sync_correlativos`)
  - Corregido bug: generate_pago_number llamado sin empresa_id en create_pago

- **Limpieza del proyecto:**
  - Eliminados 14 scripts temporales de migración y testing

## Backlog

### P1
- Investigar venta B003-17918 con pagos duplicados

### P2
- Simplificar SQL repetitivo en server.py
