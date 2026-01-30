// Placeholder pages for remaining modules
import React from 'react';

export const Clientes = () => (
  <div data-testid="clientes-page">
    <div className="page-header">
      <h1 className="page-title">Clientes</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Módulo de Clientes</div>
          <div className="empty-state-description">Similar a Proveedores con es_cliente=true</div>
        </div>
      </div>
    </div>
  </div>
);

export const Articulos = () => (
  <div data-testid="articulos-page">
    <div className="page-header">
      <h1 className="page-title">Artículos</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Catálogo de Artículos</div>
          <div className="empty-state-description">Referencia a public.prod_inventario</div>
        </div>
      </div>
    </div>
  </div>
);

export const Adelantos = () => (
  <div data-testid="adelantos-page">
    <div className="page-header">
      <h1 className="page-title">Adelantos</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Adelantos a Empleados</div>
        </div>
      </div>
    </div>
  </div>
);

export const Planillas = () => (
  <div data-testid="planillas-page">
    <div className="page-header">
      <h1 className="page-title">Planillas</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Generación de Planillas</div>
        </div>
      </div>
    </div>
  </div>
);

export const Presupuestos = () => (
  <div data-testid="presupuestos-page">
    <div className="page-header">
      <h1 className="page-title">Presupuestos</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Presupuesto vs Real</div>
        </div>
      </div>
    </div>
  </div>
);

export const Conciliacion = () => (
  <div data-testid="conciliacion-page">
    <div className="page-header">
      <h1 className="page-title">Conciliación Bancaria</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Importar Excel y Conciliar</div>
        </div>
      </div>
    </div>
  </div>
);

export const EstadoResultados = () => (
  <div data-testid="estado-resultados-page">
    <div className="page-header">
      <h1 className="page-title">Estado de Resultados</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Ingresos vs Egresos</div>
        </div>
      </div>
    </div>
  </div>
);

export const FlujoCaja = () => (
  <div data-testid="flujo-caja-page">
    <div className="page-header">
      <h1 className="page-title">Flujo de Caja</h1>
    </div>
    <div className="page-content">
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Flujo de Caja por Fecha</div>
        </div>
      </div>
    </div>
  </div>
);
