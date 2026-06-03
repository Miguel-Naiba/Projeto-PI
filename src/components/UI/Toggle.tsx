import type { LayerType } from '../../types';
import './Toggle.css';

interface ToggleProps {
  id: LayerType;
  label: string;
  icon: string;
  checked: boolean;
  onChange: (id: LayerType, val: boolean) => void;
  color?: string;
}

export function Toggle({ id, label, icon, checked, onChange, color = '#22c55e' }: ToggleProps) {
  return (
    <label className="toggle-item" htmlFor={`toggle-${id}`}>
      <div
        className={`toggle-track ${checked ? 'on' : 'off'}`}
        style={{ '--accent': color } as React.CSSProperties}
        onClick={() => onChange(id, !checked)}
        role="switch"
        aria-checked={checked}
        aria-label={`Camada ${label}`}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onChange(id, !checked)}
      >
        <div className="toggle-thumb" />
      </div>
      <span className="toggle-icon">{icon}</span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}
