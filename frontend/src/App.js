import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import './App.css';

// Components
import Sidebar from './components/Sidebar';

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
import { 
  Clientes, Articulos, LineasNegocio, CentrosCosto, Empresas,
  Adelantos, Planillas, Presupuestos, Conciliacion, 
  EstadoResultados, FlujoCaja 
} from './pages/PlaceholderPages';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Router>
      <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
        <main className="main-content">
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
            <Route path="/planillas" element={<Planillas />} />
            
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
    </Router>
  );
}

export default App;
