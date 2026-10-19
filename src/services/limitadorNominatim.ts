/**
 * Limitador GLOBAL de requisições ao Nominatim público (Fase A, item E).
 *
 * Política de uso do Nominatim (operations.osmfoundation.org): no máximo 1
 * requisição por segundo por aplicação — somando busca direta e reversa —,
 * cache dos resultados, e nada de autocomplete. Antes deste módulo, cada
 * função de geocodificacao.ts controlava (mal) só a si mesma: a busca direta
 * podia disparar até 4 requisições por consulta e a reversa não conversava com
 * ela. Agora TODA chamada ao Nominatim passa por `fetchNominatim`:
 *
 *  - fila única: os INÍCIOS das requisições ficam espaçados por pelo menos
 *    INTERVALO_MINIMO_NOMINATIM_MS (1,1 s — folga sobre o 1 s oficial);
 *  - 429 (limite excedido): respeita Retry-After (ou uma pausa padrão), NÃO
 *    retenta na hora e recusa novas chamadas, sem tocar a rede, até acabar a
 *    pausa;
 *  - 403 (acesso bloqueado): NÃO retenta (retentar um bloqueio só piora) e
 *    entra em pausa longa.
 *
 * O estado vive só em memória, por sessão do navegador.
 */

export const INTERVALO_MINIMO_NOMINATIM_MS = 1100;
export const PAUSA_PADRAO_429_MS = 60_000;
export const PAUSA_APOS_403_MS = 300_000;
const PAUSA_MAXIMA_RETRY_AFTER_MS = 600_000;

export class ErroNominatim extends Error {
  readonly status: number;
  readonly esperaMs: number;
  constructor(status: number, esperaMs: number) {
    const segundos = Math.max(1, Math.ceil(esperaMs / 1000));
    super(
      status === 429
        ? `O serviço público de busca de endereços pediu uma pausa. Tente de novo em cerca de ${segundos} segundos.`
        : 'O serviço público de busca de endereços recusou a consulta no momento. Tente de novo mais tarde.'
    );
    this.name = 'ErroNominatim';
    this.status = status;
    this.esperaMs = esperaMs;
  }
}

interface ConfigLimitador {
  intervaloMs: number;
  agora: () => number;
  dormir: (ms: number) => Promise<void>;
}

const CONFIG_PADRAO: ConfigLimitador = {
  intervaloMs: INTERVALO_MINIMO_NOMINATIM_MS,
  agora: () => Date.now(),
  dormir: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

let config: ConfigLimitador = { ...CONFIG_PADRAO };
let ultimaRequisicaoMs = -Infinity;
let bloqueadoAteMs = 0;
let ultimoStatusBloqueio = 429;
let cadeia: Promise<void> = Promise.resolve();

/** Só para testes: troca o relógio/intervalo sem esperar tempo real. */
export function configurarLimitadorNominatim(parcial: Partial<ConfigLimitador>): void {
  config = { ...config, ...parcial };
}

/** Só para testes: volta ao estado de uma sessão recém-aberta. */
export function reiniciarLimitadorNominatim(): void {
  config = { ...CONFIG_PADRAO };
  ultimaRequisicaoMs = -Infinity;
  bloqueadoAteMs = 0;
  ultimoStatusBloqueio = 429;
  cadeia = Promise.resolve();
}

function lerRetryAfterMs(res: Response): number | null {
  const bruto = res.headers?.get?.('Retry-After');
  if (!bruto) return null;
  const segundos = Number(bruto);
  if (!Number.isFinite(segundos) || segundos <= 0) return null; // formato de data HTTP: usa a pausa padrão
  return Math.min(segundos * 1000, PAUSA_MAXIMA_RETRY_AFTER_MS);
}

function recusarSeBloqueado(): void {
  const restante = bloqueadoAteMs - config.agora();
  if (restante > 0) throw new ErroNominatim(ultimoStatusBloqueio, restante);
}

async function executarUma(url: string, init?: RequestInit): Promise<Response> {
  recusarSeBloqueado();

  const espera = ultimaRequisicaoMs + config.intervaloMs - config.agora();
  if (espera > 0) await config.dormir(espera);
  ultimaRequisicaoMs = config.agora();

  const res = await fetch(url, init);

  if (res.status === 429) {
    const esperaMs = lerRetryAfterMs(res) ?? PAUSA_PADRAO_429_MS;
    bloqueadoAteMs = config.agora() + esperaMs;
    ultimoStatusBloqueio = 429;
    throw new ErroNominatim(429, esperaMs);
  }
  if (res.status === 403) {
    bloqueadoAteMs = config.agora() + PAUSA_APOS_403_MS;
    ultimoStatusBloqueio = 403;
    throw new ErroNominatim(403, PAUSA_APOS_403_MS);
  }
  return res;
}

/** Único caminho para o Nominatim: enfileira, espaça e trata 429/403. Outros status voltam como Response. */
export function fetchNominatim(url: string, init?: RequestInit): Promise<Response> {
  const execucao = cadeia.then(() => executarUma(url, init));
  cadeia = execucao.then(
    () => undefined,
    () => undefined
  );
  return execucao;
}
