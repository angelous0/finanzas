import React, { useState, useEffect } from 'react';
import { 
  getVentasPOS, syncVentasPOS, confirmarVentaPOS, desconfirmarVentaPOS,
  marcarCreditoVentaPOS, descartarVentaPOS,
  getPagosVentaPOS, getPagosOficialesVentaPOS, addPagoVentaPOS, updatePagoVentaPOS, deletePagoVentaPOS,
  getCuentasFinancieras, getLineasVentaPOS
} from '../services/api';
import { RefreshCw, Check, CreditCard, X, Filter, ShoppingCart, Download, Plus, Trash2, Eye, RotateCcw, Search, Edit } from 'lucide-react';
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
  
  // Get 30 days ago in Lima timezone
  const get30DaysAgoInLima = () => {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const lima = new Date(utc + (3600000 * -5));
    lima.setDate(lima.getDate() - 30);
    return lima.toISOString().split('T')[0];
  };
  
  // Filtros - Default to 30 days ago to yesterday in Lima timezone
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [fechaDesde, setFechaDesde] = useState(get30DaysAgoInLima());
  const [fechaHasta, setFechaHasta] = useState(getYesterdayInLima());
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Input value
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  // Modal pagos (para asignar pagos a pendientes)
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
  
  // Modal pagos oficiales (para ver pagos de confirmadas)
  const [showPagosOficialesModal, setShowPagosOficialesModal] = useState(false);
  const [pagosOficiales, setPagosOficiales] = useState([]);
  const [loadingPagosOficiales, setLoadingPagosOficiales] = useState(false);
  
  // Modal editar pago
  const [showEditPagoModal, setShowEditPagoModal] = useState(false);
  const [pagoEditando, setPagoEditando] = useState(null);
  
  // Modal ver líneas de productos
  const [showLineasModal, setShowLineasModal] = useState(false);
  const [lineasProductos, setLineasProductos] = useState([]);
  const [loadingLineas, setLoadingLineas] = useState(false);

  useEffect(() => {
    loadVentas();
  }, [activeTab, filtroEmpresa, fechaDesde, fechaHasta, search]);

  const loadVentas = async () => {
    try {
      setLoading(true);
      const params = {
        estado: activeTab !== 'todas' ? activeTab : undefined,
        company_id: filtroEmpresa || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        search: search || undefined
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

  // Ver pagos de venta confirmada (abre modal)
  const verPagosConfirmada = async (venta) => {
    setVentaSeleccionada(venta);
    setShowPagosOficialesModal(true);
    setLoadingPagosOficiales(true);
    
    try {
      const response = await getPagosOficialesVentaPOS(venta.id);
      setPagosOficiales(response.data);
    } catch (error) {
      console.error('Error loading pagos oficiales:', error);
      toast.error('Error al cargar pagos');
    } finally {
      setLoadingPagosOficiales(false);
    }
  };
  
  // Exportar pagos oficiales a Excel
  const exportarPagosOficiales = () => {
    if (!pagosOficiales || pagosOficiales.length === 0) {
      toast.error('No hay pagos para exportar');
      return;
    }
    
    try {
      const excelData = pagosOficiales.map(p => ({
        'Número': p.numero,
        'Forma de Pago': p.forma_pago,
        'Monto': p.monto,
        'Cuenta': p.cuenta_nombre || '-',
        'Referencia': p.referencia || '-',
        'Fecha': new Date(p.fecha).toLocaleDateString('es-PE'),
        'Observaciones': p.observaciones || '-'
      }));
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
      
      const filename = `pagos_${ventaSeleccionada.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      toast.success(`Exportados ${pagosOficiales.length} pagos a Excel`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar pagos');
    }
  };
  
  // Cerrar modal de pagos oficiales
  const closePagosOficialesModal = () => {
    setShowPagosOficialesModal(false);
    setVentaSeleccionada(null);
    setPagosOficiales([]);
  };
  
  // Desconfirmar venta (volver a pendiente)
  const handleDesconfirmar = async () => {
    if (!ventaSeleccionada) return;
    
    // Confirmación del usuario
    const confirmado = window.confirm(
      `¿Está seguro que desea DESCONFIRMAR esta venta?\n\n` +
      `Venta: ${ventaSeleccionada.name}\n` +
      `Cliente: ${ventaSeleccionada.partner_name}\n` +
      `Total: ${formatCurrency(ventaSeleccionada.amount_total)}\n\n` +
      `La venta volverá a estado PENDIENTE y los pagos oficiales se eliminarán.\n` +
      `Podrá volver a asignar pagos desde la pestaña Pendientes.`
    );
    
    if (!confirmado) return;
    
    try {
      const response = await desconfirmarVentaPOS(ventaSeleccionada.id);
      toast.success(response.data.message);
      
      // Cerrar modal
      closePagosOficialesModal();
      
      // Recargar lista de ventas
      loadVentas();
    } catch (error) {
      console.error('Error desconfirmando venta:', error);
      toast.error(error.response?.data?.detail || 'Error al desconfirmar venta');
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
        loadVentas(); // Reload main list
      } else {
        toast.success(response.data.message + ` (Falta: S/ ${response.data.faltante.toFixed(2)})`);
        
        // Reload pagos in modal
        const pagosResp = await getPagosVentaPOS(ventaSeleccionada.id);
        setPagos(pagosResp.data);
        
        // ✅ IMPORTANTE: Reload main ventas list to update "Pagos Asignados" column
        loadVentas();
        
        // Calculate new faltante and update form
        const totalPagos = pagosResp.data.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
        const faltante = parseFloat(ventaSeleccionada.amount_total) - totalPagos;
        const numPagos = pagosResp.data.length;
        
        // Update ventaSeleccionada with new pagos_asignados for display
        setVentaSeleccionada({
          ...ventaSeleccionada,
          pagos_asignados: totalPagos
        });
        
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
  
  const handleEditPago = (pago) => {
    setPagoEditando({...pago});
    setShowEditPagoModal(true);
  };
  
  const handleUpdatePago = async () => {
    if (!pagoEditando || !pagoEditando.monto || parseFloat(pagoEditando.monto) <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    
    try {
      await updatePagoVentaPOS(ventaSeleccionada.id, pagoEditando.id, pagoEditando);
      toast.success('Pago actualizado correctamente');
      
      setShowEditPagoModal(false);
      setPagoEditando(null);
      
      // Reload pagos
      const response = await getPagosVentaPOS(ventaSeleccionada.id);
      setPagos(response.data);
    } catch (error) {
      console.error('Error updating pago:', error);
      toast.error('Error al actualizar pago');
    }
  };
  
  // Ver líneas de productos
  const verLineasProductos = async (venta) => {
    setVentaSeleccionada(venta);
    setShowLineasModal(true);
    setLoadingLineas(true);
    
    try {
      const response = await getLineasVentaPOS(venta.id);
      setLineasProductos(response.data);
    } catch (error) {
      console.error('Error loading product lines:', error);
      toast.error('Error al cargar líneas de productos');
    } finally {
      setLoadingLineas(false);
    }
  };
  
  const closeLineasModal = () => {
    setShowLineasModal(false);
    setVentaSeleccionada(null);
    setLineasProductos([]);
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
          <div style={{ position: 'relative', minWidth: '300px' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#9ca3af',
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              className="form-input filter-input"
              placeholder="🔍 Buscar por comprobante, cliente u orden..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ 
                paddingLeft: '40px',
                paddingRight: searchInput ? '40px' : '12px',
                minWidth: '300px'
              }}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  borderRadius: '4px'
                }}
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
            {loading && search && (
              <span style={{
                position: 'absolute',
                right: searchInput ? '36px' : '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.75rem',
                color: '#6b7280'
              }}>
                Buscando...
              </span>
            )}
          </div>
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
                <div className="empty-state-title">
                  {search ? 'No se encontraron resultados' : 'No hay ventas'}
                </div>
                <div className="empty-state-description">
                  {search 
                    ? `No se encontraron ventas para "${search}". Intenta con otro término de búsqueda.`
                    : 'Sincroniza las ventas desde Odoo para verlas aquí'
                  }
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                            <span style={{ color: '#059669', fontSize: '0.875rem', fontWeight: 600 }}>
                              S/ {venta.pagos_oficiales ? parseFloat(venta.pagos_oficiales).toFixed(2) : '0.00'}
                            </span>
                            {venta.num_pagos_oficiales > 0 && (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => verPagosConfirmada(venta)}
                                title="Ver y exportar pagos"
                                style={{ padding: '0.25rem', fontSize: '0.7rem' }}
                              >
                                <Eye size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-right" style={{ fontWeight: 500 }}>
                        {formatCurrency(venta.amount_total)}
                      </td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => verLineasProductos(venta)}
                            title="Ver productos"
                            style={{ fontSize: '0.7rem' }}
                          >
                            <ShoppingCart size={14} />
                          </button>
                          {venta.estado_local === 'pendiente' && (
                            <>
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
                            </>
                          )}
                        </div>
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
        <div className="modal-overlay" onClick={closePagosModal} style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', backgroundColor: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '1rem' }}>
              <div>
                <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                  💳 Asignar Pagos
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {ventaSeleccionada.name} • {ventaSeleccionada.partner_name}
                </p>
              </div>
              <button className="modal-close" onClick={closePagosModal} style={{ fontSize: '1.75rem', color: '#9ca3af' }}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Info de la venta */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', color: 'white' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ventaSeleccionada.partner_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Venta</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatCurrency(ventaSeleccionada.amount_total)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pagado</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#a7f3d0' }}>
                    {formatCurrency(pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faltante</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#fca5a5' }}>
                    {formatCurrency(ventaSeleccionada.amount_total - pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0))}
                  </div>
                </div>
              </div>

              {/* Lista de pagos existentes */}
              {pagos.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>📋 Pagos Registrados</h4>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fafbfc' }}>
                    {pagos.map(pago => (
                      <div key={pago.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '0.125rem' }}>
                            {pago.forma_pago} - {formatCurrency(pago.monto)}
                          </div>
                          {pago.referencia && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ref: {pago.referencia}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-sm"
                            onClick={() => handleEditPago(pago)}
                            style={{ color: '#2563eb', padding: '0.375rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}
                            title="Editar pago"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            className="btn btn-sm"
                            onClick={() => handleDeletePago(pago.id)}
                            style={{ color: '#dc2626', padding: '0.375rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}
                            title="Eliminar pago"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulario nuevo pago */}
              <div style={{ border: '2px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', background: '#ffffff' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1.25rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={18} style={{ color: '#10b981' }} />
                  Agregar Nuevo Pago
                </h4>
                
                {/* PRIMERO: Cuenta */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block', color: '#111827', fontSize: '0.9375rem' }}>
                    Cuenta / Caja <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={nuevoPago.cuenta_financiera_id}
                    onChange={(e) => setNuevoPago({...nuevoPago, cuenta_financiera_id: e.target.value})}
                    style={{ fontSize: '0.9375rem', padding: '0.75rem', borderRadius: '8px', border: '2px solid #d1d5db', fontWeight: 500 }}
                  >
                    <option value="">Seleccione una cuenta...</option>
                    {cuentasFinancieras.map(cuenta => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.tipo === 'banco' ? '🏦' : '💰'} {cuenta.nombre} {cuenta.banco ? `- ${cuenta.banco}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SEGUNDO: Forma de Pago y Monto */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                      Forma de Pago <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select 
                      className="form-select"
                      value={nuevoPago.forma_pago}
                      onChange={(e) => setNuevoPago({...nuevoPago, forma_pago: e.target.value})}
                      style={{ fontSize: '0.9375rem', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #d1d5db' }}
                    >
                      <option value="Efectivo">💵 Efectivo</option>
                      <option value="Yape">📱 Yape</option>
                      <option value="Plin">📱 Plin</option>
                      <option value="Transferencia">🏦 Transferencia</option>
                      <option value="Tarjeta Débito">💳 Tarjeta Débito</option>
                      <option value="Tarjeta Crédito">💳 Tarjeta Crédito</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                      Monto <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input 
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      step="0.01"
                      value={nuevoPago.monto}
                      onChange={(e) => setNuevoPago({...nuevoPago, monto: e.target.value})}
                      style={{ fontSize: '0.9375rem', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #d1d5db', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                      Referencia / N° Comprobante
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      placeholder="Auto-generado..."
                      value={nuevoPago.referencia}
                      onChange={(e) => setNuevoPago({...nuevoPago, referencia: e.target.value})}
                      style={{ fontSize: '0.875rem', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #d1d5db' }}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                      Fecha
                    </label>
                    <input 
                      type="date"
                      className="form-input"
                      value={nuevoPago.fecha_pago}
                      onChange={(e) => setNuevoPago({...nuevoPago, fecha_pago: e.target.value})}
                      style={{ fontSize: '0.875rem', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #d1d5db' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 500, marginBottom: '0.5rem', display: 'block', color: '#374151' }}>
                    Observaciones
                  </label>
                  <textarea 
                    className="form-input"
                    rows="2"
                    placeholder="Opcional..."
                    value={nuevoPago.observaciones}
                    onChange={(e) => setNuevoPago({...nuevoPago, observaciones: e.target.value})}
                    style={{ fontSize: '0.875rem', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #d1d5db', resize: 'vertical' }}
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleAddPago}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', fontWeight: 600, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Plus size={18} />
                  Agregar Pago
                </button>
              </div>

              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '8px', fontSize: '0.8125rem', color: '#1e40af', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <div>
                  <strong>Nota:</strong> Cuando la suma de pagos sea igual al total, la venta se confirmará automáticamente.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '2px solid #f3f4f6', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={closePagosModal} style={{ padding: '0.625rem 1.25rem', borderRadius: '8px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Pagos Oficiales (Confirmadas) */}
      {showPagosOficialesModal && ventaSeleccionada && (
        <div className="modal-overlay" onClick={closePagosOficialesModal} style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', backgroundColor: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #f3f4f6', paddingBottom: '1rem' }}>
              <div>
                <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827' }}>
                  📋 Pagos Registrados
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {ventaSeleccionada.name} • {ventaSeleccionada.partner_name}
                </p>
              </div>
              <button className="modal-close" onClick={closePagosOficialesModal} style={{ fontSize: '1.75rem', color: '#9ca3af' }}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Info de la venta */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', color: 'white' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente</div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ventaSeleccionada.partner_name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Venta</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                    {formatCurrency(ventaSeleccionada.amount_total)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.9, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Pagado</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#d1fae5' }}>
                    {formatCurrency(ventaSeleccionada.pagos_oficiales || 0)}
                  </div>
                </div>
              </div>

              {/* Tabla de pagos */}
              {loadingPagosOficiales ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="loading loading-spinner loading-lg"></div>
                  <p style={{ marginTop: '1rem', color: '#6b7280' }}>Cargando pagos...</p>
                </div>
              ) : pagosOficiales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
                  <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>No hay pagos registrados</p>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Esta venta no tiene pagos oficiales</p>
                </div>
              ) : (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  <table className="table table-zebra" style={{ marginBottom: 0 }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ fontWeight: 600, color: '#374151' }}>Número</th>
                        <th style={{ fontWeight: 600, color: '#374151' }}>Fecha</th>
                        <th style={{ fontWeight: 600, color: '#374151' }}>Forma de Pago</th>
                        <th style={{ fontWeight: 600, color: '#374151' }}>Cuenta</th>
                        <th style={{ fontWeight: 600, color: '#374151' }}>Referencia</th>
                        <th className="text-right" style={{ fontWeight: 600, color: '#374151' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosOficiales.map((pago) => (
                        <tr key={pago.id}>
                          <td style={{ fontWeight: 500, color: '#111827' }}>{pago.numero}</td>
                          <td>{new Date(pago.fecha).toLocaleDateString('es-PE')}</td>
                          <td>
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              backgroundColor: '#dbeafe', 
                              color: '#1e40af', 
                              borderRadius: '9999px', 
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {pago.forma_pago}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{pago.cuenta_nombre || '-'}</td>
                          <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{pago.referencia || '-'}</td>
                          <td className="text-right" style={{ fontWeight: 600, color: '#059669' }}>
                            {formatCurrency(pago.monto)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                      <tr>
                        <td colSpan="5" style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>TOTAL</td>
                        <td className="text-right" style={{ fontWeight: 700, fontSize: '1.125rem', color: '#059669' }}>
                          {formatCurrency(pagosOficiales.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '2px solid #f3f4f6', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={closePagosOficialesModal} 
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '8px' }}
                >
                  Cerrar
                </button>
                {pagosOficiales.length > 0 && (
                  <button 
                    className="btn btn-error btn-outline"
                    onClick={handleDesconfirmar}
                    style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    title="Desconfirmar venta y eliminar pagos oficiales"
                  >
                    <RotateCcw size={16} />
                    Desconfirmar Venta
                  </button>
                )}
              </div>
              {pagosOficiales.length > 0 && (
                <button 
                  className="btn btn-primary"
                  onClick={exportarPagosOficiales}
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={16} />
                  Exportar a Excel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Ver Líneas de Productos */}
      {showLineasModal && ventaSeleccionada && (
        <div className="modal-overlay" onClick={closeLineasModal} style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', backgroundColor: '#ffffff' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #f3f4f6' }}>
              <div>
                <h2 className="modal-title" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  📋 Detalles de Productos
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {ventaSeleccionada.name} • {ventaSeleccionada.partner_name} • Total: {formatCurrency(ventaSeleccionada.amount_total)}
                </p>
              </div>
              <button className="modal-close" onClick={closeLineasModal}>×</button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {loadingLineas ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="loading loading-spinner loading-lg"></div>
                  <p style={{ marginTop: '1rem', color: '#6b7280' }}>Cargando productos...</p>
                </div>
              ) : lineasProductos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f9fafb', borderRadius: '12px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                  <p style={{ fontSize: '1rem', color: '#6b7280' }}>No hay líneas de productos para esta venta</p>
                </div>
              ) : (
                <>
                  {/* Tabla de productos */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                    <table className="table table-zebra" style={{ marginBottom: 0 }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th>Producto</th>
                          <th>Código</th>
                          <th className="text-right">Cant.</th>
                          <th className="text-right">P. Unit</th>
                          <th className="text-right">Subtotal</th>
                          <th>Marca</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasProductos.map((linea, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: 500 }}>{linea.product_name}</td>
                            <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{linea.product_code || '-'}</td>
                            <td className="text-right">{linea.qty}</td>
                            <td className="text-right">{formatCurrency(linea.price_unit)}</td>
                            <td className="text-right" style={{ fontWeight: 600 }}>{formatCurrency(linea.price_subtotal)}</td>
                            <td>
                              {linea.marca ? (
                                <span style={{ 
                                  padding: '0.25rem 0.75rem', 
                                  backgroundColor: '#dbeafe', 
                                  color: '#1e40af', 
                                  borderRadius: '9999px', 
                                  fontSize: '0.75rem'
                                }}>
                                  {linea.marca}
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {linea.tipo ? (
                                <span style={{ 
                                  padding: '0.25rem 0.75rem', 
                                  backgroundColor: '#fef3c7', 
                                  color: '#92400e', 
                                  borderRadius: '9999px', 
                                  fontSize: '0.75rem'
                                }}>
                                  {linea.tipo}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                        <tr>
                          <td colSpan="4" style={{ fontWeight: 600 }}>TOTAL</td>
                          <td className="text-right" style={{ fontWeight: 700, fontSize: '1.125rem', color: '#059669' }}>
                            {formatCurrency(lineasProductos.reduce((sum, l) => sum + parseFloat(l.price_subtotal || 0), 0))}
                          </td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Resumen por Línea de Negocio */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    {/* Por Marca */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', backgroundColor: '#f9fafb' }}>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>
                        📊 Total por Marca
                      </h4>
                      {(() => {
                        const porMarca = {};
                        lineasProductos.forEach(l => {
                          const marca = l.marca || 'Sin Marca';
                          porMarca[marca] = (porMarca[marca] || 0) + parseFloat(l.price_subtotal || 0);
                        });
                        return Object.entries(porMarca)
                          .sort((a, b) => b[1] - a[1])
                          .map(([marca, total]) => (
                            <div key={marca} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                              <span style={{ fontSize: '0.875rem' }}>{marca}</span>
                              <span style={{ fontWeight: 600, color: '#059669' }}>{formatCurrency(total)}</span>
                            </div>
                          ));
                      })()}
                    </div>

                    {/* Por Tipo */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', backgroundColor: '#f9fafb' }}>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>
                        📊 Total por Tipo (Línea de Negocio)
                      </h4>
                      {(() => {
                        const porTipo = {};
                        lineasProductos.forEach(l => {
                          const tipo = l.tipo || 'Sin Tipo';
                          porTipo[tipo] = (porTipo[tipo] || 0) + parseFloat(l.price_subtotal || 0);
                        });
                        return Object.entries(porTipo)
                          .sort((a, b) => b[1] - a[1])
                          .map(([tipo, total]) => (
                            <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }}>
                              <span style={{ fontSize: '0.875rem' }}>{tipo}</span>
                              <span style={{ fontWeight: 600, color: '#059669' }}>{formatCurrency(total)}</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '2px solid #f3f4f6' }}>
              <button className="btn btn-outline" onClick={closeLineasModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Editar Pago */}
      {showEditPagoModal && pagoEditando && (
        <div className="modal-overlay" onClick={() => setShowEditPagoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">✏️ Editar Pago</h2>
              <button className="modal-close" onClick={() => setShowEditPagoModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Cuenta / Caja</label>
                <select 
                  className="form-select"
                  value={pagoEditando.cuenta_financiera_id || ''}
                  onChange={(e) => setPagoEditando({...pagoEditando, cuenta_financiera_id: parseInt(e.target.value)})}
                >
                  <option value="">Seleccione una cuenta...</option>
                  {cuentasFinancieras.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Forma de Pago</label>
                <select 
                  className="form-select"
                  value={pagoEditando.forma_pago || 'Efectivo'}
                  onChange={(e) => setPagoEditando({...pagoEditando, forma_pago: e.target.value})}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Monto</label>
                <input 
                  type="number" 
                  className="form-input"
                  step="0.01"
                  value={pagoEditando.monto || ''}
                  onChange={(e) => setPagoEditando({...pagoEditando, monto: parseFloat(e.target.value)})}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Referencia</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={pagoEditando.referencia || ''}
                  onChange={(e) => setPagoEditando({...pagoEditando, referencia: e.target.value})}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Fecha</label>
                <input 
                  type="date" 
                  className="form-input"
                  value={pagoEditando.fecha_pago || ''}
                  onChange={(e) => setPagoEditando({...pagoEditando, fecha_pago: e.target.value})}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Observaciones</label>
                <textarea 
                  className="form-input"
                  rows="2"
                  value={pagoEditando.observaciones || ''}
                  onChange={(e) => setPagoEditando({...pagoEditando, observaciones: e.target.value})}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowEditPagoModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleUpdatePago}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasPOS;
