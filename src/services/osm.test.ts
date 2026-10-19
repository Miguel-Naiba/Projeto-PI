import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarDadosAcessibilidade } from './osm';
import { PRAZO_OVERPASS_MS } from './requisicao';
const resposta = (elements: unknown[]) => new Response(JSON.stringify({ elements }), {status: 200});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Overpass — contrato de consulta e geometria', () => {
  it('envia QL com out body center e formulário data', async () => {
    const f=vi.fn().mockResolvedValue(resposta([])); vi.stubGlobal('fetch',f);
    await buscarDadosAcessibilidade(-30,-51);
    const init=f.mock.calls[0][1]; const q=new URLSearchParams(init.body).get('data');
    expect(q).toContain('out body center;'); expect(q).toContain('(around:1200,-30,-51)');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('preserva nodes com coordenadas e centros de ways e relations', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(resposta([
      {type:'node',id:1,lat:-30,lon:-51,tags:{tactile_paving:'yes'}},
      {type:'node',id:2,lat:-30.01,lon:-51.01,tags:{'traffic_signals:sound':'yes'}},
      {type:'way',id:3,center:{lat:-30.02,lon:-51.02},tags:{highway:'construction'}},
      {type:'relation',id:4,center:{lat:-30.03,lon:-51.03},tags:{construction:'yes'}},
    ])));
    const d=await buscarDadosAcessibilidade(-30,-51);
    expect(d.pontosPisoTatil).toEqual([{idOsm:1,lat:-30,lon:-51}]);
    expect(d.sinaisSonoros[0]).toMatchObject({idOsm:2,lat:-30.01,lon:-51.01,fonte:'osm'});
    expect(d.obras).toMatchObject([{idOsm:3,lat:-30.02,lon:-51.02},{idOsm:4,lat:-30.03,lon:-51.03}]);
  });
  it('ignora nodes, ways, relations e registros sem geometria válida sem inventar posições', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(resposta([
      null, {}, {type:'node',id:1,tags:{tactile_paving:'yes'}},
      {type:'node',id:2,lat:null,lon:-51,tags:{tactile_paving:'yes'}},
      {type:'node',id:3,lat:'-30',lon:-51,tags:{tactile_paving:'yes'}},
      {type:'way',id:4,center:{lat:91,lon:-51},tags:{construction:'yes'}},
      {type:'way',id:5,tags:{construction:'yes'}},
      {type:'relation',id:6,center:{lat:-30,lon:181},tags:{construction:'yes'}},
      {type:'relation',id:7,tags:{construction:'yes'}},
      {type:'node',id:8,lat:-30,lon:-51,tags:42},
    ])));
    expect(await buscarDadosAcessibilidade(-30,-51)).toMatchObject({pontosPisoTatil:[],sinaisSonoros:[],obras:[]});
  });
  it.each([406,500])('HTTP %d usa no máximo a segunda instância e propaga falha total', async status => {
    const f=vi.fn().mockImplementation(async () => new Response('',{status})); vi.stubGlobal('fetch',f);
    await expect(buscarDadosAcessibilidade(-30,-51)).rejects.toThrow(`HTTP ${status}`);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('rede/CORS não é mascarada como sucesso vazio', async () => {
    const f=vi.fn().mockRejectedValue(new TypeError('Failed to fetch')); vi.stubGlobal('fetch',f);
    await expect(buscarDadosAcessibilidade(-30,-51)).rejects.toThrow('Failed to fetch');
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('falha da primeira instância permite resultado da segunda', async () => {
    const f=vi.fn().mockResolvedValueOnce(new Response('',{status:500})).mockResolvedValueOnce(resposta([])); vi.stubGlobal('fetch',f);
    await expect(buscarDadosAcessibilidade(-30,-51)).resolves.toHaveProperty('buscadoEm'); expect(f).toHaveBeenCalledTimes(2);
  });
  it.each([{elements:[] ,remark:'runtime error: Query timed out'}, {}, {elements:'invalido'}])('rejeita resposta incompleta %#', async corpo => {
    vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify(corpo))));
    await expect(buscarDadosAcessibilidade(-30,-51)).rejects.toThrow(/inválida|incompleta/);
  });
  it('timeout limita ambas instâncias, cancelamento externo não inicia fallback', async () => {
    vi.useFakeTimers();
    const f=vi.fn((_url, init) => new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason)))); vi.stubGlobal('fetch',f);
    const p=buscarDadosAcessibilidade(-30,-51); const e=expect(p).rejects.toMatchObject({name:'TimeoutError'});
    await vi.advanceTimersByTimeAsync(PRAZO_OVERPASS_MS*2); await e; expect(f).toHaveBeenCalledTimes(2);
    const controle=new AbortController(); const outra=buscarDadosAcessibilidade(-30,-51,1200,controle.signal);
    const cancelada=expect(outra).rejects.toMatchObject({name:'AbortError'}); controle.abort(); await cancelada;
    expect(f).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });
});
