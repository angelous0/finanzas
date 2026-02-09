import React, { useState, useEffect } from 'react';
import { getReporteFlujoCaja } from '../services/api';
import { useEmpresa } from '../context/EmpresaContext';
import { toast } from 'sonner';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react';

export default function FlujoCaja() {
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [fechaDesde, setFechaDesde] = useState(inicioMes.toISOString().split('T')[0]);
  const [fechaHasta, setFechaHasta] = useState(hoy.toISOString().split('T')[0]);

  const loadData = async () => {
    if (!fechaDesde || !fechaHasta) return;
    setLoading(true);
    try {
      const res = await getReporteFlujoCaja(fechaDesde, fechaHasta);
      setData(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar flujo de caja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fechaDesde, fechaHasta, empresaActual]);

  const totalIngresos = data.filter(d => d.tipo === 'ingreso').reduce((s, d) => s + d.monto, 0);
  const totalEgresos = data.filter(d => d.tipo === 'egreso').reduce((s, d) => s + d.monto, 0);
  const flujoNeto = totalIngresos - totalEgresos;

  const fmt = (n) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div data-testid="flujo-caja-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Flujo de Caja</h1>
          <p className="page-subtitle">Movimientos de efectivo por período</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label">Desde</label>
            <input type="date" className="form-input" value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)} data-testid="flujo-fecha-desde" />
          </div>
          <div>
            <label className="form-label">Hasta</label>
            <input type="date" className="form-input" value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)} data-testid="flujo-fecha-hasta" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Ingresos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }} data-testid="flujo-total-ingresos">{fmt(totalIngresos)}</div>
            </div>
            <ArrowUpCircle size={28} style={{ color: '#10b981' }} />
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Egresos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }} data-testid="flujo-total-egresos">{fmt(totalEgresos)}</div>
            </div>
            <ArrowDownCircle size={28} style={{ color: '#ef4444' }} />
          </div>
        </div>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>Flujo Neto</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: flujoNeto >= 0 ? '#10b981' : '#ef4444' }} data-testid="flujo-neto">{fmt(flujoNeto)}</div>
            </div>
            <TrendingUp size={28} style={{ color: flujoNeto >= 0 ? '#10b981' : '#ef4444' }} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
        ) : data.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <TrendingUp size={48} style={{ color: '#d1d5db', marginBottom: '1rem' }} />
            <div className="empty-state-title">Sin movimientos</div>
            <p style={{ color: '#9ca3af' }}>No hay movimientos de caja en el período seleccionado</p>
          </div>
        ) : (
          <table className="data-table" data-testid="flujo-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th style={{ textAlign: 'right' }}>Ingreso</th>
                <th style={{ textAlign: 'right' }}>Egreso</th>
                <th style={{ textAlign: 'right' }}>Saldo Acum.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-PE')}</td>
                  <td>{row.concepto || '-'}</td>
                  <td style={{ textAlign: 'right', color: '#10b981', fontWeight: row.tipo === 'ingreso' ? 600 : 400 }}>
                    {row.tipo === 'ingreso' ? fmt(row.monto) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: row.tipo === 'egreso' ? 600 : 400 }}>
                    {row.tipo === 'egreso' ? fmt(row.monto) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: row.saldo_acumulado >= 0 ? '#10b981' : '#ef4444' }}>
                    {fmt(row.saldo_acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
