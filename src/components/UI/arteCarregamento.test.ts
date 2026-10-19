/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A tela de carregamento tem DUAS referências à mesma arte: o preload em
// Inicializacao.tsx (que segura a abertura do app) e o <image> do SVG em
// HomemCaminhando.tsx. Se divergirem, a arte é baixada duas vezes e o preload
// deixa de aquecer o cache. Também trava o peso: a arte já passou de 1,4 MB.
const RAIZ = process.cwd();
const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');

function caminhoDaArte(fonte: string): string {
  const m = fonte.match(/\/images\/echopath-caminhada\.[a-z]+/);
  if (!m) throw new Error('referência à arte não encontrada');
  return m[0];
}

describe('arte da tela de carregamento', () => {
  const preload = caminhoDaArte(ler('src/Inicializacao.tsx'));
  const svg = caminhoDaArte(ler('src/components/UI/HomemCaminhando.tsx'));

  it('o preload e o SVG apontam para o mesmo arquivo', () => {
    expect(preload).toBe(svg);
  });

  it('o arquivo referenciado existe em public/ e está no precache do PWA', () => {
    expect(existsSync(join(RAIZ, 'public', preload))).toBe(true);
    expect(ler('vite.config.ts')).toContain(preload.replace(/^\//, ''));
  });

  it('o arquivo carregado no início pesa menos de 300 KB', () => {
    expect(statSync(join(RAIZ, 'public', preload)).size).toBeLessThan(300 * 1024);
  });
});
