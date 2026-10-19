import { afterEach, expect, it, vi } from 'vitest';
import { comPrazo, esperaRetryAfter } from './requisicao';
afterEach(()=>vi.useRealTimers());
it('Retry-After aceita segundos e data HTTP, ignora valores inválidos',()=>{
  expect(esperaRetryAfter('120',0)).toBe(120000);
  expect(esperaRetryAfter('Thu, 01 Jan 1970 00:02:00 GMT',0)).toBe(120000);
  for(const v of [null,'','inválido','-3']) expect(esperaRetryAfter(v,200000)).toBe(0);
});
it('prazo inclui leitura do corpo e libera timer/listener em sucesso',async()=>{
  vi.useFakeTimers(); const controle=new AbortController();
  const remover=vi.spyOn(controle.signal,'removeEventListener');
  expect(await comPrazo(async()=>42,30000,controle.signal)).toBe(42);
  expect(vi.getTimerCount()).toBe(0); expect(remover).toHaveBeenCalledWith('abort',expect.any(Function));
  const p=comPrazo(async sinal=>{
    // Representa headers já recebidos e corpo ainda em leitura.
    return new Promise((_resolve,reject)=>sinal.addEventListener('abort',()=>reject(sinal.reason)));
  },30000);
  const resultado=expect(p).rejects.toMatchObject({name:'TimeoutError'});
  await vi.advanceTimersByTimeAsync(30000); await resultado; expect(vi.getTimerCount()).toBe(0);
});
it('sinal já cancelado não inicia operação',async()=>{
  const controle=new AbortController(); controle.abort(); const executar=vi.fn();
  await expect(comPrazo(executar,30000,controle.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(executar).not.toHaveBeenCalled();
});
