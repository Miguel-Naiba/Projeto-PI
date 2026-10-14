import { describe, expect, it } from 'vitest';
import { proximoFocoNoTrap } from './useFocoModal';

describe('proximoFocoNoTrap — focus trap dos modais (checklist Fase 3, P8)', () => {
  const foco = ['titulo', 'campo1', 'campo2', 'botaoFechar'];

  it('Tab no último elemento focável volta pro primeiro (cicla pra frente)', () => {
    expect(proximoFocoNoTrap(foco, 'botaoFechar', false)).toBe('titulo');
  });

  it('Shift+Tab no primeiro elemento focável vai pro último (cicla pra trás)', () => {
    expect(proximoFocoNoTrap(foco, 'titulo', true)).toBe('botaoFechar');
  });

  it('Tab num elemento do meio não intercepta — o navegador já move certo sozinho', () => {
    expect(proximoFocoNoTrap(foco, 'campo1', false)).toBeNull();
    expect(proximoFocoNoTrap(foco, 'campo2', true)).toBeNull();
  });

  it('nada focado (null) não é nem primeiro nem último — não intercepta', () => {
    expect(proximoFocoNoTrap(foco, null, false)).toBeNull();
  });

  it('lista vazia de focáveis — nunca intercepta (evita travar o teclado)', () => {
    expect(proximoFocoNoTrap([], 'qualquer', false)).toBeNull();
  });

  it('um único elemento focável: Tab e Shift+Tab ciclam nele mesmo', () => {
    expect(proximoFocoNoTrap(['unico'], 'unico', false)).toBe('unico');
    expect(proximoFocoNoTrap(['unico'], 'unico', true)).toBe('unico');
  });
});
