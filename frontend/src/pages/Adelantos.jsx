import React, { useState, useEffect } from 'react';
import { 
  getAdelantos, createAdelanto, getEmpleados, getCuentasFinancieras
} from '../services/api';
import { Plus, FileText, Eye, X, DollarSign, Download, Calendar, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/SearchableSelect';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-PE');
};

const getEstadoBadge = (estado) => {
  const badges = {
    pendiente: 'badge badge-warning',
    descontado: 'badge badge-success',
    anulado: 'badge badge-danger'
  };
  return badges[estado] || 'badge';
};

export const Adelantos = () => {
  const [adelantos, setAdelantos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAdelanto, setSelectedAdelanto] = useState(null);
  
  // Filters
  const [filtroEmpleado, setFiltroEmpleado] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    empleado_id: '',
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    motivo: '',
    cuenta_financiera_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adelantosRes, empleadosRes, cuentasRes] = await Promise.all([
        getAdelantos(),
        getEmpleados(),
        getCuentasFinancieras()
      ]);
      setAdelantos(adelantosRes.data);
      setEmpleados(empleadosRes.data);
      setCuentas(cuentasRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.empleado_id) {
      toast.error('Seleccione un empleado');
      return;
    }
    
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        empleado_id: parseInt(formData.empleado_id),
        monto: parseFloat(formData.monto),
        cuenta_financiera_id: formData.cuenta_financiera_id ? parseInt(formData.cuenta_financiera_id) : null
      };
      
      await createAdelanto(payload);
      toast.success('Adelanto registrado exitosamente');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating adelanto:', error);
      toast.error(error.response?.data?.detail || 'Error al registrar adelanto');
    }
  };

  const resetForm = () => {
    setFormData({
      empleado_id: '',
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
      motivo: '',
      cuenta_financiera_id: ''
    });
  };

  const handleView = (adelanto) => {
    setSelectedAdelanto(adelanto);
    setShowViewModal(true);
  };

  const handleDownloadPDF = (adelanto) => {
    const empleado = empleados.find(e => e.id === adelanto.empleado_id);
    
    const pdfContent = `
      <html>
      <head>
        <title>Adelanto-${adelanto.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
          .header { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1B4D3E; }
          .doc-title { font-size: 1.5rem; font-weight: 700; color: #1B4D3E; }
          .doc-date { font-size: 0.875rem; color: #64748b; margin-top: 8px; }
          .content { margin: 2rem 0; }
          .field { margin-bottom: 1.5rem; }
          .field-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .field-value { font-size: 1rem; font-weight: 500; }
          .amount { font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: #1B4D3E; text-align: center; padding: 2rem; background: #f8fafc; border-radius: 8px; margin: 2rem 0; }
          .signature { margin-top: 4rem; display: flex; justify-content: space-between; }
          .signature-box { width: 200px; text-align: center; }
          .signature-line { border-top: 1px solid #1e293b; padding-top: 8px; font-size: 0.75rem; color: #64748b; }
          .footer { margin-top: 40px; text-align: center; color: #64748b; font-size: 0.75rem; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="doc-title">COMPROBANTE DE ADELANTO</div>
          <div class="doc-date">Fecha: ${formatDate(adelanto.fecha)}</div>
        </div>
        
        <div class="content">
          <div class="field">
            <div class="field-label">Empleado</div>
            <div class="field-value">${adelanto.empleado_nombre || empleado?.nombre || '-'}</div>
          </div>
          
          <div class="amount">
            ${formatCurrency(adelanto.monto)}
          </div>
          
          <div class="field">
            <div class="field-label">Motivo</div>
            <div class="field-value">${adelanto.motivo || 'No especificado'}</div>
          </div>
          
          <div class="field">
            <div class="field-label">Estado</div>
            <div class="field-value">${adelanto.estado?.toUpperCase() || 'PENDIENTE'}</div>
          </div>
        </div>
        
        <div class="signature">
          <div class="signature-box">
            <div class="signature-line">Firma del Empleado</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Firma del Responsable</div>
          </div>
        </div>
        
        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleDateString('es-PE')} | Finanzas 4.0</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };

  // Filter adelantos
  const adelantosFiltrados = adelantos.filter(a => {
    if (filtroEmpleado && a.empleado_id !== parseInt(filtroEmpleado)) return false;
    if (filtroEstado && a.estado !== filtroEstado) return false;
    return true;
  });

  const totalAdelantos = adelantos.reduce((acc, a) => acc + (a.monto || 0), 0);
  const totalPendientes = adelantos.filter(a => a.estado === 'pendiente').reduce((acc, a) => acc + (a.monto || 0), 0);

  return (
    <div data-testid="adelantos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Adelantos a Empleados</h1>
          <p className="page-subtitle">{adelantos.length} adelantos registrados</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          data-testid="nuevo-adelanto-btn"
          disabled={empleados.length === 0}
        >
          <Plus size={18} />
          Nuevo Adelanto
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#dbeafe' }}>
            <Wallet size={20} color="#1d4ed8" />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Total Adelantos</div>
            <div className="summary-card-value currency-display">{formatCurrency(totalAdelantos)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#fef3c7' }}>
            <Calendar size={20} color="#d97706" />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Pendientes de Descontar</div>
            <div className="summary-card-value currency-display">{formatCurrency(totalPendientes)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon" style={{ background: '#dcfce7' }}>
            <Users size={20} color="#15803d" />
          </div>
          <div className="summary-card-content">
            <div className="summary-card-label">Empleados</div>
            <div className="summary-card-value">{empleados.length}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar" style={{ marginBottom: '1rem' }}>
        <select
          className="form-input form-select"
          value={filtroEmpleado}
          onChange={(e) => setFiltroEmpleado(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="">Todos los empleados</option>
          {empleados.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
        <select
          className="form-input form-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="descontado">Descontado</option>
          <option value="anulado">Anulado</option>
        </select>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : adelantosFiltrados.length === 0 ? (
              <div className="empty-state">
                <Wallet className="empty-state-icon" />
                <div className="empty-state-title">No hay adelantos registrados</div>
                <div className="empty-state-description">
                  {empleados.length === 0 
                    ? 'Primero debe registrar empleados' 
                    : 'Registra adelantos para tus empleados'}
                </div>
              </div>
            ) : (
              <table className="data-table" data-testid="adelantos-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empleado</th>
                    <th className="text-right">Monto</th>
                    <th>Motivo</th>
                    <th className="text-center">Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {adelantosFiltrados.map((adelanto) => (
                    <tr key={adelanto.id}>
                      <td>{formatDate(adelanto.fecha)}</td>
                      <td style={{ fontWeight: 500 }}>{adelanto.empleado_nombre}</td>
                      <td className="text-right currency-display" style={{ fontWeight: 600 }}>
                        {formatCurrency(adelanto.monto)}
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {adelanto.motivo || '-'}
                      </td>
                      <td className="text-center">
                        <span className={getEstadoBadge(adelanto.estado)}>
                          {adelanto.estado}
                        </span>
                      </td>
                      <td>
                        <div className="actions-row">
                          <button 
                            className="action-btn"
                            onClick={() => handleView(adelanto)}
                            title="Ver detalle"
                          >
                            <Eye size={15} />
                          </button>
                          <button 
                            className="action-btn"
                            onClick={() => handleDownloadPDF(adelanto)}
                            title="Descargar PDF"
                          >
                            <Download size={15} />
                          </button>
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

      {/* Modal Nuevo Adelanto */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo Adelanto</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Empleado</label>
                  <SearchableSelect
                    options={empleados}
                    value={formData.empleado_id}
                    onChange={(value) => setFormData(prev => ({ ...prev, empleado_id: value }))}
                    placeholder="Seleccionar empleado..."
                    searchPlaceholder="Buscar empleado..."
                    displayKey="nombre"
                    valueKey="id"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label required">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input text-right currency-input"
                      value={formData.monto}
                      onChange={(e) => setFormData(prev => ({ ...prev, monto: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Fecha</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.fecha}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Motivo</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={formData.motivo}
                    onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Motivo del adelanto..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cuenta de Salida</label>
                  <select
                    className="form-input form-select"
                    value={formData.cuenta_financiera_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, cuenta_financiera_id: e.target.value }))}
                  >
                    <option value="">Sin especificar</option>
                    {cuentas.map(cuenta => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} - {cuenta.banco || 'Caja'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <DollarSign size={16} />
                  Registrar Adelanto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Adelanto */}
      {showViewModal && selectedAdelanto && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalle del Adelanto</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => handleDownloadPDF(selectedAdelanto)}>
                  <Download size={16} />
                  PDF
                </button>
                <button className="modal-close" onClick={() => setShowViewModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Monto del Adelanto</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1B4D3E', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatCurrency(selectedAdelanto.monto)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Empleado</div>
                  <div style={{ fontWeight: 500 }}>{selectedAdelanto.empleado_nombre}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Fecha</div>
                  <div style={{ fontWeight: 500 }}>{formatDate(selectedAdelanto.fecha)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Estado</div>
                  <span className={getEstadoBadge(selectedAdelanto.estado)}>{selectedAdelanto.estado}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Descontado en</div>
                  <div style={{ fontWeight: 500 }}>{selectedAdelanto.planilla_id ? `Planilla #${selectedAdelanto.planilla_id}` : '-'}</div>
                </div>
              </div>

              {selectedAdelanto.motivo && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Motivo</div>
                  <div style={{ fontWeight: 500 }}>{selectedAdelanto.motivo}</div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowViewModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Adelantos;
