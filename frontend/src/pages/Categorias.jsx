import React, { useState, useEffect } from 'react';
import { getCategorias, createCategoria, deleteCategoria } from '../services/api';
import { Plus, Trash2, Tags, X } from 'lucide-react';
import { toast } from 'sonner';

export const Categorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    tipo: 'egreso',
    descripcion: ''
  });

  useEffect(() => {
    loadData();
  }, [filtroTipo]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getCategorias(filtroTipo || undefined);
      setCategorias(response.data);
    } catch (error) {
      console.error('Error loading categorias:', error);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createCategoria(formData);
      toast.success('Categoría creada');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating:', error);
      toast.error('Error al crear categoría');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return;
    try {
      await deleteCategoria(id);
      toast.success('Categoría eliminada');
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar categoría');
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      nombre: '',
      tipo: 'egreso',
      descripcion: ''
    });
  };

  return (
    <div data-testid="categorias-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">{categorias.length} categorías</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
        >
          <Plus size={18} />
          Nueva Categoría
        </button>
      </div>

      <div className="page-content">
        <div className="filters-bar">
          <select 
            className="form-input form-select filter-input"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Egresos</option>
          </select>
        </div>

        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading">
                <div className="loading-spinner"></div>
              </div>
            ) : categorias.length === 0 ? (
              <div className="empty-state">
                <Tags className="empty-state-icon" />
                <div className="empty-state-title">No hay categorías</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((cat) => (
                    <tr key={cat.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{cat.codigo || '-'}</td>
                      <td style={{ fontWeight: 500 }}>{cat.nombre}</td>
                      <td>
                        <span className={`badge ${cat.tipo === 'ingreso' ? 'badge-success' : 'badge-error'}`}>
                          {cat.tipo}
                        </span>
                      </td>
                      <td>{cat.descripcion || '-'}</td>
                      <td className="text-center">
                        <button 
                          className="btn btn-outline btn-sm btn-icon"
                          onClick={() => handleDelete(cat.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Categoría</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Código</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.codigo}
                      onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                      placeholder="EGR-001"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label required">Tipo</label>
                    <select
                      className="form-input form-select"
                      value={formData.tipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                    >
                      <option value="egreso">Egreso</option>
                      <option value="ingreso">Ingreso</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label required">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={formData.descripcion}
                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categorias;
