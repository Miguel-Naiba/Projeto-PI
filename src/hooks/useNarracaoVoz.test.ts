import { describe, expect, it } from 'vitest';
import { volumeParaPrioridade } from './useNarracaoVoz';

describe('volumeParaPrioridade — volumes separados de narração e alertas (checklist Fase 9, item 13)', () => {
  it('prioridade "info" usa o volume de narração', () => {
    expect(volumeParaPrioridade('info', 0.4, 1)).toBe(0.4);
  });

  it('prioridade "alerta" usa o volume de alertas, não o de narração', () => {
    expect(volumeParaPrioridade('alerta', 0.4, 0.9)).toBe(0.9);
  });

  it('os dois volumes são independentes — mudar um não afeta o outro', () => {
    expect(volumeParaPrioridade('info', 0.2, 0.8)).toBe(0.2);
    expect(volumeParaPrioridade('alerta', 0.2, 0.8)).toBe(0.8);
  });

  it('valores fora de 0-1 são limitados (clamp), nunca estouram o volume real', () => {
    expect(volumeParaPrioridade('info', 1.5, 1)).toBe(1);
    expect(volumeParaPrioridade('info', -0.5, 1)).toBe(0);
  });
});
