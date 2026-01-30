import React, { useState, useEffect } from 'react';
import { 
  getVentasPOS, syncVentasPOS, confirmarVentaPOS, 
  marcarCreditoVentaPOS, descartarVentaPOS 
} from '../services/api';
import { RefreshCw, Check, CreditCard, X, Filter, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const estadoBadge = (estado) => {
  const badges = {
    pendiente: 'badge badge-warning',
    confirmada: 'badge badge-success',
    credito: 'badge badge-info',
    descartada: 'badge badge-error'
  };
  return badges[estado] || 'badge badge-neutral';
};

export const VentasPOS = () => {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('pendiente');
  
  // Filtros
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadVentas();
  }, [activeTab, filtroEmpresa, fechaDesde, fechaHasta]);

  const loadVentas = async () => {
    try {
      setLoading(true);
      const params = {
        estado: activeTab !== 'todas' ? activeTab : undefined,
        company_id: filtroEmpresa || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined
      };
      const response = await getVentasPOS(params);
      setVentas(response.data);
    } catch (error) {
      console.error('Error loading ventas:', error);
      toast.error('Error al cargar ventas');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (company) => {
    try {
      setSyncing(true);
      const response = await syncVentasPOS(company, 30);
      toast.success(`Sincronizadas ${response.data.synced} ventas de ${company}`);
      loadVentas();
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Error al sincronizar con Odoo');
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmar = async (id) => {
    try {
      await confirmarVentaPOS(id);
      toast.success('Venta confirmada');
      loadVentas();
    } catch (error) {
      console.error('Error confirming:', error);
      toast.error('Error al confirmar venta');
    }
  };

  const handleCredito = async (id) => {
    try {
      await marcarCreditoVentaPOS(id);
      toast.success('Venta marcada como crédito');
      loadVentas();
    } catch (error) {
      console.error('Error marking credit:', error);
      toast.error('Error al marcar como crédito');
    }
  };

  const handleDescartar = async (id) => {
    if (!window.confirm('¿Está seguro de descartar esta venta?')) return;
    try {
      await descartarVentaPOS(id);
      toast.success('Venta descartada');
      loadVentas();
    } catch (error) {
      console.error('Error discarding:', error);
      toast.error('Error al descartar venta');
    }
  };

  // Filter ventas by search
  const filteredVentas = ventas.filter(v => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      (v.name || '').toLowerCase().includes(searchLower) ||
      (v.partner_name || '').toLowerCase().includes(searchLower) ||
      (v.vendedor_name || '').toLowerCase().includes(searchLower)
    );
  });

  // Calculate KPIs
  const totalVentas = filteredVentas.length;
  const montoTotal = filteredVentas.reduce((sum, v) => sum + parseFloat(v.amount_total || 0), 0);

  const tabs = [
    { id: 'pendiente', label: 'Pendientes' },
    { id: 'confirmada', label: 'Confirmadas' },
    { id: 'credito', label: 'Crédito' },
    { id: 'descartada', label: 'Descartadas' },
    { id: 'todas', label: 'Todas' }
  ];

  return (
    <div data-testid="ventas-pos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ventas POS</h1>
          <p className="page-subtitle">Ventas sincronizadas desde Odoo</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-outline"
            onClick={() => handleSync('ambission')}
            disabled={syncing}
            data-testid="sync-ambission-btn"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync Ambission
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => handleSync('proyectomoda')}
            disabled={syncing}
            data-testid="sync-proyectomoda-btn"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            Sync Proyecto Moda
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '1rem' }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Ventas</div>
            <div className="kpi-value">{totalVentas}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Monto Total</div>
            <div className="kpi-value positive">{formatCurrency(montoTotal)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-bar">
          <input
            type="text"
            className="form-input filter-input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '250px' }}
          />
          <select 
            className="form-input form-select filter-input"
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
          >
            <option value="">Todas las empresas</option>
            <option value="1">Ambission</option>
            <option value="2">Proyecto Moda</option>
          </select>
          <input
            type="date"
            className="form-input filter-input"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            placeholder="Desde"
          />
          <input
            type="date"
            className="form-input filter-input"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            placeholder="Hasta"
          />
        </div>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : filteredVentas.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart className="empty-state-icon" />
                <div className="empty-state-title">No hay ventas</div>
                <div className="empty-state-description">
                  Sincroniza las ventas desde Odoo para verlas aquí
                </div>
              </div>
            ) : (
              <table className="data-table" data-testid="ventas-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Empresa</th>
                    <th>Vendedor</th>
                    <th className="text-right">Monto</th>
                    <th>Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVentas.map((venta) => (
                    <tr key={venta.id} data-testid={`venta-row-${venta.id}`}>
                      <td style={{ fontWeight: 500 }}>{venta.name}</td>
                      <td>{formatDateTime(venta.date_order)}</td>
                      <td>{venta.partner_name || '-'}</td>
                      <td>{venta.company_name || '-'}</td>
                      <td>{venta.vendedor_name || '-'}</td>
                      <td className="text-right" style={{ fontWeight: 500 }}>
                        {formatCurrency(venta.amount_total)}
                      </td>
                      <td>
                        <span className={estadoBadge(venta.estado_local)}>
                          {venta.estado_local}
                        </span>
                      </td>
                      <td className="text-center">
                        {venta.estado_local === 'pendiente' && (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleConfirmar(venta.id)}
                              title="Confirmar"
                              data-testid={`confirmar-${venta.id}`}
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleCredito(venta.id)}
                              title="Marcar Crédito"
                              data-testid={`credito-${venta.id}`}
                            >
                              <CreditCard size={14} />
                            </button>
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleDescartar(venta.id)}
                              title="Descartar"
                              data-testid={`descartar-${venta.id}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VentasPOS;
