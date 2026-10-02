import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cabecalho } from './components/UI/Cabecalho';
import { BarraInferior } from './components/UI/BarraInferior';
import { Sobre } from './components/UI/Sobre';
import { Configuracoes } from './components/UI/Configuracoes';
import { Autenticacao } from './components/UI/Autenticacao';
import { Reportar } from './components/UI/Reportar';
import { construirCatalogoOficial } from './services/catalogoReportar';
import type { PontoPreenchido } from './components/UI/Reportar';
import { VisualizadorMapa } from './components/Mapa/VisualizadorMapa';
import { ListaLocais } from './components/ListaLocais';
import {
  useParadasOnibus,
  useBotoeirasSonoras,
  useObrasSmoi,
  useAcidentes,
  useOnibusAoVivo,
  useLocalizacaoUsuario,
  useDadosAcessibilidade,
  useAlertasProximidade,
  useNarracaoVoz,
  usePreferenciasVisuais,
  useAutenticacao,
} from './hooks';
import { useComandosVoz } from './hooks/useComandosVoz';
import type { ComandoVoz } from './hooks/useComandosVoz';
import { useRotaAcessivel } from './hooks/useRotaAcessivel';
import { useReportes } from './hooks/useReportes';
import type { DadosEnvioReporte } from './hooks/useReportes';
import { distanciaM, formatarDistancia } from './utils/geografia';
import { analisarSegurancaRota, narrarSegurancaRota } from './utils/segurancaRota';
import type { EstadoCamadas, TipoCamada, EventoProximidade, PontoProximidade, TipoReporte } from './types';
import './Aplicativo.css';

const CAMADAS_PADRAO: EstadoCamadas = {
  paradas: true,
  botoneiras: true,
  obras: true,
  acidentes: false,
  onibus: false,
};

const ROTULOS_PONTO: Record<PontoProximidade['tipo'], string> = {
  parada_tatil: 'parada com piso tátil',
  botoeira: 'botoeira sonora para travessia',
  obra: 'obra em execução na via',
  acidente: 'ponto de acidente registrado',
  destino: 'seu destino',
};

const RAIO_RESUMO_PROXIMO_M = 300;

export default function Aplicativo() {
  const [camadas, setCamadas] = useState<EstadoCamadas>(CAMADAS_PADRAO);
  const [busca, setBusca] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);
  const [mostrarSobre, setMostrarSobre] = useState(false);
  const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
  const [mostrarAutenticacao, setMostrarAutenticacao] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<PontoProximidade[]>([]);
  const refUltimaFala = useRef<string>('');
  const refTituloBusca = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (resultadosBusca.length > 0) refTituloBusca.current?.focus();
  }, [resultadosBusca]);

  const { posicao, latLon, precisaoM, precisaoBaixa, erro: erroGeo, obtendo } = useLocalizacaoUsuario();

  const { dados: acessibilidade, status: statusAcessibilidade } = useDadosAcessibilidade(latLon);
  const { paradasComTatil, todasParadasComTatil } = useParadasOnibus(camadas.paradas, acessibilidade, latLon);
  const sinaisSonorosOsm = useMemo(() => acessibilidade?.sinaisSonoros ?? [], [acessibilidade]);
  const { sinais: sinaisSonoros, todosSinais } = useBotoeirasSonoras(camadas.botoneiras, sinaisSonorosOsm);
  const obrasOsm = useMemo(() => acessibilidade?.obras ?? [], [acessibilidade]);
  const { obras, todasObras } = useObrasSmoi(camadas.obras, obrasOsm);

  // Contexto usado pelo avaliador de rota — sempre com os dados completos
  // (obras/botoeiras/piso tátil), independente de quais camadas a pessoa
  // deixou visíveis no mapa. Visibilidade é preferência visual; segurança da
  // rota não pode depender disso.
  const contextoAcessibilidade = useMemo(
    () => ({
      obras: todasObras,
      botoeiras: todosSinais,
      pisoTatil: todasParadasComTatil.map((p) => ({ lat: p.latParada, lon: p.lonParada })),
    }),
    [todasObras, todosSinais, todasParadasComTatil]
  );

  // Disponibilidade dinâmica das categorias do Reportar (PROMPT MESTRE,
  // seção 17/95): reaproveita os mesmos dados já carregados pro mapa/rota —
  // não busca os datasets de novo. `todasObras`/`todosSinais` já incluem
  // TODOS os pontos com coordenada válida das fontes oficiais (EPTC/SMOI),
  // não importa a estratégia de geocodificação (cruzamento,
  // referencia-isolada, via-principal-apenas) — ver botoeirasEptc.ts e
  // obrasSmoi.ts (filtrarValidas só olha coordenada, nunca `precisao`).
  const categoriasReportarDisponiveis = useMemo(
    () => ({ obra: todasObras.length > 0, botoeira: todosSinais.length > 0, parada_tatil: todasParadasComTatil.length > 0 }),
    [todasObras, todosSinais, todasParadasComTatil]
  );

  // Catálogo oficial do fluxo de Reportar (Fase 3) — sempre a partir dos
  // datasets completos (não filtrados por camada visível no mapa), só
  // pontos EPTC/SMOI geocodificados.
  const catalogoReportarOficial = useMemo(
    () => construirCatalogoOficial(todasParadasComTatil, todosSinais, todasObras),
    [todasParadasComTatil, todosSinais, todasObras]
  );

  // paradasComTatil tem as 713 paradas confirmadas da CIDADE INTEIRA (útil pra
  // busca por nome). Desenhar 713 marcadores no mapa de uma vez é o que
  // estava deixando o app pesado — pro mapa e os alertas de proximidade,
  // só interessam as paradas realmente perto de onde a pessoa está agora.
  const RAIO_RENDERIZACAO_TATIL_M = 3000;
  const paradasComTatilProximas = useMemo(() => {
    if (!latLon) return paradasComTatil;
    return paradasComTatil.filter(
      (p) => distanciaM(latLon[0], latLon[1], p.latParada, p.lonParada) <= RAIO_RENDERIZACAO_TATIL_M
    );
  }, [paradasComTatil, latLon]);

  const { acidentes } = useAcidentes(camadas.acidentes);
  const { onibus } = useOnibusAoVivo(camadas.onibus);

  const {
    falar,
    parar: pararNarracao,
    suportado: vozSuportada,
    ativado: vozAtivada,
    definirAtivado: definirVozAtivada,
    idioma: idiomaVoz,
    definirIdioma: definirIdiomaVoz,
    velocidade: velocidadeVoz,
    definirVelocidade: definirVelocidadeVoz,
    vozUri,
    definirVozUri,
    vozesDisponiveis,
  } = useNarracaoVoz();

  const {
    tema,
    definirTema,
    contraste,
    alternarContraste,
    tamanhoTexto,
    definirTamanhoTexto,
  } = usePreferenciasVisuais();

  const { usuario, suportado: authSuportado, entrar, cadastrar, sair, atualizarPerfil } = useAutenticacao();
  const { reportes, suportado: reportesSuportado, enviarReporte } = useReportes();
  const [mostrarReportar, setMostrarReportar] = useState(false);
  const [categoriaReporteInicial, setCategoriaReporteInicial] = useState<TipoReporte | null>(null);
  const [pontoPreenchido, setPontoPreenchido] = useState<PontoPreenchido | null>(null);

  const [ultimaMsgAlerta, setUltimaMsgAlerta] = useState('');
  const [ultimaMsgInfo, setUltimaMsgInfo] = useState('');

  const anunciar = useCallback(
    (texto: string, prioridade: 'alerta' | 'info' = 'info') => {
      refUltimaFala.current = texto;
      if (prioridade === 'alerta') setUltimaMsgAlerta((prev) => (prev === texto ? texto + '\u200B' : texto));
      else setUltimaMsgInfo((prev) => (prev === texto ? texto + '\u200B' : texto));
      falar(texto, prioridade);
    },
    [falar]
  );

  const { rota, status: statusRota, erro: erroRota, solicitarRota, limparRota } = useRotaAcessivel();

  const lidarComEnviarReporte = useCallback(
    async (dados: DadosEnvioReporte) => {
      if (!usuario) return { sucesso: false, mensagem: 'Não foi possível identificar sua conta.' };
      const nome = (usuario.user_metadata?.nome as string | undefined) || usuario.email || 'Alguém';
      const resultado = await enviarReporte(dados, { id: usuario.id, nome });
      if (resultado.sucesso) anunciar(resultado.mensagem, 'info');
      return resultado;
    },
    [usuario, enviarReporte, anunciar]
  );

  // Seção 74 do prompt: se a pessoa reporta durante uma rota ativa, registra
  // a distância real até a rota — nunca inferido, só quando dá pra calcular
  // de verdade (rota existe e tem coordenadas).
  const distanciaDaRotaAtivaM = useCallback(
    (lat: number, lon: number): number | null => {
      if (!rota || rota.coordenadas.length === 0) return null;
      let menor = Infinity;
      for (const [rLat, rLon] of rota.coordenadas) {
        const d = distanciaM(lat, lon, rLat, rLon);
        if (d < menor) menor = d;
      }
      return Number.isFinite(menor) ? Math.round(menor) : null;
    },
    [rota]
  );

  const lidarComReportarPonto = useCallback(
    (dados: { tipo: 'obra' | 'botoeira' | 'parada_tatil'; pontoId: string; pontoNome: string; pontoFonte: string; lat: number; lon: number }) => {
      setPontoPreenchido(dados);
      setMostrarReportar(true);
    },
    []
  );

  // Assim que uma rota nova chega, narra o que o avaliador decidiu — se
  // desviou de obras, e o quanto do trajeto passa perto de botoeiras/piso
  // tátil confirmados. Isso é o que diferencia "aqui está uma rota, boa
  // sorte" de "essa rota foi escolhida evitando 1 obra".
  useEffect(() => {
    if (!rota) return;
    const { obrasProximas, coberturaBotoeira, coberturaPisoTatil, pontuacao } = rota.avaliacao;
    const partes: string[] = [];
    if (obrasProximas === 0) {
      partes.push('sem obras conhecidas no caminho');
    } else {
      partes.push(`${obrasProximas} ${obrasProximas === 1 ? 'obra' : 'obras'} conhecida perto do trajeto — reforce a atenção`);
    }
    if (coberturaBotoeira > 0) partes.push(`botoeira sonora confirmada em ${Math.round(coberturaBotoeira * 100)}% do trajeto`);
    if (coberturaPisoTatil > 0) partes.push(`piso tátil confirmado em ${Math.round(coberturaPisoTatil * 100)}% do trajeto`);

    const texto = `Rota calculada, ${partes.join(', ')}. Pontuação de acessibilidade: ${pontuacao} de 100.`;
    const id = setTimeout(() => anunciar(texto, 'info'), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota]);

  // Assim que uma rota nova chega, cruza cada ponto de instrução com botoeiras
  // sonoras e paradas com piso tátil confirmadas, e narra o resultado — não é
  // garantia de segurança, é aviso pra reforçar atenção onde falta confirmação.
  useEffect(() => {
    if (!rota) return;
    const paradasComoPontos = paradasComTatil.map((p) => ({ lat: p.latParada, lon: p.lonParada }));
    const analise = analisarSegurancaRota(rota.etapas, sinaisSonoros, paradasComoPontos);
    const texto = narrarSegurancaRota(analise);
    if (!texto) return;
    const id = setTimeout(() => anunciar(texto, 'info'), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota]);

  const selecionarDestino = useCallback(
    (ponto: PontoProximidade) => {
      setMostrarLista(false);
      setResultadosBusca([]);
      if (!latLon) {
        anunciar('Não é possível traçar a rota sem sua localização atual.', 'info');
        return;
      }
      anunciar(`Traçando rota acessível até ${ponto.nome}.`, 'info');
      solicitarRota(latLon, ponto, contextoAcessibilidade);
    },
    [latLon, solicitarRota, anunciar, contextoAcessibilidade]
  );

  // Comando de voz "traçar rota até X" / "rota para X" / endereço falado
  // direto: geocodifica o endereço dito e já traça a rota, sem precisar abrir
  // a lista de resultados e escolher manualmente — é o equivalente por voz
  // do fluxo de busca + clique no destino.
  const lidarComTracarRotaPorVoz = useCallback(
    async (enderecoFalado: string) => {
      const q = enderecoFalado.trim().toLowerCase();
      if (!q) return;

      anunciar(`Buscando: ${enderecoFalado}...`, 'info');

      const correspondenciaLocal = paradasComTatil.find((p) => p.nomeParada.toLowerCase().includes(q));
      if (correspondenciaLocal) {
        selecionarDestino({
          id: correspondenciaLocal.idParada,
          tipo: 'parada_tatil',
          nome: correspondenciaLocal.nomeParada,
          lat: correspondenciaLocal.latParada,
          lon: correspondenciaLocal.lonParada,
        });
        return;
      }

      try {
        const { geocodificarEndereco } = await import('./services/geocodificacao');
        const geo = await geocodificarEndereco(enderecoFalado);
        if (geo.length === 0) {
          anunciar(`Não encontrei o endereço "${enderecoFalado}". Tente falar com bairro e número.`, 'info');
          return;
        }
        const melhorResultado = geo[0];
        selecionarDestino({
          id: 'geo-voz-0',
          tipo: 'destino',
          nome: melhorResultado.rotulo,
          lat: melhorResultado.lat,
          lon: melhorResultado.lon,
        });
      } catch {
        anunciar('Não foi possível buscar esse endereço agora. Tente novamente.', 'info');
      }
    },
    [paradasComTatil, selecionarDestino, anunciar]
  );

  const lidarComBusca = useCallback(
    async (consulta: string) => {
      const q = consulta.trim().toLowerCase();
      if (!q) return;

      const correspondenciasLocais: PontoProximidade[] = [
        ...paradasComTatil
          .filter((p) => p.nomeParada.toLowerCase().includes(q))
          .map((p) => ({ id: p.idParada, tipo: 'parada_tatil' as const, nome: p.nomeParada, lat: p.latParada, lon: p.lonParada })),
        ...sinaisSonoros
          .filter((s) => s.nome?.toLowerCase().includes(q))
          .map((s) => ({ id: s.id, tipo: 'botoeira' as const, nome: s.nome ?? 'Botoeira sonora', lat: s.lat, lon: s.lon })),
      ];

      if (correspondenciasLocais.length > 0) {
        setResultadosBusca(correspondenciasLocais);
        anunciar(`${correspondenciasLocais.length} resultado${correspondenciasLocais.length > 1 ? 's' : ''} encontrado${correspondenciasLocais.length > 1 ? 's' : ''} nos dados do app.`);
        return;
      }

      try {
        const { geocodificarEndereco } = await import('./services/geocodificacao');
        const geo = await geocodificarEndereco(consulta);
        const resultados: PontoProximidade[] = geo.map((g, i) => ({ id: `geo-${i}`, tipo: 'destino' as const, nome: g.rotulo, lat: g.lat, lon: g.lon }));
        setResultadosBusca(resultados);
        anunciar(
          resultados.length > 0
            ? `${resultados.length} endereço${resultados.length > 1 ? 's' : ''} encontrado${resultados.length > 1 ? 's' : ''}.`
            : 'Nenhum endereço encontrado para essa busca.'
        );
      } catch {
        anunciar('Não foi possível buscar esse endereço agora. Tente novamente.', 'info');
      }
    },
    [paradasComTatil, sinaisSonoros, anunciar]
  );

  const pontosProximidade = useMemo<PontoProximidade[]>(() => {
    const pontos: PontoProximidade[] = [];
    if (camadas.paradas) {
      paradasComTatilProximas.forEach((p) => pontos.push({ id: `parada-${p.idParada}`, tipo: 'parada_tatil', nome: p.nomeParada, lat: p.latParada, lon: p.lonParada }));
    }
    if (camadas.botoneiras) {
      sinaisSonoros.forEach((s) => pontos.push({ id: `bot-${s.id}`, tipo: 'botoeira', nome: s.nome ?? 'Botoeira sonora', lat: s.lat, lon: s.lon }));
    }
    if (camadas.obras) {
      obras.forEach((o) => pontos.push({ id: `obra-${o.id}`, tipo: 'obra', nome: o.nome ?? 'Obra em execução', lat: o.lat, lon: o.lon }));
    }
    if (rota) {
      pontos.push({ id: 'destino-atual', tipo: 'destino', nome: rota.destino.nome, lat: rota.destino.lat, lon: rota.destino.lon });
    }
    return pontos;
  }, [camadas, paradasComTatilProximas, sinaisSonoros, obras, rota]);

  const lidarComAlertaProximidade = useCallback(
    (evento: EventoProximidade) => {
      const rotulo = ROTULOS_PONTO[evento.ponto.tipo];
      const dist = formatarDistancia(evento.distanciaM);
      anunciar(`Atenção: ${rotulo}${evento.ponto.nome ? `, ${evento.ponto.nome}` : ''}, a ${dist}.`, 'alerta');
    },
    [anunciar]
  );

  useAlertasProximidade(pontosProximidade, posicao, lidarComAlertaProximidade);

  const lidarComComandoVoz = useCallback(
    (cmd: ComandoVoz) => {
      switch (cmd.tipo) {
        case 'buscar':
          setBusca(cmd.consulta);
          lidarComBusca(cmd.consulta);
          break;
        case 'localizar':
          if (posicao) {
            anunciar(
              `Você está em latitude ${posicao.lat.toFixed(4)}, longitude ${posicao.lon.toFixed(4)}. Precisão do GPS: ${Math.round(posicao.precisao ?? 0)} metros.`
            );
          } else {
            anunciar('Localização ainda não disponível. Verifique se o GPS está ativo.');
          }
          break;
        case 'repetir':
          if (refUltimaFala.current) falar(refUltimaFala.current, 'info');
          break;
        case 'parar':
          pararNarracao();
          break;
        case 'iniciar_rota':
          if (resultadosBusca[0]) selecionarDestino(resultadosBusca[0]);
          else anunciar('Busque um destino antes de iniciar a rota.');
          break;
        case 'tracar_rota':
          setBusca(cmd.endereco);
          lidarComTracarRotaPorVoz(cmd.endereco);
          break;
        case 'reportar':
          setCategoriaReporteInicial(cmd.categoria);
          setMostrarReportar(true);
          break;
        case 'desconhecido':
          setBusca(cmd.transcricao);
          anunciar(`Não entendi o comando: "${cmd.transcricao}". Tente "buscar", "onde estou" ou "iniciar rota".`);
          break;
      }
    },
    [lidarComBusca, posicao, anunciar, falar, pararNarracao, resultadosBusca, selecionarDestino, lidarComTracarRotaPorVoz]
  );

  const { suportado: suporteMicrofone, ouvindo: microfoneOuvindo, iniciarEscuta } = useComandosVoz(lidarComComandoVoz);

  const lidarComAlternar = useCallback((id: TipoCamada, val: boolean) => {
    setCamadas((prev) => ({ ...prev, [id]: val }));
  }, []);

  const lidarComNarrarSituacao = useCallback(() => {
    if (!posicao) {
      anunciar(erroGeo ?? 'Obtendo localização, aguarde...');
      return;
    }
    const proximos = pontosProximidade.filter((p) => distanciaM(posicao.lat, posicao.lon, p.lat, p.lon) <= RAIO_RESUMO_PROXIMO_M);
    const tatil = proximos.filter((p) => p.tipo === 'parada_tatil').length;
    const bot = proximos.filter((p) => p.tipo === 'botoeira').length;
    const obr = proximos.filter((p) => p.tipo === 'obra').length;
    const precisaoTxt = precisaoM
      ? `Precisão do GPS: ${Math.round(precisaoM)} metros.${precisaoBaixa ? ' Sinal de baixa precisão — a posição no mapa pode estar imprecisa.' : ''}`
      : '';
    const rotaTxt = rota ? `Rota ativa até ${rota.destino.nome}, faltam ${formatarDistancia(rota.distanciaM)}.` : '';
    anunciar(
      `${precisaoTxt} Num raio de ${RAIO_RESUMO_PROXIMO_M} metros: ${tatil} parada${tatil === 1 ? '' : 's'} com piso tátil, ${bot} botoeira${bot === 1 ? '' : 's'} sonora, ${obr} obra${obr === 1 ? '' : 's'} em execução. ${rotaTxt}`
    );
  }, [posicao, erroGeo, precisaoM, precisaoBaixa, pontosProximidade, rota, anunciar]);

  const lidarComSobre = useCallback(() => {
    setMostrarSobre(true);
    anunciar(
      'EchoPath existe para ajudar pessoas com dificuldades de visão a se locomoverem por Porto Alegre com mais segurança e autonomia, cruzando dados de piso tátil, botoeiras sonoras e obras com narração e comandos de voz. Usa dados oficiais do GTFS da EPTC para paradas de ônibus, o dataset oficial de acidentes de trânsito da EPTC, planilhas oficiais da EPTC para piso tátil e botoeiras sonoras, e planilha oficial da SMOI para obras em execução. Onde a Prefeitura não cobre tudo, complementamos com dados colaborativos do OpenStreetMap. As rotas são calculadas pelo OpenRouteService. Projeto criado por Miguel e Gabriel, alunos do Senac Distrito Criativo.'
    );
  }, [anunciar]);

  const lidarComAlternarVoz = useCallback(() => {
    definirVozAtivada(!vozAtivada);
    if (vozAtivada) {
      pararNarracao();
    } else {
      anunciar('Narração por voz ativada.');
    }
  }, [vozAtivada, definirVozAtivada, pararNarracao, anunciar]);

  const lidarComTestarVoz = useCallback(() => {
    falar('Esta é a voz selecionada para a narração do EchoPath.', 'alerta');
  }, [falar]);

  return (
    <div className="aplicativo" lang="pt-BR">
      <div aria-live="assertive" aria-atomic="true" className="apenas-leitor-tela">{ultimaMsgAlerta}</div>
      <div aria-live="polite" aria-atomic="true" className="apenas-leitor-tela">{ultimaMsgInfo}</div>

      <Cabecalho
        valorBusca={busca}
        aoMudarBusca={setBusca}
        aoSubmeterBusca={lidarComBusca}
        aoClicarMicrofone={iniciarEscuta}
        microfoneOuvindo={microfoneOuvindo}
        microfoneSuportado={suporteMicrofone}
        aoClicarPerfil={() => setMostrarAutenticacao(true)}
        logado={!!usuario}
      />

      <main className="aplicativo-principal">
        <VisualizadorMapa
          camadas={camadas}
          paradasComTatil={paradasComTatilProximas}
          sinaisSonoros={sinaisSonoros}
          obras={obras}
          acidentes={acidentes}
          onibusAoVivo={onibus}
          posicaoUsuario={posicao}
          rota={rota}
          reportes={reportes}
          aoReportarPonto={lidarComReportarPonto}
        />

        <button
          type="button"
          className="botao-reportar-flutuante"
          onClick={() => {
            setCategoriaReporteInicial(null);
            setMostrarReportar(true);
          }}
          aria-label="Reportar obra, botoeira quebrada ou rua obstruída"
        >
          ⚠️
        </button>

        {resultadosBusca.length > 0 && (
          <aside className="lista-locais" role="complementary" aria-label="Resultados da busca">
            <div className="lista-locais__cabecalho">
              <h2 tabIndex={-1} ref={refTituloBusca}>Resultados da busca</h2>
              <button className="botao-fechar" onClick={() => setResultadosBusca([])} aria-label="Fechar resultados">✕</button>
            </div>
            <ul className="lista-locais-itens">
              {resultadosBusca.map((r) => (
                <li key={r.id}>
                  <button type="button" className="item-local" onClick={() => selecionarDestino(r)}>
                    <span className="item-icone" aria-hidden="true">{r.tipo === 'parada_tatil' ? '🟢' : r.tipo === 'botoeira' ? '🔊' : '📍'}</span>
                    <span className="item-info">
                      <span className="item-nome">{r.nome}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <ListaLocais
          paradasComTatil={paradasComTatilProximas}
          sinaisSonoros={sinaisSonoros}
          obras={obras}
          posicaoUsuario={posicao}
          visivel={mostrarLista && resultadosBusca.length === 0}
          aoFechar={() => setMostrarLista(false)}
          aoSelecionarDestino={selecionarDestino}
        />
      </main>

      {(obtendo || erroGeo || statusRota === 'carregando' || erroRota) && (
        <div
          className={`aviso-status${erroGeo || erroRota ? ' aviso-status--erro' : ' aviso-status--carregando'}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {!erroGeo && !erroRota && <span className="aviso-status__spinner" aria-hidden="true" />}
          {erroGeo || erroRota ? <span aria-hidden="true">⚠</span> : null}
          <span>
            {obtendo && 'Obtendo localização de alta precisão...'}
            {!obtendo && erroGeo}
            {statusRota === 'carregando' && 'Calculando rota acessível...'}
            {erroRota}
          </span>
          {rota && (
            <button className="aviso-status__limpar" onClick={limparRota} aria-label={`Cancelar rota até ${rota.destino.nome}`}>
              Cancelar rota
            </button>
          )}
        </div>
      )}

      <BarraInferior
        camadas={camadas}
        aoAlternar={lidarComAlternar}
        aoClicarVoz={lidarComNarrarSituacao}
        aoClicarMicrofone={iniciarEscuta}
        microfoneOuvindo={microfoneOuvindo}
        microfoneSuportado={suporteMicrofone}
        aoClicarFavoritos={() => setMostrarLista((v) => !v)}
        aoClicarConfiguracoes={() => setMostrarConfiguracoes(true)}
        aoClicarSobre={lidarComSobre}
      />

      <Sobre aberto={mostrarSobre} aoFechar={() => setMostrarSobre(false)} />

      <Configuracoes
        aberto={mostrarConfiguracoes}
        aoFechar={() => setMostrarConfiguracoes(false)}
        vozAtivada={vozAtivada}
        aoAlternarVoz={lidarComAlternarVoz}
        tema={tema}
        aoDefinirTema={definirTema}
        contraste={contraste}
        aoAlternarContraste={alternarContraste}
        tamanhoTexto={tamanhoTexto}
        aoDefinirTamanhoTexto={definirTamanhoTexto}
        idiomaVoz={idiomaVoz}
        aoDefinirIdiomaVoz={definirIdiomaVoz}
        velocidadeVoz={velocidadeVoz}
        aoDefinirVelocidadeVoz={definirVelocidadeVoz}
        vozUri={vozUri}
        aoDefinirVozUri={definirVozUri}
        vozesDisponiveis={vozesDisponiveis}
        aoTestarVoz={lidarComTestarVoz}
      />

      <Autenticacao
        aberto={mostrarAutenticacao}
        aoFechar={() => setMostrarAutenticacao(false)}
        usuario={usuario}
        suportado={authSuportado}
        aoEntrar={entrar}
        aoCadastrar={cadastrar}
        aoSair={sair}
        aoAtualizarPerfil={atualizarPerfil}
      />

      {mostrarReportar && (
        <Reportar
          aoFechar={() => {
            setMostrarReportar(false);
            setPontoPreenchido(null);
          }}
          logado={!!usuario}
          authSuportado={reportesSuportado}
          latLonAtual={latLon}
          categoriaInicial={categoriaReporteInicial}
          pontoPreenchido={pontoPreenchido}
          categoriasDisponiveis={categoriasReportarDisponiveis}
          catalogoOficial={catalogoReportarOficial}
          distanciaDaRotaAtivaM={distanciaDaRotaAtivaM}
          aoFalar={falar}
          aoEnviar={lidarComEnviarReporte}
          aoAbrirConta={() => {
            setMostrarReportar(false);
            setMostrarAutenticacao(true);
          }}
        />
      )}

      {!vozSuportada && (
        <p className="apenas-leitor-tela" role="note">
          Síntese de voz não suportada neste navegador — use a interface visual normalmente.
        </p>
      )}
      {statusAcessibilidade === 'erro' && (
        <p className="apenas-leitor-tela" role="note">
          Não foi possível atualizar dados de piso tátil, botoeiras e obras agora. Mostrando último dado disponível.
        </p>
      )}
    </div>
  );
}
