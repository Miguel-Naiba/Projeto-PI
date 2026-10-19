import { describe, expect, it } from 'vitest';
import {
  avaliarNecessidadeRecalculo,
  DURACAO_MINIMA_FORA_MS,
  ESTADO_DESVIO_INICIAL,
  LIMIAR_SAIDA_ROTA_M,
  ESTADO_FALHA_INICIAL,
  ESPERA_BASE_APOS_FALHA_MS,
  ESPERA_MAXIMA_APOS_FALHA_MS,
  registrarFalhaRecalculo,
  recalculoAutomaticoPermitido,
  mensagemFalhaRecalculo,
} from './recalculoRota';

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

describe('backoff após falha de recálculo (Fase A, item D)', () => {
  it('sem falhas registradas, o recálculo automático está liberado', () => {
    expect(recalculoAutomaticoPermitido(ESTADO_FALHA_INICIAL, T0)).toBe(true);
  });

  it('após uma falha de rede, bloqueia novas tentativas automáticas pelo tempo base', () => {
    const e = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, null);
    expect(e.falhasConsecutivas).toBe(1);
    expect(recalculoAutomaticoPermitido(e, T0 + ESPERA_BASE_APOS_FALHA_MS - 1)).toBe(false);
    expect(recalculoAutomaticoPermitido(e, T0 + ESPERA_BASE_APOS_FALHA_MS)).toBe(true);
  });

  it('o tempo de espera dobra a cada falha consecutiva, com teto', () => {
    let e = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, null);
    e = registrarFalhaRecalculo(e, T0, null);
    expect(e.bloqueadoAteMs - T0).toBe(ESPERA_BASE_APOS_FALHA_MS * 2);
    for (let i = 0; i < 10; i++) e = registrarFalhaRecalculo(e, T0, null);
    expect(e.bloqueadoAteMs - T0).toBe(ESPERA_MAXIMA_APOS_FALHA_MS);
  });

  it('401 e 403 (chave inválida/sem permissão) desistem do recálculo automático — repetir não adianta', () => {
    for (const status of [401, 403]) {
      const e = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, status);
      expect(recalculoAutomaticoPermitido(e, T0 + 24 * 60 * 60 * 1000)).toBe(false);
    }
  });

  it('429 espera pelo menos 60 s, mesmo na primeira falha', () => {
    const e = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, 429);
    expect(e.bloqueadoAteMs - T0).toBeGreaterThanOrEqual(60_000);
  });

  it('cenário completo: usuário continua fora da rota e o ORS continua falhando — tentativas ficam espaçadas, não a cada 8 s', () => {
    // Simula 10 minutos de GPS a cada 1 s com o usuário sempre 100 m fora da rota.
    let desvio = ESTADO_DESVIO_INICIAL;
    let falha = ESTADO_FALHA_INICIAL;
    let tentativas = 0;
    for (let t = 0; t <= 600; t++) {
      const agora = T0 + t * 1000;
      const r = avaliarNecessidadeRecalculo(100, desvio, agora);
      desvio = r.novoEstado;
      if (r.recalcular && recalculoAutomaticoPermitido(falha, agora)) {
        tentativas++;
        falha = registrarFalhaRecalculo(falha, agora, null); // o ORS falhou de novo
      }
    }
    // Sem backoff seriam ~66 chamadas (uma a cada ~9 s); com backoff, poucas.
    expect(tentativas).toBeLessThanOrEqual(6);
    expect(tentativas).toBeGreaterThanOrEqual(2);
  });

  it('mensagem: avisa na primeira falha, fica calada nas repetidas e explica quando desiste', () => {
    const primeira = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, null);
    expect(mensagemFalhaRecalculo(primeira, 'x')).toContain('rota anterior');
    const segunda = registrarFalhaRecalculo(primeira, T0, null);
    expect(mensagemFalhaRecalculo(segunda, 'x')).toBeNull();
    const permanente = registrarFalhaRecalculo(ESTADO_FALHA_INICIAL, T0, 401);
    expect(mensagemFalhaRecalculo(permanente, 'Chave inválida.')).toContain('Chave inválida.');
  });
});
