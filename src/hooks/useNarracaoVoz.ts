import { useCallback, useEffect, useRef, useState } from 'react';

export type PrioridadeNarracao = 'alerta' | 'info';

interface ItemFila {
  texto: string;
  prioridade: PrioridadeNarracao;
}

export interface VozNarracao {
  uri: string;
  nome: string;
  idioma: string;
}

interface ResultadoUseNarracaoVoz {
  falar: (texto: string, prioridade?: PrioridadeNarracao) => void;
  parar: () => void;
  suportado: boolean;
  ativado: boolean;
  definirAtivado: (v: boolean) => void;
  idioma: string;
  definirIdioma: (v: string) => void;
  velocidade: number;
  definirVelocidade: (v: number) => void;
  vozUri: string | null;
  definirVozUri: (v: string | null) => void;
  vozesDisponiveis: VozNarracao[];
}

const CHAVE_IDIOMA = 'echopath:voz-idioma';
const CHAVE_VELOCIDADE = 'echopath:voz-velocidade';
const CHAVE_VOZ_URI = 'echopath:voz-uri';

const IDIOMAS_SUPORTADOS = ['pt-BR', 'en-US', 'es-ES'];

function lerArmazenado(chave: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(chave);
}

export function useNarracaoVoz(idiomaPadrao = 'pt-BR'): ResultadoUseNarracaoVoz {
  const suportado = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [ativado, setAtivado] = useState(true);
  const [idioma, setIdioma] = useState(() => {
    const salvo = lerArmazenado(CHAVE_IDIOMA);
    return salvo && IDIOMAS_SUPORTADOS.includes(salvo) ? salvo : idiomaPadrao;
  });
  // 1.5 sempre foi o padrão deste app — várias pessoas cegas preferem
  // narração mais rápida que a leitura "natural". Mantido como valor
  // inicial pra não mudar o comportamento de quem já usa o app.
  const [velocidade, setVelocidade] = useState(() => {
    const salvo = lerArmazenado(CHAVE_VELOCIDADE);
    const num = salvo ? parseFloat(salvo) : NaN;
    return Number.isFinite(num) ? num : 1.5;
  });
  const [vozUri, setVozUri] = useState<string | null>(() => lerArmazenado(CHAVE_VOZ_URI));
  const [vozesDisponiveis, setVozesDisponiveis] = useState<VozNarracao[]>([]);

  const filaRef = useRef<ItemFila[]>([]);
  const falandoRef = useRef(false);
  const bombearRef = useRef<() => void>(() => {});

  // As vozes do navegador chegam de forma assíncrona (às vezes depois de um
  // evento `voiceschanged`), então é preciso escutar esse evento, não só ler
  // uma vez no carregamento.
  useEffect(() => {
    if (!suportado) return;
    const atualizarVozes = () => {
      const vozes = window.speechSynthesis.getVoices().map((v) => ({ uri: v.voiceURI, nome: v.name, idioma: v.lang }));
      setVozesDisponiveis(vozes);
    };
    atualizarVozes();
    window.speechSynthesis.addEventListener('voiceschanged', atualizarVozes);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', atualizarVozes);
  }, [suportado]);

  useEffect(() => {
    window.localStorage.setItem(CHAVE_IDIOMA, idioma);
  }, [idioma]);

  useEffect(() => {
    window.localStorage.setItem(CHAVE_VELOCIDADE, String(velocidade));
  }, [velocidade]);

  useEffect(() => {
    if (vozUri) window.localStorage.setItem(CHAVE_VOZ_URI, vozUri);
    else window.localStorage.removeItem(CHAVE_VOZ_URI);
  }, [vozUri]);

  const bombear = useCallback(() => {
    if (!suportado || falandoRef.current) return;
    const item = filaRef.current.shift();
    if (!item) return;

    const fala = new SpeechSynthesisUtterance(item.texto);
    fala.lang = idioma;
    fala.rate = velocidade;

    if (vozUri) {
      const vozEscolhida = window.speechSynthesis.getVoices().find((v) => v.voiceURI === vozUri);
      if (vozEscolhida) fala.voice = vozEscolhida;
    }

    falandoRef.current = true;
    const finalizar = () => {
      falandoRef.current = false;
      bombearRef.current();
    };
    fala.onend = finalizar;
    fala.onerror = finalizar;

    window.speechSynthesis.speak(fala);
  }, [idioma, velocidade, vozUri, suportado]);

  useEffect(() => {
    bombearRef.current = bombear;
  }, [bombear]);

  const falar = useCallback(
    (texto: string, prioridade: PrioridadeNarracao = 'info') => {
      if (!ativado || !suportado) return;

      if (prioridade === 'alerta') {
        filaRef.current = [];
        window.speechSynthesis.cancel();
        falandoRef.current = false;
      }
      filaRef.current.push({ texto, prioridade });
      bombear();
    },
    [ativado, suportado, bombear]
  );

  const parar = useCallback(() => {
    filaRef.current = [];
    if (suportado) window.speechSynthesis.cancel();
    falandoRef.current = false;
  }, [suportado]);

  // Trocar de idioma invalida a voz escolhida se ela não pertencer mais ao
  // novo idioma (evita ficar com uma voz em inglês selecionada silenciosamente
  // enquanto o idioma mostrado na tela é português).
  const definirIdioma = useCallback(
    (novoIdioma: string) => {
      setIdioma(novoIdioma);
      setVozUri((atual) => {
        if (!atual) return null;
        const vozAtual = vozesDisponiveis.find((v) => v.uri === atual);
        return vozAtual && vozAtual.idioma.startsWith(novoIdioma.slice(0, 2)) ? atual : null;
      });
    },
    [vozesDisponiveis]
  );

  return {
    falar,
    parar,
    suportado,
    ativado,
    definirAtivado: setAtivado,
    idioma,
    definirIdioma,
    velocidade,
    definirVelocidade: setVelocidade,
    vozUri,
    definirVozUri: setVozUri,
    vozesDisponiveis,
  };
}
