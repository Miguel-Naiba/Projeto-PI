import { useState } from 'react';
import { distanciaM } from '../utils/geografia';

/**
 * Checklist Fase 3, P9 ("avaliar throttle sem prejudicar navegação"):
 * `useLocalizacaoUsuario` já filtra ruído de GPS abaixo de 5m antes de
 * atualizar `latLon` — mas ainda assim, cada atualização de ~5m dispara de
 * novo qualquer cálculo que dependa de `latLon`. Pra coisas como "quais
 * paradas renderizar num raio de 3km" ou "recasar piso tátil do OSM com o
 * GTFS" isso é desperdício: o resultado desses cálculos praticamente não
 * muda entre uma leitura e outra 5m mais adiante, só entre leituras bem
 * mais espaçadas. 75m foi a distância escolhida: grande o suficiente pra
 * cortar a maioria das recomputações redundantes durante uma caminhada,
 * pequena o suficiente pra lista de "pontos próximos" continuar parecendo
 * atualizada em tempo real.
 *
 * NÃO é usado em nada que precise reagir rápido e com precisão à posição
 * exata — detecção de saída de rota (`recalculoRota.ts`), alertas de
 * proximidade e distância até a geometria da rota ativa continuam usando o
 * `latLon` cru, sem esse throttle, de propósito: atrasar essas leituras
 * seria "throttle que prejudica a navegação", exatamente o que o checklist
 * pede pra evitar.
 */
export const LIMIAR_THROTTLE_PROXIMIDADE_M = 75;

export function devePassarThrottle(
  atual: [number, number] | null,
  novo: [number, number] | null,
  limiarM: number
): boolean {
  if (novo === null) return atual !== null;
  if (atual === null) return true;
  return distanciaM(atual[0], atual[1], novo[0], novo[1]) > limiarM;
}

/**
 * Sem `useEffect` de propósito — segue o padrão oficial do React de
 * "ajustar estado quando uma prop muda" (calcular durante a renderização,
 * comparando com um "valor anterior" guardado em estado, em vez de reagir
 * depois num efeito). Evita o ciclo extra de efeito -> setState -> novo
 * render que a regra `react-hooks/set-state-in-effect` existe pra pegar.
 */
export function useLatLonThrottled(
  latLon: [number, number] | null,
  limiarM: number = LIMIAR_THROTTLE_PROXIMIDADE_M
): [number, number] | null {
  const [valor, setValor] = useState<[number, number] | null>(latLon);
  const [latLonAnterior, setLatLonAnterior] = useState<[number, number] | null>(latLon);

  if (latLon !== latLonAnterior) {
    setLatLonAnterior(latLon);
    if (devePassarThrottle(valor, latLon, limiarM)) {
      setValor(latLon);
    }
  }

  return valor;
}
