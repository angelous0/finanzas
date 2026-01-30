import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import './App.css';

// Context
import { EmpresaProvider } from './context/EmpresaContext';

// Components
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

// Pages
import Dashboard from './pages/Dashboard';
import VentasPOS from './pages/VentasPOS';
import FacturasProveedor from './pages/FacturasProveedor';
import OrdenesCompra from './pages/OrdenesCompra';
import Gastos from './pages/Gastos';
import Letras from './pages/Letras';
import PagarFacturas from './pages/PagarFacturas';
import CxP from './pages/CxP';
import CxC from './pages/CxC';
import CuentasBancarias from './pages/CuentasBancarias';
import Pagos from './pages/Pagos';
import Proveedores from './pages/Proveedores';
import Empleados from './pages/Empleados';
import Categorias from './pages/Categorias';
import BalanceGeneral from './pages/BalanceGeneral';
import LineasNegocio from './pages/LineasNegocio';
import CentrosCosto from './pages/CentrosCosto';
import Empresas from './pages/Empresas';
import Planilla from './pages/Planilla';
import Adelantos from './pages/Adelantos';
import { 
  Clientes, Articulos,
  Presupuestos, Conciliacion, 
  EstadoResultados, FlujoCaja 
} from './pages/PlaceholderPages';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when clicking outside or on navigation
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Router>
      <EmpresaProvider>
        <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
          {/* Mobile menu overlay */}
          {mobileMenuOpen && (
            <div 
              className="mobile-overlay" 
              onClick={() => setMobileMenuOpen(false)}
              data-testid="mobile-overlay"
            />
          )}
        
        <Sidebar 
          collapsed={sidebarCollapsed} 
          setCollapsed={setSidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
        
        <main className="main-content">
          {/* Top Bar with empresa selector */}
          <TopBar />
          
          {/* Mobile hamburger button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu size={24} />
          </button>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Ventas */}
            <Route path="/ventas-pos" element={<VentasPOS />} />
            <Route path="/cxc" element={<CxC />} />
            
            {/* Proveedores y Egresos */}
            <Route path="/ordenes-compra" element={<OrdenesCompra />} />
            <Route path="/facturas-proveedor" element={<FacturasProveedor />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/pagar-facturas" element={<PagarFacturas />} />
            <Route path="/cxp" element={<CxP />} />
            <Route path="/letras" element={<Letras />} />
            
            {/* Bancos y Pagos */}
            <Route path="/cuentas-bancarias" element={<CuentasBancarias />} />
            <Route path="/pagos" element={<Pagos />} />
            <Route path="/conciliacion" element={<Conciliacion />} />
            
            {/* Planilla */}
            <Route path="/empleados" element={<Empleados />} />
            <Route path="/adelantos" element={<Adelantos />} />
            <Route path="/planillas" element={<Planilla />} />
            <Route path="/planilla" element={<Planilla />} />
            
            {/* Presupuestos */}
            <Route path="/presupuestos" element={<Presupuestos />} />
            
            {/* Catálogos */}
            <Route path="/empresas" element={<Empresas />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/articulos" element={<Articulos />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/lineas-negocio" element={<LineasNegocio />} />
            <Route path="/centros-costo" element={<CentrosCosto />} />
            
            {/* Contabilidad */}
            <Route path="/balance-general" element={<BalanceGeneral />} />
            <Route path="/estado-resultados" element={<EstadoResultados />} />
            <Route path="/flujo-caja" element={<FlujoCaja />} />
          </Routes>
        </main>
        </div>
        <Toaster position="top-right" richColors />
      </EmpresaProvider>
    </Router>
  );
}

export default App;
