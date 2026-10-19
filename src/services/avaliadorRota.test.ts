import { describe, expect, it } from 'vitest';
import {
  compararCandidatas,
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

/**
 * Mesma ideia de `rotaRetaLeste`, mas deslocada `offsetNorteM` pra norte —
 * usada quando o teste precisa de duas candidatas que NÃO compartilham o
 * mesmo corredor (senão uma obra/botoeira "no caminho" de uma acaba caindo
 * perto da outra só porque as duas são retas que passam pelo mesmo lugar).
 * `distanciaM` é um campo independente da geometria (avaliarRota usa
 * `rota.distanciaM` pro custo, não o comprimento real de `coordenadas`), por
 * isso dá pra simular "rota desviando, X metros mais longa" sem precisar
 * desenhar o desvio geometricamente certinho.
 */
function rotaRetaLesteOffset(comprimentoM: number, offsetNorteM: number, passoM = 20): RotaAcessivel {
  const coordenadas: [number, number][] = [];
  for (let d = 0; d <= comprimentoM; d += passoM) coordenadas.push(deslocar(d, offsetNorteM));
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

describe('avaliarRota — ordem lexicográfica de verdade (checklist P4/P0, prioridade: obra > botoeira > piso tátil > distância > tempo)', () => {
  // As candidatas que chegam em avaliarCandidatas já passaram pelo filtro
  // de tolerância (roteamento.ts): nunca distam mais que MAX_DESVIO_ROTA_METROS
  // (100m) entre si. "distânciaMaior" simula o pior caso real: uma rota que
  // evita o problema mas é até 100m mais longa que a que não evita.
  const distanciaMaior = MAX_DESVIO_ROTA_METROS;

  it('botoeira (cobertura total) vence uma rota até 100m mais curta sem cobertura nenhuma — prioridade nº 2 > distância', () => {
    const comBotoeira = rotaRetaLeste(200, 10);
    const botoeiras: SinalSonoro[] = comBotoeira.coordenadas.map(([lat, lon], i) => ({ id: `b${i}`, lat, lon, fonte: 'eptc' }));
    const semNada = rotaRetaLeste(200 - distanciaMaior, 10);

    const avComBotoeira = avaliarRota(comBotoeira, { obras: [], botoeiras, pisoTatil: [] });
    const avSemNada = avaliarRota(semNada, { obras: [], botoeiras: [], pisoTatil: [] });

    expect(avComBotoeira.custo).toBeLessThan(avSemNada.custo);
  });

  it('piso tátil (cobertura total) vence uma rota até 100m mais curta sem cobertura nenhuma — prioridade nº 3 > distância', () => {
    const comTatil = rotaRetaLeste(200, 10);
    const pisoTatil = comTatil.coordenadas.map(([lat, lon]) => ({ lat, lon }));
    const semNada = rotaRetaLeste(200 - distanciaMaior, 10);

    const avComTatil = avaliarRota(comTatil, { obras: [], botoeiras: [], pisoTatil });
    const avSemNada = avaliarRota(semNada, { obras: [], botoeiras: [], pisoTatil: [] });

    expect(avComTatil.custo).toBeLessThan(avSemNada.custo);
  });

  it('botoeira vence piso tátil quando as duas cobrem a MESMA rota por completo — prioridade nº 2 > nº 3', () => {
    const rota = rotaRetaLeste(200, 10);
    const botoeiras: SinalSonoro[] = rota.coordenadas.map(([lat, lon], i) => ({ id: `b${i}`, lat, lon, fonte: 'eptc' }));
    const pisoTatil = rota.coordenadas.map(([lat, lon]) => ({ lat, lon }));

    const soBotoeira = avaliarRota(rota, { obras: [], botoeiras, pisoTatil: [] });
    const soTatil = avaliarRota(rota, { obras: [], botoeiras: [], pisoTatil });

    expect(soBotoeira.custo).toBeLessThan(soTatil.custo);
  });

  it('obra vence mesmo quando a rota com obra é até 100m mais curta E a rota sem obra não tem nenhuma cobertura — prioridade nº 1 > distância, no pior caso real', () => {
    const comObraMaisCurta = rotaRetaLeste(200 - distanciaMaior, 10);
    const obra: Obra = { id: 'o1', lat: deslocar(50, 0)[0], lon: deslocar(50, 0)[1], tipo: 'via' };
    const semObraMaisLonga = rotaRetaLeste(200, 10);

    const avComObra = avaliarRota(comObraMaisCurta, { obras: [obra], botoeiras: [], pisoTatil: [] });
    const avSemObra = avaliarRota(semObraMaisLonga, { obras: [], botoeiras: [], pisoTatil: [] });

    expect(avSemObra.custo).toBeLessThan(avComObra.custo);
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

  it('escolhe a candidata sem obra mesmo sendo até 100m mais longa que a candidata com obra (ordenação real, não só avaliarRota)', () => {
    const comObra = rotaRetaLeste(200, 10); // rota base, mais curta, passa reto pela obra
    const obra: Obra = { id: 'o1', lat: deslocar(50, 0)[0], lon: deslocar(50, 0)[1], tipo: 'via' };
    // Desviada 50m pro norte — fora do corredor de 30m da obra — e
    // MAX_DESVIO_ROTA_METROS mais longa, no limite exato da tolerância.
    const semObra = rotaRetaLesteOffset(200 + MAX_DESVIO_ROTA_METROS, 50, 10);

    const [melhor] = avaliarCandidatas([comObra, semObra], { obras: [obra], botoeiras: [], pisoTatil: [] });
    expect(melhor.distanciaM).toBe(200 + MAX_DESVIO_ROTA_METROS);
    expect(melhor.avaliacao.obrasProximas).toBe(0);
  });

  it('cada candidata avaliada tem a distância dentro da tolerância de 100m se a base for respeitada', () => {
    const base = rotaRetaLeste(500);
    const dentroDoLimite = rotaRetaLeste(500 + MAX_DESVIO_ROTA_METROS);
    const avaliadas = avaliarCandidatas([base, dentroDoLimite], { obras: [], botoeiras: [], pisoTatil: [] });
    expect(avaliadas).toHaveLength(2);
  });
});

describe('avaliarCandidatas — hierarquia entre rotas DIFERENTES no pior caso de +100m (Fase A, item B)', () => {
  // Cenário real do bug: duas candidatas em corredores separados (200m ao
  // norte uma da outra, bem além do raio de 30m). A é a rota com botoeiras e
  // é MAX_DESVIO_ROTA_METROS mais longa; B é a rota com piso tátil, mais curta.
  // Com os pesos antigos (botoeira 200 / piso 150) o custo dava A=900 x B=850
  // (em escala de 1.100m x 1.000m) e o piso tátil vencia — violando
  // botoeira (nº 2) > piso tátil (nº 3).
  function cenario(distanciaB: number, distanciaA: number) {
    const rotaA = rotaRetaLeste(distanciaA, 10); // com botoeiras
    const rotaB = rotaRetaLesteOffset(distanciaB, 200, 10); // com piso tátil
    const botoeiras: SinalSonoro[] = rotaA.coordenadas.map(([lat, lon], i) => ({ id: `b${i}`, lat, lon, fonte: 'eptc' }));
    const pisoTatil = rotaB.coordenadas.map(([lat, lon]) => ({ lat, lon }));
    return { rotaA, rotaB, contexto: { obras: [] as Obra[], botoeiras, pisoTatil } };
  }

  it('botoeira (100%) vence piso tátil (100%) mesmo quando a rota da botoeira é exatamente +100m mais longa', () => {
    const { rotaA, rotaB, contexto } = cenario(1000, 1000 + MAX_DESVIO_ROTA_METROS);
    const [melhor] = avaliarCandidatas([rotaB, rotaA], contexto);
    expect(melhor.avaliacao.coberturaBotoeira).toBeGreaterThan(0.9);
    expect(melhor.distanciaM).toBe(1000 + MAX_DESVIO_ROTA_METROS);
  });

  it('a ordem não depende da posição das candidatas na lista de entrada', () => {
    const { rotaA, rotaB, contexto } = cenario(1000, 1000 + MAX_DESVIO_ROTA_METROS);
    const [m1] = avaliarCandidatas([rotaA, rotaB], contexto);
    const [m2] = avaliarCandidatas([rotaB, rotaA], contexto);
    expect(m1.distanciaM).toBe(m2.distanciaM);
  });

  it('a pontuação exibida é coerente com a escolha: a rota vencedora nunca tem pontuação menor que a perdedora', () => {
    const { rotaA, rotaB, contexto } = cenario(1000, 1000 + MAX_DESVIO_ROTA_METROS);
    const [melhor, pior] = avaliarCandidatas([rotaA, rotaB], contexto);
    expect(melhor.avaliacao.pontuacao).toBeGreaterThanOrEqual(pior.avaliacao.pontuacao);
  });

  it('com diferença de distância de 50m a hierarquia também se mantém', () => {
    const { rotaA, rotaB, contexto } = cenario(1000, 1050);
    const [melhor] = avaliarCandidatas([rotaB, rotaA], contexto);
    expect(melhor.avaliacao.coberturaBotoeira).toBeGreaterThan(0.9);
  });

  it('a margem entre botoeira e piso tátil supera a faixa de empate de 5 unidades do ordenador (sem cair no desempate por duração)', () => {
    const { rotaA, rotaB, contexto } = cenario(1000, 1000 + MAX_DESVIO_ROTA_METROS);
    const avA = avaliarRota(rotaA, contexto);
    const avB = avaliarRota(rotaB, contexto);
    expect(avB.custo - avA.custo).toBeGreaterThan(5);
  });

  it('uma obra no caminho perde mesmo com cobertura TOTAL de botoeira e piso tátil e 100m a menos de distância', () => {
    const comObra = rotaRetaLeste(200, 10);
    const obra: Obra = { id: 'o1', lat: deslocar(100, 0)[0], lon: deslocar(100, 0)[1], tipo: 'via' };
    const botoeiras: SinalSonoro[] = comObra.coordenadas.map(([lat, lon], i) => ({ id: `b${i}`, lat, lon, fonte: 'eptc' }));
    const pisoTatil = comObra.coordenadas.map(([lat, lon]) => ({ lat, lon }));
    const semObra = rotaRetaLesteOffset(200 + MAX_DESVIO_ROTA_METROS, 200, 10);

    const [melhor] = avaliarCandidatas([comObra, semObra], { obras: [obra], botoeiras, pisoTatil });
    expect(melhor.avaliacao.obrasProximas).toBe(0);
  });
});

describe('hierarquia com cobertura parcial e desempates exatos',()=>{
  it('botoeira parcial vence piso tátil total mesmo com +100m e menor nota legada',()=>{
    const a=rotaRetaLeste(1100); const b=rotaRetaLesteOffset(1000,200);
    const [lat,lon]=deslocar(550,0);
    const contexto={obras:[],botoeiras:[{id:'b',lat,lon}],pisoTatil:b.coordenadas.map(([lat,lon])=>({lat,lon}))};
    const [melhor,pior]=avaliarCandidatas([b,a],contexto);
    expect(melhor.coordenadas).toEqual(a.coordenadas);
    expect(melhor.avaliacao.coberturaBotoeira).toBeGreaterThan(0);
    expect(melhor.avaliacao.coberturaBotoeira).toBeLessThan(0.1);
    expect(melhor.avaliacao.pontuacao).toBeGreaterThan(pior.avaliacao.pontuacao);
    expect(avaliarCandidatas([a,b],contexto)[0].coordenadas).toEqual(a.coordenadas);
  });
  it('piso tátil parcial vence menor distância sem confirmação',()=>{
    const a=rotaRetaLeste(1100); const b=rotaRetaLesteOffset(1000,200);
    const [lat,lon]=deslocar(550,0);
    expect(avaliarCandidatas([b,a],{obras:[],botoeiras:[],pisoTatil:[{lat,lon}]})[0].coordenadas).toEqual(a.coordenadas);
  });
  it('pequena diferença de distância conta antes do tempo; empate completo é estável e tem mesma nota',()=>{
    const a={...rotaRetaLeste(1000),duracaoS:500}; const b={...a,distanciaM:1000.01,duracaoS:1};
    const contexto={obras:[],botoeiras:[],pisoTatil:[]};
    expect(avaliarCandidatas([b,a],contexto)[0].distanciaM).toBe(1000);
    const empate=avaliarCandidatas([a,{...a,destino:{...DESTINO,id:'outro'}}],contexto);
    expect(empate.map(r=>r.destino.id)).toEqual(['d1','outro']);
    expect(empate[0].avaliacao.pontuacao).toBe(empate[1].avaliacao.pontuacao);
  });
});


it('diferença mínima real de cobertura decide antes de piso tátil, distância e tempo',()=>{
  const [a,b]=avaliarCandidatas([rotaRetaLeste(1100),rotaRetaLesteOffset(1000,200)],{obras:[],botoeiras:[],pisoTatil:[]});
  a.avaliacao.coberturaBotoeira=0.1000000001; b.avaliacao.coberturaBotoeira=0.1;
  a.avaliacao.coberturaPisoTatil=0; b.avaliacao.coberturaPisoTatil=1;
  a.distanciaM=1100; b.distanciaM=1000; a.duracaoS=1000; b.duracaoS=1;
  expect(compararCandidatas(a,b)).toBeLessThan(0);
  expect(compararCandidatas(b,a)).toBeGreaterThan(0);
});
