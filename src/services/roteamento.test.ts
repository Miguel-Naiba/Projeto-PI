import { afterEach, describe, expect, it, vi } from 'vitest';
import { calcularRotaAcessivel, filtrarDentroDaTolerancia } from './roteamento';
import { geojsonValido } from './fixturesRota.test-utils';
import { buscarDadosAcessibilidade } from './osm';
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

describe('precisão da tolerância',()=>{
  it('absorve só arredondamento binário, não +100,01m',()=>{
    expect(filtrarDentroDaTolerancia(rota(0.1),[rota(100.10000000000001)])).toHaveLength(1);
    expect(filtrarDentroDaTolerancia(rota(0.1),[rota(100.11)])).toHaveLength(0);
  });
});


describe('pipeline ORS real com transporte simulado',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  const contexto={obras:[],botoeiras:[],pisoTatil:[]};
  const origem: [number,number]=[-30.03,-51.23];
  function resposta(distancia=100) {
    const dados=geojsonValido(); dados.features[0].properties.summary.distance=distancia;
    return new Response(JSON.stringify(dados));
  }
  it('converte GeoJSON para Leaflet, mantém base e limita candidatas a +100m',async()=>{
    const f=vi.fn().mockResolvedValueOnce(resposta()).mockResolvedValueOnce(resposta(201)); vi.stubGlobal('fetch',f);
    const rota=await calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto);
    expect(rota.distanciaM).toBe(100); expect(rota.coordenadas).toEqual([[-30.03,-51.23],[-30.03,-51.229]]);
    expect(rota.etapas[0]).toMatchObject({instrucao:'Siga em frente',lat:-30.03,lon:-51.23});
    expect(f).toHaveBeenCalledTimes(2);
  });
  it.each([401,403,429,504])('base falha HTTP %d sem alternativas e sem sucesso falso',async status=>{
    const f=vi.fn().mockResolvedValue(new Response('{}',{status})); vi.stubGlobal('fetch',f);
    await expect(calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto)).rejects.toMatchObject({status});
    expect(f).toHaveBeenCalledTimes(1);
  });
  it.each([401,403,429,504,400])('alternativas falham HTTP %d sem repetir chamada idêntica',async status=>{
    const f=vi.fn().mockResolvedValueOnce(resposta()).mockResolvedValueOnce(new Response('{}',{status})); vi.stubGlobal('fetch',f);
    await expect(calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto)).resolves.toMatchObject({distanciaM:100,limitacao:expect.stringMatching(/alternativas/)});
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('400 com polígono permite uma única tentativa sem polígono',async()=>{
    const f=vi.fn().mockResolvedValueOnce(resposta()).mockResolvedValueOnce(new Response('{}',{status:400})).mockResolvedValueOnce(resposta()); vi.stubGlobal('fetch',f);
    const ctx={...contexto,obras:[{id:'obra',lat:-30.03,lon:-51.2295,tipo:'via' as const}]};
    const resultado=await calcularRotaAcessivel(origem,DESTINO,'token-teste',ctx);
    expect(resultado.avaliacao.obrasProximas).toBe(1);
    expect(JSON.parse(f.mock.calls[1][1].body).options.avoid_polygons.type).toBe('MultiPolygon');
    expect(JSON.parse(f.mock.calls[2][1].body).options).toBeUndefined(); expect(f).toHaveBeenCalledTimes(3);
  });
  it('cancelar alternativas não retorna a base como novo sucesso',async()=>{
    const controle=new AbortController();
    const f=vi.fn().mockResolvedValueOnce(resposta()).mockImplementationOnce((_url,init)=>new Promise((_resolve,reject)=>{
      controle.abort(); reject(init.signal.reason);
    })); vi.stubGlobal('fetch',f);
    await expect(calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto,'foot-walking',controle.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('base inválida não produz rota; alternativa inválida preserva base validada',async()=>{
    const f=vi.fn().mockResolvedValueOnce(new Response('{}')); vi.stubGlobal('fetch',f);
    await expect(calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto)).rejects.toMatchObject({tipo:'resposta'});
    f.mockResolvedValueOnce(resposta()).mockResolvedValueOnce(new Response('{}'));
    await expect(calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto)).resolves.toMatchObject({distanciaM:100});
  });
  it('falha simultânea das duas instâncias Overpass não impede rota ORS independente',async()=>{
    const f=vi.fn().mockImplementation(async (url:string)=>{
      if(url.includes('overpass')) return new Response('{}',{status:500});
      return resposta();
    }); vi.stubGlobal('fetch',f);
    const [osm,ors]=await Promise.allSettled([buscarDadosAcessibilidade(-30,-51),calcularRotaAcessivel(origem,DESTINO,'token-teste',contexto)]);
    expect(osm.status).toBe('rejected'); expect(ors.status).toBe('fulfilled');
    if(ors.status==='fulfilled') expect(ors.value.coordenadas.length).toBeGreaterThanOrEqual(2);
    expect(f.mock.calls.filter(([url])=>url.includes('overpass'))).toHaveLength(2);
    expect(f.mock.calls.filter(([url])=>url.startsWith('https://api.heigit.org/'))).toHaveLength(2);
  });
});
