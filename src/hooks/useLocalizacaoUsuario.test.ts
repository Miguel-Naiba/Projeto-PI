import { describe, expect, it } from 'vitest';
import { mensagemErroGeo, precisaoEhBaixa, PRECISAO_MAX_UTILIZAVEL_M } from './useLocalizacaoUsuario';

describe('mensagemErroGeo — estados de erro de GPS (checklist Fase 3, item 7)', () => {
  it('código 1 (PERMISSION_DENIED) — negado', () => {
    expect(mensagemErroGeo(1, '')).toMatch(/permissão.*negada/i);
  });

  it('código 2 (POSITION_UNAVAILABLE) — indisponível', () => {
    expect(mensagemErroGeo(2, '')).toMatch(/indisponível/i);
  });

  it('código 3 (TIMEOUT) — sinal perdido', () => {
    expect(mensagemErroGeo(3, '')).toMatch(/tempo esgotado/i);
  });

  it('código desconhecido cai para a mensagem do navegador, se houver', () => {
    expect(mensagemErroGeo(99, 'erro nativo do navegador')).toBe('erro nativo do navegador');
  });

  it('código desconhecido sem mensagem do navegador usa um texto genérico', () => {
    expect(mensagemErroGeo(99, '')).toMatch(/não foi possível obter/i);
  });
});

describe('precisaoEhBaixa — leitura de baixa precisão (checklist Fase 3, item 7)', () => {
  it(`precisão acima de ${PRECISAO_MAX_UTILIZAVEL_M}m é considerada baixa`, () => {
    expect(precisaoEhBaixa(PRECISAO_MAX_UTILIZAVEL_M + 1)).toBe(true);
  });

  it(`precisão exatamente em ${PRECISAO_MAX_UTILIZAVEL_M}m ainda é aceitável (limite inclusivo)`, () => {
    expect(precisaoEhBaixa(PRECISAO_MAX_UTILIZAVEL_M)).toBe(false);
  });

  it('precisão boa (poucos metros) não é baixa', () => {
    expect(precisaoEhBaixa(10)).toBe(false);
  });

  it('sem leitura de precisão (null) não é classificado como baixa — é "sem dado", não "ruim"', () => {
    expect(precisaoEhBaixa(null)).toBe(false);
  });
});
