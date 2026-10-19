import { describe, expect, it } from 'vitest';
import { mensagemErroReconhecimento, MENSAGEM_VOZ_NAO_SUPORTADA } from './erroReconhecimentoVoz';

describe('mensagemErroReconhecimento (Fase E — erros de voz nunca podem ser silenciosos)', () => {
  it('permissão negada explica como resolver', () => {
    for (const codigo of ['not-allowed', 'service-not-allowed']) {
      const msg = mensagemErroReconhecimento(codigo);
      expect(msg).toContain('microfone');
      expect(msg?.toLowerCase()).toContain('permiss');
    }
  });

  it('cada causa comum tem uma mensagem própria e útil', () => {
    const codigos = ['no-speech', 'audio-capture', 'network', 'language-not-supported', 'qualquer-outro'];
    const mensagens = codigos.map((c) => mensagemErroReconhecimento(c));
    for (const m of mensagens) expect(m && m.length > 10).toBe(true);
    expect(new Set(mensagens.slice(0, 4)).size).toBe(4);
  });

  it('"aborted" (quem parou foi a própria pessoa) não gera aviso', () => {
    expect(mensagemErroReconhecimento('aborted')).toBeNull();
  });

  it('navegador sem suporte indica o caminho alternativo (busca por texto)', () => {
    expect(MENSAGEM_VOZ_NAO_SUPORTADA.toLowerCase()).toContain('busca');
  });
});
