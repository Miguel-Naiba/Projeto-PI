import { useEffect, useRef } from 'react';
import { Icone } from './Icone';
import { Alternador } from './Alternador';
import type { EstadoCamadas, TipoCamada } from '../../types';
import './BarraInferior.css';

interface PropsBarraInferior {
  camadas: EstadoCamadas;
  aoAlternar: (id: TipoCamada, val: boolean) => void;
  aoClicarVoz: () => void;
  aoClicarMicrofone: () => void;
  microfoneOuvindo: boolean;
  microfoneSuportado: boolean;
  aoClicarPontosProximos: () => void;
  aoClicarConfiguracoes: () => void;
  aoClicarSobre: () => void;
}

const CONFIG_CAMADAS: { id: TipoCamada; rotulo: string; icone: string; cor: string }[] = [
  { id: 'paradas',    rotulo: 'Parada com piso tátil',  icone: '🟢', cor: '#2fd992' },
  { id: 'botoneiras', rotulo: 'Botoeiras',   icone: '🔊', cor: '#4cc9f0' },
  { id: 'obras',      rotulo: 'Obras',       icone: '🚧', cor: '#f5a623' },
];

export function BarraInferior({
  camadas,
  aoAlternar,
  aoClicarVoz,
  aoClicarMicrofone,
  microfoneOuvindo,
  microfoneSuportado,
  aoClicarPontosProximos,
  aoClicarConfiguracoes,
  aoClicarSobre,
}: PropsBarraInferior) {
  const refBarra = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const barra = refBarra.current;
    if (!barra) return;
    const raiz = document.documentElement;
    const anterior = raiz.style.getPropertyValue('--altura-barra-inferior');
    const medir = () => raiz.style.setProperty('--altura-barra-inferior', `${barra.getBoundingClientRect().height}px`);
    medir();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(barra);
    window.addEventListener('resize', medir);
    return () => {
      observador?.disconnect();
      window.removeEventListener('resize', medir);
      if (anterior) raiz.style.setProperty('--altura-barra-inferior', anterior);
      else raiz.style.removeProperty('--altura-barra-inferior');
    };
  }, []);

  return (
    <div ref={refBarra} className="barra-inferior" role="toolbar" aria-label="Controles do mapa">
      <div className="barra-inferior__camadas">
        {CONFIG_CAMADAS.map((c) => (
          <Alternador
            key={c.id}
            id={c.id}
            rotulo={c.rotulo}
            icone={c.icone}
            marcado={camadas[c.id]}
            aoMudar={aoAlternar}
            cor={c.cor}
          />
        ))}
      </div>

      <div className="barra-inferior__acoes">
        <button
          className={`botao-inferior botao-voz${microfoneOuvindo ? ' ouvindo' : ''}`}
          onClick={aoClicarMicrofone}
          aria-label={microfoneSuportado ? 'Falar um comando de voz' : 'Comando de voz indisponível neste navegador'}
          aria-pressed={microfoneOuvindo}
        >
          <span className="icone-botao" aria-hidden="true"><Icone nome={microfoneOuvindo ? 'microfone-ativo' : 'microfone'} /></span>
          <span className="rotulo-botao">{microfoneOuvindo ? 'Ouvindo...' : 'Comando'}</span>
        </button>
        <button className="botao-inferior" onClick={aoClicarVoz} aria-label="Narrar situação atual">
          <span className="icone-botao" aria-hidden="true">🔊</span>
          <span className="rotulo-botao">Narrar</span>
        </button>
        <button className="botao-inferior" onClick={aoClicarPontosProximos} aria-label="Pontos próximos">
          <span className="icone-botao" aria-hidden="true">📍</span>
          <span className="rotulo-botao">Pontos próximos</span>
        </button>
        <button
          className="botao-inferior"
          onClick={aoClicarConfiguracoes}
          aria-label="Configurações"
        >
          <span className="icone-botao" aria-hidden="true">⚙</span>
          <span className="rotulo-botao">Config</span>
        </button>
        <button className="botao-inferior" onClick={aoClicarSobre} aria-label="Sobre">
          <span className="icone-botao" aria-hidden="true">ℹ</span>
          <span className="rotulo-botao">Sobre</span>
        </button>
      </div>
    </div>
  );
}
