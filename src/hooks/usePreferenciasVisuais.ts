import { useCallback, useEffect, useState } from 'react';

export type Tema = 'claro' | 'escuro';
export type Contraste = 'normal' | 'alto';
export type TamanhoTexto = 'pequeno' | 'medio' | 'grande';

const CHAVE_TEMA = 'echopath:tema';
const CHAVE_CONTRASTE = 'echopath:contraste';
const CHAVE_TEXTO = 'echopath:tamanho-texto';

function obterTemaInicial(): Tema {
  if (typeof window === 'undefined') return 'escuro';
  const salvo = window.localStorage.getItem(CHAVE_TEMA);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  const prefereClaro = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return prefereClaro ? 'claro' : 'escuro';
}

function obterContrasteInicial(): Contraste {
  if (typeof window === 'undefined') return 'normal';
  const salvo = window.localStorage.getItem(CHAVE_CONTRASTE);
  if (salvo === 'alto' || salvo === 'normal') return salvo;
  const prefereAlto = window.matchMedia?.('(prefers-contrast: more)').matches;
  return prefereAlto ? 'alto' : 'normal';
}

function obterTextoInicial(): TamanhoTexto {
  if (typeof window === 'undefined') return 'medio';
  const salvo = window.localStorage.getItem(CHAVE_TEXTO);
  if (salvo === 'pequeno' || salvo === 'medio' || salvo === 'grande') return salvo;
  return 'medio';
}

/**
 * Controla tema (claro/escuro), alto contraste e tamanho do texto — aplicados
 * via atributos em <html>, lidos pelas variáveis CSS em Aplicativo.css. Cada
 * preferência persiste no navegador da pessoa entre visitas.
 */
export function usePreferenciasVisuais() {
  const [tema, setTema] = useState<Tema>(obterTemaInicial);
  const [contraste, setContraste] = useState<Contraste>(obterContrasteInicial);
  const [tamanhoTexto, setTamanhoTexto] = useState<TamanhoTexto>(obterTextoInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema);
    window.localStorage.setItem(CHAVE_TEMA, tema);
  }, [tema]);

  useEffect(() => {
    document.documentElement.setAttribute('data-contraste', contraste);
    window.localStorage.setItem(CHAVE_CONTRASTE, contraste);
  }, [contraste]);

  useEffect(() => {
    document.documentElement.setAttribute('data-texto', tamanhoTexto);
    window.localStorage.setItem(CHAVE_TEXTO, tamanhoTexto);
  }, [tamanhoTexto]);

  const alternarTema = useCallback(() => {
    setTema((t) => (t === 'escuro' ? 'claro' : 'escuro'));
  }, []);

  const alternarContraste = useCallback(() => {
    setContraste((c) => (c === 'alto' ? 'normal' : 'alto'));
  }, []);

  return {
    tema,
    definirTema: setTema,
    alternarTema,
    contraste,
    alternarContraste,
    tamanhoTexto,
    definirTamanhoTexto: setTamanhoTexto,
  };
}
