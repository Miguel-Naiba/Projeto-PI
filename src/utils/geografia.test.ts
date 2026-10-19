import { describe, expect, it } from 'vitest';
import { distanciaM, distanciaPontoSegmentoM, distanciaPontoPolilinhaM } from './geografia';
import { obrasNoCorredorDaRota } from '../services/avaliadorRota';
import type { Obra } from '../types';

const LAT0 = -30.03;
const LON0 = -51.23;
const M_POR_GRAU_LAT = 111320;
const M_POR_GRAU_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

/** Desloca (LAT0, LON0) em `leste`/`norte` metros — só pra montar cenários com distâncias conhecidas. */
function deslocar(leste: number, norte: number): [number, number] {
  return [LAT0 + norte / M_POR_GRAU_LAT, LON0 + leste / M_POR_GRAU_LON];
}

describe('distanciaPontoSegmentoM (Fase A, item C)', () => {
  const a = deslocar(0, 0);
  const b = deslocar(1000, 0);

  it('ponto ao lado do MEIO de um segmento longo mede a distância perpendicular, não até o vértice mais próximo', () => {
    const p = deslocar(500, 10);
    const d = distanciaPontoSegmentoM(p[0], p[1], a[0], a[1], b[0], b[1]);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11);
    // Contraste: até o vértice mais próximo seriam ~500m.
    expect(distanciaM(p[0], p[1], a[0], a[1])).toBeGreaterThan(450);
  });

  it('ponto além da ponta do segmento mede até a ponta (não até a reta infinita)', () => {
    const p = deslocar(1100, 0);
    const d = distanciaPontoSegmentoM(p[0], p[1], a[0], a[1], b[0], b[1]);
    expect(d).toBeGreaterThan(99);
    expect(d).toBeLessThan(101);
  });

  it('ponto sobre o segmento tem distância ~0', () => {
    const p = deslocar(300, 0);
    expect(distanciaPontoSegmentoM(p[0], p[1], a[0], a[1], b[0], b[1])).toBeLessThan(0.5);
  });

  it('segmento degenerado (a == b) mede até o ponto', () => {
    const p = deslocar(30, 40);
    const d = distanciaPontoSegmentoM(p[0], p[1], a[0], a[1], a[0], a[1]);
    expect(d).toBeGreaterThan(49);
    expect(d).toBeLessThan(51);
  });
});

describe('distanciaPontoPolilinhaM (Fase A, item C)', () => {
  it('rota esparsa (só 2 vértices a 1 km um do outro): usuário em cima do trecho, longe dos vértices, está a ~0 m', () => {
    const rota: [number, number][] = [deslocar(0, 0), deslocar(1000, 0)];
    const p = deslocar(500, 0);
    expect(distanciaPontoPolilinhaM(p[0], p[1], rota)).toBeLessThan(0.5);
  });

  it('escolhe o segmento mais próximo numa rota com curva', () => {
    const rota: [number, number][] = [deslocar(0, 0), deslocar(500, 0), deslocar(500, 500)];
    const p = deslocar(510, 250); // ao lado do segundo trecho (vertical)
    const d = distanciaPontoPolilinhaM(p[0], p[1], rota);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11);
  });

  it('polilinha vazia devolve Infinity; com um único ponto devolve a distância até ele', () => {
    expect(distanciaPontoPolilinhaM(LAT0, LON0, [])).toBe(Infinity);
    const unico = deslocar(30, 40);
    const d = distanciaPontoPolilinhaM(LAT0, LON0, [unico]);
    expect(d).toBeGreaterThan(49);
    expect(d).toBeLessThan(51);
  });
});

describe('obrasNoCorredorDaRota — obra entre dois vértices distantes (Fase A, item C)', () => {
  // Geometria esparsa como o ORS devolve em retas longas: só 2 vértices.
  const rotaEsparsa: [number, number][] = [deslocar(0, 0), deslocar(1000, 0)];

  it('encontra a obra a 10 m do meio do trecho, mesmo com os vértices a ~500 m dela', () => {
    const [lat, lon] = deslocar(500, 10);
    const obra: Obra = { id: 'o1', lat, lon, tipo: 'via' };
    expect(obrasNoCorredorDaRota(rotaEsparsa, [obra])).toHaveLength(1);
  });

  it('continua ignorando obra a 100 m do trecho', () => {
    const [lat, lon] = deslocar(500, 100);
    const obra: Obra = { id: 'o2', lat, lon, tipo: 'via' };
    expect(obrasNoCorredorDaRota(rotaEsparsa, [obra])).toHaveLength(0);
  });

  it('ignora obra além da ponta da rota (fora do segmento)', () => {
    const [lat, lon] = deslocar(1200, 0);
    const obra: Obra = { id: 'o3', lat, lon, tipo: 'via' };
    expect(obrasNoCorredorDaRota(rotaEsparsa, [obra])).toHaveLength(0);
  });
});
