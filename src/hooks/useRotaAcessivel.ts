import { useCallback, useState } from 'react';
import type { PontoProximidade } from '../types';
import type { ContextoAcessibilidade } from '../services/roteamento';
import type { RotaCandidata } from '../services/avaliadorRota';

export type StatusRota = 'ocioso' | 'carregando' | 'sucesso' | 'erro';

interface ResultadoUseRotaAcessivel {
  rota: RotaCandidata | null;
  status: StatusRota;
  erro: string | null;
  solicitarRota: (origem: [number, number], destino: PontoProximidade, contexto: ContextoAcessibilidade) => Promise<void>;
  limparRota: () => void;
}

const CHAVE_API_ORS = import.meta.env.VITE_CHAVE_API_ORS as string | undefined;

export function useRotaAcessivel(): ResultadoUseRotaAcessivel {
  const [rota, setRota] = useState<RotaCandidata | null>(null);
  const [status, setStatus] = useState<StatusRota>('ocioso');
  const [erro, setErro] = useState<string | null>(null);

  const solicitarRota = useCallback(
    async (origem: [number, number], destino: PontoProximidade, contexto: ContextoAcessibilidade) => {
      if (!CHAVE_API_ORS) {
        setStatus('erro');
        setErro('Chave da API de rotas (OpenRouteService) não configurada — defina VITE_CHAVE_API_ORS no .env.');
        return;
      }
      setStatus('carregando');
      setErro(null);
      try {
        const { calcularRotaAcessivel } = await import('../services/roteamento');
        const resultado = await calcularRotaAcessivel(origem, destino, CHAVE_API_ORS, contexto);
        setRota(resultado);
        setStatus('sucesso');
      } catch (err) {
        setStatus('erro');
        setErro(err instanceof Error ? err.message : 'Falha ao calcular rota.');
      }
    },
    []
  );

  const limparRota = useCallback(() => {
    setRota(null);
    setStatus('ocioso');
    setErro(null);
  }, []);

  return { rota, status, erro, solicitarRota, limparRota };
}
