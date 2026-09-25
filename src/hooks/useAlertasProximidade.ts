import { useEffect, useRef } from 'react';
import { distanciaM } from '../utils/geografia';
import { LIMIARES_ALERTA } from '../types';
import type { LimiarAlerta, EventoProximidade, PontoProximidade, LocalizacaoUsuario } from '../types';

const DISTANCIA_ESQUECIMENTO_M = 260;

export function useAlertasProximidade(
  pontos: PontoProximidade[],
  posicaoUsuario: LocalizacaoUsuario | null,
  aoAlertar: (evento: EventoProximidade) => void
) {
  const disparadosRef = useRef<Map<string, LimiarAlerta>>(new Map());

  useEffect(() => {
    if (!posicaoUsuario || pontos.length === 0) return;
    if (posicaoUsuario.precisao != null && posicaoUsuario.precisao > 100) return;

    for (const ponto of pontos) {
      const d = distanciaM(posicaoUsuario.lat, posicaoUsuario.lon, ponto.lat, ponto.lon);
      const jaDisparado = disparadosRef.current.get(ponto.id);

      for (const limiar of LIMIARES_ALERTA) {
        const cruzou = d <= limiar && (jaDisparado === undefined || jaDisparado > limiar);
        if (cruzou) {
          disparadosRef.current.set(ponto.id, limiar);
          aoAlertar({ ponto, limiar, distanciaM: d });
        }
      }

      if (d > DISTANCIA_ESQUECIMENTO_M && jaDisparado !== undefined) {
        disparadosRef.current.delete(ponto.id);
      }
    }
  }, [pontos, posicaoUsuario, aoAlertar]);
}
