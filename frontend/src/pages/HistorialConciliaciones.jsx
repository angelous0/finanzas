import React, { useState, useEffect } from 'react';
import { getConciliacionesDetalladas, desconciliarMovimientos } from '../services/api';
import { History, Trash2, FileText, Receipt, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE');
};

export const HistorialConciliaciones = () => {
  const [conciliaciones, setConciliaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConciliaciones();
  }, []);

  const loadConciliaciones = async () => {
    try {
      setLoading(true);
      const response = await getConciliacionesDetalladas();
      setConciliaciones(response.data || []);
    } catch (error) {
      console.error('Error loading conciliaciones:', error);
      toast.error('Error al cargar historial de conciliaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleDesconciliar = async (bancoId, pagoId) => {
    if (!window.confirm('¿Está seguro de desconciliar estos movimientos?')) {
      return;
    }

    try {
      await desconciliarMovimientos(bancoId, pagoId);
      toast.success('Movimientos desconciliados exitosamente');
      loadConciliaciones();
    } catch (error) {
      console.error('Error al desconciliar:', error);
      toast.error('Error al desconciliar movimientos');
    }
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Historial de Conciliaciones</h1>
          <p className="page-subtitle">Todos los movimientos bancarios conciliados con el sistema</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="summary-card" style={{ 
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <History size={20} />
            <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Conciliaciones</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{conciliaciones.length}</div>
        </div>
      </div>

      {/* Conciliaciones Table */}
      <div className="card">
        <div className="data-table-wrapper">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Cargando...
            </div>
          ) : conciliaciones.length === 0 ? (
            <div className="empty-state">
              <History className="empty-state-icon" />
              <div className="empty-state-title">No hay conciliaciones registradas</div>
              <div className="empty-state-description">
                Las conciliaciones aparecerán aquí una vez que vincule movimientos
              </div>
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Banco</th>
                  <th>Ref. Banco</th>
                  <th>Descripción Banco</th>
                  <th>Sistema</th>
                  <th>Ref. Sistema</th>
                  <th>Descripción Sistema</th>
                  <th className="text-right">Monto</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conciliaciones.map((conc, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(conc.fecha_banco || conc.fecha_sistema)}</td>
                    <td>{conc.banco}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                      {conc.ref_banco || '-'}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conc.descripcion_banco || '-'}
                    </td>
                    <td>
                      <span className={`badge ${conc.tipo_sistema === 'ingreso' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6875rem' }}>
                        {conc.tipo_sistema === 'ingreso' ? 'INGRESO' : 'EGRESO'}
                      </span>
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                      {conc.numero_sistema || '-'}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conc.descripcion_sistema || '-'}
                    </td>
                    <td className="text-right currency-display" style={{ 
                      color: conc.monto < 0 ? '#dc2626' : '#16a34a',
                      fontWeight: 500
                    }}>
                      {formatCurrency(conc.monto, conc.monto < 0 ? '-S/' : 'S/')}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDesconciliar(conc.banco_id, conc.sistema_id)}
                        style={{ 
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem'
                        }}
                      >
                        <Trash2 size={14} />
                        Desconciliar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
