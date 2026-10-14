import { useEffect, useRef } from 'react';

export interface AcoesMediaSession {
  /** Botão "play" do fone/headset — retomar a narração pausada. */
  tocar?: () => void;
  /** Botão "pause" — pausar a fala em andamento. */
  pausar?: () => void;
  /** Botão "anterior" — abrir o Reportar (ação rápida, não "voltar no tempo"). */
  faixaAnterior?: () => void;
  /** Botão "próximo" — repetir a última instrução/anúncio falado. */
  proximaFaixa?: () => void;
}

const ACOES: { acao: MediaSessionAction; chave: keyof AcoesMediaSession }[] = [
  { acao: 'play', chave: 'tocar' },
  { acao: 'pause', chave: 'pausar' },
  { acao: 'previoustrack', chave: 'faixaAnterior' },
  { acao: 'nexttrack', chave: 'proximaFaixa' },
];

/**
 * Monta o mapa ação→handler que vai pra `navigator.mediaSession`. Extraída
 * como função pura (checklist Fase 9, item 23) pra dar pra testar a
 * ligação "play/pause/anterior/próximo → narração/Reportar/repetir" sem
 * precisar de um `navigator.mediaSession` real nem de DOM.
 */
export function mapaAcoesMediaSession(acoes: AcoesMediaSession): Partial<Record<MediaSessionAction, () => void>> {
  const mapa: Partial<Record<MediaSessionAction, () => void>> = {};
  for (const { acao, chave } of ACOES) {
    const handler = acoes[chave];
    if (handler) mapa[acao] = handler;
  }
  return mapa;
}

/**
 * Integração com a Media Session API (controles de mídia do sistema —
 * fone Bluetooth, tela de bloqueio, teclas multimídia do teclado). Nunca
 * usa Web Bluetooth (seria outra API, pra outro propósito — pareamento
 * direto, não controles de mídia) e nunca promete suporte universal: cada
 * `setActionHandler` é tentado individualmente dentro de um try/catch,
 * porque nem todo navegador suporta toda ação (ex.: suporte a
 * `previoustrack`/`nexttrack` varia bastante entre Chrome/Safari/Firefox,
 * desktop/Android/iOS) — uma ação não suportada simplesmente não é
 * registrada, sem quebrar as outras nem lançar erro pro resto do app.
 * `suportado` reflete só se a API existe neste navegador, não se CADA ação
 * específica vai funcionar — isso só dá pra confirmar testando no
 * aparelho/fone de verdade (ver roteiro de validação manual no changelog).
 */
export function useMediaSession(acoes: AcoesMediaSession): { suportado: boolean } {
  const suportado = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  const refAcoes = useRef(acoes);

  useEffect(() => {
    refAcoes.current = acoes;
  }, [acoes]);

  useEffect(() => {
    if (!suportado) return;
    const mediaSession = navigator.mediaSession;

    for (const { acao, chave } of ACOES) {
      try {
        mediaSession.setActionHandler(acao, () => {
          refAcoes.current[chave]?.();
        });
      } catch {
        // Ação não suportada neste navegador — tentar/ignorar é o padrão
        // recomendado pela própria especificação da Media Session API.
      }
    }

    return () => {
      for (const { acao } of ACOES) {
        try {
          mediaSession.setActionHandler(acao, null);
        } catch {
          // idem
        }
      }
    };
  }, [suportado]);

  return { suportado };
}
