import { useEffect, useRef } from 'react';

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dado o Tab (ou Shift+Tab) apertado com `ativo` focado no momento, devolve
 * o elemento pro qual o foco deve pular pra ciclar DENTRO do modal (preso
 * entre o primeiro e o último elemento focável), ou `null` quando o Tab não
 * precisa ser interceptado (o navegador já vai mover o foco certo sozinho).
 * Função pura e genérica (não depende de DOM real) pra dar pra testar o
 * algoritmo do focus trap sem jsdom — ver checklist Fase 3, P8.
 */
export function proximoFocoNoTrap<T>(focaveis: T[], ativo: T | null, comShift: boolean): T | null {
  if (focaveis.length === 0) return null;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (comShift && ativo === primeiro) return ultimo;
  if (!comShift && ativo === ultimo) return primeiro;
  return null;
}

/**
 * Comportamento de acessibilidade compartilhado pelos 4 modais do app
 * (Reportar, Autenticação, Configurações, Sobre) — checklist Fase 3, P8:
 *   - foco inicial no título ao abrir;
 *   - Escape fecha;
 *   - focus trap: Tab/Shift+Tab nunca escapa do modal;
 *   - devolução de foco: ao fechar (ou desmontar — caso do Reportar, que o
 *     pai desmonta em vez de passar `aberto=false`), o foco volta pro
 *     elemento que estava focado antes de abrir.
 *
 * `aberto` pode ser sempre `true` para um componente que só existe montado
 * enquanto está aberto (padrão do Reportar.tsx) — a devolução de foco
 * acontece de qualquer forma na limpeza do effect, que o React roda tanto
 * numa transição `aberto: true → false` quanto no desmonte do componente.
 */
export function useFocoModal(aberto: boolean, aoFechar: () => void) {
  const refTitulo = useRef<HTMLHeadingElement>(null);
  const refModal = useRef<HTMLDivElement>(null);

  // Foco inicial + devolução de foco (ver docstring acima — um efeito só,
  // porque a limpeza do React cobre os dois casos que importam: fechar e
  // desmontar).
  useEffect(() => {
    if (!aberto) return;
    const elementoAnterior = document.activeElement as HTMLElement | null;
    refTitulo.current?.focus();
    return () => {
      elementoAnterior?.focus();
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const lidarComTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', lidarComTecla);
    return () => window.removeEventListener('keydown', lidarComTecla);
  }, [aberto, aoFechar]);

  useEffect(() => {
    if (!aberto) return;
    const lidarComTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !refModal.current) return;
      const focaveis = Array.from(refModal.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(
        (el) => el.offsetParent !== null
      );
      const destino = proximoFocoNoTrap(focaveis, document.activeElement as HTMLElement | null, e.shiftKey);
      if (destino) {
        e.preventDefault();
        destino.focus();
      }
    };
    window.addEventListener('keydown', lidarComTab);
    return () => window.removeEventListener('keydown', lidarComTab);
  }, [aberto]);

  return { refTitulo, refModal };
}
