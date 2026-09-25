import { useCallback, useEffect, useRef, useState } from 'react';

interface ReconhecimentoMinimo {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: { results: { length: number; [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type ConstrutorReconhecimento = new () => ReconhecimentoMinimo;

/**
 * Ditado de voz avulso: transcreve uma fala e devolve o texto via callback.
 * Deliberadamente separado de useComandosVoz — aqui não há comando pra
 * interpretar, é só "transformar fala em texto num campo", reutilizável em
 * qualquer formulário (hoje: descrição do reporte).
 */
export function useDitadoVoz(aoTranscrever: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const refReconhecimento = useRef<ReconhecimentoMinimo | null>(null);
  const refCallback = useRef(aoTranscrever);

  useEffect(() => {
    refCallback.current = aoTranscrever;
  }, [aoTranscrever]);

  const Construtor =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: ConstrutorReconhecimento }).webkitSpeechRecognition)
      : undefined;

  const suportado = !!Construtor;

  useEffect(() => {
    if (!Construtor) return;
    const reconhecimento = new Construtor();
    reconhecimento.lang = 'pt-BR';
    reconhecimento.continuous = false;
    reconhecimento.interimResults = false;
    reconhecimento.onresult = (ev) => {
      const texto = ev.results[ev.results.length - 1]?.[0]?.transcript;
      if (texto) refCallback.current(texto);
    };
    reconhecimento.onerror = () => setOuvindo(false);
    reconhecimento.onend = () => setOuvindo(false);
    refReconhecimento.current = reconhecimento;
  }, [Construtor]);

  const iniciar = useCallback(() => {
    if (!refReconhecimento.current) return;
    setOuvindo(true);
    try {
      refReconhecimento.current.start();
    } catch {
      setOuvindo(false);
    }
  }, []);

  const parar = useCallback(() => {
    refReconhecimento.current?.stop();
  }, []);

  return { ouvindo, suportado, iniciar, parar };
}
