import React, { useState, useEffect } from 'react';
import { 
  getOrdenesCompra, createOrdenCompra, deleteOrdenCompra, 
  generarFacturaDesdeOC, getProveedores, getMonedas
} from '../services/api';
import { Plus, Trash2, FileText, X, ArrowRight } from 'lucide-react';
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
    borrador: 'badge badge-neutral',
    enviada: 'badge badge-info',
    recibida: 'badge badge-success',
    facturada: 'badge badge-success',
    cancelada: 'badge badge-error'
  };
  return badges[estado] || 'badge badge-neutral';
};

export const OrdenesCompra = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [monedas, setMonedas] = useState([]);
  
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_id: '',
    moneda_id: '',
    notas: '',
    lineas: [{ articulo_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, igv_aplica: true }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordenesRes, proveedoresRes, monedasRes] = await Promise.all([
        getOrdenesCompra(),
        getProveedores(),
        getMonedas()
      ]);
      setOrdenes(ordenesRes.data);
      setProveedores(proveedoresRes.data);
      setMonedas(monedasRes.data);
      
      const pen = monedasRes.data.find(m => m.codigo === 'PEN');
      if (pen) {
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
      lineas: [...prev.lineas, { articulo_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, igv_aplica: true }]
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
      const lineaSubtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio_unitario) || 0);
      subtotal += lineaSubtotal;
      if (linea.igv_aplica) {
        igv += lineaSubtotal * 0.18;
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
        lineas: formData.lineas.map(l => ({
          ...l,
          articulo_id: l.articulo_id ? parseInt(l.articulo_id) : null,
          cantidad: parseFloat(l.cantidad) || 0,
          precio_unitario: parseFloat(l.precio_unitario) || 0
        }))
      };
      
      await createOrdenCompra(dataToSend);
      toast.success('Orden de compra creada');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating OC:', error);
      toast.error('Error al crear orden de compra');
    }
  };

  const handleGenerarFactura = async (id) => {
    if (!window.confirm('¿Generar factura de proveedor desde esta OC?')) return;
    try {
      await generarFacturaDesdeOC(id);
      toast.success('Factura generada desde OC');
      loadData();
    } catch (error) {
      console.error('Error generating factura:', error);
      toast.error(error.response?.data?.detail || 'Error al generar factura');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta orden de compra?')) return;
    try {
      await deleteOrdenCompra(id);
      toast.success('Orden eliminada');
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const resetForm = () => {
    const pen = monedas.find(m => m.codigo === 'PEN');
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      proveedor_id: '',
      moneda_id: pen?.id || '',
      notas: '',
      lineas: [{ articulo_id: '', descripcion: '', cantidad: 1, precio_unitario: 0, igv_aplica: true }]
    });
  };

  const totales = calcularTotales();

  return (
    <div data-testid="ordenes-compra-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Órdenes de Compra</h1>
          <p className="page-subtitle">{ordenes.length} órdenes registradas</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          data-testid="nueva-oc-btn"
        >
          <Plus size={18} />
          Nueva OC
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : ordenes.length === 0 ? (
              <div className="empty-state">
                <FileText className="empty-state-icon" />
                <div className="empty-state-title">No hay órdenes de compra</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Crear primera OC
                </button>
              </div>
            ) : (
              <table className="data-table" data-testid="oc-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th className="text-right">Total</th>
                    <th>Estado</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((oc) => (
                    <tr key={oc.id}>
                      <td style={{ fontWeight: 500 }}>{oc.numero}</td>
                      <td>{formatDate(oc.fecha)}</td>
                      <td>{oc.proveedor_nombre || '-'}</td>
                      <td className="text-right">{formatCurrency(oc.total)}</td>
                      <td>
                        <span className={estadoBadge(oc.estado)}>
                          {oc.estado}
                        </span>
                      </td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {oc.estado !== 'facturada' && oc.estado !== 'cancelada' && (
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleGenerarFactura(oc.id)}
                              title="Generar Factura"
                            >
                              <ArrowRight size={14} />
                              Facturar
                            </button>
                          )}
                          <button 
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => handleDelete(oc.id)}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
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

      {/* Modal Nueva OC */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Orden de Compra</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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
                  
                  <div className="form-group">
                    <label className="form-label required">Proveedor</label>
                    <select
                      className="form-input form-select"
                      value={formData.proveedor_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, proveedor_id: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
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
                </div>

                {/* Líneas */}
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Descripción</th>
                      <th style={{ width: 80 }}>Cant.</th>
                      <th style={{ width: 100 }}>P. Unit.</th>
                      <th style={{ width: 100 }}>Subtotal</th>
                      <th style={{ width: 60 }}>IGV</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lineas.map((linea, index) => {
                      const lineaSubtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio_unitario) || 0);
                      return (
                        <tr key={index}>
                          <td className="row-number">{index + 1}</td>
                          <td>
                            <input
                              type="text"
                              placeholder="Descripción del producto"
                              value={linea.descripcion}
                              onChange={(e) => handleLineaChange(index, 'descripcion', e.target.value)}
                              required
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={linea.cantidad}
                              onChange={(e) => handleLineaChange(index, 'cantidad', e.target.value)}
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={linea.precio_unitario}
                              onChange={(e) => handleLineaChange(index, 'precio_unitario', e.target.value)}
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', background: '#f8fafc', fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatCurrency(lineaSubtotal)}
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
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddLinea}
                  style={{ marginTop: '0.75rem' }}
                >
                  <Plus size={16} />
                  Agregar línea
                </button>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={formData.notas}
                    onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                  />
                </div>

                <div className="totals-section">
                  <div className="totals-row">
                    <span>Subtotal</span>
                    <span className="totals-value">{formatCurrency(totales.subtotal)}</span>
                  </div>
                  <div className="totals-row">
                    <span>IGV (18%)</span>
                    <span className="totals-value">{formatCurrency(totales.igv)}</span>
                  </div>
                  <div className="totals-row total">
                    <span>Total</span>
                    <span className="totals-value">{formatCurrency(totales.total)}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear OC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenesCompra;
