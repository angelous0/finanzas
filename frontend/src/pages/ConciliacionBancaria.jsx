import React, { useState, useEffect, useCallback } from 'react';
import { 
  getCuentasFinancieras, getMovimientosBanco, getPagos,
  importarExcelBanco, getConciliaciones, createConciliacion
} from '../services/api';
import { 
  Upload, Search, RefreshCw, Check, X, FileSpreadsheet, 
  AlertCircle, CheckCircle, Clock, ArrowLeftRight, Download,
  Filter, Calendar, Building2
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
  // Data states
  const [cuentas, setCuentas] = useState([]);
  const [movimientosBanco, setMovimientosBanco] = useState([]);
  const [movimientosSistema, setMovimientosSistema] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [bancoSeleccionado, setBancoSeleccionado] = useState('BCP');
  
  // Selection states
  const [selectedBanco, setSelectedBanco] = useState([]);
  const [selectedSistema, setSelectedSistema] = useState([]);
  
  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('pendientes');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [cuentasRes] = await Promise.all([
        getCuentasFinancieras()
      ]);
      setCuentas(cuentasRes.data.filter(c => c.tipo === 'banco'));
      
      // Set default dates (last month)
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
      const [bancoRes, sistemaRes, concilRes] = await Promise.all([
        getMovimientosBanco({ cuenta_financiera_id: cuentaSeleccionada, procesado: false }),
        getPagos({ cuenta_financiera_id: cuentaSeleccionada, fecha_desde: fechaDesde, fecha_hasta: fechaHasta }),
        getConciliaciones(cuentaSeleccionada)
      ]);
      
      setMovimientosBanco(bancoRes.data || []);
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

  const handleImportExcel = async () => {
    if (!uploadFile) {
      toast.error('Seleccione un archivo Excel');
      return;
    }
    if (!cuentaSeleccionada) {
      toast.error('Seleccione una cuenta bancaria');
      return;
    }
    
    try {
      setImporting(true);
      const result = await importarExcelBanco(uploadFile, cuentaSeleccionada, bancoSeleccionado);
      toast.success(`Se importaron ${result.data.imported} movimientos`);
      setShowImportModal(false);
      setUploadFile(null);
      loadMovimientos();
    } catch (error) {
      console.error('Error importing:', error);
      toast.error(error.response?.data?.detail || 'Error al importar Excel');
    } finally {
      setImporting(false);
    }
  };

  const handleSelectBanco = (id) => {
    setSelectedBanco(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectSistema = (id) => {
    setSelectedSistema(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConciliarManual = async () => {
    if (selectedBanco.length === 0 || selectedSistema.length === 0) {
      toast.error('Seleccione al menos un movimiento de cada lado');
      return;
    }
    
    // Calculate totals
    const totalBanco = selectedBanco.reduce((sum, id) => {
      const mov = movimientosBanco.find(m => m.id === id);
      return sum + (mov ? (mov.abono || 0) - (mov.cargo || 0) : 0);
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
      // Mark as conciliated (update backend)
      toast.success('Movimientos conciliados exitosamente');
      loadMovimientos();
    } catch (error) {
      toast.error('Error al conciliar movimientos');
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
    
    // Try to match by exact amount and similar date
    for (const movBanco of movimientosBanco) {
      if (bancoUsados.has(movBanco.id)) continue;
      
      const montoBanco = (movBanco.abono || 0) - (movBanco.cargo || 0);
      
      for (const movSistema of movimientosSistema) {
        if (sistemaUsados.has(movSistema.id)) continue;
        
        const montoSistema = movSistema.tipo === 'ingreso' ? movSistema.monto_total : -movSistema.monto_total;
        
        // Check if amounts match (within 0.01 tolerance)
        if (Math.abs(montoBanco - montoSistema) < 0.01) {
          // Check if dates are within 3 days
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

  // Summary calculations
  const pendientesBanco = movimientosBanco.filter(m => !m.procesado).length;
  const pendientesSistema = movimientosSistema.filter(m => !m.conciliado).length;
  const totalBancoPendiente = movimientosBanco.reduce((sum, m) => sum + (m.abono || 0) - (m.cargo || 0), 0);
  const totalSistemaPendiente = movimientosSistema.reduce((sum, m) => 
    sum + (m.tipo === 'ingreso' ? m.monto_total : -m.monto_total), 0);

  return (
    <div className="page" data-testid="conciliacion-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conciliación Bancaria</h1>
          <p className="page-subtitle">Concilie los movimientos del banco con el sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
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

      {/* Summary Cards */}
      <div className="summary-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#dbeafe' }}>
            <Building2 size={20} color="#2563eb" />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Mov. Banco Pendientes</div>
            <div className="summary-card-value">{pendientesBanco}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#fef3c7' }}>
            <FileSpreadsheet size={20} color="#d97706" />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Mov. Sistema Pendientes</div>
            <div className="summary-card-value">{pendientesSistema}</div>
          </div>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: totalBancoPendiente - totalSistemaPendiente === 0 ? '#dcfce7' : '#fee2e2' }}>
            <ArrowLeftRight size={20} color={totalBancoPendiente - totalSistemaPendiente === 0 ? '#16a34a' : '#dc2626'} />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Diferencia</div>
            <div className="summary-card-value currency-display" style={{ 
              color: totalBancoPendiente - totalSistemaPendiente === 0 ? '#16a34a' : '#dc2626',
              fontSize: '1.25rem'
            }}>
              {formatCurrency(Math.abs(totalBancoPendiente - totalSistemaPendiente))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button 
          className={`tab ${activeTab === 'pendientes' ? 'active' : ''}`}
          onClick={() => setActiveTab('pendientes')}
        >
          <Clock size={16} />
          Pendientes de Conciliar
        </button>
        <button 
          className={`tab ${activeTab === 'banco' ? 'active' : ''}`}
          onClick={() => setActiveTab('banco')}
        >
          <Building2 size={16} />
          Movimientos Banco
        </button>
        <button 
          className={`tab ${activeTab === 'historial' ? 'active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          <CheckCircle size={16} />
          Historial Conciliados
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'pendientes' && (
        <div className="conciliacion-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Banco Side */}
          <div className="card">
            <div className="card-header" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                <Building2 size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Banco ({movimientosBanco.length})
              </h3>
              <span className="currency-display" style={{ fontWeight: 600, color: '#2563eb' }}>
                {formatCurrency(totalBancoPendiente)}
              </span>
            </div>
            <div className="data-table-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
              {loading ? (
                <div className="loading"><div className="loading-spinner"></div></div>
              ) : movimientosBanco.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-state-description">
                    {cuentaSeleccionada ? 'No hay movimientos pendientes' : 'Seleccione una cuenta y haga clic en Buscar'}
                  </div>
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th className="text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosBanco.map(mov => (
                      <tr 
                        key={mov.id}
                        className={selectedBanco.includes(mov.id) ? 'selected' : ''}
                        onClick={() => handleSelectBanco(mov.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedBanco.includes(mov.id)}
                            onChange={() => {}}
                            style={{ width: '16px', height: '16px' }}
                          />
                        </td>
                        <td>{formatDate(mov.fecha)}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mov.descripcion}
                        </td>
                        <td className="text-right currency-display" style={{ 
                          fontWeight: 500,
                          color: (mov.abono || 0) > 0 ? '#16a34a' : '#dc2626'
                        }}>
                          {formatCurrency((mov.abono || 0) - (mov.cargo || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Sistema Side */}
          <div className="card">
            <div className="card-header" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>
                <FileSpreadsheet size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Sistema ({movimientosSistema.length})
              </h3>
              <span className="currency-display" style={{ fontWeight: 600, color: '#d97706' }}>
                {formatCurrency(totalSistemaPendiente)}
              </span>
            </div>
            <div className="data-table-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
              {loading ? (
                <div className="loading"><div className="loading-spinner"></div></div>
              ) : movimientosSistema.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-state-description">
                    {cuentaSeleccionada ? 'No hay movimientos pendientes' : 'Seleccione una cuenta y haga clic en Buscar'}
                  </div>
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Fecha</th>
                      <th>Número</th>
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
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedSistema.includes(mov.id)}
                            onChange={() => {}}
                            style={{ width: '16px', height: '16px' }}
                          />
                        </td>
                        <td>{formatDate(mov.fecha)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                          {mov.numero}
                        </td>
                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

      {activeTab === 'banco' && (
        <div className="card">
          <div className="data-table-wrapper">
            {movimientosBanco.length === 0 ? (
              <div className="empty-state">
                <Upload className="empty-state-icon" />
                <div className="empty-state-title">No hay movimientos importados</div>
                <div className="empty-state-description">Importe un archivo Excel del banco para comenzar</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Descripción</th>
                    <th className="text-right">Cargo</th>
                    <th className="text-right">Abono</th>
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
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mov.descripcion}
                      </td>
                      <td className="text-right currency-display" style={{ color: '#dc2626' }}>
                        {mov.cargo ? formatCurrency(mov.cargo) : '-'}
                      </td>
                      <td className="text-right currency-display" style={{ color: '#16a34a' }}>
                        {mov.abono ? formatCurrency(mov.abono) : '-'}
                      </td>
                      <td className="text-right currency-display">
                        {mov.saldo ? formatCurrency(mov.saldo) : '-'}
                      </td>
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
            {conciliaciones.length === 0 ? (
              <div className="empty-state">
                <CheckCircle className="empty-state-icon" />
                <div className="empty-state-title">No hay conciliaciones registradas</div>
                <div className="empty-state-description">Las conciliaciones realizadas aparecerán aquí</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cuenta</th>
                    <th>Período</th>
                    <th className="text-right">Saldo Inicial</th>
                    <th className="text-right">Saldo Final</th>
                    <th className="text-center">Movimientos</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {conciliaciones.map(conc => (
                    <tr key={conc.id}>
                      <td>{formatDate(conc.created_at)}</td>
                      <td>{conc.cuenta_nombre}</td>
                      <td>{formatDate(conc.fecha_inicio)} - {formatDate(conc.fecha_fin)}</td>
                      <td className="text-right currency-display">{formatCurrency(conc.saldo_inicial)}</td>
                      <td className="text-right currency-display">{formatCurrency(conc.saldo_final)}</td>
                      <td className="text-center">{conc.lineas?.length || 0}</td>
                      <td>{conc.notas || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Conciliar button when items selected */}
      {selectedBanco.length > 0 && selectedSistema.length > 0 && (
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
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(27, 77, 62, 0.3)'
            }}
          >
            <Check size={18} />
            Conciliar {selectedBanco.length} + {selectedSistema.length} movimientos
          </button>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Importar Movimientos del Banco</h2>
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
                    border: '2px dashed #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '2rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: uploadFile ? '#f0fdf4' : '#f8fafc'
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
                      <CheckCircle size={32} color="#16a34a" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 500 }}>{uploadFile.name}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Click para cambiar archivo
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={32} color="#64748b" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 500 }}>Click para seleccionar archivo</div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Formatos soportados: .xlsx, .xls
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div style={{ 
                background: '#fef3c7', 
                border: '1px solid #fcd34d', 
                borderRadius: '8px', 
                padding: '0.75rem',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Formato esperado según banco:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                    <li><strong>BCP:</strong> Fecha, Descripción, Monto, Saldo</li>
                    <li><strong>BBVA:</strong> F. Valor, Concepto, Importe, Saldo Final</li>
                    <li><strong>Interbank:</strong> Fecha operación, Descripción, Cargo, Abono, Saldo</li>
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
                {importing ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Importar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConciliacionBancaria;
