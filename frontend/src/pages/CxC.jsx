import React, { useState, useEffect } from 'react';
import { getCxC } from '../services/api';
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

export const CxC = () => {
  const { empresaActual } = useEmpresa();

  const [cxc, setCxc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');

  useEffect(() => {
    loadData();
  }, [filtroEstado]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getCxC({ estado: filtroEstado || undefined });
      setCxc(response.data);
    } catch (error) {
      console.error('Error loading CxC:', error);
      toast.error('Error al cargar CxC');
    } finally {
      setLoading(false);
    }
  };

  const totalPendiente = cxc
    .filter(c => c.estado === 'pendiente')
    .reduce((sum, c) => sum + parseFloat(c.saldo_pendiente || 0), 0);

  return (
    <div data-testid="cxc-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Créditos por Cobrar</h1>
          <p className="page-subtitle">Total pendiente: {formatCurrency(totalPendiente)}</p>
        </div>
      </div>

      <div className="page-content">
        {/* Filtros */}
        <div className="filters-bar">
          <select 
            className="form-input form-select filter-input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : cxc.length === 0 ? (
              <div className="empty-state">
                <Clock className="empty-state-icon" />
                <div className="empty-state-title">No hay créditos por cobrar</div>
              </div>
            ) : (
              <table className="data-table" data-testid="cxc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Vencimiento</th>
                    <th className="text-right">Monto Original</th>
                    <th className="text-right">Saldo Pendiente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cxc.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.id}</td>
                      <td>{item.cliente_nombre || '-'}</td>
                      <td style={{ 
                        color: isVencido(item.fecha_vencimiento) ? '#EF4444' : 'inherit'
                      }}>
                        {formatDate(item.fecha_vencimiento)}
                      </td>
                      <td className="text-right">{formatCurrency(item.monto_original)}</td>
                      <td className="text-right" style={{ 
                        fontWeight: 600,
                        color: item.saldo_pendiente > 0 ? '#22C55E' : 'inherit'
                      }}>
                        {formatCurrency(item.saldo_pendiente)}
                      </td>
                      <td>
                        <span className={`badge ${item.estado === 'pendiente' ? 'badge-warning' : 'badge-success'}`}>
                          {item.estado}
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

export default CxC;
