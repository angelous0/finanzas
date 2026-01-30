import React, { useState, useEffect } from 'react';
import { getDashboardKPIs } from '../services/api';
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, 
  FileText, Clock, Landmark, Receipt 
} from 'lucide-react';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

export const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      const response = await getDashboardKPIs();
      setKpis(response.data);
    } catch (error) {
      console.error('Error loading KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Saldo en Bancos',
      value: formatCurrency(kpis?.saldo_bancos),
      icon: Landmark,
      color: '#22C55E',
      positive: true
    },
    {
      label: 'Cuentas por Pagar',
      value: formatCurrency(kpis?.total_cxp),
      icon: CreditCard,
      color: '#EF4444',
      positive: false
    },
    {
      label: 'Cuentas por Cobrar',
      value: formatCurrency(kpis?.total_cxc),
      icon: DollarSign,
      color: '#3B82F6',
      positive: true
    },
    {
      label: 'Letras Pendientes',
      value: formatCurrency(kpis?.total_letras_pendientes),
      icon: FileText,
      color: '#F59E0B',
      positive: false
    },
    {
      label: 'Ventas del Mes',
      value: formatCurrency(kpis?.ventas_mes),
      icon: TrendingUp,
      color: '#22C55E',
      positive: true
    },
    {
      label: 'Gastos del Mes',
      value: formatCurrency(kpis?.gastos_mes),
      icon: TrendingDown,
      color: '#EF4444',
      positive: false
    },
    {
      label: 'Facturas Pendientes',
      value: kpis?.facturas_pendientes || 0,
      icon: Receipt,
      color: '#6366F1',
      isCount: true
    },
    {
      label: 'Letras por Vencer (7d)',
      value: kpis?.letras_por_vencer || 0,
      icon: Clock,
      color: '#F59E0B',
      isCount: true
    },
  ];

  return (
    <div data-testid="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Resumen financiero de tu empresa</p>
        </div>
      </div>

      <div className="page-content">
        <div className="kpi-grid">
          {kpiCards.map((kpi, index) => (
            <div key={index} className="kpi-card" data-testid={`kpi-${index}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="kpi-label">{kpi.label}</div>
                  <div className={`kpi-value ${kpi.positive ? 'positive' : kpi.positive === false ? 'negative' : ''}`}>
                    {kpi.isCount ? kpi.value : kpi.value}
                  </div>
                </div>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  background: `${kpi.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <kpi.icon size={20} color={kpi.color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Acciones Rápidas</h3>
            </div>
            <div className="card-content">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="/facturas-proveedor/nueva" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  <Receipt size={18} />
                  Nueva Factura Proveedor
                </a>
                <a href="/gastos/nuevo" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  <DollarSign size={18} />
                  Registrar Gasto
                </a>
                <a href="/ventas-pos" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  <TrendingUp size={18} />
                  Ver Ventas POS
                </a>
                <a href="/pagar-facturas" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  <CreditCard size={18} />
                  Pagar Facturas
                </a>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Resumen del Período</h3>
            </div>
            <div className="card-content">
              <div className="totals-section" style={{ background: '#fff', padding: 0 }}>
                <div className="totals-row">
                  <span>Ingresos del mes</span>
                  <span className="totals-value" style={{ color: '#22C55E' }}>
                    {formatCurrency(kpis?.ventas_mes)}
                  </span>
                </div>
                <div className="totals-row">
                  <span>Egresos del mes</span>
                  <span className="totals-value" style={{ color: '#EF4444' }}>
                    {formatCurrency(kpis?.gastos_mes)}
                  </span>
                </div>
                <div className="totals-row total">
                  <span>Resultado neto</span>
                  <span className="totals-value" style={{ 
                    color: (kpis?.ventas_mes || 0) - (kpis?.gastos_mes || 0) >= 0 ? '#22C55E' : '#EF4444'
                  }}>
                    {formatCurrency((kpis?.ventas_mes || 0) - (kpis?.gastos_mes || 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
