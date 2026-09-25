import { useEffect, useRef, useState } from 'react';
import { distanciaM } from '../utils/geografia';
import type { LocalizacaoUsuario } from '../types';

export type PermissaoGeo = 'granted' | 'denied' | 'prompt' | 'unknown';

interface ResultadoUseLocalizacaoUsuario {
  posicao: LocalizacaoUsuario | null;
  latLon: [number, number] | null;
  precisaoM: number | null;
  erro: string | null;
  permissao: PermissaoGeo;
  obtendo: boolean;
}

const PRECISAO_MAX_UTILIZAVEL_M = 120;
// GPS "treme" alguns metros mesmo parado — sem isso, cada leitura gerava uma
// referência nova de latLon e disparava recálculo em cascata (filtro de
// paradas próximas, alertas de proximidade) à toa, várias vezes por segundo.
const LIMIAR_ESTABILIDADE_LATLON_M = 5;

export function useLocalizacaoUsuario(): ResultadoUseLocalizacaoUsuario {
  const [posicao, setPosicao] = useState<LocalizacaoUsuario | null>(null);
  const [latLonEstavel, setLatLonEstavel] = useState<[number, number] | null>(null);
  const geoDisponivel = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [erro, setErro] = useState<string | null>(() =>
    geoDisponivel ? null : 'Geolocalização não suportada neste navegador.'
  );
  const [permissao, setPermissao] = useState<PermissaoGeo>('unknown');
  const [obtendo, setObtendo] = useState(geoDisponivel);
  const melhorPrecisaoRef = useRef<number>(Infinity);

  useEffect(() => {
    if (!geoDisponivel) return;

    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          setPermissao(status.state as PermissaoGeo);
          status.onchange = () => setPermissao(status.state as PermissaoGeo);
        })
        .catch(() => setPermissao('unknown'));
    }

    const aoObterSucesso = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      setObtendo(false);
      setErro(null);

      if (accuracy < melhorPrecisaoRef.current) melhorPrecisaoRef.current = accuracy;

      setPosicao({
        lat: latitude,
        lon: longitude,
        precisao: accuracy,
        direcao: heading ?? null,
        velocidade: speed ?? null,
        timestamp: pos.timestamp,
      });
    };

    const aoObterErro = (err: GeolocationPositionError) => {
      setObtendo(false);
      const mensagens: Record<number, string> = {
        1: 'Permissão de localização negada. Ative o GPS e a permissão do site para navegação guiada.',
        2: 'Sinal de localização indisponível. Verifique se o GPS está ativo.',
        3: 'Tempo esgotado ao obter localização. Tentando novamente...',
      };
      setErro(mensagens[err.code] ?? err.message);
    };

    const idObservador = navigator.geolocation.watchPosition(aoObterSucesso, aoObterErro, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });

    return () => navigator.geolocation.clearWatch(idObservador);
  }, [geoDisponivel]);

  useEffect(() => {
    if (!posicao) return;
    const id = setTimeout(() => {
      setLatLonEstavel((anterior) => {
        if (anterior && distanciaM(anterior[0], anterior[1], posicao.lat, posicao.lon) < LIMIAR_ESTABILIDADE_LATLON_M) {
          return anterior;
        }
        return [posicao.lat, posicao.lon];
      });
    }, 0);
    return () => clearTimeout(id);
  }, [posicao]);

  return {
    posicao,
    latLon: latLonEstavel,
    precisaoM: posicao?.precisao ?? null,
    erro,
    permissao,
    obtendo,
  };
}

export { PRECISAO_MAX_UTILIZAVEL_M };
