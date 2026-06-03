import { Toggle } from './Toggle';
import type { LayerState, LayerType } from '../../types';
import './BottomBar.css';

interface BottomBarProps {
  layers: LayerState;
  onToggle: (id: LayerType, val: boolean) => void;
  onVoiceClick: () => void;
  onFavoritesClick: () => void;
  onConfigClick: () => void;
  onAboutClick: () => void;
}

const LAYER_CONFIG: { id: LayerType; label: string; icon: string; color: string }[] = [
  { id: 'paradas',   label: 'Paradas',   icon: '🚏', color: '#22c55e' },
  { id: 'semaforos', label: 'Semáforos', icon: '🚦', color: '#22c55e' },
  { id: 'obras',     label: 'Obras',     icon: '⚠️', color: '#f97316' },
];

export function BottomBar({ layers, onToggle, onVoiceClick, onFavoritesClick, onConfigClick, onAboutClick }: BottomBarProps) {
  return (
    <div className="bottom-bar" role="toolbar" aria-label="Controles do mapa">
      <div className="bottom-bar__layers">
        {LAYER_CONFIG.map((l) => (
          <Toggle
            key={l.id}
            id={l.id}
            label={l.label}
            icon={l.icon}
            checked={layers[l.id]}
            onChange={onToggle}
            color={l.color}
          />
        ))}
      </div>

      <div className="bottom-bar__actions">
        <button
          className="bottom-btn voice-btn"
          onClick={onVoiceClick}
          aria-label="Ativar navegação por voz"
        >
          <span className="btn-icon">🔊</span>
          <span className="btn-label">Voz</span>
        </button>
        <button className="bottom-btn" onClick={onFavoritesClick} aria-label="Favoritos">
          <span className="btn-icon">☆</span>
          <span className="btn-label">Favoritos</span>
        </button>
        <button className="bottom-btn" onClick={onConfigClick} aria-label="Configurações">
          <span className="btn-icon">⚙</span>
          <span className="btn-label">Config</span>
        </button>
        <button className="bottom-btn" onClick={onAboutClick} aria-label="Sobre">
          <span className="btn-icon">ℹ</span>
          <span className="btn-label">Sobre</span>
        </button>
      </div>
    </div>
  );
}
