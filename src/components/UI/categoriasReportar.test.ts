import { describe, expect, it } from 'vitest';
import { TIPOS, categoriasVisiveis } from './categoriasReportar';

describe('categoriasReportar — catálogo oficial (Fase 3)', () => {
  it('existem exatamente 3 categorias, com os rótulos e tipos oficiais', () => {
    expect(TIPOS.map((t) => t.tipo)).toEqual(['parada_tatil', 'botoeira', 'obra']);
    expect(TIPOS.find((t) => t.tipo === 'parada_tatil')?.rotulo).toBe('Parada com piso tátil');
  });

  it('nenhuma categoria usa "Piso tátil" isolado como rótulo', () => {
    const rotulos = TIPOS.map((t) => t.rotulo);
    expect(rotulos).not.toContain('Piso tátil');
  });

  it('nomenclaturas legadas (botoeira_quebrada, rua_obstruida) não existem mais no catálogo', () => {
    const tipos = TIPOS.map((t) => t.tipo as string);
    expect(tipos).not.toContain('botoeira_quebrada');
    expect(tipos).not.toContain('rua_obstruida');
  });
});

describe('categoriasVisiveis', () => {
  it('sem informação de disponibilidade, mostra todas as categorias (comportamento anterior preservado)', () => {
    expect(categoriasVisiveis(TIPOS)).toEqual(TIPOS);
  });

  it('caso 7 — dataset vazio: categoria some quando marcada como indisponível', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: false });
    expect(visiveis.find((t) => t.tipo === 'obra')).toBeUndefined();
  });

  it('caso 8 — dataset válido: categoria aparece quando marcada como disponível', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: true, botoeira: false });
    expect(visiveis.find((t) => t.tipo === 'obra')).toBeDefined();
    expect(visiveis.find((t) => t.tipo === 'botoeira')).toBeUndefined();
  });

  it('"Parada com piso tátil" some quando o catálogo de paradas está vazio', () => {
    const visiveis = categoriasVisiveis(TIPOS, { parada_tatil: false, obra: true, botoeira: true });
    expect(visiveis.find((t) => t.tipo === 'parada_tatil')).toBeUndefined();
    expect(visiveis.find((t) => t.tipo === 'obra')).toBeDefined();
  });

  it('uma categoria ausente do mapa de disponibilidade continua visível (evita sumir botão durante carregamento parcial)', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: false });
    expect(visiveis.find((t) => t.tipo === 'botoeira')).toBeDefined();
    expect(visiveis.find((t) => t.tipo === 'parada_tatil')).toBeDefined();
  });
});
