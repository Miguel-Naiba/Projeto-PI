import './Cabecalho.css';

interface PropsCabecalho {
  valorBusca: string;
  aoMudarBusca: (v: string) => void;
  aoSubmeterBusca: (v: string) => void;
  aoClicarMicrofone: () => void;
  microfoneOuvindo: boolean;
  microfoneSuportado: boolean;
  aoClicarPerfil: () => void;
  logado: boolean;
  cidade?: string;
}

export function Cabecalho({
  valorBusca,
  aoMudarBusca,
  aoSubmeterBusca,
  aoClicarMicrofone,
  microfoneOuvindo,
  microfoneSuportado,
  aoClicarPerfil,
  logado,
  cidade = 'Porto Alegre',
}: PropsCabecalho) {
  return (
    <header className="cabecalho" role="banner">
      <div className="cabecalho__marca">
        <span className="cabecalho__logo" aria-hidden="true">🧭</span>
        <span className="cabecalho__titulo">EchoPath</span>
      </div>

      <div className="cabecalho__busca">
        <label htmlFor="campo-busca" className="apenas-leitor-tela">Buscar destino</label>
        <span className="icone-busca" aria-hidden="true">🔍</span>
        <input
          id="campo-busca"
          type="search"
          className="campo-busca campo-busca--com-microfone"
          placeholder={microfoneOuvindo ? 'Ouvindo...' : `Buscar destino em ${cidade}...`}
          value={valorBusca}
          onChange={(e) => aoMudarBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aoSubmeterBusca(valorBusca)}
          aria-label={`Buscar destino em ${cidade}`}
          autoComplete="off"
        />
        <button
          type="button"
          className={`botao-microfone-busca${microfoneOuvindo ? ' ouvindo' : ''}`}
          onClick={aoClicarMicrofone}
          aria-label={
            microfoneSuportado
              ? microfoneOuvindo
                ? 'Ouvindo... fale o destino, ou "traçar rota até" seguido do endereço'
                : 'Buscar ou traçar rota por voz'
              : 'Busca por voz indisponível neste navegador'
          }
          aria-pressed={microfoneOuvindo}
          disabled={!microfoneSuportado}
        >
          <span aria-hidden="true">{microfoneOuvindo ? '🎙️' : '🎤'}</span>
        </button>
      </div>

      <div className="cabecalho__usuario">
        <button className="botao-cabecalho" aria-label="Câmera / Modo AR">📷</button>
        <button
          className={`botao-cabecalho${logado ? ' logado' : ''}`}
          onClick={aoClicarPerfil}
          aria-label={logado ? 'Minha conta' : 'Entrar ou criar conta'}
        >
          👤
        </button>
      </div>
    </header>
  );
}
