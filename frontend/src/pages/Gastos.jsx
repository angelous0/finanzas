import React, { useState, useEffect } from 'react';
import { 
  getGastos, createGasto, getCategorias, getLineasNegocio, 
  getCentrosCosto, getCuentasFinancieras, getMonedas
} from '../services/api';
import { Plus, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-PE');
};

export const Gastos = () => {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [lineasNegocio, setLineasNegocio] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [cuentasFinancieras, setCuentasFinancieras] = useState([]);
  const [monedas, setMonedas] = useState([]);
  
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    beneficiario_nombre: '',
    moneda_id: '',
    tipo_documento: '',
    numero_documento: '',
    notas: '',
    lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }],
    pago_cuenta_financiera_id: '',
    pago_medio: 'efectivo',
    pago_referencia: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [gastosRes, categoriasRes, lineasRes, centrosRes, cuentasRes, monedasRes] = await Promise.all([
        getGastos(),
        getCategorias('egreso'),
        getLineasNegocio(),
        getCentrosCosto(),
        getCuentasFinancieras(),
        getMonedas()
      ]);
      
      setGastos(gastosRes.data);
      setCategorias(categoriasRes.data);
      setLineasNegocio(lineasRes.data);
      setCentrosCosto(centrosRes.data);
      setCuentasFinancieras(cuentasRes.data);
      setMonedas(monedasRes.data);
      
      // Set defaults
      const pen = monedasRes.data.find(m => m.codigo === 'PEN');
      if (pen) {
        setFormData(prev => ({ ...prev, moneda_id: pen.id }));
      }
      if (cuentasRes.data.length > 0) {
        setFormData(prev => ({ ...prev, pago_cuenta_financiera_id: cuentasRes.data[0].id }));
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

  const calcularTotal = () => {
    let subtotal = 0;
    let igv = 0;
    formData.lineas.forEach(linea => {
      const importe = parseFloat(linea.importe) || 0;
      subtotal += importe;
      if (linea.igv_aplica) {
        igv += importe * 0.18;
      }
    });
    return { subtotal, igv, total: subtotal + igv };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.pago_cuenta_financiera_id) {
      toast.error('Debe seleccionar una cuenta para el pago');
      return;
    }

    try {
      const dataToSend = {
        ...formData,
        moneda_id: formData.moneda_id ? parseInt(formData.moneda_id) : null,
        pago_cuenta_financiera_id: parseInt(formData.pago_cuenta_financiera_id),
        lineas: formData.lineas.map(l => ({
          ...l,
          categoria_id: l.categoria_id ? parseInt(l.categoria_id) : null,
          linea_negocio_id: l.linea_negocio_id ? parseInt(l.linea_negocio_id) : null,
          centro_costo_id: l.centro_costo_id ? parseInt(l.centro_costo_id) : null,
          importe: parseFloat(l.importe) || 0
        }))
      };
      
      await createGasto(dataToSend);
      toast.success('Gasto registrado y pagado');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating gasto:', error);
      toast.error('Error al registrar gasto');
    }
  };

  const resetForm = () => {
    const pen = monedas.find(m => m.codigo === 'PEN');
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      beneficiario_nombre: '',
      moneda_id: pen?.id || '',
      tipo_documento: '',
      numero_documento: '',
      notas: '',
      lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }],
      pago_cuenta_financiera_id: cuentasFinancieras[0]?.id || '',
      pago_medio: 'efectivo',
      pago_referencia: ''
    });
  };

  const totales = calcularTotal();
  const monedaActual = monedas.find(m => m.id === parseInt(formData.moneda_id));

  // Totales de la lista
  const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.total || 0), 0);

  return (
    <div data-testid="gastos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">Total: {formatCurrency(totalGastos)}</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          data-testid="nuevo-gasto-btn"
        >
          <Plus size={18} />
          Nuevo Gasto
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : gastos.length === 0 ? (
              <div className="empty-state">
                <Wallet className="empty-state-icon" />
                <div className="empty-state-title">No hay gastos registrados</div>
                <div className="empty-state-description">Registra tu primer gasto</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Registrar gasto
                </button>
              </div>
            ) : (
              <table className="data-table" data-testid="gastos-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Beneficiario</th>
                    <th>Documento</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((gasto) => (
                    <tr key={gasto.id}>
                      <td style={{ fontWeight: 500 }}>{gasto.numero}</td>
                      <td>{formatDate(gasto.fecha)}</td>
                      <td>{gasto.beneficiario_nombre || gasto.proveedor_nombre || '-'}</td>
                      <td>{gasto.tipo_documento ? `${gasto.tipo_documento} ${gasto.numero_documento || ''}` : '-'}</td>
                      <td className="text-right" style={{ fontWeight: 500 }}>
                        {formatCurrency(gasto.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nuevo Gasto */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <Wallet size={20} style={{ marginRight: '0.5rem' }} />
                Nuevo Gasto
              </h2>
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
                    <label className="form-label">Beneficiario</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nombre del beneficiario"
                      value={formData.beneficiario_nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, beneficiario_nombre: e.target.value }))}
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo Documento</label>
                    <select
                      className="form-input form-select"
                      value={formData.tipo_documento}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo_documento: e.target.value }))}
                    >
                      <option value="">Sin documento</option>
                      <option value="boleta">Boleta</option>
                      <option value="factura">Factura</option>
                      <option value="recibo">Recibo</option>
                      <option value="ticket">Ticket</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Número Documento</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.numero_documento}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero_documento: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Detalles */}
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Detalle del gasto
                  </h3>

                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Centro Costo</th>
                        <th style={{ width: 100 }}>Importe</th>
                        <th style={{ width: 60 }}>IGV</th>
                        <th style={{ width: 60 }}></th>
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
                              value={linea.centro_costo_id}
                              onChange={(e) => handleLineaChange(index, 'centro_costo_id', e.target.value)}
                            >
                              <option value="">Centro</option>
                              {centrosCosto.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
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
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
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
                </div>

                {/* Pago obligatorio */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#166534' }}>
                    Pago (obligatorio)
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label required">Cuenta</label>
                      <select
                        className="form-input form-select"
                        value={formData.pago_cuenta_financiera_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, pago_cuenta_financiera_id: e.target.value }))}
                        required
                      >
                        <option value="">Seleccionar...</option>
                        {cuentasFinancieras.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Medio</label>
                      <select
                        className="form-input form-select"
                        value={formData.pago_medio}
                        onChange={(e) => setFormData(prev => ({ ...prev, pago_medio: e.target.value }))}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Referencia</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nº operación"
                        value={formData.pago_referencia}
                        onChange={(e) => setFormData(prev => ({ ...prev, pago_referencia: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Totales */}
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
                    <span>Total a Pagar</span>
                    <span className="totals-value">{formatCurrency(totales.total, monedaActual?.simbolo)}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar y Pagar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gastos;
