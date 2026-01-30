import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Trash2, Eye, X, FileCheck, ShoppingCart, ArrowLeft, Printer, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getOrdenesCompra, 
  createOrdenCompra,
  deleteOrdenCompra,
  generarFacturaDesdeOC,
  getProveedores, 
  getMonedas,
  getInventario,
  getEmpresas
} from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const formatCurrency = (value, symbol = 'S/') => {
  const num = parseFloat(value) || 0;
  return `${symbol} ${num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const estadoBadge = (estado) => {
  const badges = {
    borrador: 'badge badge-warning',
    aprobada: 'badge badge-info',
    facturada: 'badge badge-success',
    anulada: 'badge badge-error'
  };
  return badges[estado] || 'badge badge-neutral';
};

export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOC, setSelectedOC] = useState(null);
  const [editingOC, setEditingOC] = useState(null);
  const printRef = useRef();
  
  // Master data
  const [proveedores, setProveedores] = useState([]);
  const [monedas, setMonedas] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  
  // Filters
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    proveedor_id: '',
    moneda_id: '',
    empresa_id: '',
    notas: '',
    condicion_pago: 'contado',
    dias_credito: 0,
    direccion_entrega: ''
  });
  
  // Line items
  const [lineas, setLineas] = useState([{
    articulo_id: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario: 0,
    igv_aplica: true,
    codigo: '',
    unidad: 'UND'
  }]);
  
  const [igvIncluido, setIgvIncluido] = useState(true); // Por defecto IGV incluido

  useEffect(() => {
    loadData();
  }, [filtroEstado, filtroProveedor]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroProveedor) params.proveedor_id = filtroProveedor;
      
      const [ordenesRes, provRes, monRes, artRes, empRes] = await Promise.all([
        getOrdenesCompra(params),
        getProveedores(),
        getMonedas(),
        getInventario(),
        getEmpresas()
      ]);
      
      setOrdenes(ordenesRes.data);
      setProveedores(provRes.data);
      setMonedas(monRes.data);
      setArticulos(artRes.data);
      setEmpresas(empRes.data);
      
      if (monRes.data.length > 0 && !formData.moneda_id) {
        setFormData(prev => ({ ...prev, moneda_id: monRes.data[0].id }));
      }
      if (empRes.data.length > 0 && !formData.empresa_id) {
        setFormData(prev => ({ ...prev, empresa_id: empRes.data[0].id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotales = () => {
    let subtotal = 0;
    let igv = 0;
    
    lineas.forEach(linea => {
      const lineaSubtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio_unitario) || 0);
      if (igvIncluido) {
        const base = lineaSubtotal / 1.18;
        subtotal += base;
        if (linea.igv_aplica) {
          igv += lineaSubtotal - base;
        }
      } else {
        subtotal += lineaSubtotal;
        if (linea.igv_aplica) {
          igv += lineaSubtotal * 0.18;
        }
      }
    });
    
    return { subtotal, igv, total: subtotal + igv };
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      proveedor_id: '',
      moneda_id: monedas[0]?.id || '',
      empresa_id: empresas[0]?.id || '',
      notas: '',
      condicion_pago: 'contado',
      dias_credito: 0,
      direccion_entrega: ''
    });
    setLineas([{
      articulo_id: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      igv_aplica: true,
      codigo: '',
      unidad: 'UND'
    }]);
    setIgvIncluido(true);
  };

  const handleAddLinea = () => {
    setLineas([...lineas, {
      articulo_id: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      igv_aplica: true,
      codigo: '',
      unidad: 'UND'
    }]);
  };

  const handleRemoveLinea = (index) => {
    if (lineas.length > 1) {
      setLineas(lineas.filter((_, i) => i !== index));
    }
  };

  const handleLineaChange = (index, field, value) => {
    setLineas(prev => prev.map((l, i) => 
      i === index ? { ...l, [field]: value } : l
    ));
  };

  const handleSelectArticulo = (index, articuloId) => {
    const articulo = articulos.find(a => a.id === parseInt(articuloId));
    if (articulo) {
      setLineas(prev => prev.map((l, i) => 
        i === index ? { 
          ...l, 
          articulo_id: articulo.id,
          descripcion: articulo.descripcion || articulo.nombre,
          codigo: articulo.codigo || '',
          unidad: articulo.unidad || 'UND',
          precio_unitario: articulo.precio || 0
        } : l
      ));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.proveedor_id) {
      toast.error('Seleccione un proveedor');
      return;
    }
    
    if (lineas.every(l => !l.cantidad || l.cantidad <= 0)) {
      toast.error('Agregue al menos un artículo');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        proveedor_id: parseInt(formData.proveedor_id),
        moneda_id: parseInt(formData.moneda_id),
        lineas: lineas.filter(l => l.cantidad > 0).map(l => ({
          articulo_id: l.articulo_id || null,
          descripcion: l.descripcion || null,
          cantidad: parseFloat(l.cantidad),
          precio_unitario: parseFloat(l.precio_unitario),
          igv_aplica: l.igv_aplica
        }))
      };
      
      await createOrdenCompra(payload);
      toast.success('Orden de compra creada');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating OC:', error);
      toast.error(error.response?.data?.detail || 'Error al crear orden');
    }
  };

  const handleGenerarFactura = async (oc) => {
    if (!window.confirm(`¿Generar factura desde la OC ${oc.numero}?`)) return;
    
    try {
      const response = await generarFacturaDesdeOC(oc.id);
      toast.success(`Factura ${response.data.numero} generada exitosamente`);
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
      toast.error(error.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleView = (oc) => {
    setSelectedOC(oc);
    setShowViewModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const totales = calcularTotales();
  const monedaActual = monedas.find(m => m.id === parseInt(formData.moneda_id));
  const totalOrdenes = ordenes.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const cantidadArticulos = lineas.filter(l => l.cantidad > 0 && (l.articulo_id || l.descripcion)).length;

  return (
    <div data-testid="ordenes-compra-page" className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Órdenes de Compra</h1>
          <p className="page-subtitle">Total: {formatCurrency(totalOrdenes)}</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          data-testid="nueva-oc-btn"
        >
          <Plus size={18} />
          Nueva Orden
        </button>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">Proveedor</label>
            <SearchableSelect
              options={[{ id: '', nombre: 'Todos' }, ...proveedores]}
              value={filtroProveedor}
              onChange={(value) => setFiltroProveedor(value || '')}
              placeholder="Todos"
              searchPlaceholder="Buscar..."
              displayKey="nombre"
              valueKey="id"
              style={{ width: '180px' }}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Estado</label>
            <select 
              className="form-input form-select"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: '140px' }}
            >
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="aprobada">Aprobada</option>
              <option value="facturada">Facturada</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
          {(filtroEstado || filtroProveedor) && (
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => { setFiltroEstado(''); setFiltroProveedor(''); }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : ordenes.length === 0 ? (
              <div className="empty-state">
                <ShoppingCart className="empty-state-icon" />
                <div className="empty-state-title">No hay órdenes de compra</div>
                <div className="empty-state-description">Crea tu primera orden de compra</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Nueva Orden
                </button>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Número</th>
                    <th>Proveedor</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((oc) => (
                    <tr key={oc.id}>
                      <td>{formatDate(oc.fecha)}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                        {oc.numero}
                      </td>
                      <td>{oc.proveedor_nombre || '-'}</td>
                      <td>
                        <span className={estadoBadge(oc.estado)}>
                          {oc.estado}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                        {formatCurrency(oc.total, oc.moneda_codigo === 'USD' ? '$' : 'S/')}
                      </td>
                      <td>
                        <div className="actions-row">
                          {(oc.estado === 'borrador' || oc.estado === 'aprobada') && !oc.factura_generada_id && (
                            <button 
                              className="action-btn action-success"
                              onClick={() => handleGenerarFactura(oc)}
                              title="Generar Factura"
                            >
                              <FileCheck size={15} />
                            </button>
                          )}
                          <button 
                            className="action-btn"
                            onClick={() => handleView(oc)}
                            title="Ver detalles"
                          >
                            <Eye size={15} />
                          </button>
                          {oc.estado === 'borrador' && (
                            <>
                              <button 
                                className="action-btn action-info"
                                onClick={() => handleEdit(oc)}
                                title="Editar"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                className="action-btn action-danger"
                                onClick={() => handleDelete(oc.id)}
                                title="Eliminar"
                              >
                                <Trash2 size={15} />
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

      {/* Modal Nueva OC */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} style={{ padding: '0.25rem' }}>
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>Nueva Orden de Compra</h2>
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                <FileCheck size={16} />
                Guardar
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', gap: '1.5rem', padding: '1.5rem' }}>
                {/* Left Column - Form */}
                <div style={{ flex: 1 }}>
                  {/* Row 1: Empresa + N° Orden | Fecha + Moneda */}
                  <div className="oc-section">
                    <div className="form-grid form-grid-4">
                      <div className="form-group">
                        <label className="form-label">Empresa *</label>
                        <select
                          className="form-input form-select"
                          value={formData.empresa_id}
                          onChange={(e) => setFormData({ ...formData, empresa_id: e.target.value })}
                          required
                        >
                          <option value="">Seleccionar...</option>
                          {empresas.map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">N° Orden</label>
                        <input
                          type="text"
                          className="form-input"
                          value="(Automático)"
                          disabled
                          style={{ background: '#f8fafc', color: '#94a3b8' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fecha *</label>
                        <input
                          type="date"
                          className="form-input"
                          value={formData.fecha}
                          onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Moneda *</label>
                        <select
                          className="form-input form-select"
                          value={formData.moneda_id}
                          onChange={(e) => setFormData({ ...formData, moneda_id: e.target.value })}
                          required
                        >
                          {monedas.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre} ({m.simbolo})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Proveedor + Condición + Días */}
                  <div className="oc-section">
                    <div className="form-grid form-grid-3">
                      <div className="form-group">
                        <label className="form-label">Proveedor *</label>
                        <SearchableSelect
                          options={proveedores}
                          value={formData.proveedor_id}
                          onChange={(value) => setFormData({ ...formData, proveedor_id: value })}
                          placeholder="Seleccionar proveedor..."
                          searchPlaceholder="Buscar proveedor..."
                          displayKey="nombre"
                          valueKey="id"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Condición de Pago</label>
                        <select
                          className="form-input form-select"
                          value={formData.condicion_pago}
                          onChange={(e) => {
                            const val = e.target.value;
                            let dias = 0;
                            if (val === 'credito_15') dias = 15;
                            else if (val === 'credito_30') dias = 30;
                            else if (val === 'credito_45') dias = 45;
                            else if (val === 'credito_60') dias = 60;
                            setFormData({ ...formData, condicion_pago: val, dias_credito: dias });
                          }}
                        >
                          <option value="contado">Contado</option>
                          <option value="credito_15">Crédito 15 días</option>
                          <option value="credito_30">Crédito 30 días</option>
                          <option value="credito_45">Crédito 45 días</option>
                          <option value="credito_60">Crédito 60 días</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Días Crédito</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.dias_credito}
                          onChange={(e) => setFormData({ ...formData, dias_credito: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Dirección + Observaciones */}
                  <div className="oc-section">
                    <div className="form-grid form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Dirección de Entrega</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.direccion_entrega}
                          onChange={(e) => setFormData({ ...formData, direccion_entrega: e.target.value })}
                          placeholder="Dirección de entrega"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Observaciones</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.notas}
                          onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                          placeholder="Notas adicionales"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Detalle de Artículos */}
                  <div className="oc-section" style={{ padding: '1rem 0 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', padding: '0 1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>Detalle de Artículos</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={igvIncluido}
                            onChange={(e) => setIgvIncluido(e.target.checked)}
                          />
                          <span className="toggle-slider"></span>
                          <span className="toggle-label">IGV incluido</span>
                        </label>
                        <button type="button" className="btn btn-outline btn-sm" onClick={handleAddLinea}>
                          <Plus size={14} /> Agregar Línea
                        </button>
                      </div>
                    </div>
                    
                    <div className="items-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="data-table items-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}>#</th>
                            <th style={{ minWidth: '250px' }}>Artículo</th>
                            <th style={{ width: '100px' }}>Código</th>
                            <th style={{ minWidth: '200px' }}>Descripción *</th>
                            <th style={{ width: '80px' }}>Cant. *</th>
                            <th style={{ width: '70px' }}>Unidad</th>
                            <th style={{ width: '100px' }}>P. Unit. *</th>
                            <th style={{ width: '110px' }}>Subtotal</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map((linea, index) => {
                            const subtotal = (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio_unitario) || 0);
                            return (
                              <tr key={index}>
                                <td className="text-center" style={{ color: '#94a3b8' }}>{index + 1}</td>
                                <td>
                                  <SearchableSelect
                                    options={articulos}
                                    value={linea.articulo_id}
                                    onChange={(value) => handleSelectArticulo(index, value)}
                                    placeholder="Buscar artículo..."
                                    searchPlaceholder="Escriba para buscar..."
                                    displayKey="nombre"
                                    valueKey="id"
                                    renderOption={(a) => (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span>{a.nombre}</span>
                                        {a.codigo && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{a.codigo}</span>}
                                      </div>
                                    )}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-input text-center"
                                    value={linea.codigo}
                                    readOnly
                                    style={{ fontSize: '0.8125rem', background: '#f8fafc', color: '#64748b' }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={linea.descripcion}
                                    onChange={(e) => handleLineaChange(index, 'descripcion', e.target.value)}
                                    placeholder="Descripción del artículo"
                                    style={{ fontSize: '0.8125rem' }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input text-center"
                                    value={linea.cantidad}
                                    onChange={(e) => handleLineaChange(index, 'cantidad', e.target.value)}
                                    style={{ fontSize: '0.8125rem' }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-input text-center"
                                    value={linea.unidad}
                                    readOnly
                                    style={{ fontSize: '0.8125rem', background: '#f8fafc', color: '#64748b' }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input text-right"
                                    value={linea.precio_unitario}
                                    onChange={(e) => handleLineaChange(index, 'precio_unitario', e.target.value)}
                                    style={{ fontSize: '0.8125rem', fontFamily: "'JetBrains Mono', monospace" }}
                                  />
                                </td>
                                <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', fontWeight: 500, padding: '0.5rem' }}>
                                  {formatCurrency(subtotal, monedaActual?.simbolo)}
                                </td>
                                <td>
                                  {lineas.length > 1 && (
                                    <button
                                      type="button"
                                      className="action-btn action-danger"
                                      onClick={() => handleRemoveLinea(index)}
                                      style={{ width: '28px', height: '28px' }}
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
                    </div>
                  </div>
                </div>

                {/* Right Column - Summary */}
                <div style={{ width: '280px', flexShrink: 0 }}>
                  <div className="oc-summary-card">
                    <h3 className="summary-title">Resumen</h3>
                    
                    {igvIncluido && (
                      <div className="summary-info-badge">
                        Precios con IGV incluido
                      </div>
                    )}
                    
                    <div className="summary-rows">
                      <div className="summary-row">
                        <span>Subtotal:</span>
                        <span>{monedaActual?.codigo || 'PEN'} {totales.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="summary-row">
                        <span>IGV (18%):</span>
                        <span>{monedaActual?.codigo || 'PEN'} {totales.igv.toFixed(2)}</span>
                      </div>
                      <div className="summary-row summary-total">
                        <span>Total:</span>
                        <span>{monedaActual?.codigo || 'PEN'} {totales.total.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="summary-count">
                      {cantidadArticulos} artículo(s)
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver OC */}
      {showViewModal && selectedOC && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal modal-lg print-content" onClick={(e) => e.stopPropagation()} ref={printRef}>
            <div className="modal-header no-print">
              <h2 className="modal-title">Orden de Compra {selectedOC.numero}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline btn-sm" onClick={handlePrint} title="Imprimir">
                  <Printer size={16} />
                  Imprimir
                </button>
                <button className="modal-close" onClick={() => setShowViewModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Print Header */}
            <div className="print-header">
              <h1>ORDEN DE COMPRA</h1>
              <p className="oc-number">{selectedOC.numero}</p>
            </div>
            
            <div className="modal-body">
              <div className="form-grid form-grid-4" style={{ marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">Fecha</label>
                  <p style={{ fontWeight: 500 }}>{formatDate(selectedOC.fecha)}</p>
                </div>
                <div>
                  <label className="form-label">Proveedor</label>
                  <p style={{ fontWeight: 500 }}>{selectedOC.proveedor_nombre || '-'}</p>
                </div>
                <div>
                  <label className="form-label">Estado</label>
                  <p><span className={estadoBadge(selectedOC.estado)}>{selectedOC.estado}</span></p>
                </div>
                <div>
                  <label className="form-label">Factura</label>
                  <p style={{ fontWeight: 500 }}>{selectedOC.factura_generada_id ? `#${selectedOC.factura_generada_id}` : '-'}</p>
                </div>
              </div>

              <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.875rem' }}>Detalle</h4>
              <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th className="text-center">Cantidad</th>
                    <th className="text-right">P. Unit.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOC.lineas?.map((linea, i) => (
                    <tr key={i}>
                      <td>{linea.descripcion || '-'}</td>
                      <td className="text-center">{linea.cantidad}</td>
                      <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatCurrency(linea.precio_unitario)}
                      </td>
                      <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatCurrency(linea.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-right">Subtotal:</td>
                    <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCurrency(selectedOC.subtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-right">IGV:</td>
                    <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatCurrency(selectedOC.igv)}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={3} className="text-right">TOTAL:</td>
                    <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#1B4D3E' }}>
                      {formatCurrency(selectedOC.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {selectedOC.notas && (
                <div style={{ marginTop: '1rem' }}>
                  <label className="form-label">Notas</label>
                  <p style={{ color: '#64748b' }}>{selectedOC.notas}</p>
                </div>
              )}
            </div>
            <div className="modal-footer no-print">
              {(selectedOC.estado === 'borrador' || selectedOC.estado === 'aprobada') && !selectedOC.factura_generada_id && (
                <button 
                  className="btn btn-success"
                  onClick={() => { setShowViewModal(false); handleGenerarFactura(selectedOC); }}
                >
                  <FileCheck size={16} />
                  Generar Factura
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowViewModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
