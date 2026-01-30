import React, { useState, useEffect } from 'react';
import { 
  getFacturasProveedor, createFacturaProveedor, deleteFacturaProveedor,
  getProveedores, getMonedas, getCategorias, getLineasNegocio, getCentrosCosto
} from '../services/api';
import { Plus, Trash2, Search, X, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-PE');
};

const estadoBadge = (estado) => {
  const badges = {
    pendiente: 'badge badge-warning',
    parcial: 'badge badge-info',
    pagado: 'badge badge-success',
    canjeado: 'badge badge-neutral',
    anulada: 'badge badge-error'
  };
  return badges[estado] || 'badge badge-neutral';
};

export const FacturasProveedor = () => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [lineasNegocio, setLineasNegocio] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    proveedor_id: '',
    beneficiario_nombre: '',
    moneda_id: '',
    fecha_factura: new Date().toISOString().split('T')[0],
    terminos_dias: 30,
    tipo_documento: 'factura',
    impuestos_incluidos: false,
    notas: '',
    lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }]
  });

  useEffect(() => {
    loadData();
  }, [filtroEstado, filtroProveedor]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [facturasRes, proveedoresRes, monedasRes, categoriasRes, lineasRes, centrosRes] = await Promise.all([
        getFacturasProveedor({ estado: filtroEstado || undefined }),
        getProveedores(),
        getMonedas(),
        getCategorias('egreso'),
        getLineasNegocio(),
        getCentrosCosto()
      ]);
      
      setFacturas(facturasRes.data);
      setProveedores(proveedoresRes.data);
      setMonedas(monedasRes.data);
      setCategorias(categoriasRes.data);
      setLineasNegocio(lineasRes.data);
      setCentrosCosto(centrosRes.data);
      
      // Set default moneda
      const pen = monedasRes.data.find(m => m.codigo === 'PEN');
      if (pen && !formData.moneda_id) {
        setFormData(prev => ({ ...prev, moneda_id: pen.id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLinea = () => {
    setFormData(prev => ({
      ...prev,
      lineas: [...prev.lineas, { categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }]
    }));
  };

  const handleRemoveLinea = (index) => {
    setFormData(prev => ({
      ...prev,
      lineas: prev.lineas.filter((_, i) => i !== index)
    }));
  };

  const handleLineaChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lineas: prev.lineas.map((linea, i) => 
        i === index ? { ...linea, [field]: value } : linea
      )
    }));
  };

  const calcularTotales = () => {
    let subtotal = 0;
    let igv = 0;
    
    formData.lineas.forEach(linea => {
      const importe = parseFloat(linea.importe) || 0;
      if (formData.impuestos_incluidos) {
        const base = importe / 1.18;
        subtotal += base;
        if (linea.igv_aplica) {
          igv += base * 0.18;
        }
      } else {
        subtotal += importe;
        if (linea.igv_aplica) {
          igv += importe * 0.18;
        }
      }
    });
    
    return { subtotal, igv, total: subtotal + igv };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const dataToSend = {
        ...formData,
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
        moneda_id: formData.moneda_id ? parseInt(formData.moneda_id) : null,
        terminos_dias: parseInt(formData.terminos_dias) || 0,
        lineas: formData.lineas.map(l => ({
          ...l,
          categoria_id: l.categoria_id ? parseInt(l.categoria_id) : null,
          linea_negocio_id: l.linea_negocio_id ? parseInt(l.linea_negocio_id) : null,
          centro_costo_id: l.centro_costo_id ? parseInt(l.centro_costo_id) : null,
          importe: parseFloat(l.importe) || 0
        }))
      };
      
      await createFacturaProveedor(dataToSend);
      toast.success('Factura creada exitosamente');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating factura:', error);
      toast.error('Error al crear factura');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta factura?')) return;
    
    try {
      await deleteFacturaProveedor(id);
      toast.success('Factura eliminada');
      loadData();
    } catch (error) {
      console.error('Error deleting factura:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar factura');
    }
  };

  const resetForm = () => {
    const pen = monedas.find(m => m.codigo === 'PEN');
    setFormData({
      proveedor_id: '',
      beneficiario_nombre: '',
      moneda_id: pen?.id || '',
      fecha_factura: new Date().toISOString().split('T')[0],
      terminos_dias: 30,
      tipo_documento: 'factura',
      impuestos_incluidos: false,
      notas: '',
      lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }]
    });
  };

  const totales = calcularTotales();
  const monedaActual = monedas.find(m => m.id === parseInt(formData.moneda_id));

  // Calcular totales para la lista
  const totalPendiente = facturas.filter(f => f.estado === 'pendiente' || f.estado === 'parcial')
    .reduce((sum, f) => sum + parseFloat(f.saldo_pendiente || 0), 0);
  const totalPagado = facturas.filter(f => f.estado === 'pagado')
    .reduce((sum, f) => sum + parseFloat(f.total || 0), 0);

  return (
    <div data-testid="facturas-proveedor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturas de Proveedor</h1>
          <p className="page-subtitle">
            Pendiente: {formatCurrency(totalPendiente)} | Pagado: {formatCurrency(totalPagado)}
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          data-testid="nueva-factura-btn"
        >
          <Plus size={18} />
          Nueva Factura
        </button>
      </div>

      <div className="page-content">
        {/* Filtros */}
        <div className="filters-bar">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select 
              className="form-input form-select filter-input"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              data-testid="filtro-estado"
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="canjeado">Canjeado</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : facturas.length === 0 ? (
              <div className="empty-state">
                <FileText className="empty-state-icon" />
                <div className="empty-state-title">No hay facturas registradas</div>
                <div className="empty-state-description">Crea tu primera factura de proveedor</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Crear primera factura
                </button>
              </div>
            ) : (
              <table className="data-table" data-testid="facturas-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Proveedor</th>
                    <th>Fecha</th>
                    <th>Vencimiento</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Saldo</th>
                    <th>Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((factura) => (
                    <tr key={factura.id} data-testid={`factura-row-${factura.id}`}>
                      <td style={{ fontWeight: 500 }}>{factura.numero}</td>
                      <td>{factura.proveedor_nombre || factura.beneficiario_nombre || '-'}</td>
                      <td>{formatDate(factura.fecha_factura)}</td>
                      <td>{formatDate(factura.fecha_vencimiento)}</td>
                      <td className="text-right">
                        {formatCurrency(factura.total, factura.moneda_simbolo)}
                      </td>
                      <td className="text-right" style={{ 
                        color: factura.saldo_pendiente > 0 ? '#EF4444' : '#22C55E',
                        fontWeight: 500
                      }}>
                        {formatCurrency(factura.saldo_pendiente, factura.moneda_simbolo)}
                      </td>
                      <td>
                        <span className={estadoBadge(factura.estado)}>
                          {factura.estado}
                        </span>
                      </td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => handleDelete(factura.id)}
                            title="Eliminar"
                            data-testid={`delete-factura-${factura.id}`}
                          >
                            <Trash2 size={16} />
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

      {/* Modal Nueva Factura */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FileText size={20} style={{ marginRight: '0.5rem' }} />
                Factura de proveedor
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Saldo Pendiente */}
                <div style={{ 
                  position: 'absolute', 
                  top: '1rem', 
                  right: '3rem',
                  background: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
                    Saldo Pendiente
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatCurrency(totales.total, monedaActual?.simbolo)}
                  </div>
                </div>

                {/* Header Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label required">Proveedor</label>
                    <select
                      className="form-input form-select"
                      value={formData.proveedor_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, proveedor_id: e.target.value }))}
                      data-testid="proveedor-select"
                    >
                      <option value="">Buscar proveedor...</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">O escribir beneficiario</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nombre del beneficiario"
                      value={formData.beneficiario_nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, beneficiario_nombre: e.target.value }))}
                      data-testid="beneficiario-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Términos</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: 30 días"
                      value={formData.terminos_dias}
                      onChange={(e) => setFormData(prev => ({ ...prev, terminos_dias: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Moneda</label>
                    <select
                      className="form-input form-select"
                      value={formData.moneda_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, moneda_id: e.target.value }))}
                    >
                      {monedas.map(m => (
                        <option key={m.id} value={m.id}>{m.codigo}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label required">Fecha de factura</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.fecha_factura}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_factura: e.target.value }))}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Fecha de vencimiento</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.fecha_vencimiento || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label required">Tipo de documento</label>
                    <select
                      className="form-input form-select"
                      value={formData.tipo_documento}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo_documento: e.target.value }))}
                    >
                      <option value="factura">Factura</option>
                      <option value="boleta">Boleta</option>
                      <option value="recibo">Recibo por Honorarios</option>
                      <option value="nota_credito">Nota de Crédito</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">N.º de documento</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="NV001-00001"
                      value={formData.numero || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Detalles de la categoría */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      Detalles de la categoría ({formData.lineas.length} línea{formData.lineas.length !== 1 ? 's' : ''})
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.813rem', color: 'var(--muted)' }}>Los importes son</span>
                      <select
                        className="form-input form-select"
                        style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem' }}
                        value={formData.impuestos_incluidos ? 'incluidos' : 'sin_igv'}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          impuestos_incluidos: e.target.value === 'incluidos' 
                        }))}
                      >
                        <option value="sin_igv">Sin IGV</option>
                        <option value="incluidos">Impuestos incluidos</option>
                      </select>
                    </div>
                  </div>

                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Línea Negocio</th>
                        <th style={{ width: 100 }}>Importe</th>
                        <th style={{ width: 70 }}>IGV 18%</th>
                        <th style={{ width: 80 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lineas.map((linea, index) => (
                        <tr key={index}>
                          <td className="row-number">{index + 1}</td>
                          <td>
                            <select
                              value={linea.categoria_id}
                              onChange={(e) => handleLineaChange(index, 'categoria_id', e.target.value)}
                              data-testid={`linea-categoria-${index}`}
                            >
                              <option value="">Categoría</option>
                              {categorias.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="Descripción"
                              value={linea.descripcion}
                              onChange={(e) => handleLineaChange(index, 'descripcion', e.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              value={linea.linea_negocio_id}
                              onChange={(e) => handleLineaChange(index, 'linea_negocio_id', e.target.value)}
                            >
                              <option value="">Línea</option>
                              {lineasNegocio.map(l => (
                                <option key={l.id} value={l.id}>{l.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={linea.importe}
                              onChange={(e) => handleLineaChange(index, 'importe', e.target.value)}
                              style={{ textAlign: 'right' }}
                              data-testid={`linea-importe-${index}`}
                            />
                          </td>
                          <td style={{ textAlign: 'center', background: '#f8fafc' }}>
                            <input
                              type="checkbox"
                              checked={linea.igv_aplica}
                              onChange={(e) => handleLineaChange(index, 'igv_aplica', e.target.checked)}
                              style={{ width: 'auto' }}
                            />
                          </td>
                          <td className="actions-cell">
                            {formData.lineas.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm btn-icon"
                                onClick={() => handleRemoveLinea(index)}
                                style={{ margin: '0 auto' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleAddLinea}
                    >
                      <Plus size={16} />
                      Agregar línea
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setFormData(prev => ({ ...prev, lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }] }))}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Borrar todas las líneas
                    </button>
                  </div>
                </div>

                {/* Nota y Totales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nota</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Añadir una nota..."
                      value={formData.notas}
                      onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                    />
                  </div>
                  
                  <div className="totals-section">
                    <div className="totals-row">
                      <span>Subtotal</span>
                      <span className="totals-value">{formatCurrency(totales.subtotal, monedaActual?.simbolo)}</span>
                    </div>
                    <div className="totals-row">
                      <span>IGV (18%)</span>
                      <span className="totals-value">{formatCurrency(totales.igv, monedaActual?.simbolo)}</span>
                    </div>
                    <div className="totals-row total">
                      <span>Total</span>
                      <span className="totals-value">{formatCurrency(totales.total, monedaActual?.simbolo)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-secondary" data-testid="guardar-factura-btn">
                  Guardar
                </button>
                <button type="submit" className="btn btn-primary" data-testid="guardar-crear-btn">
                  Guardar y crear nueva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturasProveedor;
