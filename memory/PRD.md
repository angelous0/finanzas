# Finanzas 4.0 - PRD (Product Requirements Document)

## Problema Original
Sistema financiero tipo QuickBooks para PYME llamado "Finanzas 4.0" con PostgreSQL. 
- Schema: `finanzas2` (separado del esquema público)
- Prefijo tablas: `cont_`
- Integración con Odoo para Ventas POS (2 empresas: Ambission y Proyecto Moda)
- Referencia a inventario existente en `public.prod_inventario`

## User Personas
1. **Contador/Administrador**: Gestiona facturas, pagos, CxP, CxC
2. **Gerente Financiero**: Revisa KPIs, presupuestos, balance general
3. **Asistente Operativo**: Registra gastos, adelantos, planilla

## Requisitos Core (Estáticos)

### Catálogos Base
- [x] Empresas
- [x] Monedas (PEN, USD)
- [x] Categorías (ingreso/egreso) jerárquicas
- [x] Centros de Costo
- [x] Líneas de Negocio
- [x] Cuentas Financieras (bancos/cajas)
- [x] Terceros unificados (cliente/proveedor/personal)

### Módulos Transaccionales
- [x] Órdenes de Compra (OC) con conversión a Factura
- [x] Facturas Proveedor con tabla Excel inline
- [x] CxP automático al guardar factura
- [x] Pagos centralizados multi-medio y parciales
- [x] Letras (canje desde factura)
- [x] Gastos con pago obligatorio
- [x] Planilla básica con adelantos
- [x] Ventas POS desde Odoo (sync XML-RPC)
- [x] CxC desde ventas a crédito

### Reportes
- [x] Dashboard con KPIs
- [x] Balance General operativo
- [ ] Estado de Resultados
- [ ] Flujo de Caja
- [ ] Presupuesto vs Real
- [ ] Conciliación Bancaria

## Lo Implementado (Diciembre 2025)

### Backend (FastAPI + PostgreSQL)
- Schema `finanzas2` con 25+ tablas
- API REST completa con CRUD para todos los módulos
- Conexión a PostgreSQL externo: `postgres://admin:admin@72.60.241.216:9090/datos`
- Servicio Odoo XML-RPC para sync de ventas POS
- Seed data: 1 empresa, monedas, categorías, cuentas, 1 proveedor

### Frontend (React + Shadcn UI)
- Sidebar fijo con navegación jerárquica
- Dashboard con 8 KPIs financieros
- Páginas completas:
  - Facturas Proveedor (Excel inline)
  - Órdenes de Compra
  - Gastos (con pago obligatorio)
  - Letras (generar y pagar)
  - Pagar Facturas (multi-medio)
  - CxP y CxC
  - Cuentas Bancarias
  - Movimientos/Pagos
  - Proveedores
  - Empleados
  - Categorías
  - Balance General
- Ventas POS con sync desde Odoo

### Integraciones
- PostgreSQL externo ✅
- Odoo XML-RPC (2 empresas) ✅
- Referencia a `public.prod_inventario` (preparado)

## Backlog Priorizado

### P0 - Crítico (Próximas iteraciones)
- [ ] Completar Planilla (generar quincena, pagar, descuento adelantos)
- [ ] Completar Presupuestos (crear, aprobar, comparar vs real)
- [ ] Conciliación Bancaria (importar Excel BCP/BBVA/Interbank)

### P1 - Alto
- [ ] Impresión de OC (layout bonito)
- [ ] Módulo completo de Adelantos a empleados
- [ ] Estado de Resultados detallado
- [ ] Flujo de Caja con gráficos

### P2 - Medio
- [ ] Gestión de Artículos local + link a inventario
- [ ] Historial de tipo de cambio
- [ ] Notificaciones de vencimiento (letras, CxP)
- [ ] Exportación a Excel de reportes

### P3 - Bajo
- [ ] Multi-empresa (cambiar empresa activa)
- [ ] Auditoría de cambios
- [ ] Roles y permisos de usuario
- [ ] Integración con SUNAT (facturación electrónica)

## Próximas Acciones
1. Completar páginas placeholder (Adelantos, Planillas, Presupuestos)
2. Implementar Conciliación Bancaria con importación Excel
3. Agregar gráficos al Dashboard
4. Probar sync real con Odoo (credenciales proporcionadas)
