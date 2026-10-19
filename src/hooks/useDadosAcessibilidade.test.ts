import { describe, expect, it } from 'vitest';
import { podeBuscarAcessibilidade, anexarPisoTatil } from './useDadosAcessibilidade';
import type { ParadaOnibus } from '../types';
describe('frequência Overpass e independência oficial',()=>{
  it('permite primeira busca e impede duplicação em andamento',()=>{
    expect(podeBuscarAcessibilidade(false,null,null,'a',0)).toBe(true);
    expect(podeBuscarAcessibilidade(true,null,null,'a',60000)).toBe(false);
  });
  it('falha registrada não permite requisição a cada atualização de GPS',()=>{
    // Sem sucesso anterior, célula confirmada é null; a tentativa falha foi em 1000.
    for(const agora of [1001,2000,15000,20999]) expect(podeBuscarAcessibilidade(false,1000,null,'a',agora)).toBe(false);
    expect(podeBuscarAcessibilidade(false,1000,null,'a',21000)).toBe(true);
  });
  it('preserva cache da célula por 60s e limita mudança de célula a 20s',()=>{
    expect(podeBuscarAcessibilidade(false,0,'a','a',59999)).toBe(false);
    expect(podeBuscarAcessibilidade(false,0,'a','a',60000)).toBe(true);
    expect(podeBuscarAcessibilidade(false,0,'a','b',19999)).toBe(false);
    expect(podeBuscarAcessibilidade(false,0,'a','b',20000)).toBe(true);
  });
  it('piso tátil EPTC permanece utilizável sem resultado Overpass',()=>{
    const paradas=[{idParada:'oficial',latParada:-30,lonParada:-51}] as ParadaOnibus[];
    expect(anexarPisoTatil(paradas,[],new Set(['oficial']))[0]).toMatchObject({pisoTatil:true,fontePisoTatil:'eptc'});
  });
});
