import './TelaCarregamento.css';
import { HomemCaminhando } from './HomemCaminhando';

interface Props { progresso: number; saindo?: boolean; erro?: boolean }

export function TelaCarregamento({ progresso, saindo = false, erro = false }: Props) {
  return (
    <div className={`ep-loading${saindo ? ' ep-loading--saindo' : ''}`}>
      <div className="ep-loading__conteudo">
        <div className="ep-loading__cena" aria-hidden="true">
          <svg className="ep-loading__pista" viewBox="0 0 400 150">
            <defs><linearGradient id="ep-azul"><stop stopColor="#43e0ff" /><stop offset="1" stopColor="#16a8f4" /></linearGradient></defs>
            <ellipse cx="200" cy="75" rx="176" ry="53" fill="none" stroke="#153e80" strokeWidth="13" />
            <ellipse className="ep-loading__anel" cx="200" cy="75" rx="176" ry="53" pathLength="100" fill="none" stroke="url(#ep-azul)" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${progresso} ${100 - progresso}`} />
          </svg>
          <HomemCaminhando />
        </div>
        <div className="ep-loading__percentual" role="progressbar" aria-label="Inicialização do EchoPath" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso}>{progresso}%</div>
        <p role="status">{erro ? 'Não foi possível abrir o EchoPath.' : 'Carregando o EchoPath...'}</p>
        {erro && <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button>}
      </div>
    </div>
  );
}
