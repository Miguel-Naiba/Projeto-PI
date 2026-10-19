/** Prazos operacionais: ORS admite processamento pesado; Overpass declara 25s
 * no servidor e recebe 5s adicionais para transporte. Não são SLA medidos. */
export const PRAZO_ORS_MS = 60_000;
export const PRAZO_OVERPASS_MS = 30_000;

export function cancelamento(): DOMException {
  return new DOMException('Solicitação cancelada.', 'AbortError');
}

export function foiCancelado(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError';
}

export function coordenadaValida(lat: unknown, lon: unknown): boolean {
  return typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** O prazo cobre fetch E leitura do corpo. Cleanup ocorre em todos os caminhos. */
export async function comPrazo<T>(
  executar: (sinal: AbortSignal) => Promise<T>, prazoMs: number, sinal?: AbortSignal,
): Promise<T> {
  sinal?.throwIfAborted();
  const controle = new AbortController();
  const cancelar = () => controle.abort(cancelamento());
  sinal?.addEventListener('abort', cancelar, { once: true });
  const timer = setTimeout(() => controle.abort(new DOMException('Tempo de resposta esgotado. Tente novamente.', 'TimeoutError')), prazoMs);
  try {
    const resultado = await executar(controle.signal);
    controle.signal.throwIfAborted();
    return resultado;
  } catch (erro) {
    if (controle.signal.aborted) throw controle.signal.reason;
    throw erro;
  } finally {
    clearTimeout(timer);
    sinal?.removeEventListener('abort', cancelar);
  }
}

export function esperaRetryAfter(valor: string | null | undefined, agora = Date.now()): number {
  if (!valor?.trim()) return 0;
  const segundos = Number(valor);
  const espera = Number.isFinite(segundos) ? segundos * 1000 : Date.parse(valor) - agora;
  return Number.isFinite(espera) ? Math.max(0, espera) : 0;
}
