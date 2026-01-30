import React, { useState, useEffect } from 'react';
import { 
  getFacturasProveedor, createFacturaProveedor, updateFacturaProveedor, deleteFacturaProveedor,
  getProveedores, getMonedas, getCategorias, getLineasNegocio, getCentrosCosto,
  getInventario, getModelosCortes, createTercero, createPago, getCuentasFinancieras, createLetra
} from '../services/api';
import { Plus, Trash2, Search, X, FileText, ChevronDown, ChevronUp, Copy, Edit2, Eye, DollarSign, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/SearchableSelect';
import TableSearchSelect from '../components/TableSearchSelect';

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
  const [showDetallesArticulo, setShowDetallesArticulo] = useState(true);
  const [inventario, setInventario] = useState([]);
  const [modelosCortes, setModelosCortes] = useState([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('');
  const [cuentasFinancieras, setCuentasFinancieras] = useState([]);
  
  // Modal de Pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [facturaParaPago, setFacturaParaPago] = useState(null);
  const [pagoData, setPagoData] = useState({
    cuenta_id: '',
    medio_pago: 'transferencia',
    monto: 0,
    referencia: ''
  });
  
  // Modal de Letras
  const [showLetrasModal, setShowLetrasModal] = useState(false);
  const [facturaParaLetras, setFacturaParaLetras] = useState(null);
  const [letrasConfig, setLetrasConfig] = useState({
    prefijo: 'LT',
    cantidad: 3,
    intervalo_dias: 30,
    fecha_giro: new Date().toISOString().split('T')[0],
    banco_id: ''
  });
  const [letrasPreview, setLetrasPreview] = useState([]);
  
  // Modal de Edición/Ver
  const [editingFactura, setEditingFactura] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    proveedor_id: '',
    beneficiario_nombre: '',
    moneda_id: '',
    fecha_factura: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    terminos_dias: 30,
    tipo_documento: 'factura',
    numero: '',
    impuestos_incluidos: true,
    notas: '',
    lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }],
    articulos: []
  });

  useEffect(() => {
    loadData();
  }, [filtroEstado]);

  // Calculate fecha_vencimiento when fecha_factura or terminos change
  useEffect(() => {
    if (formData.fecha_factura && formData.terminos_dias) {
      const fecha = new Date(formData.fecha_factura);
      fecha.setDate(fecha.getDate() + parseInt(formData.terminos_dias));
      setFormData(prev => ({ 
        ...prev, 
        fecha_vencimiento: fecha.toISOString().split('T')[0] 
      }));
    }
  }, [formData.fecha_factura, formData.terminos_dias]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [facturasRes, proveedoresRes, monedasRes, categoriasRes, lineasRes, centrosRes, inventarioRes, modelosRes, cuentasRes] = await Promise.all([
        getFacturasProveedor({ estado: filtroEstado || undefined }),
        getProveedores(),
        getMonedas(),
        getCategorias('egreso'),
        getLineasNegocio(),
        getCentrosCosto(),
        getInventario(),
        getModelosCortes(),
        getCuentasFinancieras()
      ]);
      
      setFacturas(facturasRes.data);
      setProveedores(proveedoresRes.data);
      setMonedas(monedasRes.data);
      setCategorias(categoriasRes.data);
      setLineasNegocio(lineasRes.data);
      setCentrosCosto(centrosRes.data);
      setInventario(inventarioRes.data);
      setModelosCortes(modelosRes.data);
      setCuentasFinancieras(cuentasRes.data);
      
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
    if (formData.lineas.length > 1) {
      setFormData(prev => ({
        ...prev,
        lineas: prev.lineas.filter((_, i) => i !== index)
      }));
    }
  };

  const handleDuplicateLinea = (index) => {
    setFormData(prev => ({
      ...prev,
      lineas: [...prev.lineas.slice(0, index + 1), { ...prev.lineas[index] }, ...prev.lineas.slice(index + 1)]
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

  // Artículos handlers
  const handleAddArticulo = () => {
    setFormData(prev => ({
      ...prev,
      articulos: [...prev.articulos, { articulo_id: '', modelo_corte_id: '', unidad: '', cantidad: 1, precio: 0, linea_negocio_id: '', igv_aplica: true }]
    }));
  };

  const handleRemoveArticulo = (index) => {
    setFormData(prev => ({
      ...prev,
      articulos: prev.articulos.filter((_, i) => i !== index)
    }));
  };

  const handleDuplicateArticulo = (index) => {
    setFormData(prev => ({
      ...prev,
      articulos: [...prev.articulos.slice(0, index + 1), { ...prev.articulos[index] }, ...prev.articulos.slice(index + 1)]
    }));
  };

  const handleArticuloChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      articulos: prev.articulos.map((art, i) => {
        if (i !== index) return art;
        
        const updated = { ...art, [field]: value };
        
        // Auto-fill unidad and precio when selecting articulo
        if (field === 'articulo_id' && value) {
          const selectedArticulo = inventario.find(inv => inv.id === value);
          if (selectedArticulo) {
            updated.unidad = selectedArticulo.unidad_medida || 'UND';
            updated.precio = parseFloat(selectedArticulo.precio_ref) || parseFloat(selectedArticulo.costo_compra) || 0;
          }
        }
        
        return updated;
      })
    }));
  };

  const calcularImporteArticulo = (articulo) => {
    const cantidad = parseFloat(articulo.cantidad) || 0;
    const precio = parseFloat(articulo.precio) || 0;
    return cantidad * precio;
  };

  const calcularTotales = () => {
    let subtotal = 0;
    let igv = 0;
    
    // Sumar líneas de categoría
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
    
    // Sumar artículos
    formData.articulos.forEach(art => {
      const importe = calcularImporteArticulo(art);
      if (formData.impuestos_incluidos) {
        const base = importe / 1.18;
        subtotal += base;
        if (art.igv_aplica) {
          igv += base * 0.18;
        }
      } else {
        subtotal += importe;
        if (art.igv_aplica) {
          igv += importe * 0.18;
        }
      }
    });
    
    return { subtotal, igv, total: subtotal + igv };
  };

  // Crear nuevo proveedor
  const handleCreateProveedor = async (nombre) => {
    if (!nombre || nombre.trim() === '') {
      setShowProveedorModal(true);
      setNuevoProveedorNombre('');
      return;
    }
    
    try {
      const response = await createTercero({
        nombre: nombre.trim(),
        es_proveedor: true,
        tipo_documento: 'RUC',
        numero_documento: '',
        terminos_pago_dias: 30
      });
      
      // Add new proveedor to list and select it
      setProveedores(prev => [...prev, response.data]);
      setFormData(prev => ({ 
        ...prev, 
        proveedor_id: response.data.id,
        beneficiario_nombre: ''
      }));
      toast.success(`Proveedor "${nombre}" creado exitosamente`);
    } catch (error) {
      console.error('Error creating proveedor:', error);
      toast.error('Error al crear proveedor');
    }
  };

  const handleSaveNuevoProveedor = async () => {
    if (!nuevoProveedorNombre.trim()) {
      toast.error('Ingrese el nombre del proveedor');
      return;
    }
    await handleCreateProveedor(nuevoProveedorNombre);
    setShowProveedorModal(false);
  };

  const handleSubmit = async (e, createNew = false) => {
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
      
      if (createNew) {
        resetForm();
      } else {
        setShowModal(false);
        resetForm();
      }
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

  // Abrir modal de pago
  const handleOpenPago = (factura) => {
    setFacturaParaPago(factura);
    setPagoData({
      cuenta_id: cuentasFinancieras[0]?.id || '',
      medio_pago: 'transferencia',
      monto: parseFloat(factura.saldo_pendiente) || 0,
      referencia: ''
    });
    setShowPagoModal(true);
  };

  // Registrar pago
  const handleRegistrarPago = async () => {
    if (!pagoData.cuenta_id) {
      toast.error('Seleccione una cuenta');
      return;
    }
    if (pagoData.monto <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    
    try {
      await createPago({
        tipo: 'egreso',
        fecha: new Date().toISOString().split('T')[0],
        cuenta_financiera_id: parseInt(pagoData.cuenta_id),
        moneda_id: facturaParaPago.moneda_id || 1,
        monto_total: parseFloat(pagoData.monto),
        referencia: pagoData.referencia,
        detalles: [{
          cuenta_financiera_id: parseInt(pagoData.cuenta_id),
          medio_pago: pagoData.medio_pago,
          monto: parseFloat(pagoData.monto),
          referencia: pagoData.referencia
        }],
        aplicaciones: [{
          tipo_documento: 'factura',
          documento_id: facturaParaPago.id,
          monto_aplicado: parseFloat(pagoData.monto)
        }]
      });
      
      toast.success('Pago registrado exitosamente');
      setShowPagoModal(false);
      loadData();
    } catch (error) {
      console.error('Error registrando pago:', error);
      toast.error(error.response?.data?.detail || 'Error al registrar pago');
    }
  };

  // Abrir modal de letras
  const handleOpenLetras = (factura) => {
    setFacturaParaLetras(factura);
    setLetrasConfig({
      prefijo: 'LT',
      cantidad: 3,
      intervalo_dias: 30,
      fecha_giro: new Date().toISOString().split('T')[0],
      banco_id: cuentasFinancieras.find(c => c.tipo === 'banco')?.id || cuentasFinancieras[0]?.id || ''
    });
    // Generar preview inicial
    generateLetrasPreview(factura, 3, 30, new Date().toISOString().split('T')[0]);
    setShowLetrasModal(true);
  };

  // Generar preview de letras
  const generateLetrasPreview = (factura, cantidad, intervalo, fechaGiro) => {
    const saldo = parseFloat(factura?.saldo_pendiente || 0);
    const montoLetra = saldo / cantidad;
    const letras = [];
    
    for (let i = 0; i < cantidad; i++) {
      const fechaVenc = new Date(fechaGiro);
      fechaVenc.setDate(fechaVenc.getDate() + (intervalo * (i + 1)));
      
      letras.push({
        numero: i + 1,
        fecha_vencimiento: fechaVenc.toISOString().split('T')[0],
        monto: montoLetra
      });
    }
    
    setLetrasPreview(letras);
  };

  // Actualizar preview cuando cambian los parámetros
  const handleLetrasConfigChange = (field, value) => {
    const newConfig = { ...letrasConfig, [field]: value };
    setLetrasConfig(newConfig);
    
    if (facturaParaLetras) {
      generateLetrasPreview(
        facturaParaLetras,
        field === 'cantidad' ? parseInt(value) : parseInt(newConfig.cantidad),
        field === 'intervalo_dias' ? parseInt(value) : parseInt(newConfig.intervalo_dias),
        field === 'fecha_giro' ? value : newConfig.fecha_giro
      );
    }
  };

  // Crear letras
  const handleCrearLetras = async () => {
    if (!letrasConfig.banco_id) {
      toast.error('Seleccione un banco');
      return;
    }
    
    try {
      // Crear cada letra
      for (const letra of letrasPreview) {
        await createLetra({
          factura_proveedor_id: facturaParaLetras.id,
          numero: `${letrasConfig.prefijo}-${facturaParaLetras.numero}-${String(letra.numero).padStart(2, '0')}`,
          fecha_emision: letrasConfig.fecha_giro,
          fecha_vencimiento: letra.fecha_vencimiento,
          monto: letra.monto,
          moneda_id: facturaParaLetras.moneda_id || 1,
          banco_id: parseInt(letrasConfig.banco_id),
          estado: 'pendiente'
        });
      }
      
      // Actualizar estado de la factura a CANJEADO
      await updateFacturaProveedor(facturaParaLetras.id, { estado: 'canjeado' });
      
      toast.success(`${letrasPreview.length} letras creadas exitosamente`);
      setShowLetrasModal(false);
      loadData();
    } catch (error) {
      console.error('Error creando letras:', error);
      toast.error(error.response?.data?.detail || 'Error al crear letras');
    }
  };

  // Editar factura
  const handleEdit = (factura) => {
    // Por ahora solo abrimos el modal con los datos
    toast.info('Función de edición en desarrollo');
  };

  // Ver factura
  const handleView = (factura) => {
    // Por ahora solo mostramos info
    toast.info(`Factura ${factura.numero} - Total: ${formatCurrency(factura.total)}`);
  };

  const resetForm = () => {
    const pen = monedas.find(m => m.codigo === 'PEN');
    setFormData({
      proveedor_id: '',
      beneficiario_nombre: '',
      moneda_id: pen?.id || '',
      fecha_factura: new Date().toISOString().split('T')[0],
      fecha_vencimiento: '',
      terminos_dias: 30,
      tipo_documento: 'factura',
      numero: '',
      impuestos_incluidos: true,
      notas: '',
      lineas: [{ categoria_id: '', descripcion: '', linea_negocio_id: '', centro_costo_id: '', importe: 0, igv_aplica: true }],
      articulos: []
    });
  };

  const totales = calcularTotales();
  const monedaActual = monedas.find(m => m.id === parseInt(formData.moneda_id));

  // Calcular totales para la lista
  const totalPendiente = facturas.filter(f => f.estado === 'pendiente' || f.estado === 'parcial')
    .reduce((sum, f) => sum + parseFloat(f.saldo_pendiente || 0), 0);

  return (
    <div data-testid="facturas-proveedor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturas de Proveedor</h1>
          <p className="page-subtitle">
            Pendiente: {formatCurrency(totalPendiente)}
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
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
                    <th>Fecha</th>
                    <th>Nro. Doc</th>
                    <th>Proveedor / Beneficiario</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pagado</th>
                    <th>Estado</th>
                    <th className="text-right">Saldo CxP</th>
                    <th className="text-center" style={{ minWidth: '200px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((factura) => {
                    const saldo = parseFloat(factura.saldo_pendiente) || 0;
                    const total = parseFloat(factura.total) || 0;
                    const pagado = total - saldo;
                    const puedeGenerarLetras = factura.estado === 'pendiente' && saldo > 0;
                    const puedePagar = (factura.estado === 'pendiente' || factura.estado === 'parcial') && saldo > 0;
                    
                    return (
                      <tr key={factura.id} data-testid={`factura-row-${factura.id}`}>
                        <td>{formatDate(factura.fecha_factura)}</td>
                        <td style={{ fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                          {factura.numero}
                        </td>
                        <td>{factura.proveedor_nombre || factura.beneficiario_nombre || '-'}</td>
                        <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatCurrency(total, factura.moneda_simbolo)}
                        </td>
                        <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#22C55E' }}>
                          {formatCurrency(pagado, factura.moneda_simbolo)}
                        </td>
                        <td>
                          <span className={estadoBadge(factura.estado)}>
                            {factura.estado}
                          </span>
                        </td>
                        <td className="text-right" style={{ 
                          fontFamily: "'JetBrains Mono', monospace",
                          color: saldo > 0 ? '#EF4444' : '#22C55E',
                          fontWeight: 500
                        }}>
                          {formatCurrency(saldo, factura.moneda_simbolo)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {/* Botón Pagar - Solo si puede pagar y NO está canjeado */}
                            {puedePagar && factura.estado !== 'canjeado' && (
                              <button 
                                className="btn btn-success btn-sm"
                                onClick={() => handleOpenPago(factura)}
                                title="Registrar Pago"
                                data-testid={`pagar-factura-${factura.id}`}
                              >
                                <DollarSign size={14} />
                                Pagar
                              </button>
                            )}
                            
                            {/* Botón Generar Letras - Solo si está pendiente */}
                            {puedeGenerarLetras && (
                              <button 
                                className="btn btn-info btn-sm"
                                onClick={() => handleOpenLetras(factura)}
                                title="Canjear por Letras"
                                data-testid={`letras-factura-${factura.id}`}
                              >
                                <FileSpreadsheet size={14} />
                                Letras
                              </button>
                            )}
                            
                            {/* Botón Ver */}
                            <button 
                              className="btn btn-outline btn-sm btn-icon"
                              onClick={() => handleView(factura)}
                              title="Ver detalles"
                              data-testid={`ver-factura-${factura.id}`}
                            >
                              <Eye size={14} />
                            </button>
                            
                            {/* Botón Editar - Solo si no está pagado o canjeado */}
                            {factura.estado !== 'pagado' && factura.estado !== 'canjeado' && (
                              <button 
                                className="btn btn-outline btn-sm btn-icon"
                                onClick={() => handleEdit(factura)}
                                title="Editar"
                                data-testid={`editar-factura-${factura.id}`}
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            
                            {/* Botón Eliminar - Solo si está pendiente */}
                            {factura.estado === 'pendiente' && (
                              <button 
                                className="btn btn-outline btn-sm btn-icon btn-danger"
                                onClick={() => handleDelete(factura.id)}
                                title="Eliminar"
                                data-testid={`delete-factura-${factura.id}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nueva Factura - Estilo como la imagen */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="factura-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="factura-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={24} color="#1B4D3E" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Factura de proveedor</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SALDO PENDIENTE
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatCurrency(totales.total, monedaActual?.simbolo || 'S/.')}
                  </div>
                </div>
                <button className="modal-close" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="factura-modal-body">
                {/* Proveedor row */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label required">Proveedor</label>
                    <SearchableSelect
                      options={proveedores}
                      value={formData.proveedor_id}
                      onChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        proveedor_id: value,
                        beneficiario_nombre: value ? '' : prev.beneficiario_nombre
                      }))}
                      placeholder="Buscar proveedor..."
                      searchPlaceholder="Buscar por nombre..."
                      displayKey="nombre"
                      valueKey="id"
                      onCreateNew={handleCreateProveedor}
                      createNewLabel="Crear proveedor"
                      data-testid="proveedor-select"
                    />
                  </div>
                  
                  {/* Mostrar campo beneficiario solo si NO hay proveedor seleccionado */}
                  {!formData.proveedor_id && (
                    <div className="form-group" style={{ flex: 1 }}>
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
                  )}
                </div>

                {/* Términos, Moneda, Fechas */}
                <div className="form-row">
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
                      <option value="">Moneda</option>
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
                      value={formData.fecha_vencimiento}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_vencimiento: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Tipo y Número documento */}
                <div className="form-row">
                  <div className="form-group" style={{ maxWidth: '200px' }}>
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
                  
                  <div className="form-group" style={{ maxWidth: '200px' }}>
                    <label className="form-label required">N.º de documento</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="NV001-00001"
                      value={formData.numero}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Sección Detalles de la categoría */}
                <div className="factura-section">
                  <div className="factura-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ChevronUp size={18} />
                      <span style={{ fontWeight: 600 }}>Detalles de la categoría</span>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>({formData.lineas.length} línea{formData.lineas.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Los importes son</span>
                      <select
                        className="form-input form-select"
                        style={{ width: 'auto', padding: '0.375rem 2rem 0.375rem 0.75rem', fontSize: '0.875rem' }}
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

                  <div className="table-scroll-wrapper">
                    <table className="factura-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th style={{ minWidth: '160px' }}>CATEGORÍA</th>
                          <th style={{ minWidth: '180px' }}>DESCRIPCIÓN</th>
                          <th style={{ minWidth: '140px' }}>LÍNEA NEGOCIO</th>
                          <th style={{ width: '100px' }}>IMPORTE</th>
                          <th style={{ width: '80px' }}>IGV 18%</th>
                          <th style={{ width: '100px' }}>ACCIONES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lineas.map((linea, index) => (
                          <tr key={index}>
                            <td className="row-number">{index + 1}</td>
                            <td>
                              <TableSearchSelect
                                options={categorias}
                                value={linea.categoria_id}
                                onChange={(value) => handleLineaChange(index, 'categoria_id', value)}
                              placeholder="Categoría"
                              displayKey="nombre"
                              valueKey="id"
                            />
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
                            <TableSearchSelect
                              options={lineasNegocio}
                              value={linea.linea_negocio_id}
                              onChange={(value) => handleLineaChange(index, 'linea_negocio_id', value)}
                              placeholder="Línea"
                              displayKey="nombre"
                              valueKey="id"
                            />
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
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={linea.igv_aplica}
                              onChange={(e) => handleLineaChange(index, 'igv_aplica', e.target.checked)}
                              style={{ width: '18px', height: '18px', accentColor: '#1B4D3E' }}
                            />
                          </td>
                          <td className="actions-cell">
                            <button
                              type="button"
                              className="btn-icon-small"
                              onClick={() => handleDuplicateLinea(index)}
                              title="Duplicar"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-small"
                              onClick={() => handleRemoveLinea(index)}
                              title="Eliminar"
                              disabled={formData.lineas.length === 1}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
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
                    >
                      Borrar todas las líneas
                    </button>
                  </div>
                </div>

                {/* Sección Detalles del artículo */}
                <div className="factura-section">
                  <button
                    type="button"
                    className="factura-section-header"
                    onClick={() => setShowDetallesArticulo(!showDetallesArticulo)}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {showDetallesArticulo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      <span style={{ fontWeight: 600 }}>Detalles del artículo</span>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>({formData.articulos.length} artículo{formData.articulos.length !== 1 ? 's' : ''})</span>
                    </div>
                  </button>
                  
                  {showDetallesArticulo && (
                    <>
                      {formData.articulos.length > 0 ? (
                        <div className="table-scroll-wrapper">
                          <table className="factura-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th style={{ minWidth: '180px' }}>ARTÍCULO</th>
                                <th style={{ minWidth: '180px' }}>MODELO / CORTE</th>
                                <th style={{ width: '70px' }}>UND</th>
                                <th style={{ width: '70px' }}>CANT.</th>
                                <th style={{ width: '90px' }}>PRECIO</th>
                                <th style={{ minWidth: '140px' }}>LÍNEA NEGOCIO</th>
                                <th style={{ width: '100px' }}>IMPORTE</th>
                                <th style={{ width: '60px' }}>IGV</th>
                                <th style={{ width: '80px' }}>ACCIONES</th>
                              </tr>
                            </thead>
                            <tbody>
                              {formData.articulos.map((articulo, index) => (
                                <tr key={index}>
                                  <td className="row-number">{index + 1}</td>
                                  <td>
                                    <TableSearchSelect
                                      options={inventario}
                                      value={articulo.articulo_id}
                                      onChange={(value) => handleArticuloChange(index, 'articulo_id', value)}
                                      placeholder="Artículo"
                                      displayKey="nombre"
                                      valueKey="id"
                                      renderOption={(inv) => `${inv.codigo ? inv.codigo + ' - ' : ''}${inv.nombre}`}
                                    />
                                  </td>
                                  <td>
                                    <TableSearchSelect
                                      options={modelosCortes}
                                      value={articulo.modelo_corte_id}
                                      onChange={(value) => handleArticuloChange(index, 'modelo_corte_id', value)}
                                      placeholder="Modelo / Corte"
                                      displayKey="display_name"
                                      valueKey="id"
                                      renderOption={(mc) => mc.display_name || `${mc.modelo_nombre || 'Sin modelo'} - Corte ${mc.n_corte}`}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      value={articulo.unidad || ''}
                                      readOnly
                                      disabled
                                      style={{ width: '100%', textAlign: 'center', background: '#f8fafc', color: '#64748b' }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      step="1"
                                      min="1"
                                      placeholder="1"
                                      value={articulo.cantidad}
                                      onChange={(e) => handleArticuloChange(index, 'cantidad', e.target.value)}
                                      style={{ textAlign: 'center' }}
                                      data-testid={`articulo-cantidad-${index}`}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={articulo.precio}
                                      onChange={(e) => handleArticuloChange(index, 'precio', e.target.value)}
                                      style={{ textAlign: 'right' }}
                                      data-testid={`articulo-precio-${index}`}
                                    />
                                  </td>
                                  <td>
                                    <TableSearchSelect
                                      options={lineasNegocio}
                                      value={articulo.linea_negocio_id}
                                      onChange={(value) => handleArticuloChange(index, 'linea_negocio_id', value)}
                                      placeholder="Línea"
                                      displayKey="nombre"
                                      valueKey="id"
                                    />
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 500, fontFamily: "'JetBrains Mono', monospace", padding: '0.625rem 0.75rem' }}>
                                    {calcularImporteArticulo(articulo).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={articulo.igv_aplica}
                                      onChange={(e) => handleArticuloChange(index, 'igv_aplica', e.target.checked)}
                                      style={{ width: '18px', height: '18px', accentColor: '#1B4D3E' }}
                                    />
                                  </td>
                                  <td className="actions-cell">
                                    <button
                                      type="button"
                                      className="btn-icon-small"
                                      onClick={() => handleDuplicateArticulo(index)}
                                      title="Duplicar"
                                    >
                                      <Copy size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon-small"
                                      onClick={() => handleRemoveArticulo(index)}
                                      title="Eliminar"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleAddArticulo}
                          data-testid="agregar-articulo-btn"
                        >
                          <Plus size={16} />
                          Agregar artículo
                        </button>
                        {formData.articulos.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setFormData(prev => ({ ...prev, articulos: [] }))}
                          >
                            Borrar todos
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Nota y Totales */}
                <div className="form-row" style={{ alignItems: 'flex-start', marginTop: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Nota</label>
                    <textarea
                      className="form-input"
                      rows={4}
                      placeholder="Añadir una nota..."
                      value={formData.notas}
                      onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  
                  <div className="factura-totales">
                    <div className="totales-row">
                      <span>Subtotal</span>
                      <span>{formatCurrency(totales.subtotal, monedaActual?.simbolo || 'S/.')}</span>
                    </div>
                    <div className="totales-row">
                      <span>IGV (18%)</span>
                      <span>{formatCurrency(totales.igv, monedaActual?.simbolo || 'S/.')}</span>
                    </div>
                    <div className="totales-row total">
                      <span>Total</span>
                      <span>{formatCurrency(totales.total, monedaActual?.simbolo || 'S/.')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="factura-modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn btn-secondary" data-testid="guardar-factura-btn">
                    <FileText size={16} />
                    Guardar
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={(e) => handleSubmit(e, true)}
                    data-testid="guardar-crear-btn"
                  >
                    Guardar y crear nueva
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Proveedor */}
      {showProveedorModal && (
        <div className="modal-overlay" onClick={() => setShowProveedorModal(false)} style={{ zIndex: 1100 }}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', padding: '1.5rem' }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600 }}>Crear nuevo proveedor</h3>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Nombre del proveedor</label>
              <input
                type="text"
                className="form-input"
                placeholder="Razón social o nombre"
                value={nuevoProveedorNombre}
                onChange={(e) => setNuevoProveedorNombre(e.target.value)}
                autoFocus
                data-testid="nuevo-proveedor-nombre"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowProveedorModal(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSaveNuevoProveedor}
                data-testid="guardar-proveedor-btn"
              >
                Crear proveedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturasProveedor;
