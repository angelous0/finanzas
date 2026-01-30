import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, FileText, Receipt, CreditCard, 
  Building2, Users, Wallet, BarChart3, FileSpreadsheet, Settings,
  ChevronDown, ChevronRight, DollarSign, Landmark, Clock, FolderOpen,
  Package, Tags, GitBranch, Target
} from 'lucide-react';

const navSections = [
  {
    title: 'Principal',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ]
  },
  {
    title: 'Ventas',
    items: [
      { icon: ShoppingCart, label: 'Ventas POS', path: '/ventas-pos' },
      { icon: CreditCard, label: 'Créditos por Cobrar', path: '/cxc' },
    ]
  },
  {
    title: 'Proveedores y Egresos',
    items: [
      { icon: FileText, label: 'Órdenes de Compra', path: '/ordenes-compra' },
      { icon: Receipt, label: 'Factura Proveedor', path: '/facturas-proveedor' },
      { icon: Wallet, label: 'Gastos', path: '/gastos' },
      { icon: DollarSign, label: 'Pagar Facturas', path: '/pagar-facturas' },
      { icon: Clock, label: 'CxP Pendientes', path: '/cxp' },
      { icon: FileSpreadsheet, label: 'Letras', path: '/letras' },
    ]
  },
  {
    title: 'Bancos y Pagos',
    items: [
      { icon: Landmark, label: 'Cuentas Bancarias', path: '/cuentas-bancarias' },
      { icon: DollarSign, label: 'Movimientos/Pagos', path: '/pagos' },
      { icon: FileSpreadsheet, label: 'Conciliación Bancaria', path: '/conciliacion' },
    ]
  },
  {
    title: 'Planilla',
    items: [
      { icon: Users, label: 'Empleados', path: '/empleados' },
      { icon: Wallet, label: 'Adelantos', path: '/adelantos' },
      { icon: FileText, label: 'Generar Planilla', path: '/planillas' },
    ]
  },
  {
    title: 'Presupuestos',
    items: [
      { icon: BarChart3, label: 'Presupuestos', path: '/presupuestos' },
    ]
  },
  {
    title: 'Catálogos',
    items: [
      { icon: Building2, label: 'Empresas', path: '/empresas' },
      { icon: Users, label: 'Proveedores', path: '/proveedores' },
      { icon: Users, label: 'Clientes', path: '/clientes' },
      { icon: Package, label: 'Artículos', path: '/articulos' },
      { icon: Tags, label: 'Categorías', path: '/categorias' },
      { icon: GitBranch, label: 'Líneas de Negocio', path: '/lineas-negocio' },
      { icon: Target, label: 'Centros de Costo', path: '/centros-costo' },
    ]
  },
  {
    title: 'Contabilidad',
    items: [
      { icon: BarChart3, label: 'Balance General', path: '/balance-general' },
      { icon: FileText, label: 'Estado de Resultados', path: '/estado-resultados' },
      { icon: DollarSign, label: 'Flujo de Caja', path: '/flujo-caja' },
    ]
  },
];

export const Sidebar = () => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(
    navSections.reduce((acc, section) => ({ ...acc, [section.title]: true }), {})
  );

  const toggleSection = (title) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">F4</div>
          <span className="sidebar-logo-text">Finanzas 4.0</span>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="nav-section">
            <button 
              className="nav-section-title"
              onClick={() => toggleSection(section.title)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem 1.5rem',
                color: 'rgba(255,255,255,0.4)'
              }}
            >
              <span>{section.title}</span>
              {expandedSections[section.title] ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
            
            {expandedSections[section.title] && (
              <div className="nav-items">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => 
                      `nav-item ${isActive || (item.path === '/' && location.pathname === '/') ? 'active' : ''}`
                    }
                    data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                  >
                    <item.icon className="nav-item-icon" size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
