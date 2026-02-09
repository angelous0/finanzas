import React, { useState, useEffect } from 'react';
import { getProveedores, createTercero, updateTercero, deleteTercero } from '../services/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Plus, Edit2, Trash2, Users, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export const Proveedores = () => {
  const { empresaActual } = useEmpresa();

  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    tipo_documento: 'RUC',
    numero_documento: '',
    nombre: '',
    nombre_comercial: '',
    direccion: '',
    telefono: '',
    email: '',
    terminos_pago_dias: 30,
    es_proveedor: true
  });

  useEffect(() => {
    loadProveedores();
  }, [search, empresaActual]);

  const loadProveedores = async () => {
    try {
      setLoading(true);
      const response = await getProveedores(search || undefined);
      setProveedores(response.data);
    } catch (error) {
      console.error('Error loading proveedores:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateTercero(editingId, formData);
        toast.success('Proveedor actualizado');
      } else {
        await createTercero(formData);
        toast.success('Proveedor creado');
      }
      setShowModal(false);
      resetForm();
      loadProveedores();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error al guardar proveedor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (proveedor) => {
    setFormData({
      tipo_documento: proveedor.tipo_documento || 'RUC',
      numero_documento: proveedor.numero_documento || '',
      nombre: proveedor.nombre,
      nombre_comercial: proveedor.nombre_comercial || '',
      direccion: proveedor.direccion || '',
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      terminos_pago_dias: proveedor.terminos_pago_dias || 30,
      es_proveedor: true
    });
    setEditingId(proveedor.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este proveedor?')) return;
    try {
      await deleteTercero(id);
      toast.success('Proveedor eliminado');
      loadProveedores();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar proveedor');
    }
  };

  const resetForm = () => {
    setFormData({
      tipo_documento: 'RUC',
      numero_documento: '',
      nombre: '',
      nombre_comercial: '',
      direccion: '',
      telefono: '',
      email: '',
      terminos_pago_dias: 30,
      es_proveedor: true
    });
    setEditingId(null);
  };

  return (
    <div data-testid="proveedores-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">{proveedores.length} proveedores registrados</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          data-testid="nuevo-proveedor-btn"
        >
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>

      <div className="page-content">
        {/* Search */}
        <div className="filters-bar">
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar por nombre o RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : proveedores.length === 0 ? (
              <div className="empty-state">
                <Users className="empty-state-icon" />
                <div className="empty-state-title">No hay proveedores</div>
                <div className="empty-state-description">Agrega tu primer proveedor</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Agregar proveedor
                </button>
              </div>
            ) : (
              <table className="data-table" data-testid="proveedores-table">
                <thead>
                  <tr>
                    <th>RUC/DNI</th>
                    <th>Nombre</th>
                    <th>Nombre Comercial</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Términos</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((proveedor) => (
                    <tr key={proveedor.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {proveedor.numero_documento || '-'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{proveedor.nombre}</td>
                      <td>{proveedor.nombre_comercial || '-'}</td>
                      <td>{proveedor.telefono || '-'}</td>
                      <td>{proveedor.email || '-'}</td>
                      <td>{proveedor.terminos_pago_dias || 0} días</td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => handleEdit(proveedor)}
                            title="Editar"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => handleDelete(proveedor.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo Doc.</label>
                    <select
                      className="form-input form-select"
                      value={formData.tipo_documento}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo_documento: e.target.value }))}
                    >
                      <option value="RUC">RUC</option>
                      <option value="DNI">DNI</option>
                      <option value="CE">CE</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label required">Número Documento</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.numero_documento}
                      onChange={(e) => setFormData(prev => ({ ...prev, numero_documento: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Razón Social / Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre Comercial</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre_comercial}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre_comercial: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.direccion}
                    onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.telefono}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Términos de Pago (días)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.terminos_pago_dias}
                    onChange={(e) => setFormData(prev => ({ ...prev, terminos_pago_dias: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Proveedores;
