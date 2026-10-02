import { describe, expect, it } from 'vitest';
import { filtrarDentroDaTolerancia } from './roteamento';
import { MAX_DESVIO_ROTA_METROS } from './avaliadorRota';
import type { PontoProximidade, RotaAcessivel } from '../types';

const DESTINO: PontoProximidade = { id: 'd1', tipo: 'destino', nome: 'Destino de teste', lat: -30.03, lon: -51.23 };

function rota(distanciaM: number): RotaAcessivel {
  return { coordenadas: [], etapas: [], distanciaM, duracaoS: distanciaM / 1.2, destino: DESTINO };
}

describe('filtrarDentroDaTolerancia — regra de +100m (checklist Fase 3, item 5)', () => {
  const base = rota(1000);

  it('a constante de tolerância é exatamente 100m', () => {
    expect(MAX_DESVIO_ROTA_METROS).toBe(100);
  });

  it.each([20, 50, 99, 100])('aceita uma candidata com +%dm sobre a base', (desvio) => {
    const candidata = rota(base.distanciaM + desvio);
    const resultado = filtrarDentroDaTolerancia(base, [candidata]);
    expect(resultado).toHaveLength(1);
  });

  it('rejeita uma candidata com +101m sobre a base', () => {
    const candidata = rota(base.distanciaM + 101);
    const resultado = filtrarDentroDaTolerancia(base, [candidata]);
    expect(resultado).toHaveLength(0);
  });

  it('o limite é inclusivo: exatamente +100m passa, +100.01m não', () => {
    expect(filtrarDentroDaTolerancia(base, [rota(base.distanciaM + 100)])).toHaveLength(1);
    expect(filtrarDentroDaTolerancia(base, [rota(base.distanciaM + 100.01)])).toHaveLength(0);
  });

  it('uma candidata mais curta que a base nunca é rejeitada pela tolerância', () => {
    expect(filtrarDentroDaTolerancia(base, [rota(base.distanciaM - 500)])).toHaveLength(1);
  });

  it('filtra corretamente dentro de um conjunto misto de candidatas', () => {
    const candidatas = [rota(base.distanciaM + 20), rota(base.distanciaM + 100), rota(base.distanciaM + 101), rota(base.distanciaM + 500)];
    const resultado = filtrarDentroDaTolerancia(base, candidatas);
    expect(resultado.map((r) => r.distanciaM)).toEqual([base.distanciaM + 20, base.distanciaM + 100]);
  });
});
