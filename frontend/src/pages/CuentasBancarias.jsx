import React, { useState, useEffect } from 'react';
import { getCuentasFinancieras, createCuentaFinanciera, deleteCuentaFinanciera, getMonedas } from '../services/api';
import { Plus, Trash2, Edit2, Landmark, X } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value, symbol = 'S/') => {
  return `${symbol} ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
};

export const CuentasBancarias = () => {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [monedas, setMonedas] = useState([]);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'banco',
    banco: '',
    numero_cuenta: '',
    cci: '',
    moneda_id: '',
    saldo_actual: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cuentasRes, monedasRes] = await Promise.all([
        getCuentasFinancieras(),
        getMonedas()
      ]);
      setCuentas(cuentasRes.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createCuentaFinanciera({
        ...formData,
        moneda_id: parseInt(formData.moneda_id),
        saldo_actual: parseFloat(formData.saldo_actual) || 0
      });
      toast.success('Cuenta creada');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating cuenta:', error);
      toast.error('Error al crear cuenta');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar esta cuenta?')) return;
    try {
      await deleteCuentaFinanciera(id);
      toast.success('Cuenta eliminada');
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar cuenta');
    }
  };

  const resetForm = () => {
    const pen = monedas.find(m => m.codigo === 'PEN');
    setFormData({
      nombre: '',
      tipo: 'banco',
      banco: '',
      numero_cuenta: '',
      cci: '',
      moneda_id: pen?.id || '',
      saldo_actual: 0
    });
  };

  const totalSaldo = cuentas.reduce((sum, c) => sum + parseFloat(c.saldo_actual || 0), 0);

  return (
    <div data-testid="cuentas-bancarias-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas Bancarias</h1>
          <p className="page-subtitle">Saldo total: {formatCurrency(totalSaldo)}</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowModal(true); }}
          data-testid="nueva-cuenta-btn"
        >
          <Plus size={18} />
          Nueva Cuenta
        </button>
      </div>

      <div className="page-content">
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
            </div>
          ) : cuentas.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <Landmark className="empty-state-icon" />
                <div className="empty-state-title">No hay cuentas registradas</div>
                <div className="empty-state-description">Agrega tu primera cuenta bancaria o caja</div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={18} />
                  Agregar cuenta
                </button>
              </div>
            </div>
          ) : (
            cuentas.map((cuenta) => (
              <div key={cuenta.id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ 
                      display: 'inline-flex', 
                      padding: '0.25rem 0.5rem', 
                      background: cuenta.tipo === 'banco' ? '#dbeafe' : '#fef3c7',
                      color: cuenta.tipo === 'banco' ? '#1e40af' : '#92400e',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      marginBottom: '0.5rem'
                    }}>
                      {cuenta.tipo}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{cuenta.nombre}</h3>
                    {cuenta.banco && (
                      <p style={{ fontSize: '0.813rem', color: 'var(--muted)' }}>{cuenta.banco}</p>
                    )}
                  </div>
                  <button 
                    className="btn btn-outline btn-sm btn-icon"
                    onClick={() => handleDelete(cuenta.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                {cuenta.numero_cuenta && (
                  <div style={{ fontSize: '0.813rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
                    Cuenta: {cuenta.numero_cuenta}
                  </div>
                )}
                
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 600, 
                  fontFamily: "'JetBrains Mono', monospace",
                  color: cuenta.saldo_actual >= 0 ? '#22C55E' : '#EF4444'
                }}>
                  {formatCurrency(cuenta.saldo_actual, cuenta.moneda_codigo === 'USD' ? '$' : 'S/')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Cuenta</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Cuenta BCP Soles"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label required">Tipo</label>
                    <select
                      className="form-input form-select"
                      value={formData.tipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                    >
                      <option value="banco">Banco</option>
                      <option value="caja">Caja</option>
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
                        <option key={m.id} value={m.id}>{m.codigo} - {m.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.tipo === 'banco' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Banco</label>
                      <select
                        className="form-input form-select"
                        value={formData.banco}
                        onChange={(e) => setFormData(prev => ({ ...prev, banco: e.target.value }))}
                      >
                        <option value="">Seleccionar banco...</option>
                        <option value="BCP">BCP</option>
                        <option value="BBVA">BBVA</option>
                        <option value="Interbank">Interbank</option>
                        <option value="Scotiabank">Scotiabank</option>
                        <option value="BanBif">BanBif</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Número de Cuenta</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.numero_cuenta}
                        onChange={(e) => setFormData(prev => ({ ...prev, numero_cuenta: e.target.value }))}
                        placeholder="Ej: 191-12345678-0-12"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">CCI</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.cci}
                        onChange={(e) => setFormData(prev => ({ ...prev, cci: e.target.value }))}
                        placeholder="Código Interbancario"
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Saldo Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.saldo_actual}
                    onChange={(e) => setFormData(prev => ({ ...prev, saldo_actual: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuentasBancarias;
