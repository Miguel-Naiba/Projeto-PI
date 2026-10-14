import { describe, expect, it } from 'vitest';
import { devePassarThrottle, LIMIAR_THROTTLE_PROXIMIDADE_M } from './useLatLonThrottled';

// Aproximação simples: ~0.00001 grau de latitude ≈ 1.11m, suficiente pra
// montar deslocamentos de teste em metros sem precisar de uma lib de geo.
const LAT0 = -30.034;
const LON0 = -51.217;
function deslocarMetros(m: number): [number, number] {
  return [LAT0 + m * 0.000009, LON0];
}

describe('devePassarThrottle (checklist Fase 3, P9)', () => {
  it('primeira posição conhecida (atual null) sempre passa', () => {
    expect(devePassarThrottle(null, deslocarMetros(0), 75)).toBe(true);
  });

  it('GPS perdido (novo null) sempre passa — precisa propagar "sem posição"', () => {
    expect(devePassarThrottle(deslocarMetros(0), null, 75)).toBe(true);
  });

  it('sem posição antes e continua sem posição — não passa (nada mudou)', () => {
    expect(devePassarThrottle(null, null, 75)).toBe(false);
  });

  it('movimento pequeno (dentro do limiar) não passa — evita recomputar à toa', () => {
    expect(devePassarThrottle(deslocarMetros(0), deslocarMetros(30), LIMIAR_THROTTLE_PROXIMIDADE_M)).toBe(false);
  });

  it('movimento além do limiar passa', () => {
    expect(devePassarThrottle(deslocarMetros(0), deslocarMetros(100), LIMIAR_THROTTLE_PROXIMIDADE_M)).toBe(true);
  });

  it('um limiar customizado bem pequeno (1m) é respeitado — não é um valor fixo escondido', () => {
    expect(devePassarThrottle(deslocarMetros(0), deslocarMetros(30), 1)).toBe(true);
  });
});
