import React, { useState, useEffect } from 'react';
import { getCxP } from '../services/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-PE');
};

const isVencido = (fecha) => {
  if (!fecha) return false;
  return new Date(fecha) < new Date();
};

export const CxP = () => {
  const { empresaActual } = useEmpresa();

  const [cxp, setCxp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    loadData();
  }, [filtroEstado, empresaActual]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getCxP({ estado: filtroEstado || undefined });
      setCxp(response.data);
    } catch (error) {
      console.error('Error loading CxP:', error);
      toast.error('Error al cargar CxP');
    } finally {
      setLoading(false);
    }
  };

  const totalPendiente = cxp
    .filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
    .reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);

  const totalVencido = cxp
    .filter(c => (c.estado === 'pendiente' || c.estado === 'parcial') && isVencido(c.fecha_vencimiento))
    .reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);

  const estadoBadge = (estado, fechaVencimiento) => {
    if (isVencido(fechaVencimiento) && (estado === 'pendiente' || estado === 'parcial')) {
      return 'badge badge-error';
    }
    const badges = {
      pendiente: 'badge badge-warning',
      parcial: 'badge badge-info',
      pagado: 'badge badge-success',
      canjeado: 'badge badge-neutral',
      anulada: 'badge badge-neutral'
    };
    return badges[estado] || 'badge badge-neutral';
  };

  return (
    <div data-testid="cxp-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas por Pagar</h1>
          <p className="page-subtitle">
            Pendiente: {formatCurrency(totalPendiente)} • Vencido: {formatCurrency(totalVencido)}
          </p>
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1rem' }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Pendiente</div>
            <div className="kpi-value negative">{formatCurrency(totalPendiente)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Vencido</div>
            <div className="kpi-value" style={{ color: '#EF4444' }}>
              {formatCurrency(totalVencido)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Documentos</div>
            <div className="kpi-value">{cxp.length}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-bar">
          <select 
            className="form-input form-select filter-input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="parcial">Parcial</option>
            <option value="pagado">Pagado</option>
            <option value="canjeado">Canjeado</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : cxp.length === 0 ? (
              <div className="empty-state">
                <Clock className="empty-state-icon" />
                <div className="empty-state-title">No hay cuentas por pagar</div>
              </div>
            ) : (
              <table className="data-table" data-testid="cxp-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Proveedor</th>
                    <th>Vencimiento</th>
                    <th className="text-right">Monto Original</th>
                    <th className="text-right">Saldo Pendiente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cxp.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.factura_numero || '-'}</td>
                      <td>{item.proveedor_nombre || '-'}</td>
                      <td style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        color: isVencido(item.fecha_vencimiento) ? '#EF4444' : 'inherit'
                      }}>
                        {isVencido(item.fecha_vencimiento) && (
                          <AlertTriangle size={14} />
                        )}
                        {formatDate(item.fecha_vencimiento)}
                      </td>
                      <td className="text-right">{formatCurrency(item.monto_original)}</td>
                      <td className="text-right" style={{ 
                        fontWeight: 600,
                        color: item.saldo_pendiente > 0 ? '#EF4444' : '#22C55E'
                      }}>
                        {formatCurrency(item.saldo_pendiente)}
                      </td>
                      <td>
                        <span className={estadoBadge(item.estado, item.fecha_vencimiento)}>
                          {isVencido(item.fecha_vencimiento) && item.estado !== 'pagado' ? 'vencido' : item.estado}
                        </span>
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

export default CxP;
