import React, { useState, useEffect, useCallback } from 'react';
import { 
  getCuentasFinancieras, getMovimientosBanco, getPagos,
  importarExcelBanco, getConciliaciones, conciliarMovimientos, previsualizarExcelBanco
} from '../services/api';
import { 
  Upload, Search, RefreshCw, Check, X, FileSpreadsheet, 
  AlertCircle, CheckCircle, Clock, ArrowDown, Download,
  Building2, Link2, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-PE');
};

const BANCOS = [
  { id: 'BCP', nombre: 'BCP - Banco de Crédito' },
  { id: 'BBVA', nombre: 'BBVA Continental' },
  { id: 'IBK', nombre: 'Interbank' },
  { id: 'SCOTIABANK', nombre: 'Scotiabank' },
  { id: 'PERSONALIZADO', nombre: 'Personalizado' }
];

export const ConciliacionBancaria = () => {
  const [cuentas, setCuentas] = useState([]);
  const [movimientosBanco, setMovimientosBanco] = useState([]);
  const [movimientosSistema, setMovimientosSistema] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [bancoSeleccionado, setBancoSeleccionado] = useState('BCP');
  const [filtroBanco, setFiltroBanco] = useState('pendientes'); // New filter state
  
  const [selectedBanco, setSelectedBanco] = useState([]);
  const [selectedSistema, setSelectedSistema] = useState([]);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState('pendientes');
  const [expandedBanco, setExpandedBanco] = useState(true);
  const [expandedSistema, setExpandedSistema] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [cuentasRes] = await Promise.all([getCuentasFinancieras()]);
      setCuentas(cuentasRes.data.filter(c => c.tipo === 'banco'));
      
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      setFechaDesde(lastMonth.toISOString().split('T')[0]);
      setFechaHasta(today.toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadMovimientos = useCallback(async () => {
    if (!cuentaSeleccionada) {
      toast.error('Seleccione una cuenta bancaria');
      return;
    }
    
    try {
      setLoading(true);
      const [bancoPendientesRes, bancoConciliadosRes, sistemaRes, concilRes] = await Promise.all([
        getMovimientosBanco({ cuenta_financiera_id: cuentaSeleccionada, procesado: false }),
        getMovimientosBanco({ cuenta_financiera_id: cuentaSeleccionada, procesado: true }),
        getPagos({ cuenta_financiera_id: cuentaSeleccionada, fecha_desde: fechaDesde, fecha_hasta: fechaHasta }),
        getConciliaciones(cuentaSeleccionada)
      ]);
      
      // Combine pending and reconciled bank movements
      const allBancoMovements = [...(bancoPendientesRes.data || []), ...(bancoConciliadosRes.data || [])];
      setMovimientosBanco(allBancoMovements);
      setMovimientosSistema(sistemaRes.data || []);
      setConciliaciones(concilRes.data || []);
      setSelectedBanco([]);
      setSelectedSistema([]);
    } catch (error) {
      console.error('Error loading movements:', error);
      toast.error('Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }, [cuentaSeleccionada, fechaDesde, fechaHasta]);

  const handlePreviewExcel = async () => {
    if (!uploadFile) return;
    
    try {
      setImporting(true);
      const result = await previsualizarExcelBanco(uploadFile, bancoSeleccionado);
      setPreviewData(result.data.preview);
      setShowImportModal(false);
      setShowPreviewModal(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al previsualizar Excel');
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!uploadFile || !cuentaSeleccionada) return;
    
    try {
      setImporting(true);
      const result = await importarExcelBanco(uploadFile, cuentaSeleccionada, bancoSeleccionado);
      const data = result.data;
      
      let msg = '';
      if (data.imported > 0) msg += `${data.imported} nuevos`;
      if (data.updated > 0) msg += `${msg ? ', ' : ''}${data.updated} actualizados`;
      if (data.skipped > 0) msg += `${msg ? ', ' : ''}${data.skipped} omitidos (ya conciliados)`;
      
      toast.success(msg || 'Importación completada');
      setShowPreviewModal(false);
      setUploadFile(null);
      setPreviewData(null);
      loadMovimientos();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al importar Excel');
    } finally {
      setImporting(false);
    }
  };

  const handleImportExcel = async () => {
    // Show preview first
    handlePreviewExcel();
  };

  const handleSelectBanco = (id) => {
    setSelectedBanco(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectSistema = (id) => {
    setSelectedSistema(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConciliarManual = async () => {
    if (selectedBanco.length === 0 || selectedSistema.length === 0) {
      toast.error('Seleccione movimientos de ambos lados');
      return;
    }
    
    const totalBanco = selectedBanco.reduce((sum, id) => {
      const mov = movimientosBanco.find(m => m.id === id);
      return sum + (mov ? (mov.monto || 0) : 0);
    }, 0);
    
    const totalSistema = selectedSistema.reduce((sum, id) => {
      const mov = movimientosSistema.find(m => m.id === id);
      return sum + (mov ? (mov.tipo === 'ingreso' ? mov.monto_total : -mov.monto_total) : 0);
    }, 0);
    
    if (Math.abs(totalBanco - totalSistema) > 0.01) {
      toast.error(`Los montos no coinciden: Banco ${formatCurrency(totalBanco)} vs Sistema ${formatCurrency(totalSistema)}`);
      return;
    }
    
    try {
      setLoading(true);
      await conciliarMovimientos(selectedBanco, selectedSistema);
      toast.success('Movimientos conciliados exitosamente');
      await loadMovimientos();
    } catch (error) {
      console.error('Error al conciliar:', error);
      toast.error('Error al guardar la conciliación');
    } finally {
      setLoading(false);
    }
  };

  const handleConciliarAuto = async () => {
    if (movimientosBanco.length === 0 || movimientosSistema.length === 0) {
      toast.error('No hay movimientos para conciliar');
      return;
    }
    
    let conciliados = 0;
    const bancoUsados = new Set();
    const sistemaUsados = new Set();
    
    for (const movBanco of movimientosBanco) {
      if (bancoUsados.has(movBanco.id)) continue;
      const montoBanco = movBanco.monto || 0;
      
      for (const movSistema of movimientosSistema) {
        if (sistemaUsados.has(movSistema.id)) continue;
        const montoSistema = movSistema.tipo === 'ingreso' ? movSistema.monto_total : -movSistema.monto_total;
        
        if (Math.abs(montoBanco - montoSistema) < 0.01) {
          const fechaBanco = new Date(movBanco.fecha);
          const fechaSistema = new Date(movSistema.fecha);
          const diffDays = Math.abs((fechaBanco - fechaSistema) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 3) {
            bancoUsados.add(movBanco.id);
            sistemaUsados.add(movSistema.id);
            conciliados++;
            break;
          }
        }
      }
    }
    
    if (conciliados > 0) {
      toast.success(`Se conciliaron ${conciliados} movimientos automáticamente`);
      loadMovimientos();
    } else {
      toast.info('No se encontraron coincidencias automáticas');
    }
  };

  const pendientesBanco = movimientosBanco.filter(m => !m.procesado).length;
  const pendientesSistema = movimientosSistema.filter(m => !m.conciliado).length;
  const totalBancoPendiente = movimientosBanco.reduce((sum, m) => sum + (m.monto || 0), 0);
  const totalSistemaPendiente = movimientosSistema.reduce((sum, m) => 
    sum + (m.tipo === 'ingreso' ? m.monto_total : -m.monto_total), 0);
  const diferencia = totalBancoPendiente - totalSistemaPendiente;

  const selectedBancoTotal = selectedBanco.reduce((sum, id) => {
    const mov = movimientosBanco.find(m => m.id === id);
    return sum + (mov ? (mov.monto || 0) : 0);
  }, 0);

  const selectedSistemaTotal = selectedSistema.reduce((sum, id) => {
    const mov = movimientosSistema.find(m => m.id === id);
    return sum + (mov ? (mov.tipo === 'ingreso' ? mov.monto_total : -mov.monto_total) : 0);
  }, 0);

  return (
    <div className="page" data-testid="conciliacion-page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Conciliación Bancaria</h1>
          <p className="page-subtitle">Concilie los movimientos del banco con el sistema</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-outline"
            onClick={() => setShowImportModal(true)}
            disabled={!cuentaSeleccionada}
          >
            <Upload size={16} />
            Importar Excel
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleConciliarAuto}
            disabled={movimientosBanco.length === 0}
          >
            <RefreshCw size={16} />
            Conciliar Auto
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '220px', marginBottom: 0 }}>
            <label className="form-label">Cuenta Bancaria</label>
            <select
              className="form-input form-select"
              value={cuentaSeleccionada}
              onChange={(e) => setCuentaSeleccionada(e.target.value)}
            >
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map(cuenta => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre} - {cuenta.banco}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Desde</label>
            <input
              type="date"
              className="form-input"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Hasta</label>
            <input
              type="date"
              className="form-input"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={loadMovimientos}
            disabled={!cuentaSeleccionada}
          >
            <Search size={16} />
            Buscar
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Building2 size={18} />
            <span style={{ fontSize: '0.8125rem', opacity: 0.9 }}>Mov. Banco</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{pendientesBanco}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
            {formatCurrency(totalBancoPendiente)}
          </div>
        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <FileSpreadsheet size={18} />
            <span style={{ fontSize: '0.8125rem', opacity: 0.9 }}>Mov. Sistema</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{pendientesSistema}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
            {formatCurrency(totalSistemaPendiente)}
          </div>
        </div>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <CheckCircle size={18} />
            <span style={{ fontSize: '0.8125rem', opacity: 0.9 }}>Conciliados</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{conciliaciones.length}</div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
            Este período
          </div>
        </div>
        
        <div style={{ 
          background: diferencia === 0 
            ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' 
            : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
          borderRadius: '12px',
          padding: '1.25rem',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ArrowDown size={18} />
            <span style={{ fontSize: '0.8125rem', opacity: 0.9 }}>Diferencia</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
            {formatCurrency(Math.abs(diferencia))}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
            {diferencia === 0 ? 'Cuadrado' : diferencia > 0 ? 'Banco mayor' : 'Sistema mayor'}
          </div>
        </div>
      </div>

      {/* Tabs mejorados */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.25rem',
        background: '#f1f5f9',
        padding: '0.375rem',
        borderRadius: '10px',
        width: 'fit-content'
      }}>
        <button 
          onClick={() => setActiveTab('pendientes')}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'pendientes' ? 'white' : 'transparent',
            color: activeTab === 'pendientes' ? '#1B4D3E' : '#64748b',
            boxShadow: activeTab === 'pendientes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <Clock size={16} /> Pendientes
        </button>
        <button 
          onClick={() => setActiveTab('banco')}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'banco' ? 'white' : 'transparent',
            color: activeTab === 'banco' ? '#1B4D3E' : '#64748b',
            boxShadow: activeTab === 'banco' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <Building2 size={16} /> Movimientos Banco
        </button>
        <button 
          onClick={() => setActiveTab('historial')}
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            background: activeTab === 'historial' ? 'white' : 'transparent',
            color: activeTab === 'historial' ? '#1B4D3E' : '#64748b',
            boxShadow: activeTab === 'historial' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
        >
          <CheckCircle size={16} /> Historial
        </button>
        </div>

        {/* Filter for Movimientos del Banco - Only show in Pendientes tab */}
        {activeTab === 'pendientes' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b', marginRight: '0.5rem', fontWeight: 500 }}>
              Movimientos Banco:
            </span>
            <button
              onClick={() => setFiltroBanco('pendientes')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: filtroBanco === 'pendientes' ? '#2563eb' : 'white',
                color: filtroBanco === 'pendientes' ? 'white' : '#64748b',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Pendientes ({movimientosBanco.filter(m => !m.procesado).length})
            </button>
            <button
              onClick={() => setFiltroBanco('conciliados')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: filtroBanco === 'conciliados' ? '#2563eb' : 'white',
                color: filtroBanco === 'conciliados' ? 'white' : '#64748b',
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Conciliados ({movimientosBanco.filter(m => m.procesado).length})
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'pendientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Banco Section */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div 
              onClick={() => setExpandedBanco(!expandedBanco)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Building2 size={20} />
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                  Movimientos del Banco ({movimientosBanco.length})
                </span>
                {selectedBanco.length > 0 && (
                  <span style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px',
                    fontSize: '0.8125rem'
                  }}>
                    {selectedBanco.length} seleccionados = {formatCurrency(selectedBancoTotal)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="currency-display" style={{ fontWeight: 600 }}>
                  {formatCurrency(totalBancoPendiente)}
                </span>
                {expandedBanco ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
            
            {expandedBanco && (
              <div className="data-table-wrapper" style={{ maxHeight: '300px', overflow: 'auto' }}>
                {/* Filter for bank movements */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <button
                    onClick={() => setFiltroBanco('pendientes')}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: filtroBanco === 'pendientes' ? '#2563eb' : 'white',
                      color: filtroBanco === 'pendientes' ? 'white' : '#64748b',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Pendientes ({movimientosBanco.filter(m => !m.procesado).length})
                  </button>
                  <button
                    onClick={() => setFiltroBanco('conciliados')}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: filtroBanco === 'conciliados' ? '#2563eb' : 'white',
                      color: filtroBanco === 'conciliados' ? 'white' : '#64748b',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Conciliados ({movimientosBanco.filter(m => m.procesado).length})
                  </button>
                </div>

                {loading ? (
                  <div className="loading"><div className="loading-spinner"></div></div>
                ) : movimientosBanco.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <Upload size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 500 }}>No hay movimientos importados</div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      Importe un archivo Excel del banco
                    </div>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedBanco.length === movimientosBanco.length && movimientosBanco.length > 0}
                            onChange={() => {
                              if (selectedBanco.length === movimientosBanco.length) {
                                setSelectedBanco([]);
                              } else {
                                setSelectedBanco(movimientosBanco.map(m => m.id));
                              }
                            }}
                            style={{ width: '16px', height: '16px' }}
                          />
                        </th>
                        <th>Fecha</th>
                        <th>Banco</th>
                        <th>Nro Operación</th>
                        <th>Descripción</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosBanco.filter(m => filtroBanco === 'pendientes' ? !m.procesado : m.procesado).map(mov => (
                        <tr 
                          key={mov.id}
                          className={selectedBanco.includes(mov.id) ? 'selected' : ''}
                          onClick={() => filtroBanco === 'pendientes' && handleSelectBanco(mov.id)}
                          style={{ cursor: filtroBanco === 'pendientes' ? 'pointer' : 'default' }}
                        >
                          {filtroBanco === 'pendientes' && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedBanco.includes(mov.id)}
                                onChange={() => handleSelectBanco(mov.id)}
                                style={{ width: '16px', height: '16px' }}
                              />
                            </td>
                          )}
                          <td>{formatDate(mov.fecha)}</td>
                          <td>{mov.banco_excel || mov.banco || '-'}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                            {mov.referencia || '-'}
                          </td>
                          <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mov.descripcion}
                          </td>
                          <td className="text-right currency-display" style={{ 
                            color: mov.monto < 0 ? '#dc2626' : '#16a34a',
                            fontWeight: 500
                          }}>
                            {formatCurrency(mov.monto, mov.monto < 0 ? '-S/' : 'S/')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Link indicator */}
          {(selectedBanco.length > 0 || selectedSistema.length > 0) && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              padding: '0.5rem'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                background: Math.abs(selectedBancoTotal - selectedSistemaTotal) < 0.01 ? '#dcfce7' : '#fef3c7',
                padding: '0.75rem 1.5rem',
                borderRadius: '30px',
                border: `1px solid ${Math.abs(selectedBancoTotal - selectedSistemaTotal) < 0.01 ? '#86efac' : '#fcd34d'}`
              }}>
                <Link2 size={18} color={Math.abs(selectedBancoTotal - selectedSistemaTotal) < 0.01 ? '#16a34a' : '#d97706'} />
                <span style={{ fontWeight: 500 }}>
                  Banco: {formatCurrency(selectedBancoTotal)} | Sistema: {formatCurrency(selectedSistemaTotal)}
                </span>
                {Math.abs(selectedBancoTotal - selectedSistemaTotal) < 0.01 ? (
                  <Check size={18} color="#16a34a" />
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>
                    Dif: {formatCurrency(Math.abs(selectedBancoTotal - selectedSistemaTotal))}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sistema Section */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div 
              onClick={() => setExpandedSistema(!expandedSistema)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileSpreadsheet size={20} />
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                  Movimientos del Sistema ({movimientosSistema.length})
                </span>
                {selectedSistema.length > 0 && (
                  <span style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px',
                    fontSize: '0.8125rem'
                  }}>
                    {selectedSistema.length} seleccionados = {formatCurrency(selectedSistemaTotal)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="currency-display" style={{ fontWeight: 600 }}>
                  {formatCurrency(totalSistemaPendiente)}
                </span>
                {expandedSistema ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
            
            {expandedSistema && (
              <div className="data-table-wrapper" style={{ maxHeight: '300px', overflow: 'auto' }}>
                {loading ? (
                  <div className="loading"><div className="loading-spinner"></div></div>
                ) : movimientosSistema.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <FileSpreadsheet size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 500 }}>No hay movimientos pendientes</div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                      {cuentaSeleccionada ? 'Los pagos registrados aparecerán aquí' : 'Seleccione una cuenta y busque'}
                    </div>
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedSistema.length === movimientosSistema.length && movimientosSistema.length > 0}
                            onChange={() => {
                              if (selectedSistema.length === movimientosSistema.length) {
                                setSelectedSistema([]);
                              } else {
                                setSelectedSistema(movimientosSistema.map(m => m.id));
                              }
                            }}
                            style={{ width: '16px', height: '16px' }}
                          />
                        </th>
                        <th>Fecha</th>
                        <th>Número</th>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th className="text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosSistema.map(mov => (
                        <tr 
                          key={mov.id}
                          className={selectedSistema.includes(mov.id) ? 'selected' : ''}
                          onClick={() => handleSelectSistema(mov.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedSistema.includes(mov.id)}
                              onChange={() => handleSelectSistema(mov.id)}
                              style={{ width: '16px', height: '16px' }}
                            />
                          </td>
                          <td>{formatDate(mov.fecha)}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                            {mov.numero}
                          </td>
                          <td>
                            <span className={`badge ${mov.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6875rem' }}>
                              {mov.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mov.notas || mov.tercero_nombre || '-'}
                          </td>
                          <td className="text-right currency-display" style={{ 
                            fontWeight: 500,
                            color: mov.tipo === 'ingreso' ? '#16a34a' : '#dc2626'
                          }}>
                            {mov.tipo === 'ingreso' ? '' : '-'}{formatCurrency(mov.monto_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'banco' && (
        <div className="card">
          <div className="data-table-wrapper">
            {movimientosBanco.length === 0 ? (
              <div className="empty-state">
                <Upload className="empty-state-icon" />
                <div className="empty-state-title">No hay movimientos importados</div>
                <div className="empty-state-description">Importe un archivo Excel del banco</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Descripción</th>
                    <th className="text-right">Monto</th>
                    <th className="text-right">Saldo</th>
                    <th className="text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosBanco.map(mov => (
                    <tr key={mov.id}>
                      <td>{formatDate(mov.fecha)}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                        {mov.referencia || '-'}
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mov.descripcion}
                      </td>
                      <td className="text-right currency-display" style={{ 
                        color: mov.monto < 0 ? '#dc2626' : '#16a34a',
                        fontWeight: 500
                      }}>
                        {formatCurrency(mov.monto, mov.monto < 0 ? '-S/' : 'S/')}
                      </td>
                      <td className="text-right currency-display">{mov.saldo ? formatCurrency(mov.saldo) : '-'}</td>
                      <td className="text-center">
                        <span className={`badge ${mov.procesado ? 'badge-success' : 'badge-warning'}`}>
                          {mov.procesado ? 'Conciliado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="card">
          <div className="data-table-wrapper">
            {/* Movimientos del Banco Conciliados */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <CheckCircle size={20} color="white" />
                <h3 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 600 }}>
                  Movimientos del Banco Conciliados ({movimientosBanco.filter(m => m.procesado).length})
                </h3>
              </div>
              
              {movimientosBanco.filter(m => m.procesado).length === 0 ? (
                <div className="empty-state">
                  <CheckCircle className="empty-state-icon" />
                  <div className="empty-state-title">No hay movimientos bancarios conciliados</div>
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Banco</th>
                      <th>Nro Operación</th>
                      <th>Descripción</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosBanco.filter(m => m.procesado).map(mov => (
                      <tr key={mov.id}>
                        <td>{formatDate(mov.fecha)}</td>
                        <td>{mov.banco_excel || mov.banco || '-'}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                          {mov.referencia || '-'}
                        </td>
                        <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mov.descripcion}
                        </td>
                        <td className="text-right currency-display" style={{ 
                          color: mov.monto < 0 ? '#dc2626' : '#16a34a',
                          fontWeight: 500
                        }}>
                          {formatCurrency(mov.monto, mov.monto < 0 ? '-S/' : 'S/')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Movimientos del Sistema Conciliados */}
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                borderRadius: '12px',
                marginBottom: '1rem'
              }}>
                <CheckCircle size={20} color="white" />
                <h3 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 600 }}>
                  Movimientos del Sistema Conciliados ({movimientosSistema.filter(m => m.conciliado).length})
                </h3>
              </div>
              
              {movimientosSistema.filter(m => m.conciliado).length === 0 ? (
                <div className="empty-state">
                  <CheckCircle className="empty-state-icon" />
                  <div className="empty-state-title">No hay movimientos del sistema conciliados</div>
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosSistema.filter(m => m.conciliado).map(mov => (
                      <tr key={mov.id}>
                        <td>{formatDate(mov.fecha)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                          {mov.numero}
                        </td>
                        <td>
                          <span className={`badge ${mov.tipo === 'ingreso' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6875rem' }}>
                            {mov.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mov.notas || mov.tercero_nombre || '-'}
                        </td>
                        <td className="text-right currency-display" style={{ 
                          fontWeight: 500,
                          color: mov.tipo === 'ingreso' ? '#16a34a' : '#dc2626'
                        }}>
                          {mov.tipo === 'ingreso' ? '' : '-'}{formatCurrency(mov.monto_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating conciliar button */}
      {selectedBanco.length > 0 && selectedSistema.length > 0 && Math.abs(selectedBancoTotal - selectedSistemaTotal) < 0.01 && (
        <div style={{ 
          position: 'fixed', 
          bottom: '2rem', 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 100
        }}>
          <button 
            className="btn btn-primary"
            onClick={handleConciliarManual}
            style={{ 
              padding: '1rem 2rem',
              fontSize: '1rem',
              boxShadow: '0 8px 24px rgba(27, 77, 62, 0.4)',
              borderRadius: '30px'
            }}
          >
            <Check size={20} />
            Conciliar {selectedBanco.length} + {selectedSistema.length} movimientos
          </button>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Importar Movimientos</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Banco</label>
                <select
                  className="form-input form-select"
                  value={bancoSeleccionado}
                  onChange={(e) => setBancoSeleccionado(e.target.value)}
                >
                  {BANCOS.map(banco => (
                    <option key={banco.id} value={banco.id}>{banco.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label required">Archivo Excel</label>
                <div 
                  style={{ 
                    border: `2px dashed ${uploadFile ? '#16a34a' : '#e2e8f0'}`, 
                    borderRadius: '12px', 
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: uploadFile ? '#f0fdf4' : '#f8fafc',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => document.getElementById('excel-input').click()}
                >
                  <input
                    id="excel-input"
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => setUploadFile(e.target.files[0])}
                  />
                  {uploadFile ? (
                    <>
                      <CheckCircle size={40} color="#16a34a" style={{ marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 600, color: '#16a34a' }}>{uploadFile.name}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Click para cambiar
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={40} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
                      <div style={{ fontWeight: 500 }}>Click para seleccionar archivo</div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Formatos: .xlsx, .xls
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #fcd34d', 
                borderRadius: '8px', 
                padding: '0.875rem',
                fontSize: '0.8125rem',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <AlertCircle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Formatos esperados:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                    <li><strong>BCP:</strong> Fecha, Descripción, Monto, Saldo</li>
                    <li><strong>BBVA:</strong> F. Valor, Concepto, Importe</li>
                    <li><strong>IBK:</strong> Fecha, Descripción, Cargo, Abono</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowImportModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleImportExcel}
                disabled={!uploadFile || importing}
              >
                {importing ? <><RefreshCw size={16} className="spin" /> Importando...</> : <><Upload size={16} /> Importar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Previsualización de Importación</h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Revise los datos antes de importar ({previewData.length} registros)
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowPreviewModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              <div className="data-table-wrapper" style={{ padding: 0 }}>
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                    <tr>
                      <th style={{ width: '100px' }}>Fecha</th>
                      <th style={{ width: '120px' }}>Banco</th>
                      <th style={{ width: '150px' }}>Nro Operación</th>
                      <th>Descripción</th>
                      <th className="text-right" style={{ width: '120px' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(row.fecha)}</td>
                        <td>{row.banco}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                          {row.referencia || '-'}
                        </td>
                        <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.descripcion}
                        </td>
                        <td className="text-right currency-display" style={{ 
                          color: row.monto < 0 ? '#dc2626' : '#16a34a',
                          fontWeight: 500
                        }}>
                          {formatCurrency(row.monto, row.monto < 0 ? '-S/' : 'S/')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-outline" 
                onClick={() => {
                  setShowPreviewModal(false);
                  setShowImportModal(true);
                }}
              >
                <X size={16} /> Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirmImport}
                disabled={importing}
              >
                {importing ? <><RefreshCw size={16} className="spin" /> Importando...</> : <><Check size={16} /> Confirmar e Importar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConciliacionBancaria;
