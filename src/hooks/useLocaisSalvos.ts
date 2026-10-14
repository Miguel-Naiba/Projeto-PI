import { useCallback, useEffect, useState } from 'react';
import type { PontoProximidade } from '../types';

const CHAVE_ARMAZENAMENTO = 'echopath:locais-salvos';
const MAXIMO_FAVORITOS = 50;

/**
 * Identidade de um favorito pra fins de salvar/remover/verificar duplicata —
 * NÃO usa `ponto.id` direto porque resultados de busca por endereço (geocodificação)
 * têm ids efêmeros tipo `geo-0`, `geo-1` (só válidos dentro de uma busca), que podem
 * colidir entre buscas diferentes. Coordenada arredondada (~1m de precisão) é estável
 * e não depende de nenhum id externo — não inventa um identificador que a fonte não dá.
 */
export function chaveDoLocal(p: Pick<PontoProximidade, 'lat' | 'lon'>): string {
  return `${p.lat.toFixed(5)}:${p.lon.toFixed(5)}`;
}

export function ehPontoValido(valor: unknown): valor is PontoProximidade {
  if (!valor || typeof valor !== 'object') return false;
  const p = valor as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.tipo === 'string' &&
    typeof p.nome === 'string' &&
    typeof p.lat === 'number' &&
    typeof p.lon === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon)
  );
}

function lerArmazenado(): PontoProximidade[] {
  if (typeof window === 'undefined') return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return [];
    const parsed: unknown = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return [];
    // Filtra silenciosamente qualquer entrada corrompida/de formato antigo —
    // não inventa dado pra completar um registro inválido, só o descarta.
    return parsed.filter(ehPontoValido);
  } catch {
    return [];
  }
}

interface ResultadoUseLocaisSalvos {
  favoritos: PontoProximidade[];
  salvar: (ponto: PontoProximidade) => void;
  remover: (ponto: Pick<PontoProximidade, 'lat' | 'lon'>) => void;
  ehFavorito: (ponto: Pick<PontoProximidade, 'lat' | 'lon'>) => boolean;
  alternar: (ponto: PontoProximidade) => void;
  cheio: boolean;
}

/**
 * Locais salvos (Favoritos) — checklist Fase 3, P6: salvar/remover/listar
 * persistidos em localStorage, integrado ao fluxo de seleção de destino já
 * existente (`PontoProximidade`/`aoSelecionarDestino`) — sem segunda
 * arquitetura de navegação, sem endpoint novo, sem dado inventado.
 */
export function useLocaisSalvos(): ResultadoUseLocaisSalvos {
  const [favoritos, setFavoritos] = useState<PontoProximidade[]>(() => lerArmazenado());

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(favoritos));
    } catch {
      // Armazenamento indisponível/cheio (ex.: modo privado) — a sessão
      // atual continua funcionando normalmente em memória, só não persiste
      // entre sessões. Não é um erro que precise interromper o uso.
    }
  }, [favoritos]);

  const ehFavorito = useCallback(
    (ponto: Pick<PontoProximidade, 'lat' | 'lon'>) => favoritos.some((f) => chaveDoLocal(f) === chaveDoLocal(ponto)),
    [favoritos]
  );

  const salvar = useCallback((ponto: PontoProximidade) => {
    setFavoritos((atual) => {
      if (atual.some((f) => chaveDoLocal(f) === chaveDoLocal(ponto))) return atual;
      if (atual.length >= MAXIMO_FAVORITOS) return atual;
      return [...atual, ponto];
    });
  }, []);

  const remover = useCallback((ponto: Pick<PontoProximidade, 'lat' | 'lon'>) => {
    setFavoritos((atual) => atual.filter((f) => chaveDoLocal(f) !== chaveDoLocal(ponto)));
  }, []);

  const alternar = useCallback(
    (ponto: PontoProximidade) => {
      if (ehFavorito(ponto)) remover(ponto);
      else salvar(ponto);
    },
    [ehFavorito, remover, salvar]
  );

  return { favoritos, salvar, remover, ehFavorito, alternar, cheio: favoritos.length >= MAXIMO_FAVORITOS };
}
