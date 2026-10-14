import { describe, expect, it } from 'vitest';
import { avaliarNecessidadeRecalculo, DURACAO_MINIMA_FORA_MS, ESTADO_DESVIO_INICIAL, LIMIAR_SAIDA_ROTA_M } from './recalculoRota';

const T0 = 1_000_000;

describe('avaliarNecessidadeRecalculo (checklist Fase 3, P11)', () => {
  it('usuário sobre a rota (distância 0) nunca recalcula', () => {
    const r = avaliarNecessidadeRecalculo(0, ESTADO_DESVIO_INICIAL, T0);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado.foraDesdeMs).toBeNull();
  });

  it('pequena imprecisão de GPS (dentro do limiar) não inicia o cronômetro nem recalcula', () => {
    const r = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M, ESTADO_DESVIO_INICIAL, T0);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado.foraDesdeMs).toBeNull();
  });

  it('acabou de exceder o limiar: começa a contar, ainda não recalcula nessa mesma leitura', () => {
    const r = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M + 1, ESTADO_DESVIO_INICIAL, T0);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado.foraDesdeMs).toBe(T0);
  });

  it('saída real: fora do limiar continuamente pelo tempo mínimo → recalcula', () => {
    const inicioDesvio = { foraDesdeMs: T0 };
    const r = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M + 10, inicioDesvio, T0 + DURACAO_MINIMA_FORA_MS);
    expect(r.recalcular).toBe(true);
    expect(r.novoEstado).toEqual(ESTADO_DESVIO_INICIAL);
  });

  it('fora do limiar mas ainda não completou a duração mínima — não recalcula ainda (evita recálculo por oscilação)', () => {
    const inicioDesvio = { foraDesdeMs: T0 };
    const r = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M + 10, inicioDesvio, T0 + DURACAO_MINIMA_FORA_MS - 1);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado.foraDesdeMs).toBe(T0);
  });

  it('GPS oscila de volta pra dentro do limiar antes do tempo mínimo — zera o cronômetro, não recalcula', () => {
    const inicioDesvio = { foraDesdeMs: T0 };
    const voltouPraDentro = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M - 5, inicioDesvio, T0 + 2000);
    expect(voltouPraDentro.recalcular).toBe(false);
    expect(voltouPraDentro.novoEstado.foraDesdeMs).toBeNull();

    // Se depois voltar a exceder o limiar, o cronômetro recomeça do zero —
    // não é "retomado" de onde tinha parado.
    const saiuDeNovo = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M + 10, voltouPraDentro.novoEstado, T0 + 2500);
    expect(saiuDeNovo.recalcular).toBe(false);
    expect(saiuDeNovo.novoEstado.foraDesdeMs).toBe(T0 + 2500);
  });

  it('sem rota ativa (distância null) nunca recalcula, mesmo com estado de desvio anterior', () => {
    const r = avaliarNecessidadeRecalculo(null, { foraDesdeMs: T0 }, T0 + 100_000);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado).toEqual(ESTADO_DESVIO_INICIAL);
  });

  it('exatamente no limiar (borda) não é considerado "fora" — só acima dele', () => {
    const r = avaliarNecessidadeRecalculo(LIMIAR_SAIDA_ROTA_M, { foraDesdeMs: T0 }, T0 + DURACAO_MINIMA_FORA_MS);
    expect(r.recalcular).toBe(false);
    expect(r.novoEstado).toEqual(ESTADO_DESVIO_INICIAL);
  });
});
