import { describe, expect, it, vi } from 'vitest';
import { ControleSolicitacaoRota } from './controleSolicitacaoRota';
import type { EstadoSolicitacaoRota } from './controleSolicitacaoRota';
import type { RotaCandidata } from './avaliadorRota';
import type { PontoProximidade } from '../types';
const destino: PontoProximidade = {id: 'a', tipo: 'destino', nome: 'A', lat: -30, lon: -51};
const contexto = {obras: [], botoeiras: [], pisoTatil: []};
const origem: [number, number] = [-30.1, -51.1];
function rota(id: string): RotaCandidata {
  return { coordenadas: [origem, [-30, -51]], distanciaM: 100, duracaoS: 80, etapas: [], destino: {...destino, id},
    avaliacao: {custo: 100, pontuacao: 100, obrasProximas: 0, coberturaBotoeira: 0, coberturaPisoTatil: 0} };
}
function pendente<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promessa = new Promise<T>((a,b) => {resolve=a; reject=b;}); return {promessa, resolve, reject};
}
describe('controle de solicitações usado pelo hook', () => {
  it('deduplica cliques para o mesmo destino enquanto está pendente', async () => {
    const p = pendente<RotaCandidata>(); const calcular = vi.fn(() => p.promessa);
    const c = new ControleSolicitacaoRota(calcular, vi.fn());
    const a = c.solicitar(origem,destino,contexto); const b = c.solicitar([-30.2,-51],destino,contexto);
    expect(a).toBe(b); expect(calcular).toHaveBeenCalledTimes(1);
    p.resolve(rota('a')); await a; expect(c.estado.status).toBe('sucesso');
  });
  it.each(['sucesso', 'erro'])('troca de destino cancela anterior e ignora seu %s fora de ordem', async resultado => {
    const a=pendente<RotaCandidata>(); const b=pendente<RotaCandidata>();
    const calcular=vi.fn().mockReturnValueOnce(a.promessa).mockReturnValueOnce(b.promessa);
    const estados: EstadoSolicitacaoRota[]=[]; const c=new ControleSolicitacaoRota(calcular,s=>estados.push(s));
    const pa=c.solicitar(origem,destino,contexto);
    const pb=c.solicitar(origem,{...destino,id:'b'},contexto);
    expect(calcular.mock.calls[0][3].aborted).toBe(true);
    b.resolve(rota('b')); await pb;
    if(resultado==='sucesso') a.resolve(rota('a')); else a.reject(new Error('Falha antiga'));
    await pa; expect(c.estado.rota?.destino.id).toBe('b'); expect(c.estado.erro).toBeNull();
    expect(estados.filter(s=>s.status==='sucesso')).toHaveLength(1);
  });
  it('cancelamento voluntário encerra loading e resposta tardia não recria rota', async () => {
    const a=pendente<RotaCandidata>(); const c=new ControleSolicitacaoRota(()=>a.promessa,vi.fn());
    const p=c.solicitar(origem,destino,contexto); c.cancelar(true);
    a.resolve(rota('a')); await p;
    expect(c.estado).toMatchObject({rota:null,status:'ocioso',erro:null});
  });
  it.each(['TimeoutError','Error'])('falha %s no recálculo preserva rota válida', async nome => {
    const calcular=vi.fn().mockResolvedValueOnce(rota('anterior')).mockRejectedValueOnce(new DOMException('Falha',nome));
    const c=new ControleSolicitacaoRota(calcular,vi.fn()); await c.solicitar(origem,destino,contexto);
    await c.solicitar(origem,destino,contexto,'recalculo');
    expect(c.estado).toMatchObject({status:'erro',motivo:'recalculo',rota:{destino:{id:'anterior'}}});
  });
  it('cancelar recálculo mantém rota e não apresenta erro', async () => {
    const p=pendente<RotaCandidata>(); const f=vi.fn().mockResolvedValueOnce(rota('anterior')).mockReturnValueOnce(p.promessa);
    const c=new ControleSolicitacaoRota(f,vi.fn()); await c.solicitar(origem,destino,contexto);
    const t=c.solicitar(origem,destino,contexto,'recalculo'); c.cancelar(); p.reject(new DOMException('Cancelado','AbortError')); await t;
    expect(c.estado).toMatchObject({status:'sucesso',erro:null,rota:{destino:{id:'anterior'}}});
  });
  it('falha manual mantém a rota anterior e permite recuperação', async () => {
    const f=vi.fn().mockResolvedValueOnce(rota('a')).mockRejectedValueOnce(new Error('Sem rede')).mockResolvedValueOnce(rota('b'));
    const c=new ControleSolicitacaoRota(f,vi.fn()); await c.solicitar(origem,destino,contexto);
    await c.solicitar(origem,{...destino,id:'b'},contexto); expect(c.estado.rota?.destino.id).toBe('a');
    expect(c.estado).toMatchObject({status:'erro',motivo:'manual'});
    await c.solicitar(origem,{...destino,id:'b'},contexto); expect(c.estado).toMatchObject({status:'sucesso',erro:null,rota:{destino:{id:'b'}}});
  });
});

it('erro antigo não encerra loading da solicitação nova ainda pendente', async()=>{
  const a=pendente<RotaCandidata>(); const b=pendente<RotaCandidata>();
  const f=vi.fn().mockReturnValueOnce(a.promessa).mockReturnValueOnce(b.promessa);
  const c=new ControleSolicitacaoRota(f,vi.fn());
  const primeira=c.solicitar(origem,destino,contexto); const segunda=c.solicitar(origem,{...destino,id:'b'},contexto);
  a.reject(new Error('Erro antigo')); await primeira;
  expect(c.estado).toMatchObject({status:'carregando',erro:null});
  b.resolve(rota('b')); await segunda; expect(c.estado.rota?.destino.id).toBe('b');
});
