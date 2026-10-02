import { useEffect, useMemo, useState } from 'react';
import { carregarParadasGtfs } from '../services/gtfs';
import { ACIDENTES_MOCK, ONIBUS_MOCK, buscarAcidentes } from '../services/api';
import { carregarIdsParadasTatilEptc } from '../services/pisoTatilEptc';
import { carregarBotoeirasEptc } from '../services/botoeirasEptc';
import { carregarObrasSmoi } from '../services/obrasSmoi';
import { anexarPisoTatil } from './useDadosAcessibilidade';
import { distanciaM } from '../utils/geografia';
import type { ParadaOnibus, Acidente, OnibusAoVivo, SinalSonoro, Obra } from '../types';
import type { DadosAcessibilidadeOsm } from '../services/osm';

export { useLocalizacaoUsuario, PRECISAO_MAX_UTILIZAVEL_M, mensagemErroGeo, precisaoEhBaixa } from './useLocalizacaoUsuario';
export { useDadosAcessibilidade, anexarPisoTatil } from './useDadosAcessibilidade';
export { useAlertasProximidade } from './useAlertasProximidade';
export { useNarracaoVoz } from './useNarracaoVoz';
export { usePreferenciasVisuais } from './usePreferenciasVisuais';
export type { Tema, Contraste, TamanhoTexto } from './usePreferenciasVisuais';
export { useAutenticacao } from './useAutenticacao';

export function useParadasOnibus(
  ativado: boolean,
  acessibilidade: DadosAcessibilidadeOsm | null,
  latLonUsuario?: [number, number] | null
) {
  const [todasParadas, setTodasParadas] = useState<ParadaOnibus[]>([]);
  const [idsTatilEptc, setIdsTatilEptc] = useState<Set<string>>(new Set());
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega paradas/piso tátil independente da camada estar visível no mapa
  // — a rota acessível precisa saber onde tem piso tátil confirmado mesmo
  // que a pessoa tenha escondido essa camada visualmente. Mostrar ou não no
  // mapa é decidido depois, no VisualizadorMapa (que já filtra por conta
  // própria); aqui é só sobre TER o dado.
  useEffect(() => {
    if (carregado) return;
    let cancelado = false;
    Promise.all([carregarParadasGtfs(), carregarIdsParadasTatilEptc()])
      .then(([paradas, idsEptc]) => {
        if (cancelado) return;
        setTodasParadas(paradas);
        setIdsTatilEptc(idsEptc);
        setCarregado(true);
      })
      .catch((err) => {
        if (cancelado) return;
        setErro(err instanceof Error ? err.message : 'Falha ao carregar paradas');
        setCarregado(true);
      });
    return () => {
      cancelado = true;
    };
  }, [carregado]);

  const todasComTatilAnexado = useMemo(
    () => anexarPisoTatil(todasParadas, acessibilidade?.pontosPisoTatil ?? [], idsTatilEptc, latLonUsuario ?? undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todasParadas, acessibilidade, idsTatilEptc, latLonUsuario?.[0], latLonUsuario?.[1]]
  );

  // Sempre disponível (independe da camada) — usado pelo avaliador de rota.
  const todasParadasComTatil = useMemo(() => todasComTatilAnexado.filter((p) => p.pisoTatil), [todasComTatilAnexado]);

  // Preserva o comportamento visual de antes: só "existe" pro resto da UI
  // (lista de locais, mapa) quando a camada está ligada.
  const paradas = useMemo(() => (ativado ? todasComTatilAnexado : []), [ativado, todasComTatilAnexado]);
  const paradasComTatil = useMemo(() => (ativado ? todasParadasComTatil : []), [ativado, todasParadasComTatil]);
  const carregando = ativado && !carregado;

  return { paradas, paradasComTatil, todasParadasComTatil, carregando, erro };
}

// Botoeiras a menos disso de uma botoeira oficial da EPTC são consideradas o
// mesmo ponto físico — evita mostrar duas vezes a mesma botoeira (uma vinda
// da planilha oficial, outra do OSM).
const RAIO_DEDUP_BOTOEIRAS_M = 30;

export function useBotoeirasSonoras(ativado: boolean, sinaisOsm: SinalSonoro[]) {
  const [botoeirasEptc, setBotoeirasEptc] = useState<import('../services/botoeirasEptc').EntradaBotoeiraEptc[]>([]);
  const [carregado, setCarregado] = useState(false);

  // Sempre busca, independente da camada estar visível — ver comentário
  // equivalente em useParadasOnibus.
  useEffect(() => {
    if (carregado) return;
    let cancelado = false;
    carregarBotoeirasEptc().then((dados) => {
      if (cancelado) return;
      setBotoeirasEptc(dados);
      setCarregado(true);
    });
    return () => {
      cancelado = true;
    };
  }, [carregado]);

  const sinaisEptc = useMemo<SinalSonoro[]>(
    () => botoeirasEptc.map((b) => ({ id: b.id, lat: b.lat, lon: b.lon, nome: b.local, fonte: 'eptc' as const })),
    [botoeirasEptc]
  );

  const todosSinais = useMemo(() => {
    const osmSemDuplicata = sinaisOsm.filter(
      (osm) => !sinaisEptc.some((eptc) => distanciaM(osm.lat, osm.lon, eptc.lat, eptc.lon) < RAIO_DEDUP_BOTOEIRAS_M)
    );
    return [...sinaisEptc, ...osmSemDuplicata];
  }, [sinaisEptc, sinaisOsm]);

  // Preserva o comportamento visual de antes.
  const sinais = useMemo(() => (ativado ? todosSinais : []), [ativado, todosSinais]);

  return { sinais, todosSinais };
}

// Obras a menos disso de uma obra oficial da SMOI são consideradas o mesmo
// canteiro — evita mostrar a mesma obra duas vezes (planilha oficial + OSM).
const RAIO_DEDUP_OBRAS_M = 50;

export function useObrasSmoi(ativado: boolean, obrasOsm: Obra[]) {
  const [obrasSmoi, setObrasSmoi] = useState<import('../services/obrasSmoi').EntradaObraSmoi[]>([]);
  const [carregado, setCarregado] = useState(false);

  // Sempre busca, independente da camada estar visível — a rota acessível
  // precisa saber de obras mesmo que a pessoa tenha escondido essa camada
  // do mapa. Antes, desligar a camada "Obras" fazia a rota parar de evitar
  // obras de verdade, o que não devia depender de preferência visual.
  useEffect(() => {
    if (carregado) return;
    let cancelado = false;
    carregarObrasSmoi().then((dados) => {
      if (cancelado) return;
      setObrasSmoi(dados);
      setCarregado(true);
    });
    return () => {
      cancelado = true;
    };
  }, [carregado]);

  const obrasOficiais = useMemo<Obra[]>(
    () =>
      obrasSmoi.map((o) => ({
        id: o.id,
        lat: o.lat,
        lon: o.lon,
        tipo: 'edificacao' as const,
        nome: o.nome,
        endereco: o.endereco,
        fonte: 'smoi' as const,
      })),
    [obrasSmoi]
  );

  const todasObras = useMemo(() => {
    const osmSemDuplicata = obrasOsm.filter(
      (osm) => !obrasOficiais.some((oficial) => distanciaM(osm.lat, osm.lon, oficial.lat, oficial.lon) < RAIO_DEDUP_OBRAS_M)
    );
    return [...obrasOficiais, ...osmSemDuplicata];
  }, [obrasOficiais, obrasOsm]);

  // Preserva o comportamento visual de antes.
  const obras = useMemo(() => (ativado ? todasObras : []), [ativado, todasObras]);

  return { obras, todasObras };
}

export function useAcidentes(ativado: boolean) {
  const [acidentes, setAcidentes] = useState<Acidente[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ativado || carregado) return;
    let cancelado = false;
    buscarAcidentes()
      .then((dados) => {
        if (cancelado) return;
        setAcidentes(dados);
        setCarregado(true);
      })
      .catch((err) => {
        if (cancelado) return;
        setErro(err instanceof Error ? err.message : 'Falha ao buscar acidentes');
        setAcidentes(ACIDENTES_MOCK as Acidente[]);
        setCarregado(true);
      });
    return () => {
      cancelado = true;
    };
  }, [ativado, carregado]);

  return { acidentes: ativado ? acidentes : [], carregando: ativado && !carregado, erro };
}

export function useOnibusAoVivo(ativado: boolean, intervaloMs = 15000) {
  const [onibus, setOnibus] = useState<OnibusAoVivo[]>(() => ONIBUS_MOCK as OnibusAoVivo[]);
  useEffect(() => {
    if (!ativado) return;
    const id = setInterval(() => setOnibus(ONIBUS_MOCK as OnibusAoVivo[]), intervaloMs);
    return () => clearInterval(id);
  }, [ativado, intervaloMs]);
  return { onibus: ativado ? onibus : [] };
}
