import { distanciaM } from './geografia';
import type { EtapaRota } from '../types';

// Uma etapa a até esta distância de um ponto confirmado é considerada "coberta"
// por ele — folga generosa porque a etapa é o ponto de decisão da instrução
// (ex.: "vire à direita"), não necessariamente o centro exato da travessia.
const RAIO_COBERTURA_M = 40;

export interface EtapaComSeguranca extends EtapaRota {
  temBotoeiraProxima: boolean;
  temPisoTatilProximo: boolean;
}

export interface AnaliseSegurancaRota {
  etapas: EtapaComSeguranca[];
  totalEtapas: number;
  etapasComBotoeira: number;
  etapasComPisoTatil: number;
  etapasSemNenhuma: EtapaComSeguranca[];
}

function algumPertoDe(lat: number, lon: number, pontos: { lat: number; lon: number }[], raioM: number): boolean {
  return pontos.some((p) => distanciaM(lat, lon, p.lat, p.lon) <= raioM);
}

/**
 * Cruza cada etapa (ponto de instrução) da rota com as botoeiras sonoras e
 * paradas com piso tátil já carregadas no app. Não identifica com certeza
 * quais etapas são "travessias de rua" de fato (o texto da instrução do ORS
 * não é confiável pra isso) — por honestidade, avalia todas as etapas e
 * deixa claro na narração que é uma aproximação, não uma garantia.
 */
export function analisarSegurancaRota(
  etapas: EtapaRota[],
  botoeiras: { lat: number; lon: number }[],
  paradasComTatil: { lat: number; lon: number }[]
): AnaliseSegurancaRota {
  const etapasAnalisadas: EtapaComSeguranca[] = etapas.map((etapa) => ({
    ...etapa,
    temBotoeiraProxima: algumPertoDe(etapa.lat, etapa.lon, botoeiras, RAIO_COBERTURA_M),
    temPisoTatilProximo: algumPertoDe(etapa.lat, etapa.lon, paradasComTatil, RAIO_COBERTURA_M),
  }));

  return {
    etapas: etapasAnalisadas,
    totalEtapas: etapasAnalisadas.length,
    etapasComBotoeira: etapasAnalisadas.filter((e) => e.temBotoeiraProxima).length,
    etapasComPisoTatil: etapasAnalisadas.filter((e) => e.temPisoTatilProximo).length,
    etapasSemNenhuma: etapasAnalisadas.filter((e) => !e.temBotoeiraProxima && !e.temPisoTatilProximo),
  };
}

/** Monta a frase narrada com o resumo da análise — chamada logo após a rota ser calculada. */
export function narrarSegurancaRota(analise: AnaliseSegurancaRota): string {
  if (analise.totalEtapas === 0) return '';

  const semNenhuma = analise.etapasSemNenhuma.length;

  if (semNenhuma === 0) {
    return 'Todos os pontos de instrução dessa rota passam perto de uma botoeira sonora ou piso tátil confirmado.';
  }

  const proporcao = `${analise.totalEtapas - semNenhuma} de ${analise.totalEtapas}`;
  return (
    `Atenção: ${proporcao} pontos de instrução dessa rota têm botoeira sonora ou piso tátil confirmado por perto. ` +
    `${semNenhuma} ${semNenhuma === 1 ? 'ponto não tem' : 'pontos não têm'} nenhuma confirmação — reforce a atenção nessas travessias.`
  );
}
