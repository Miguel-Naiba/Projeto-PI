import { describe, expect, it } from 'vitest';
import { chaveDoLocal, ehPontoValido } from './useLocaisSalvos';

describe('chaveDoLocal — identidade de um favorito (checklist Fase 3, P6)', () => {
  it('duas coordenadas idênticas geram a mesma chave', () => {
    expect(chaveDoLocal({ lat: -30.0346, lon: -51.2177 })).toBe(chaveDoLocal({ lat: -30.0346, lon: -51.2177 }));
  });

  it('coordenadas diferentes geram chaves diferentes', () => {
    expect(chaveDoLocal({ lat: -30.0346, lon: -51.2177 })).not.toBe(chaveDoLocal({ lat: -30.03, lon: -51.21 }));
  });

  it('dois resultados de busca com o mesmo "id" efêmero (geo-0) mas coordenadas diferentes NÃO colidem', () => {
    // geo-0/geo-1 são reatribuídos a cada busca nova — a chave real de um
    // favorito nunca pode depender desse id, só da coordenada.
    const resultadoBuscaA = { id: 'geo-0', tipo: 'destino' as const, nome: 'Rua A', lat: -30.01, lon: -51.1 };
    const resultadoBuscaB = { id: 'geo-0', tipo: 'destino' as const, nome: 'Rua B', lat: -30.02, lon: -51.2 };
    expect(chaveDoLocal(resultadoBuscaA)).not.toBe(chaveDoLocal(resultadoBuscaB));
  });
});

describe('ehPontoValido — validação defensiva ao ler do localStorage (checklist Fase 3, P6)', () => {
  it('aceita um PontoProximidade bem formado', () => {
    expect(ehPontoValido({ id: 'p1', tipo: 'parada_tatil', nome: 'Parada X', lat: -30.03, lon: -51.21 })).toBe(true);
  });

  it('rejeita lat/lon ausentes ou não-numéricos', () => {
    expect(ehPontoValido({ id: 'p1', tipo: 'obra', nome: 'X', lat: '−30.03', lon: -51.21 })).toBe(false);
    expect(ehPontoValido({ id: 'p1', tipo: 'obra', nome: 'X', lon: -51.21 })).toBe(false);
  });

  it('rejeita lat/lon infinito ou NaN (dado corrompido, nunca inventa um valor substituto)', () => {
    expect(ehPontoValido({ id: 'p1', tipo: 'obra', nome: 'X', lat: NaN, lon: -51.21 })).toBe(false);
    expect(ehPontoValido({ id: 'p1', tipo: 'obra', nome: 'X', lat: Infinity, lon: -51.21 })).toBe(false);
  });

  it('rejeita nome/id/tipo ausentes', () => {
    expect(ehPontoValido({ tipo: 'obra', nome: 'X', lat: 1, lon: 2 })).toBe(false);
  });

  it('rejeita null, undefined, string, array', () => {
    expect(ehPontoValido(null)).toBe(false);
    expect(ehPontoValido(undefined)).toBe(false);
    expect(ehPontoValido('local')).toBe(false);
    expect(ehPontoValido([1, 2, 3])).toBe(false);
  });
});
