import { describe, expect, it } from 'vitest';
import { filtrarValidas, type EntradaObraSmoi } from './obrasSmoi';

// Coordenada real dentro de Porto Alegre, usada nos casos "válidos".
const LAT_POA = -30.03;
const LON_POA = -51.23;

function obra(overrides: Partial<EntradaObraSmoi>): EntradaObraSmoi {
  return {
    id: 'o1',
    nome: 'Obra teste',
    endereco: 'Rua Teste, 123',
    bairro: 'Centro',
    lat: LAT_POA,
    lon: LON_POA,
    precisao: 'cruzamento',
    fonte: 'smoi',
    ...overrides,
  };
}

describe('obrasSmoi — filtrarValidas (PROMPT MESTRE seção 9-13/76/99-101)', () => {
  it('caso 1 — precisao "cruzamento" é reportável', () => {
    expect(filtrarValidas([obra({ precisao: 'cruzamento' })])).toHaveLength(1);
  });

  it('caso 2 — precisao "referencia-isolada" é reportável (nunca deve ser excluída)', () => {
    expect(filtrarValidas([obra({ precisao: 'referencia-isolada' })])).toHaveLength(1);
  });

  it('caso 3 — precisao "via-principal-apenas" é reportável (nunca deve ser excluída)', () => {
    expect(filtrarValidas([obra({ precisao: 'via-principal-apenas' })])).toHaveLength(1);
  });

  it('nenhuma estratégia de geocodificação, sozinha, exclui um registro com coordenada válida', () => {
    const estrategias: EntradaObraSmoi['precisao'][] = ['cruzamento', 'referencia-isolada', 'via-principal-apenas', 'qualquer-coisa-futura'];
    const registros = estrategias.map((precisao, i) => obra({ id: `o${i}`, precisao }));
    expect(filtrarValidas(registros)).toHaveLength(estrategias.length);
  });

  it('caso 4 — sem coordenada (NaN) é excluído, independente da precisao', () => {
    expect(filtrarValidas([obra({ precisao: 'cruzamento', lat: NaN, lon: LON_POA })])).toHaveLength(0);
  });

  it('caso 5 — coordenada fora de Porto Alegre é excluída, independente da precisao', () => {
    // São Paulo — coordenada real, mas fora da caixa de Porto Alegre.
    expect(filtrarValidas([obra({ precisao: 'referencia-isolada', lat: -23.55, lon: -46.63 })])).toHaveLength(0);
  });

  it('cenário do exemplo do prompt: de N registros, só os sem coordenada válida ficam de fora — o resto é reportável, seja qual for a precisao', () => {
    const registros: EntradaObraSmoi[] = [
      obra({ id: '1', precisao: 'cruzamento' }),
      obra({ id: '2', precisao: 'referencia-isolada' }),
      obra({ id: '3', precisao: 'via-principal-apenas' }),
      obra({ id: '4', precisao: 'via-principal-apenas', lat: NaN, lon: NaN }), // sem coordenada
    ];
    const reportaveis = filtrarValidas(registros);
    expect(reportaveis.map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});
