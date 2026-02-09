# Finanzas 4.0 - PRD

## Problema Original
Sistema de gestión financiera multiempresa. Módulos: OC, Facturas Proveedor, Gastos, Pagos, Letras, Planilla, Adelantos, CxP, CxC, Ventas POS, Conciliación Bancaria, Presupuestos, Reportes.

## Arquitectura
- **Backend:** FastAPI + asyncpg (PostgreSQL) - `/app/backend/server.py`
- **Frontend:** React + Tailwind CSS - `/app/frontend/src/`
- **BD:** PostgreSQL con schemas `finanzas2` (contabilidad) y `produccion` (artículos)
- **Multiempresa:** empresa_id obligatorio en todos los endpoints no-globales

## Esquema Multiempresa
- **Dependency:** `get_empresa_id()` extrae empresa_id de query param o header `X-Empresa-Id`
- **Frontend interceptor:** axios interceptor inyecta empresa_id automáticamente desde localStorage
- **Tablas globales (sin empresa_id):** cont_empresa, cont_moneda, cont_tipo_cambio
- **Tablas por empresa:** Todas las demás (31 tablas con empresa_id NOT NULL FK)
- **Backfill:** Datos existentes migrados a empresa_id=3 ("Empresa de Prueba SAC")
- **DDL actualizado:** database.py refleja las columnas reales con constraints e índices

## Lo implementado

### Sesiones anteriores
- Cálculo IGV, filtros empresa, bugs CxP/Letras, migración produccion schema
- Rediseño categorías, jerarquía en formularios, ancho formulario gastos

### Sesión actual (2026-02-09)
- **A) Multiempresa completo:**
  - Migración BD: empresa_id en 31 tablas, NOT NULL, FK, índices
  - Backend: Dependency FastAPI, 79+ endpoints actualizados, INSERTs/SELECTs/UPDATEs/DELETEs filtrados
  - Frontend: Interceptor axios, EmpresaGuard, modelos Pydantic actualizados
  - Correlaciones seguras por empresa en generate_*_number()
  - Tests: 100% (28/28 backend, todas las páginas frontend)

## Backlog Priorizado

### P0
- **B) Correlativos seguros por empresa** — Prevenir duplicados de número de serie entre empresas (parcialmente hecho - generate_*_number ya filtra por empresa_id, falta UNIQUE constraint compuesto)

### P1
- Investigar venta B003-17918 con pagos duplicados

### P2 (Refactoring)
- Simplificar consultas SQL repetitivas en server.py (JOINs de categorías)

## Archivos clave
- `/app/backend/server.py` (4300+ lines) - Todos los endpoints
- `/app/backend/database.py` - DDL completo con empresa_id
- `/app/backend/models.py` - Modelos Pydantic con empresa_id
- `/app/backend/migrate_empresa_id.py` - Script de migración
- `/app/frontend/src/services/api.js` - Interceptor empresa_id
- `/app/frontend/src/App.js` - EmpresaGuard
- `/app/frontend/src/context/EmpresaContext.jsx` - Contexto empresa
