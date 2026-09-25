import { describe, expect, it } from 'vitest';
import { TIPOS, categoriasVisiveis } from './categoriasReportar';

describe('categoriasVisiveis', () => {
  it('sem informação de disponibilidade, mostra todas as categorias (comportamento anterior preservado)', () => {
    expect(categoriasVisiveis(TIPOS)).toEqual(TIPOS);
  });

  it('caso 7 — dataset vazio: categoria some quando marcada como indisponível', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: false });
    expect(visiveis.find((t) => t.tipo === 'obra')).toBeUndefined();
  });

  it('caso 8 — dataset válido: categoria aparece quando marcada como disponível', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: true, botoeira_quebrada: false });
    expect(visiveis.find((t) => t.tipo === 'obra')).toBeDefined();
    expect(visiveis.find((t) => t.tipo === 'botoeira_quebrada')).toBeUndefined();
  });

  it('"rua obstruída" nunca depende de catálogo — continua visível mesmo quando obra/botoeira estão indisponíveis', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: false, botoeira_quebrada: false });
    expect(visiveis.find((t) => t.tipo === 'rua_obstruida')).toBeDefined();
  });

  it('uma categoria ausente do mapa de disponibilidade continua visível (evita sumir botão durante carregamento parcial)', () => {
    const visiveis = categoriasVisiveis(TIPOS, { obra: false });
    expect(visiveis.find((t) => t.tipo === 'botoeira_quebrada')).toBeDefined();
  });
});
