import { describe, expect, it } from 'vitest';
import { buscarNoCatalogo, construirCatalogoOficial } from './catalogoReportar';
import type { Obra, ParadaOnibus, SinalSonoro } from '../types';

const paradas: ParadaOnibus[] = [
  { idParada: 'p1', nomeParada: 'Av. Farrapos, 100', latParada: -30.02, lonParada: -51.2, fontePisoTatil: 'eptc' },
  { idParada: 'p2', nomeParada: 'Av. Ipiranga, 200', latParada: -30.03, lonParada: -51.21, fontePisoTatil: 'osm' },
  { idParada: 'p3', nomeParada: 'Coordenada ruim', latParada: NaN, lonParada: -51.2, fontePisoTatil: 'eptc' },
];

const sinais: SinalSonoro[] = [
  { id: 's1', lat: -30.02, lon: -51.2, nome: 'Farrapos x Voluntários', fonte: 'eptc' },
  { id: 's2', lat: -30.02, lon: -51.2, nome: 'Só no OSM', fonte: 'osm' },
];

const obras: Obra[] = [
  { id: 'o1', lat: -30.02, lon: -51.2, tipo: 'via', nome: 'Obra Farrapos', fonte: 'smoi' },
  { id: 'o2', lat: -30.02, lon: -51.2, tipo: 'via', nome: 'Obra pendente exposta como OSM', fonte: 'osm' },
];

describe('construirCatalogoOficial', () => {
  const catalogo = construirCatalogoOficial(paradas, sinais, obras);

  it('só inclui pontos de fonte oficial (eptc/smoi), nunca OSM', () => {
    expect(catalogo.parada_tatil.map((i) => i.id)).toEqual(['p1']);
    expect(catalogo.botoeira.map((i) => i.id)).toEqual(['s1']);
    expect(catalogo.obra.map((i) => i.id)).toEqual(['o1']);
  });

  it('exclui pontos com coordenada inválida (NaN), mesmo que a fonte seja oficial', () => {
    expect(catalogo.parada_tatil.find((i) => i.id === 'p3')).toBeUndefined();
  });

  it('nunca inclui um ponto OSM no lugar de um oficial (não há substituição)', () => {
    expect(catalogo.botoeira.find((i) => i.id === 's2')).toBeUndefined();
    expect(catalogo.obra.find((i) => i.id === 'o2')).toBeUndefined();
  });
});

describe('buscarNoCatalogo', () => {
  const catalogo = construirCatalogoOficial(paradas, sinais, obras);

  it('busca por texto, ignorando acentos e maiúsculas/minúsculas', () => {
    const resultado = buscarNoCatalogo(catalogo.parada_tatil, 'farrapos');
    expect(resultado.map((i) => i.id)).toEqual(['p1']);
  });

  it('consulta vazia devolve a lista completa (sem filtrar)', () => {
    expect(buscarNoCatalogo(catalogo.obra, '')).toEqual(catalogo.obra);
  });

  it('consulta sem resultado devolve lista vazia, nunca inventa ponto', () => {
    expect(buscarNoCatalogo(catalogo.obra, 'endereço que não existe')).toEqual([]);
  });
});
