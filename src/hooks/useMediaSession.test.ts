import { describe, expect, it, vi } from 'vitest';
import { mapaAcoesMediaSession } from './useMediaSession';

describe('mapaAcoesMediaSession — ligação fone/headset (checklist Fase 9, item 23)', () => {
  it('"play" chama tocar(), "pause" chama pausar()', () => {
    const tocar = vi.fn();
    const pausar = vi.fn();
    const mapa = mapaAcoesMediaSession({ tocar, pausar });
    mapa.play?.();
    mapa.pause?.();
    expect(tocar).toHaveBeenCalledTimes(1);
    expect(pausar).toHaveBeenCalledTimes(1);
  });

  it('"previoustrack" abre o Reportar (faixaAnterior), "nexttrack" repete a instrução (proximaFaixa)', () => {
    const faixaAnterior = vi.fn();
    const proximaFaixa = vi.fn();
    const mapa = mapaAcoesMediaSession({ faixaAnterior, proximaFaixa });
    mapa.previoustrack?.();
    mapa.nexttrack?.();
    expect(faixaAnterior).toHaveBeenCalledTimes(1);
    expect(proximaFaixa).toHaveBeenCalledTimes(1);
  });

  it('ação sem handler correspondente não aparece no mapa (nada de handler fantasma)', () => {
    const mapa = mapaAcoesMediaSession({ tocar: vi.fn() });
    expect(mapa.pause).toBeUndefined();
    expect(mapa.previoustrack).toBeUndefined();
    expect(mapa.nexttrack).toBeUndefined();
  });

  it('nenhuma ação passada → mapa vazio, nenhuma chamada', () => {
    const mapa = mapaAcoesMediaSession({});
    expect(Object.keys(mapa)).toHaveLength(0);
  });
});
