import type { TipoCamada } from '../../types';
import './Alternador.css';

interface PropsAlternador {
  id: TipoCamada;
  rotulo: string;
  icone: string;
  marcado: boolean;
  aoMudar: (id: TipoCamada, val: boolean) => void;
  cor?: string;
}

export function Alternador({ id, rotulo, icone, marcado, aoMudar, cor = '#2fd992' }: PropsAlternador) {
  return (
    <button
      type="button"
      className="alternador-item"
      role="switch"
      aria-checked={marcado}
      aria-label={`Camada ${rotulo}`}
      onClick={() => aoMudar(id, !marcado)}
    >
      <span className={`alternador-trilho ${marcado ? 'ligado' : 'desligado'}`} style={{ '--destaque': cor } as React.CSSProperties} aria-hidden="true">
        <span className="alternador-cursor" />
      </span>
      <span className="alternador-icone" aria-hidden="true">{icone}</span>
      <span className="alternador-rotulo">{rotulo}</span>
    </button>
  );
}
