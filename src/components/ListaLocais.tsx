import { useEffect, useRef } from 'react';
import type { SinalSonoro, ParadaOnibus, Obra, PontoProximidade, LocalizacaoUsuario } from '../types';
import { distanciaM, formatarDistancia } from '../utils/geografia';
import { chaveDoLocal } from '../hooks/useLocaisSalvos';
import './ListaLocais.css';

interface PropsListaLocais {
  paradasComTatil: ParadaOnibus[];
  sinaisSonoros: SinalSonoro[];
  obras: Obra[];
  posicaoUsuario: LocalizacaoUsuario | null;
  visivel: boolean;
  aoFechar: () => void;
  aoSelecionarDestino: (ponto: PontoProximidade) => void;
  favoritos: PontoProximidade[];
  ehFavorito: (ponto: Pick<PontoProximidade, 'lat' | 'lon'>) => boolean;
  aoAlternarFavorito: (ponto: PontoProximidade) => void;
}

function BotaoFavorito({
  ponto,
  ehFavorito,
  aoAlternarFavorito,
}: {
  ponto: PontoProximidade;
  ehFavorito: boolean;
  aoAlternarFavorito: (ponto: PontoProximidade) => void;
}) {
  return (
    <button
      type="button"
      className="botao-favorito"
      onClick={(e) => {
        e.stopPropagation();
        aoAlternarFavorito(ponto);
      }}
      aria-pressed={ehFavorito}
      aria-label={ehFavorito ? `Remover ${ponto.nome} dos favoritos` : `Salvar ${ponto.nome} nos favoritos`}
    >
      {ehFavorito ? '★' : '☆'}
    </button>
  );
}

function ordenarPorDistancia<T extends { lat: number; lon: number }>(itens: T[], posicaoUsuario: LocalizacaoUsuario | null): T[] {
  if (!posicaoUsuario) return itens;
  return [...itens].sort(
    (a, b) =>
      distanciaM(posicaoUsuario.lat, posicaoUsuario.lon, a.lat, a.lon) -
      distanciaM(posicaoUsuario.lat, posicaoUsuario.lon, b.lat, b.lon)
  );
}

export function ListaLocais({
  paradasComTatil,
  sinaisSonoros,
  obras,
  posicaoUsuario,
  visivel,
  aoFechar,
  aoSelecionarDestino,
  favoritos,
  ehFavorito,
  aoAlternarFavorito,
}: PropsListaLocais) {
  const refTitulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (visivel) refTitulo.current?.focus();
  }, [visivel]);

  if (!visivel) return null;

  const paradasComoPontos = paradasComTatil.map((p) => ({ ...p, lat: p.latParada, lon: p.lonParada }));
  const paradasOrdenadas = ordenarPorDistancia(paradasComoPontos, posicaoUsuario).slice(0, 10);
  const sinaisOrdenados = ordenarPorDistancia(sinaisSonoros, posicaoUsuario).slice(0, 10);
  const obrasOrdenadas = ordenarPorDistancia(obras, posicaoUsuario).slice(0, 10);

  const rotuloDistancia = (lat: number, lon: number) =>
    posicaoUsuario ? formatarDistancia(distanciaM(posicaoUsuario.lat, posicaoUsuario.lon, lat, lon)) : null;

  return (
    <aside className="lista-locais" role="complementary" aria-label="Lista de pontos próximos">
      <div className="lista-locais__cabecalho">
        <h2 tabIndex={-1} ref={refTitulo}>Pontos próximos</h2>
        <button className="botao-fechar" onClick={aoFechar} aria-label="Fechar lista">✕</button>
      </div>

      {favoritos.length > 0 && (
        <section>
          <h3 className="titulo-secao">⭐ Favoritos</h3>
          <ul className="lista-locais-itens">
            {ordenarPorDistancia(favoritos, posicaoUsuario).map((fav) => (
              <li key={chaveDoLocal(fav)} className="item-local-linha">
                <button
                  type="button"
                  className={`item-local favorito-tipo-${fav.tipo}`}
                  onClick={() => aoSelecionarDestino(fav)}
                >
                  <span className="item-icone" aria-hidden="true">
                    {fav.tipo === 'parada_tatil' ? '🟢' : fav.tipo === 'botoeira' ? '🔊' : fav.tipo === 'obra' ? '🚧' : '📍'}
                  </span>
                  <span className="item-info">
                    <span className="item-nome">{fav.nome}</span>
                    {rotuloDistancia(fav.lat, fav.lon) && <span className="item-dist">a {rotuloDistancia(fav.lat, fav.lon)}</span>}
                  </span>
                </button>
                <BotaoFavorito ponto={fav} ehFavorito aoAlternarFavorito={aoAlternarFavorito} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {obrasOrdenadas.length > 0 && (
        <section>
          <h3 className="titulo-secao alerta">🚧 Obras em execução</h3>
          <ul className="lista-locais-itens">
            {obrasOrdenadas.map((o) => (
              <li key={o.id}>
                <div className="item-local obra gravidade-media">
                  <span className="item-icone" aria-hidden="true">🚧</span>
                  <div className="item-info">
                    <span className="item-nome">{o.nome ?? `Obra na via (${o.tipo})`}</span>
                    {rotuloDistancia(o.lat, o.lon) && <span className="item-dist">a {rotuloDistancia(o.lat, o.lon)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="titulo-secao">🔊 Botoeiras sonoras</h3>
        <ul className="lista-locais-itens">
          {sinaisOrdenados.length === 0 && (
            <li><span className="item-desc">Nenhuma encontrada nesta área.</span></li>
          )}
          {sinaisOrdenados.map((sinal) => {
            const ponto: PontoProximidade = { id: sinal.id, tipo: 'botoeira', nome: sinal.nome ?? 'Botoeira sonora', lat: sinal.lat, lon: sinal.lon };
            return (
              <li key={sinal.id} className="item-local-linha">
                <button type="button" className="item-local sinal" onClick={() => aoSelecionarDestino(ponto)}>
                  <span className="item-icone" aria-hidden="true">🔊</span>
                  <span className="item-info">
                    <span className="item-nome">{ponto.nome}</span>
                    {rotuloDistancia(sinal.lat, sinal.lon) && <span className="item-dist">a {rotuloDistancia(sinal.lat, sinal.lon)}</span>}
                  </span>
                </button>
                <BotaoFavorito ponto={ponto} ehFavorito={ehFavorito(ponto)} aoAlternarFavorito={aoAlternarFavorito} />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="titulo-secao">🟢 Paradas com piso tátil</h3>
        <ul className="lista-locais-itens">
          {paradasOrdenadas.length === 0 && (
            <li><span className="item-desc">Nenhuma parada com piso tátil confirmada nesta área.</span></li>
          )}
          {paradasOrdenadas.map((parada) => {
            const ponto: PontoProximidade = { id: parada.idParada, tipo: 'parada_tatil', nome: parada.nomeParada, lat: parada.latParada, lon: parada.lonParada };
            return (
              <li key={parada.idParada} className="item-local-linha">
                <button type="button" className="item-local parada" onClick={() => aoSelecionarDestino(ponto)}>
                  <span className="item-icone" aria-hidden="true">🟢</span>
                  <span className="item-info">
                    <span className="item-nome">{parada.nomeParada}</span>
                    {rotuloDistancia(parada.lat, parada.lon) && <span className="item-dist">a {rotuloDistancia(parada.lat, parada.lon)}</span>}
                  </span>
                </button>
                <BotaoFavorito ponto={ponto} ehFavorito={ehFavorito(ponto)} aoAlternarFavorito={aoAlternarFavorito} />
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
