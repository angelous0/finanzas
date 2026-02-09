import React, { useState, useEffect } from 'react';
import { getLineasNegocio, createLineaNegocio, updateLineaNegocio, deleteLineaNegocio } from '../services/api';
import { useEmpresa } from '../context/EmpresaContext';
import { Plus, Trash2, GitBranch, X, Edit } from 'lucide-react';
import { toast } from 'sonner';

export const LineasNegocio = () => {
  const { empresaActual } = useEmpresa();

  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({ codigo: '', nombre: '', descripcion: '' });

  useEffect(() => { loadData(); }, [empresaActual]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getLineasNegocio();
      setLineas(response.data);
    } catch (error) {
      toast.error('Error al cargar líneas de negocio');
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
        await updateLineaNegocio(editingId, formData);
        toast.success('Línea de negocio actualizada');
      } else {
        await createLineaNegocio(formData);
        toast.success('Línea de negocio creada');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Error al guardar línea de negocio');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (linea) => {
    setFormData({ codigo: linea.codigo || '', nombre: linea.nombre, descripcion: linea.descripcion || '' });
    setEditingId(linea.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta línea de negocio?')) return;
    try {
      await deleteLineaNegocio(id);
      toast.success('Línea de negocio eliminada');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const resetForm = () => {
    setFormData({ codigo: '', nombre: '', descripcion: '' });
    setEditingId(null);
  };

  return (
    <div data-testid="lineas-negocio-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Líneas de Negocio</h1>
          <p className="page-subtitle">{lineas.length} líneas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }} data-testid="nueva-linea-btn">
          <Plus size={18} /> Nueva Línea
        </button>
      </div>

      <div className="page-content">
        <div className="card">
          <div className="data-table-wrapper">
            {loading ? (
              <div className="loading"><div className="loading-spinner"></div></div>
            ) : lineas.length === 0 ? (
              <div className="empty-state">
                <GitBranch className="empty-state-icon" />
                <div className="empty-state-title">No hay líneas de negocio</div>
                <div className="empty-state-description">Crea tu primera línea para organizar tus operaciones</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea) => (
                    <tr key={linea.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{linea.codigo || '-'}</td>
                      <td style={{ fontWeight: 500 }}>{linea.nombre}</td>
                      <td>{linea.descripcion || '-'}</td>
                      <td className="text-center" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => handleEdit(linea)} title="Editar" data-testid={`edit-linea-${linea.id}`}>
                          <Edit size={14} />
                        </button>
                        <button className="btn btn-outline btn-sm btn-icon" onClick={() => handleDelete(linea.id)} title="Eliminar" data-testid={`delete-linea-${linea.id}`}>
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
              <h2 className="modal-title">{editingId ? 'Editar' : 'Nueva'} Línea de Negocio</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Código</label>
                  <input type="text" className="form-input" value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))} placeholder="LN-001" />
                </div>
                <div className="form-group">
                  <label className="form-label required">Nombre</label>
                  <input type="text" className="form-input" value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} required data-testid="linea-nombre-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea className="form-input" rows={2} value={formData.descripcion}
                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" data-testid="guardar-linea-btn" disabled={submitting}>
                  {submitting ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LineasNegocio;
