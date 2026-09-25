import { describe, expect, it } from 'vitest';
import {
  avaliarRota,
  avaliarCandidatas,
  obrasNoCorredorDaRota,
  amostrarRotaPorDistancia,
  MAX_DESVIO_ROTA_METROS,
} from './avaliadorRota';
import { bufferPontoPoligono, distanciaM } from '../utils/geografia';
import type { RotaAcessivel, Obra, SinalSonoro, PontoProximidade } from '../types';

// Ponto de partida arbitrário em Porto Alegre, só pra ter uma latitude
// realista (a conversão metros->graus depende da latitude).
const LAT0 = -30.03;
const LON0 = -51.23;
const M_POR_GRAU_LAT = 111320;
const M_POR_GRAU_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

/** Desloca (LAT0, LON0) em `leste`/`norte` metros — só pra montar cenários de teste com distâncias conhecidas. */
function deslocar(leste: number, norte: number): [number, number] {
  return [LAT0 + norte / M_POR_GRAU_LAT, LON0 + leste / M_POR_GRAU_LON];
}

const DESTINO: PontoProximidade = { id: 'd1', tipo: 'destino', nome: 'Destino de teste', lat: LAT0, lon: LON0 };

function rotaRetaLeste(comprimentoM: number, passoM = 20): RotaAcessivel {
  const coordenadas: [number, number][] = [];
  for (let d = 0; d <= comprimentoM; d += passoM) coordenadas.push(deslocar(d, 0));
  return {
    coordenadas,
    etapas: [],
    distanciaM: comprimentoM,
    duracaoS: comprimentoM / 1.2,
    destino: DESTINO,
  };
}

describe('bufferPontoPoligono', () => {
  it('gera um anel fechado com o número de vértices pedido', () => {
    const poligono = bufferPontoPoligono(LAT0, LON0, 20, 8);
    const anel = poligono.coordinates[0];
    expect(anel.length).toBe(9); // 8 lados + ponto de fechamento repetido
    expect(anel[0]).toEqual(anel[anel.length - 1]); // anel fechado
  });

  it('os vértices ficam a aproximadamente o raio pedido do centro', () => {
    const raioM = 25;
    const poligono = bufferPontoPoligono(LAT0, LON0, raioM, 8);
    for (const [lon, lat] of poligono.coordinates[0]) {
      const d = distanciaM(LAT0, LON0, lat, lon);
      expect(d).toBeGreaterThan(raioM * 0.95);
      expect(d).toBeLessThan(raioM * 1.05);
    }
  });
});

describe('obrasNoCorredorDaRota', () => {
  const rota = rotaRetaLeste(200);

  it('encontra obra bem em cima da rota', () => {
    const obra: Obra = { id: 'o1', lat: deslocar(100, 0)[0], lon: deslocar(100, 0)[1], tipo: 'via' };
    expect(obrasNoCorredorDaRota(rota.coordenadas, [obra])).toHaveLength(1);
  });

  it('ignora obra longe da rota', () => {
    const obra: Obra = { id: 'o2', lat: deslocar(100, 500)[0], lon: deslocar(100, 500)[1], tipo: 'via' };
    expect(obrasNoCorredorDaRota(rota.coordenadas, [obra])).toHaveLength(0);
  });

  it('respeita o raio customizado', () => {
    const obra: Obra = { id: 'o3', lat: deslocar(100, 15)[0], lon: deslocar(100, 15)[1], tipo: 'via' };
    expect(obrasNoCorredorDaRota(rota.coordenadas, [obra], 10)).toHaveLength(0);
    expect(obrasNoCorredorDaRota(rota.coordenadas, [obra], 20)).toHaveLength(1);
  });
});

describe('avaliarRota', () => {
  it('rota sem nenhuma obra/botoeira/tátil tem custo igual à distância', () => {
    const rota = rotaRetaLeste(300);
    const avaliacao = avaliarRota(rota, { obras: [], botoeiras: [], pisoTatil: [] });
    expect(avaliacao.custo).toBe(300);
    expect(avaliacao.obrasProximas).toBe(0);
    expect(avaliacao.coberturaBotoeira).toBe(0);
    expect(avaliacao.coberturaPisoTatil).toBe(0);
  });

  it('cada obra no caminho aumenta o custo — prioridade nº 1 do EchoPath', () => {
    const rota = rotaRetaLeste(300);
    const obra: Obra = { id: 'o1', lat: deslocar(150, 0)[0], lon: deslocar(150, 0)[1], tipo: 'via' };
    const semObra = avaliarRota(rota, { obras: [], botoeiras: [], pisoTatil: [] });
    const comObra = avaliarRota(rota, { obras: [obra], botoeiras: [], pisoTatil: [] });
    expect(comObra.custo).toBeGreaterThan(semObra.custo);
    expect(comObra.obrasProximas).toBe(1);
  });

  it('cobertura de botoeira/piso tátil reduz o custo (bônus), nunca abaixo de zero por si só', () => {
    const rota = rotaRetaLeste(200, 10); // pontos a cada 10m -> amostra densa
    const botoeiras: SinalSonoro[] = rota.coordenadas.map(([lat, lon], i) => ({
      id: `b${i}`,
      lat,
      lon,
      fonte: 'eptc',
    }));
    const semCobertura = avaliarRota(rota, { obras: [], botoeiras: [], pisoTatil: [] });
    const comCoberturaTotal = avaliarRota(rota, { obras: [], botoeiras, pisoTatil: [] });
    expect(comCoberturaTotal.coberturaBotoeira).toBeCloseTo(1, 1);
    expect(comCoberturaTotal.custo).toBeLessThan(semCobertura.custo);
  });

  it('uma única obra pesa mais que cobertura total de botoeira e piso tátil juntas', () => {
    // Garante a ordem de prioridade pedida: evitar obra > botoeiras > piso tátil.
    const rota = rotaRetaLeste(200, 10);
    const obra: Obra = { id: 'o1', lat: deslocar(100, 0)[0], lon: deslocar(100, 0)[1], tipo: 'via' };
    const botoeiras: SinalSonoro[] = rota.coordenadas.map(([lat, lon], i) => ({ id: `b${i}`, lat, lon, fonte: 'eptc' }));
    const pisoTatil = rota.coordenadas.map(([lat, lon]) => ({ lat, lon }));

    const comObraSemCobertura = avaliarRota(rota, { obras: [obra], botoeiras: [], pisoTatil: [] });
    const semObraComCoberturaTotal = avaliarRota(rota, { obras: [], botoeiras, pisoTatil });

    expect(semObraComCoberturaTotal.custo).toBeLessThan(comObraSemCobertura.custo);
  });
});

describe('amostrarRotaPorDistancia', () => {
  it('o número de amostras acompanha a distância total, não a quantidade de vértices originais', () => {
    // 300m com vértices MUITO desiguais: densos nos primeiros 30m (2 em 2m),
    // depois um único segmento reto de 270m sem vértice nenhum no meio —
    // como o ORS costuma devolver (denso em curva, esparso em reta).
    const coordenadas: [number, number][] = [];
    for (let d = 0; d <= 30; d += 2) coordenadas.push(deslocar(d, 0));
    coordenadas.push(deslocar(300, 0));

    const amostras = amostrarRotaPorDistancia(coordenadas, 15);
    // ~300/15 + 1 = 21 amostras — não os 17 vértices originais.
    expect(amostras.length).toBeGreaterThanOrEqual(19);
    expect(amostras.length).toBeLessThanOrEqual(23);
  });

  it('mantém o passo aproximadamente constante mesmo cruzando vários vértices originais', () => {
    const coordenadas: [number, number][] = [];
    for (let d = 0; d <= 100; d += 3) coordenadas.push(deslocar(d, 0)); // vértices ddesalinhados do passo de amostragem
    const amostras = amostrarRotaPorDistancia(coordenadas, 10);
    for (let i = 1; i < amostras.length - 1; i++) {
      const passo = distanciaM(amostras[i - 1].lat, amostras[i - 1].lon, amostras[i].lat, amostras[i].lon);
      expect(passo).toBeCloseTo(10, 0);
    }
  });
});

describe('avaliarRota — cobertura por distância, não por vértice', () => {
  it('não superestima cobertura só porque um trecho pequeno tem vértices densos', () => {
    // Réplica do cenário acima: só os primeiros 30m (de 300m) têm botoeira
    // por perto. Cobertura REAL é ~10%. Contando por vértice bruto (forma
    // antiga), os ~16 vértices densos desse trecho dominariam a amostra e
    // dariam uma cobertura beirando 90%+, mesmo cobrindo só 10% da caminhada.
    const coordenadas: [number, number][] = [];
    for (let d = 0; d <= 30; d += 2) coordenadas.push(deslocar(d, 0));
    coordenadas.push(deslocar(300, 0));
    const rota: RotaAcessivel = { coordenadas, etapas: [], distanciaM: 300, duracaoS: 250, destino: DESTINO };

    const botoeira: SinalSonoro = { id: 'b1', lat: deslocar(15, 0)[0], lon: deslocar(15, 0)[1], fonte: 'eptc' };
    const avaliacao = avaliarRota(rota, { obras: [], botoeiras: [botoeira], pisoTatil: [] });

    // Fração ingênua por vértice bruto (17 vértices, ~16 dentro do raio de 30m da botoeira) pra contraste:
    const coberturaPorVerticeIngenua = 16 / 17;
    expect(avaliacao.coberturaBotoeira).toBeLessThan(coberturaPorVerticeIngenua / 2);
  });
});

describe('avaliarCandidatas', () => {
  it('escolhe a rota com menor custo primeiro', () => {
    const curta = rotaRetaLeste(200);
    const longa = rotaRetaLeste(280);
    const [melhor] = avaliarCandidatas([longa, curta], { obras: [], botoeiras: [], pisoTatil: [] });
    expect(melhor.distanciaM).toBe(200);
  });

  it('com custo praticamente igual, desempata pela menor duração', () => {
    const a: RotaAcessivel = { ...rotaRetaLeste(200), duracaoS: 200 };
    const b: RotaAcessivel = { ...rotaRetaLeste(200), duracaoS: 150 };
    const [melhor] = avaliarCandidatas([a, b], { obras: [], botoeiras: [], pisoTatil: [] });
    expect(melhor.duracaoS).toBe(150);
  });

  it('cada candidata avaliada tem a distância dentro da tolerância de 100m se a base for respeitada', () => {
    const base = rotaRetaLeste(500);
    const dentroDoLimite = rotaRetaLeste(500 + MAX_DESVIO_ROTA_METROS);
    const avaliadas = avaliarCandidatas([base, dentroDoLimite], { obras: [], botoeiras: [], pisoTatil: [] });
    expect(avaliadas).toHaveLength(2);
  });
});
