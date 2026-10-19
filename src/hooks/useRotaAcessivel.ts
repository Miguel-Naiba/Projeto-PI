import { useCallback, useEffect, useState } from 'react';
import { ControleSolicitacaoRota } from '../services/controleSolicitacaoRota';
import type { MotivoRota } from '../services/controleSolicitacaoRota';
import type { PontoProximidade } from '../types';
import type { ContextoAcessibilidade } from '../services/roteamento';
export type StatusRota = 'ocioso' | 'carregando' | 'sucesso' | 'erro';

const CHAVE_API_ORS = import.meta.env.VITE_CHAVE_API_ORS as string | undefined;

export function useRotaAcessivel() {
  const [estado, setEstado] = useState(() => ({
    rota: null, status: 'ocioso', erro: null, erroStatus: null, motivo: 'manual', destinoSolicitado: null,
  } as import('../services/controleSolicitacaoRota').EstadoSolicitacaoRota));
  const [controle] = useState(() => new ControleSolicitacaoRota(async (origem, destino, contexto, sinal) => {
    const { calcularRotaAcessivel } = await import('../services/roteamento');
    sinal.throwIfAborted();
    return calcularRotaAcessivel(origem, destino, CHAVE_API_ORS ?? '', contexto, 'foot-walking', sinal);
  }, setEstado));

  useEffect(() => () => controle.cancelar(), [controle]);
  const solicitarRota = useCallback((origem: [number, number], destino: PontoProximidade,
    contexto: ContextoAcessibilidade, motivo: MotivoRota = 'manual') =>
    controle.solicitar(origem, destino, contexto, motivo), [controle]);
  const limparRota = useCallback(() => controle.cancelar(true), [controle]);
  const cancelarSolicitacao = useCallback(() => controle.cancelar(), [controle]);
  return { ...estado, solicitarRota, limparRota, cancelarSolicitacao };
}
