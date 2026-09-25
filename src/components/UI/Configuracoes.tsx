import { useEffect, useRef } from 'react';
import type { Tema, Contraste, TamanhoTexto } from '../../hooks';
import type { VozNarracao } from '../../hooks/useNarracaoVoz';
import './Configuracoes.css';

const IDIOMAS = [
  { valor: 'pt-BR', rotulo: 'Português (Brasil)' },
  { valor: 'en-US', rotulo: 'English (US)' },
  { valor: 'es-ES', rotulo: 'Español' },
];

const VELOCIDADES = [
  { valor: 0.85, rotulo: 'Lenta' },
  { valor: 1.15, rotulo: 'Normal' },
  { valor: 1.6, rotulo: 'Rápida' },
];

interface PropsConfiguracoes {
  aberto: boolean;
  aoFechar: () => void;
  vozAtivada: boolean;
  aoAlternarVoz: () => void;
  tema: Tema;
  aoDefinirTema: (t: Tema) => void;
  contraste: Contraste;
  aoAlternarContraste: () => void;
  tamanhoTexto: TamanhoTexto;
  aoDefinirTamanhoTexto: (t: TamanhoTexto) => void;
  idiomaVoz: string;
  aoDefinirIdiomaVoz: (v: string) => void;
  velocidadeVoz: number;
  aoDefinirVelocidadeVoz: (v: number) => void;
  vozUri: string | null;
  aoDefinirVozUri: (v: string | null) => void;
  vozesDisponiveis: VozNarracao[];
  aoTestarVoz: () => void;
}

export function Configuracoes({
  aberto,
  aoFechar,
  vozAtivada,
  aoAlternarVoz,
  tema,
  aoDefinirTema,
  contraste,
  aoAlternarContraste,
  tamanhoTexto,
  aoDefinirTamanhoTexto,
  idiomaVoz,
  aoDefinirIdiomaVoz,
  velocidadeVoz,
  aoDefinirVelocidadeVoz,
  vozUri,
  aoDefinirVozUri,
  vozesDisponiveis,
  aoTestarVoz,
}: PropsConfiguracoes) {
  const refTitulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (aberto) refTitulo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const lidarComTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', lidarComTecla);
    return () => window.removeEventListener('keydown', lidarComTecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="config-sobreposicao" role="presentation" onClick={aoFechar}>
      <div
        className="config-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="config-modal__cabecalho">
          <h2 id="config-titulo" tabIndex={-1} ref={refTitulo}>
            <span aria-hidden="true">⚙</span> Configurações
          </h2>
          <button className="botao-fechar" onClick={aoFechar} aria-label="Fechar configurações">✕</button>
        </div>

        <div className="config-modal__conteudo">
          <section className="config-secao">
            <div className="config-linha">
              <div className="config-linha__texto">
                <span className="config-linha__rotulo">Narração por voz</span>
                <span className="config-linha__descricao">Fala alertas de proximidade e status da rota em voz alta.</span>
              </div>
              <button
                type="button"
                className={`config-switch${vozAtivada ? ' ligado' : ''}`}
                role="switch"
                aria-checked={vozAtivada}
                aria-label={vozAtivada ? 'Narração por voz ativada. Toque para desativar.' : 'Narração por voz desativada. Toque para ativar.'}
                onClick={aoAlternarVoz}
              >
                <span className="config-switch__cursor" />
              </button>
            </div>
          </section>

          <section className="config-secao">
            <h3 className="config-subtitulo">Idioma da narração</h3>
            <select
              className="config-select"
              value={idiomaVoz}
              onChange={(e) => aoDefinirIdiomaVoz(e.target.value)}
              aria-label="Idioma da narração"
            >
              {IDIOMAS.map((op) => (
                <option key={op.valor} value={op.valor}>{op.rotulo}</option>
              ))}
            </select>
          </section>

          <section className="config-secao">
            <h3 className="config-subtitulo">Velocidade da fala</h3>
            <div className="config-segmentado" role="radiogroup" aria-label="Velocidade da narração">
              {VELOCIDADES.map((op) => (
                <button
                  key={op.rotulo}
                  type="button"
                  className={velocidadeVoz === op.valor ? 'ativo' : ''}
                  role="radio"
                  aria-checked={velocidadeVoz === op.valor}
                  onClick={() => aoDefinirVelocidadeVoz(op.valor)}
                >
                  {op.rotulo}
                </button>
              ))}
            </div>
          </section>

          <section className="config-secao">
            <h3 className="config-subtitulo">Voz</h3>
            {vozesDisponiveis.length === 0 ? (
              <p className="config-linha__descricao">
                Nenhuma voz adicional encontrada neste navegador — será usada a voz padrão do sistema para o idioma
                escolhido.
              </p>
            ) : (
              <select
                className="config-select"
                value={vozUri ?? ''}
                onChange={(e) => aoDefinirVozUri(e.target.value || null)}
                aria-label="Voz da narração"
              >
                <option value="">Padrão do sistema</option>
                {vozesDisponiveis
                  .filter((v) => v.idioma.toLowerCase().startsWith(idiomaVoz.slice(0, 2).toLowerCase()))
                  .map((v) => (
                    <option key={v.uri} value={v.uri}>{v.nome}</option>
                  ))}
              </select>
            )}
            <p className="config-linha__descricao config-nota-voz">
              As vozes disponíveis (incluindo opções de voz masculina e feminina) dependem do que está instalado no
              seu navegador e sistema operacional.
            </p>
            <button type="button" className="config-botao-testar" onClick={aoTestarVoz} disabled={!vozAtivada}>
              🔊 Testar voz
            </button>
          </section>

          <section className="config-secao">
            <h3 className="config-subtitulo">Tema</h3>
            <div className="config-segmentado" role="radiogroup" aria-label="Tema do aplicativo">
              <button
                type="button"
                className={tema === 'escuro' ? 'ativo' : ''}
                role="radio"
                aria-checked={tema === 'escuro'}
                onClick={() => aoDefinirTema('escuro')}
              >
                🌙 Escuro
              </button>
              <button
                type="button"
                className={tema === 'claro' ? 'ativo' : ''}
                role="radio"
                aria-checked={tema === 'claro'}
                onClick={() => aoDefinirTema('claro')}
              >
                ☀️ Claro
              </button>
            </div>
          </section>

          <section className="config-secao">
            <div className="config-linha">
              <div className="config-linha__texto">
                <span className="config-linha__rotulo">Alto contraste</span>
                <span className="config-linha__descricao">Bordas mais fortes e menos transparência, pra facilitar a leitura.</span>
              </div>
              <button
                type="button"
                className={`config-switch${contraste === 'alto' ? ' ligado' : ''}`}
                role="switch"
                aria-checked={contraste === 'alto'}
                aria-label={contraste === 'alto' ? 'Alto contraste ativado. Toque para desativar.' : 'Alto contraste desativado. Toque para ativar.'}
                onClick={aoAlternarContraste}
              >
                <span className="config-switch__cursor" />
              </button>
            </div>
          </section>

          <section className="config-secao config-secao--ultima">
            <h3 className="config-subtitulo">Tamanho do texto</h3>
            <div className="config-segmentado config-segmentado--3" role="radiogroup" aria-label="Tamanho do texto">
              <button
                type="button"
                className={tamanhoTexto === 'pequeno' ? 'ativo' : ''}
                role="radio"
                aria-checked={tamanhoTexto === 'pequeno'}
                onClick={() => aoDefinirTamanhoTexto('pequeno')}
              >
                A
              </button>
              <button
                type="button"
                className={tamanhoTexto === 'medio' ? 'ativo' : ''}
                role="radio"
                aria-checked={tamanhoTexto === 'medio'}
                onClick={() => aoDefinirTamanhoTexto('medio')}
              >
                A
              </button>
              <button
                type="button"
                className={tamanhoTexto === 'grande' ? 'ativo' : ''}
                role="radio"
                aria-checked={tamanhoTexto === 'grande'}
                onClick={() => aoDefinirTamanhoTexto('grande')}
              >
                A
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
