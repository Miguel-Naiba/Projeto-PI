import { useEffect, useRef, useState } from 'react';
import { buscarDadosAcessibilidade } from '../services/osm';
import type { DadosAcessibilidadeOsm } from '../services/osm';
import { chaveCelula, distanciaM } from '../utils/geografia';
import type { ParadaOnibus } from '../types';

export type StatusAcessibilidade = 'ocioso' | 'carregando' | 'sucesso' | 'erro';

const INTERVALO_ATUALIZACAO_MS = 60_000;
const MIN_INTERVALO_REBUSCA_MS = 20_000;
const RAIO_BUSCA_M = 1200;
const MAX_DISTANCIA_CASAMENTO_TATIL_M = 25;
const MARGEM_PREFILTRO_ESPACIAL_OSM_M = 200;

interface ResultadoUseDadosAcessibilidade {
  dados: DadosAcessibilidadeOsm | null;
  status: StatusAcessibilidade;
  ultimaAtualizacao: number | null;
}

/** Política única de frequência, inclusive depois de falhas. Sem novo timer permanente. */
export function podeBuscarAcessibilidade(emAndamento: boolean, ultimaTentativa: number | null,
  ultimaCelula: string | null, celula: string, agora: number): boolean {
  if (emAndamento) return false;
  const decorrido = ultimaTentativa === null ? Infinity : agora - ultimaTentativa;
  return decorrido >= MIN_INTERVALO_REBUSCA_MS &&
    (celula !== ultimaCelula || decorrido >= INTERVALO_ATUALIZACAO_MS);
}

export function useDadosAcessibilidade(latLonUsuario: [number, number] | null): ResultadoUseDadosAcessibilidade {
  const [dados, setDados] = useState<DadosAcessibilidadeOsm | null>(null);
  const [status, setStatus] = useState<StatusAcessibilidade>('ocioso');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null);
  const ultimaCelulaRef = useRef<string | null>(null);
  const ultimaBuscaEmRef = useRef<number | null>(null);
  const emAndamento = useRef<AbortController | null>(null);

  useEffect(() => () => {
    emAndamento.current?.abort();
    emAndamento.current = null;
    // Permite nova montagem de efeitos em StrictMode, sem manter pedido abortado.
    ultimaBuscaEmRef.current = null;
  }, []);

  useEffect(() => {
    if (!latLonUsuario || emAndamento.current) return;
    const [lat, lon] = latLonUsuario;
    const celula = chaveCelula(lat, lon, 2);
    const agora = Date.now();
    if (!podeBuscarAcessibilidade(false, ultimaBuscaEmRef.current, ultimaCelulaRef.current, celula, agora)) return;

    const controle = new AbortController();
    emAndamento.current = controle;
    ultimaBuscaEmRef.current = agora; // tentativa, inclusive quando falha
    setStatus('carregando');
    buscarDadosAcessibilidade(lat, lon, RAIO_BUSCA_M, controle.signal)
      .then((res) => {
        if (controle.signal.aborted) return;
        setDados(res);
        setStatus('sucesso');
        setUltimaAtualizacao(res.buscadoEm);
        ultimaCelulaRef.current = celula;
      })
      .catch(() => {
        if (!controle.signal.aborted) setStatus('erro');
      })
      .finally(() => {
        if (emAndamento.current === controle) emAndamento.current = null;
      });
    // As atualizações de GPS não cancelam uma consulta útil nem iniciam outra.
    // Cleanup de rede pertence à desmontagem, não a cada leitura do GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latLonUsuario?.[0], latLonUsuario?.[1]]);

  return { dados, status, ultimaAtualizacao };
}

export function anexarPisoTatil(
  paradas: ParadaOnibus[],
  pontosTatil: { lat: number; lon: number }[],
  idsParadasEptc?: Set<string>,
  centroBusca?: [number, number]
): ParadaOnibus[] {
  const temEptc = !!idsParadasEptc && idsParadasEptc.size > 0;
  const temOsm = pontosTatil.length > 0;
  if (!temEptc && !temOsm) return paradas;

  const distanciaMaxOsm = RAIO_BUSCA_M + MARGEM_PREFILTRO_ESPACIAL_OSM_M;

  return paradas.map((parada) => {
    if (idsParadasEptc?.has(parada.idParada)) {
      return parada.fontePisoTatil === 'eptc' ? parada : { ...parada, pisoTatil: true, fontePisoTatil: 'eptc' };
    }
    if (parada.pisoTatil) return parada;
    if (!temOsm) return parada;
    if (centroBusca && distanciaM(parada.latParada, parada.lonParada, centroBusca[0], centroBusca[1]) > distanciaMaxOsm) {
      return parada;
    }

    let melhor = Infinity;
    for (const p of pontosTatil) {
      const d = distanciaM(parada.latParada, parada.lonParada, p.lat, p.lon);
      if (d < melhor) melhor = d;
    }
    return melhor <= MAX_DISTANCIA_CASAMENTO_TATIL_M
      ? { ...parada, pisoTatil: true, fontePisoTatil: 'osm', distanciaPisoTatilM: Math.round(melhor) }
      : parada;
  });
}
