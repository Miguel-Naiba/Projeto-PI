import { useEffect, useRef } from 'react';
import './Sobre.css';

interface PropsSobre {
  aberto: boolean;
  aoFechar: () => void;
}

const FONTES_DADOS = [
  { rotulo: 'Paradas de ônibus', fonte: 'GTFS oficial da EPTC' },
  { rotulo: 'Acidentes de trânsito', fonte: 'Dataset oficial da EPTC' },
  { rotulo: 'Piso tátil e botoeiras sonoras', fonte: 'Planilhas oficiais da EPTC' },
  { rotulo: 'Obras em execução', fonte: 'Planilha oficial da SMOI' },
  { rotulo: 'Dados complementares', fonte: 'OpenStreetMap (colaborativo)' },
  { rotulo: 'Cálculo de rotas', fonte: 'OpenRouteService' },
];

export function Sobre({ aberto, aoFechar }: PropsSobre) {
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
    <div className="sobre-sobreposicao" role="presentation" onClick={aoFechar}>
      <div
        className="sobre-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sobre-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sobre-modal__cabecalho">
          <h2 id="sobre-titulo" tabIndex={-1} ref={refTitulo}>
            <span aria-hidden="true">🧭</span> Sobre o EchoPath
          </h2>
          <button className="botao-fechar" onClick={aoFechar} aria-label="Fechar sobre">✕</button>
        </div>

        <div className="sobre-modal__conteudo">
          <p className="sobre-missao">
            O EchoPath existe para ajudar pessoas com dificuldades de visão a se
            locomoverem por Porto Alegre com mais segurança e autonomia. O app
            cruza dados de piso tátil, botoeiras sonoras e obras em execução com
            narração e comandos de voz, avisando o que existe no caminho antes
            de a pessoa chegar lá — e não apenas indicando o trajeto mais curto,
            mas o mais acessível.
          </p>

          <h3 className="sobre-subtitulo">Fontes de dados</h3>
          <ul className="sobre-lista-fontes">
            {FONTES_DADOS.map((item) => (
              <li key={item.rotulo}>
                <span className="sobre-lista-fontes__rotulo">{item.rotulo}</span>
                <span className="sobre-lista-fontes__fonte">{item.fonte}</span>
              </li>
            ))}
          </ul>
          <p className="sobre-observacao">
            Onde os dados oficiais da Prefeitura não cobrem tudo, o app
            complementa com dados colaborativos do OpenStreetMap.
          </p>

          <div className="sobre-creditos">
            <p>
              Desenvolvido por <strong>Miguel</strong> e <strong>Gabriel</strong>,
              alunos do Senac Distrito Criativo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
