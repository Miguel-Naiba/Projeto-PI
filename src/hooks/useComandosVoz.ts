import { useCallback, useEffect, useRef, useState } from 'react';

export type ComandoVoz =
  | { tipo: 'buscar'; consulta: string }
  | { tipo: 'tracar_rota'; endereco: string }
  | { tipo: 'localizar' }
  | { tipo: 'repetir' }
  | { tipo: 'parar' }
  | { tipo: 'iniciar_rota' }
  | { tipo: 'reportar'; categoria: 'obra' | 'botoeira_quebrada' | 'rua_obstruida' }
  | { tipo: 'desconhecido'; transcricao: string };

interface ReconhecimentoMinimo {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: { results: { transcript: string }[][] } & { results: ListaResultadoReconhecimento }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type ListaResultadoReconhecimento = { [i: number]: { 0: { transcript: string }; isFinal?: boolean }; length: number };

function interpretarComando(transcricaoBruta: string): ComandoVoz {
  const t = transcricaoBruta.toLowerCase().trim();

  const buscaEncontrada = t.match(/^(?:buscar|procurar|ir para|encontrar)\s+(.+)/);
  if (buscaEncontrada) return { tipo: 'buscar', consulta: buscaEncontrada[1] };

  const rotaComTrigger = t.match(/^(?:tra[çc]ar rota (?:at[ée]|para|pra)|rota (?:at[ée]|para|pra)|navegar (?:at[ée]|para|pra))\s+(.+)/);
  if (rotaComTrigger) return { tipo: 'tracar_rota', endereco: rotaComTrigger[1] };

  const enderecoDireto = t.match(/^(avenida|av\.?|rua|r\.?|travessa|estrada|alameda)\s+.+\d.*/);
  if (enderecoDireto) return { tipo: 'tracar_rota', endereco: t };

  if (/onde estou|minha localiza[cç][aã]o/.test(t)) return { tipo: 'localizar' };
  if (/^repetir/.test(t)) return { tipo: 'repetir' };
  if (/^(parar|cancelar|pare)/.test(t)) return { tipo: 'parar' };
  if (/iniciar rota|come[cç]ar rota|navegar/.test(t)) return { tipo: 'iniciar_rota' };

  const reportarObra = /reportar obra|relatar obra|tem uma obra|nova obra/.test(t);
  if (reportarObra) return { tipo: 'reportar', categoria: 'obra' };

  const reportarBotoeira = /botoeira (quebrada|com defeito|n[aã]o funciona|mal funcionamento)|reportar botoeira|relatar botoeira/.test(t);
  if (reportarBotoeira) return { tipo: 'reportar', categoria: 'botoeira_quebrada' };

  const reportarRua = /rua obstru[ií]da|rua bloqueada|caminho obstru[ií]do|reportar (rua|obst[aá]culo)|relatar (rua|obst[aá]culo)/.test(t);
  if (reportarRua) return { tipo: 'reportar', categoria: 'rua_obstruida' };

  return { tipo: 'desconhecido', transcricao: t };
}

interface ResultadoUseComandosVoz {
  suportado: boolean;
  ouvindo: boolean;
  ultimaTranscricao: string | null;
  erro: string | null;
  iniciarEscuta: () => void;
  pararEscuta: () => void;
}

export function useComandosVoz(aoReceberComando: (cmd: ComandoVoz) => void, idioma = 'pt-BR'): ResultadoUseComandosVoz {
  const [ouvindo, setOuvindo] = useState(false);
  const [ultimaTranscricao, setUltimaTranscricao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimentoRef = useRef<ReconhecimentoMinimo | null>(null);

  const ConstrutorReconhecimento =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: new () => ReconhecimentoMinimo; webkitSpeechRecognition?: new () => ReconhecimentoMinimo })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => ReconhecimentoMinimo }).webkitSpeechRecognition
      : undefined;

  const suportado = !!ConstrutorReconhecimento;

  useEffect(() => {
    if (!ConstrutorReconhecimento) return;
    const reconhecimento = new ConstrutorReconhecimento();
    reconhecimento.lang = idioma;
    reconhecimento.continuous = false;
    reconhecimento.interimResults = false;

    reconhecimento.onresult = (evento) => {
      const transcricao = evento.results[evento.results.length - 1]?.[0]?.transcript ?? '';
      setUltimaTranscricao(transcricao);
      aoReceberComando(interpretarComando(transcricao));
    };
    reconhecimento.onerror = (evento) => {
      setErro(evento.error === 'not-allowed' ? 'Permissão de microfone negada.' : `Erro de reconhecimento: ${evento.error}`);
      setOuvindo(false);
    };
    reconhecimento.onend = () => setOuvindo(false);

    reconhecimentoRef.current = reconhecimento;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idioma]);

  const iniciarEscuta = useCallback(() => {
    if (!reconhecimentoRef.current) {
      setErro('Comando de voz não é suportado neste navegador. Use a barra de busca.');
      return;
    }
    setErro(null);
    setOuvindo(true);
    reconhecimentoRef.current.start();
  }, []);

  const pararEscuta = useCallback(() => {
    reconhecimentoRef.current?.stop();
    setOuvindo(false);
  }, []);

  return { suportado, ouvindo, ultimaTranscricao, erro, iniciarEscuta, pararEscuta };
}
