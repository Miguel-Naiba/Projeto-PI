import { describe, expect, it } from 'vitest';
import { filtrarValidas, type EntradaBotoeiraEptc } from './botoeirasEptc';

const LAT_POA = -30.03;
const LON_POA = -51.23;

function botoeira(overrides: Partial<EntradaBotoeiraEptc>): EntradaBotoeiraEptc {
  return {
    id: 'b1',
    local: 'Av. Teste × Rua Teste',
    lat: LAT_POA,
    lon: LON_POA,
    dataImplantacao: '2020-01-01',
    nBotoeiras: 2,
    nTravessias: 1,
    fonte: 'eptc',
    ...overrides,
  };
}

describe('botoeirasEptc — filtrarValidas', () => {
  it('mantém registros com coordenada válida dentro de Porto Alegre', () => {
    expect(filtrarValidas([botoeira({})])).toHaveLength(1);
  });

  it('caso 4 — sem coordenada (NaN) é excluído', () => {
    expect(filtrarValidas([botoeira({ lat: NaN, lon: NaN })])).toHaveLength(0);
  });

  it('caso 5 — coordenada fora de Porto Alegre é excluída', () => {
    expect(filtrarValidas([botoeira({ lat: -23.55, lon: -46.63 })])).toHaveLength(0);
  });
});
