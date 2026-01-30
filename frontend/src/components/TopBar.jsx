import React from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useEmpresa } from '../context/EmpresaContext';

export default function TopBar() {
  const { empresas, empresaActual, cambiarEmpresa, loading } = useEmpresa();

  if (loading) return null;

  return (
    <div className="top-bar">
      <div className="empresa-selector">
        <Building2 size={18} className="empresa-icon" />
        <select
          value={empresaActual?.id || ''}
          onChange={(e) => cambiarEmpresa(e.target.value)}
          className="empresa-select"
          data-testid="empresa-selector"
        >
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.nombre}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="empresa-chevron" />
      </div>
    </div>
  );
}
