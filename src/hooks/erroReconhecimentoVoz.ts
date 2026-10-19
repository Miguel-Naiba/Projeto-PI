/**
 * Mensagens para os erros do reconhecimento de voz (Web Speech API).
 *
 * Num app guiado por voz, falhar em silêncio é o pior resultado: quem negou a
 * permissão do microfone apertava o botão e nada acontecia. Antes, o erro era
 * guardado em estado e nunca exibido nem anunciado (comandos) ou simplesmente
 * descartado (ditado do Reportar). Agora os dois usam esta função.
 *
 * `null` = não avisar (código "aborted": quem interrompeu foi a própria pessoa).
 */
export const MENSAGEM_VOZ_NAO_SUPORTADA = 'Comando de voz não é suportado neste navegador. Use a barra de busca.';

export function mensagemErroReconhecimento(codigo: string): string | null {
  switch (codigo) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Permissão de microfone negada. Libere o microfone para este site nas configurações do navegador.';
    case 'no-speech':
      return 'Não ouvi nada. Toque no microfone e fale de novo.';
    case 'audio-capture':
      return 'Não encontrei um microfone neste aparelho.';
    case 'network':
      return 'O reconhecimento de voz precisa de internet. Verifique a conexão e tente de novo.';
    case 'language-not-supported':
      return 'O reconhecimento de voz não está disponível em português neste navegador.';
    default:
      return 'Não consegui usar o reconhecimento de voz agora. Tente de novo.';
  }
}
