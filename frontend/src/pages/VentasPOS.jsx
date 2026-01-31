import React, { useState, useEffect } from 'react';
import { 
  getVentasPOS, syncVentasPOS, confirmarVentaPOS, 
  marcarCreditoVentaPOS, descartarVentaPOS,
  getPagosVentaPOS, addPagoVentaPOS, deletePagoVentaPOS,
  getCuentasFinancieras
} from '../services/api';
import { RefreshCw, Check, CreditCard, X, Filter, ShoppingCart, Download, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  
  // Parse as UTC and convert to Lima timezone (UTC-5)
  const utcDate = new Date(dateStr);
  const limaDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000));
  
  return limaDate.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima'
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
  
  // Helper: Get yesterday's date in Lima timezone (UTC-5)
  const getYesterdayInLima = () => {
    const now = new Date();
    // Convert to Lima time (UTC-5)
    const limaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    // Get yesterday
    limaTime.setDate(limaTime.getDate() - 1);
    return limaTime.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };
  
  // Filtros - Default to yesterday in Lima timezone
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [fechaDesde, setFechaDesde] = useState(getYesterdayInLima());
  const [fechaHasta, setFechaHasta] = useState(getYesterdayInLima());
  const [search, setSearch] = useState('');
  
  // Modal pagos
  const [showPagosModal, setShowPagosModal] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [cuentasFinancieras, setCuentasFinancieras] = useState([]);
  const [nuevoPago, setNuevoPago] = useState({
    forma_pago: 'Efectivo',
    cuenta_financiera_id: '',
    monto: '',
    referencia: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

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
    // TODO: Check if venta has assigned payments before confirming
    // For now, show a confirmation dialog
    if (!window.confirm('¿Confirmar esta venta? Debe tener pagos asignados.')) return;
    
    try {
      await confirmarVentaPOS(id);
      toast.success('Venta confirmada');
      loadVentas();
    } catch (error) {
      console.error('Error confirming:', error);
      // Check if error is due to missing payments
      if (error.response?.data?.detail?.includes('pago')) {
        toast.error('Error: Debe asignar pagos antes de confirmar');
      } else {
        toast.error('Error al confirmar venta');
      }
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

  const handleExportExcel = () => {
    try {
      // Prepare data for Excel (without ID)
      const excelData = filteredVentas.map(v => ({
        'Fecha': formatDateTime(v.date_order),
        'Tipo': v.tipo_comp || '-',
        'N° Comprobante': v.num_comp || '-',
        'Orden': v.name || '-',
        'Empresa': v.company_name || '-',
        'Cliente': v.partner_name || '-',
        'Tienda': v.tienda_name || '-',
        'Pagos Odoo': v.x_pagos || '-',
        'Pagos Asignados': '-', // TODO: implementar cuando tengas pagos asignados
        'Total': v.amount_total || 0
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas POS');

      // Auto-size columns
      const colWidths = [
        { wch: 18 }, // Fecha
        { wch: 8 },  // Tipo
        { wch: 15 }, // N° Comprobante
        { wch: 20 }, // Orden
        { wch: 30 }, // Empresa
        { wch: 30 }, // Cliente
        { wch: 20 }, // Tienda
        { wch: 25 }, // Pagos Odoo
        { wch: 18 }, // Pagos Asignados
        { wch: 12 }  // Total
      ];
      ws['!cols'] = colWidths;

      // Generate filename with date
      const today = new Date().toISOString().split('T')[0];
      const filename = `ventas_pos_${today}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success(`Exportadas ${excelData.length} ventas a Excel`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar a Excel');
    }
  };

  // Payment modal functions
  const openPagosModal = async (venta) => {
    setVentaSeleccionada(venta);
    setShowPagosModal(true);
    setLoadingPagos(true);
    
    try {
      // Load pagos
      const response = await getPagosVentaPOS(venta.id);
      setPagos(response.data);
      
      // Load cuentas financieras
      const cuentasResp = await getCuentasFinancieras();
      setCuentasFinancieras(cuentasResp.data);
      
      // Calculate faltante
      const totalPagos = response.data.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
      const faltante = parseFloat(venta.amount_total) - totalPagos;
      
      // Pre-fill form with smart defaults
      const numPagosExistentes = response.data.length;
      const referenciaAuto = numPagosExistentes === 0 
        ? venta.num_comp || venta.name 
        : `${venta.num_comp || venta.name} - ${numPagosExistentes + 1}`;
      
      setNuevoPago({
        forma_pago: 'Efectivo',
        cuenta_financiera_id: cuentasResp.data.length > 0 ? cuentasResp.data[0].id : '',
        monto: faltante > 0 ? faltante.toFixed(2) : '',
        referencia: referenciaAuto,
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: ''
      });
      
    } catch (error) {
      console.error('Error loading pagos:', error);
      toast.error('Error al cargar pagos');
    } finally {
      setLoadingPagos(false);
    }
  };

  const closePagosModal = () => {
    setShowPagosModal(false);
    setVentaSeleccionada(null);
    setPagos([]);
    setCuentasFinancieras([]);
    setNuevoPago({
      forma_pago: 'Efectivo',
      cuenta_financiera_id: '',
      monto: '',
      referencia: '',
      fecha_pago: new Date().toISOString().split('T')[0],
      observaciones: ''
    });
  };

  const handleAddPago = async () => {
    if (!nuevoPago.monto || parseFloat(nuevoPago.monto) <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    if (!nuevoPago.cuenta_financiera_id) {
      toast.error('Seleccione una cuenta');
      return;
    }

    try {
      const response = await addPagoVentaPOS(ventaSeleccionada.id, {
        ...nuevoPago,
        monto: parseFloat(nuevoPago.monto)
      });
      
      if (response.data.auto_confirmed) {
        toast.success('✅ ' + response.data.message);
        closePagosModal();
        loadVentas();
      } else {
        toast.success(response.data.message + ` (Falta: S/ ${response.data.faltante.toFixed(2)})`);
        
        // Reload pagos
        const pagosResp = await getPagosVentaPOS(ventaSeleccionada.id);
        setPagos(pagosResp.data);
        
        // Calculate new faltante and update form
        const totalPagos = pagosResp.data.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
        const faltante = parseFloat(ventaSeleccionada.amount_total) - totalPagos;
        const numPagos = pagosResp.data.length;
        
        setNuevoPago({
          ...nuevoPago,
          monto: faltante > 0 ? faltante.toFixed(2) : '',
          referencia: `${ventaSeleccionada.num_comp || ventaSeleccionada.name} - ${numPagos + 1}`,
          observaciones: ''
        });
      }
    } catch (error) {
      console.error('Error adding pago:', error);
      toast.error('Error al agregar pago');
    }
  };

  const handleDeletePago = async (pagoId) => {
    if (!window.confirm('¿Eliminar este pago?')) return;
    
    try {
      await deletePagoVentaPOS(ventaSeleccionada.id, pagoId);
      toast.success('Pago eliminado');
      
      // Reload pagos
      const response = await getPagosVentaPOS(ventaSeleccionada.id);
      setPagos(response.data);
    } catch (error) {
      console.error('Error deleting pago:', error);
      toast.error('Error al eliminar pago');
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

  // Calculate KPIs - ONLY confirmed sales count as real sales
  const ventasConfirmadas = filteredVentas.filter(v => v.estado_local === 'confirmada');
  const totalVentas = ventasConfirmadas.length;
  const montoTotal = ventasConfirmadas.reduce((sum, v) => sum + parseFloat(v.amount_total || 0), 0);

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
            className="btn btn-success"
            onClick={handleExportExcel}
            disabled={filteredVentas.length === 0}
            data-testid="export-excel-btn"
          >
            <Download size={18} />
            Exportar Excel
          </button>
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
            <option value="3">Proyecto Moda</option>
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
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>N° Comprobante</th>
                    <th>Orden</th>
                    <th>Empresa</th>
                    <th>Cliente</th>
                    <th>Tienda</th>
                    <th>Pagos Odoo</th>
                    <th>Pagos Asignados</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVentas.map((venta) => (
                    <tr key={venta.id} data-testid={`venta-row-${venta.id}`}>
                      <td>{formatDateTime(venta.date_order)}</td>
                      <td>{venta.tipo_comp || '-'}</td>
                      <td>{venta.num_comp || '-'}</td>
                      <td style={{ fontWeight: 500 }}>{venta.name}</td>
                      <td>{venta.company_name || '-'}</td>
                      <td>{venta.partner_name || '-'}</td>
                      <td>{venta.tienda_name || '-'}</td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {venta.x_pagos || '-'}
                      </td>
                      <td className="text-center">
                        {venta.estado_local === 'pendiente' ? (
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => openPagosModal(venta)}
                            title="Asignar pagos"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            <Plus size={12} style={{ marginRight: '0.25rem' }} />
                            S/ {venta.pagos_asignados ? parseFloat(venta.pagos_asignados).toFixed(2) : '0.00'}
                          </button>
                        ) : (
                          <span style={{ color: '#666', fontSize: '0.85rem' }}>
                            S/ {venta.pagos_asignados ? parseFloat(venta.pagos_asignados).toFixed(2) : '0.00'}
                          </span>
                        )}
                      </td>
                      <td className="text-right" style={{ fontWeight: 500 }}>
                        {formatCurrency(venta.amount_total)}
                      </td>
                      <td className="text-center">
                        {venta.estado_local === 'pendiente' && (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleConfirmar(venta.id)}
                              title="Confirmar (requiere pagos asignados)"
                              data-testid={`confirmar-${venta.id}`}
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleCredito(venta.id)}
                              title="Marcar Crédito (va a módulo CxC)"
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

      {/* Modal Asignar Pagos */}
      {showPagosModal && ventaSeleccionada && (
        <div className="modal-overlay" onClick={closePagosModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Asignar Pagos - {ventaSeleccionada.name}</h2>
              <button className="modal-close" onClick={closePagosModal}>×</button>
            </div>

            <div className="modal-body">
              {/* Info de la venta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Cliente</div>
                  <div style={{ fontWeight: 500 }}>{ventaSeleccionada.partner_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Total Venta</div>
                  <div style={{ fontWeight: 600, fontSize: '1.25rem', color: '#2563eb' }}>
                    {formatCurrency(ventaSeleccionada.amount_total)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Pagos Asignados</div>
                  <div style={{ fontWeight: 600, color: '#16a34a' }}>
                    {formatCurrency(pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Faltante</div>
                  <div style={{ fontWeight: 600, color: '#dc2626' }}>
                    {formatCurrency(ventaSeleccionada.amount_total - pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0))}
                  </div>
                </div>
              </div>

              {/* Lista de pagos existentes */}
              {pagos.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Pagos Registrados</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                    {pagos.map(pago => (
                      <div key={pago.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{pago.forma_pago} - {formatCurrency(pago.monto)}</div>
                          {pago.referencia && (
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>Ref: {pago.referencia}</div>
                          )}
                        </div>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleDeletePago(pago.id)}
                          style={{ color: '#dc2626' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario nuevo pago */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', background: '#fafbfc' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Agregar Pago</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">Forma de Pago</label>
                    <select 
                      className="form-select"
                      value={nuevoPago.forma_pago}
                      onChange={(e) => setNuevoPago({...nuevoPago, forma_pago: e.target.value})}
                    >
                      <option>Efectivo</option>
                      <option>Yape</option>
                      <option>Plin</option>
                      <option>Transferencia</option>
                      <option>Tarjeta Débito</option>
                      <option>Tarjeta Crédito</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Monto</label>
                    <input 
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      step="0.01"
                      value={nuevoPago.monto}
                      onChange={(e) => setNuevoPago({...nuevoPago, monto: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label">Referencia</label>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="Nro. operación, etc."
                      value={nuevoPago.referencia}
                      onChange={(e) => setNuevoPago({...nuevoPago, referencia: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Fecha</label>
                    <input 
                      type="date"
                      className="form-input"
                      value={nuevoPago.fecha_pago}
                      onChange={(e) => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Observaciones</label>
                  <textarea 
                    className="form-input"
                    rows="2"
                    placeholder="Opcional..."
                    value={nuevoPago.observaciones}
                    onChange={(e) => setNuevoPago({...nuevoPago, observaciones: e.target.value})}
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleAddPago}
                  style={{ width: '100%' }}
                >
                  <Plus size={16} />
                  Agregar Pago
                </button>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.8125rem', color: '#1e40af' }}>
                💡 <strong>Nota:</strong> Cuando la suma de pagos sea igual al total, la venta se confirmará automáticamente.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closePagosModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasPOS;
