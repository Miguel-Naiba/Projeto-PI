import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {
  RotaAcessivel,
  SinalSonoro,
  ParadaOnibus,
  Obra,
  EstadoCamadas,
  Acidente,
  OnibusAoVivo,
  LocalizacaoUsuario,
  Reporte,
} from '../../types';
import './VisualizadorMapa.css';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function iconeCirculo(cor: string, tamanho = 14, emoji?: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${tamanho}px;height:${tamanho}px;border-radius:50%;
      background:${cor};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.5);
      display:flex;align-items:center;justify-content:center;font-size:${tamanho * 0.6}px;
    ">${emoji ?? ''}</div>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
  });
}

function iconeQuadrado(cor: string, emoji: string, tamanho = 22) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${tamanho}px;height:${tamanho}px;border-radius:4px;
      background:${cor};border:2px solid #fff;
      font-size:13px;display:flex;align-items:center;
      justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.5);
    ">${emoji}</div>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
  });
}

function formatarTempoRelativo(isoDatetime: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(isoDatetime).getTime()) / 60000));
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.round(horas / 24)}d`;
}

const ROTULO_TIPO_REPORTE: Record<string, { cor: string; emoji: string; titulo: string }> = {
  obra: { cor: '#f5a623', emoji: '🚧', titulo: 'Obra reportada' },
  botoeira_quebrada: { cor: '#ff5470', emoji: '🔇', titulo: 'Botoeira com problema' },
  rua_obstruida: { cor: '#ff5470', emoji: '🚫', titulo: 'Rua obstruída' },
};

function escaparAtributo(texto: string): string {
  return texto.replace(/"/g, '&quot;');
}

// Botão embutido no HTML do popup (Leaflet popups são strings, não React) —
// um único listener delegado no container do mapa (ver useEffect abaixo)
// escuta cliques nele e devolve os dados via aoReportarPonto. Só nos dois
// tipos que mapeiam direto pra uma categoria de reporte (obra, botoeira);
// piso tátil não tem categoria própria nas 3 definidas, então não ganhou
// esse atalho por enquanto — ver handoff.
function botaoReportarEstePonto(
  tipo: 'obra' | 'botoeira_quebrada',
  id: string,
  nome: string,
  fonte: string,
  lat: number,
  lon: number
): string {
  return `<button class="popup-botao-reportar" data-reportar-ponto
    data-tipo="${tipo}" data-ponto-id="${escaparAtributo(id)}" data-ponto-nome="${escaparAtributo(nome)}"
    data-ponto-fonte="${escaparAtributo(fonte)}" data-lat="${lat}" data-lon="${lon}">⚠️ Reportar este ponto</button>`;
}

interface PropsVisualizadorMapa {
  camadas: EstadoCamadas;
  paradasComTatil: ParadaOnibus[];
  sinaisSonoros: SinalSonoro[];
  obras: Obra[];
  acidentes: Acidente[];
  onibusAoVivo: OnibusAoVivo[];
  posicaoUsuario: LocalizacaoUsuario | null;
  rota: RotaAcessivel | null;
  reportes: Reporte[];
  aoReportarPonto: (dados: { tipo: 'obra' | 'botoeira_quebrada'; pontoId: string; pontoNome: string; pontoFonte: string; lat: number; lon: number }) => void;
}

const CENTRO_POA: [number, number] = [-30.0346, -51.2177];

function assinatura(ids: (string | number)[]): string {
  return ids.join(',');
}

function desenharSeMudou(
  refUltimaAssinatura: { current: string },
  ids: (string | number)[],
  desenhar: () => void
): void {
  const sig = assinatura(ids);
  if (sig === refUltimaAssinatura.current) return;
  refUltimaAssinatura.current = sig;
  desenhar();
}

export function VisualizadorMapa({
  camadas,
  paradasComTatil,
  sinaisSonoros,
  obras,
  acidentes,
  onibusAoVivo,
  posicaoUsuario,
  rota,
  reportes,
  aoReportarPonto,
}: PropsVisualizadorMapa) {
  const refContainer = useRef<HTMLDivElement>(null);
  const refMapa = useRef<L.Map | null>(null);
  const refGruposCamadas = useRef<Record<string, L.LayerGroup>>({});
  const refMarcadorUsuario = useRef<L.Marker | null>(null);
  const refCirculoPrecisao = useRef<L.Circle | null>(null);
  const refLinhaRota = useRef<L.Polyline | null>(null);
  const refContornoRota = useRef<L.Polyline | null>(null);
  const refJaCentralizou = useRef(false);

  useEffect(() => {
    if (!refContainer.current || refMapa.current) return;

    const mapa = L.map(refContainer.current, {
      center: CENTRO_POA,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);

    L.control.zoom({ position: 'topleft', zoomInTitle: 'Aumentar zoom', zoomOutTitle: 'Diminuir zoom' }).addTo(mapa);

    refGruposCamadas.current = {
      paradas: L.layerGroup().addTo(mapa),
      botoneiras: L.layerGroup().addTo(mapa),
      obras: L.layerGroup().addTo(mapa),
      acidentes: L.layerGroup().addTo(mapa),
      onibus: L.layerGroup().addTo(mapa),
      reportes: L.layerGroup().addTo(mapa),
    };
    refMapa.current = mapa;

    return () => {
      mapa.remove();
      refMapa.current = null;
    };
  }, []);

  // Um único listener delegado no container do mapa pros botões "Reportar
  // este ponto" embutidos nos popups (que são HTML puro do Leaflet, não
  // React) — evita ter que religar um listener a cada popup aberto/fechado.
  const refAoReportarPonto = useRef(aoReportarPonto);
  useEffect(() => {
    refAoReportarPonto.current = aoReportarPonto;
  }, [aoReportarPonto]);

  useEffect(() => {
    const container = refMapa.current?.getContainer();
    if (!container) return;
    const lidarComClique = (e: MouseEvent) => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-reportar-ponto]');
      if (!alvo) return;
      const { tipo, pontoId, pontoNome, pontoFonte, lat, lon } = alvo.dataset;
      if (!tipo || !pontoId || lat === undefined || lon === undefined) return;
      refAoReportarPonto.current({
        tipo: tipo as 'obra' | 'botoeira_quebrada',
        pontoId,
        pontoNome: pontoNome ?? '',
        pontoFonte: pontoFonte ?? '',
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      });
    };
    container.addEventListener('click', lidarComClique);
    return () => container.removeEventListener('click', lidarComClique);
  }, []);

  useEffect(() => {
    const mapa = refMapa.current;
    const grupos = refGruposCamadas.current;
    if (!mapa) return;
    (Object.keys(camadas) as Array<keyof typeof camadas>).forEach((chave) => {
      if (!grupos[chave]) return;
      if (camadas[chave]) mapa.addLayer(grupos[chave]);
      else mapa.removeLayer(grupos[chave]);
    });
  }, [camadas]);

  const refAssinaturaParadas = useRef('');
  const refAssinaturaBotoneiras = useRef('');
  const refAssinaturaObras = useRef('');
  const refAssinaturaAcidentes = useRef('');
  const refAssinaturaOnibus = useRef('');
  const refAssinaturaReportes = useRef('');
  useEffect(() => {
    const g = refGruposCamadas.current.paradas;
    if (!g) return;
    if (!camadas.paradas) {
      g.clearLayers();
      refAssinaturaParadas.current = '';
      return;
    }
    desenharSeMudou(refAssinaturaParadas, paradasComTatil.map((p) => p.idParada), () => {
      g.clearLayers();
      paradasComTatil.forEach((parada) => {
        const textoFonte = parada.fontePisoTatil === 'eptc' ? 'confirmado pela EPTC (planilha oficial)' : 'indicado no OpenStreetMap';
        L.marker([parada.latParada, parada.lonParada], { icon: iconeCirculo('#2fd992', 16, '🟢') })
          .bindPopup(`
            <strong>${parada.nomeParada}</strong><br/>
            <small>Parada #${parada.idParada} · piso tátil ${textoFonte}</small>
          `)
          .addTo(g);
      });
    });
  }, [paradasComTatil, camadas.paradas]);

  useEffect(() => {
    const g = refGruposCamadas.current.botoneiras;
    if (!g) return;
    if (!camadas.botoneiras) {
      g.clearLayers();
      refAssinaturaBotoneiras.current = '';
      return;
    }
    desenharSeMudou(refAssinaturaBotoneiras, sinaisSonoros.map((s) => s.id), () => {
      g.clearLayers();
      sinaisSonoros.forEach((sinal) => {
        const fonteTxt = sinal.fonte === 'eptc' ? 'confirmado pela EPTC (planilha oficial)' : 'indicado no OpenStreetMap';
        L.marker([sinal.lat, sinal.lon], { icon: iconeCirculo('#4cc9f0', 16, '🔊') })
          .bindPopup(
            `<strong>Botoeira sonora</strong>${sinal.nome ? `<br/>${sinal.nome}` : ''}<br/><small>${fonteTxt}</small>` +
              botaoReportarEstePonto('botoeira_quebrada', sinal.id, sinal.nome ?? 'Botoeira sonora', sinal.fonte ?? 'osm', sinal.lat, sinal.lon)
          )
          .addTo(g);
      });
    });
  }, [sinaisSonoros, camadas.botoneiras]);

  useEffect(() => {
    const g = refGruposCamadas.current.obras;
    if (!g) return;
    if (!camadas.obras) {
      g.clearLayers();
      refAssinaturaObras.current = '';
      return;
    }
    desenharSeMudou(refAssinaturaObras, obras.map((o) => o.id), () => {
      g.clearLayers();
      obras.forEach((obra) => {
        const textoFonte = obra.fonte === 'smoi' ? 'obra oficial — SMOI (Secretaria Municipal de Obras)' : 'indicado no OpenStreetMap';
        const linhaEndereco = obra.endereco ? `<br/>${obra.endereco}` : '';
        L.marker([obra.lat, obra.lon], { icon: iconeQuadrado('#f5a623', '🚧') })
          .bindPopup(
            `<strong>Obra em execução</strong><br/>${obra.nome ?? obra.tipo}${linhaEndereco}<br/><small>${textoFonte}</small>` +
              botaoReportarEstePonto('obra', obra.id, obra.nome ?? obra.tipo, obra.fonte ?? 'osm', obra.lat, obra.lon)
          )
          .addTo(g);
      });
    });
  }, [obras, camadas.obras]);

  // Reportes da comunidade não têm toggle de visibilidade — são alertas
  // ativos, não uma camada estética que a pessoa liga/desliga por gosto.
  useEffect(() => {
    const g = refGruposCamadas.current.reportes;
    if (!g) return;
    desenharSeMudou(refAssinaturaReportes, reportes.map((r) => r.id), () => {
      g.clearLayers();
      reportes.forEach((rep) => {
        const info = ROTULO_TIPO_REPORTE[rep.tipo];
        const tempoAtras = formatarTempoRelativo(rep.criadoEm);
        const descricao = rep.descricao ? `<br/>${rep.descricao}` : '';
        L.marker([rep.lat, rep.lon], { icon: iconeCirculo(info.cor, 24, info.emoji) })
          .bindPopup(
            `<strong>${info.titulo}</strong>${descricao}<br/><small>reportado por ${rep.usuarioNome} · ${tempoAtras}</small>`
          )
          .addTo(g);
      });
    });
  }, [reportes]);

  useEffect(() => {
    const g = refGruposCamadas.current.acidentes;
    if (!g) return;
    if (!camadas.acidentes) {
      g.clearLayers();
      refAssinaturaAcidentes.current = '';
      return;
    }
    desenharSeMudou(refAssinaturaAcidentes, acidentes.map((a) => a.id), () => {
      g.clearLayers();
      const mapaCores = { leve: '#facc15', grave: '#f5a623', fatal: '#ff5470' };
      acidentes.forEach((a) => {
        L.marker([a.lat, a.lon], { icon: iconeCirculo(mapaCores[a.gravidade], 12) })
          .bindPopup(`<strong>Acidente ${a.gravidade}</strong><br/>${a.data}<br/>${a.descricao ?? ''}`)
          .addTo(g);
      });
    });
  }, [acidentes, camadas.acidentes]);

  useEffect(() => {
    const g = refGruposCamadas.current.onibus;
    if (!g) return;
    if (!camadas.onibus) {
      g.clearLayers();
      refAssinaturaOnibus.current = '';
      return;
    }
    desenharSeMudou(refAssinaturaOnibus, onibusAoVivo.map((b) => `${b.idVeiculo}:${b.lat.toFixed(5)},${b.lon.toFixed(5)}`), () => {
      g.clearLayers();
      onibusAoVivo.forEach((b) => {
        L.marker([b.lat, b.lon], { icon: iconeQuadrado('#4cc9f0', '🚌') })
          .bindPopup(`<strong>Linha ${b.linha}</strong><br/>Veículo: ${b.idVeiculo}`)
          .addTo(g);
      });
    });
  }, [onibusAoVivo, camadas.onibus]);

  useEffect(() => {
    const mapa = refMapa.current;
    if (!mapa || !posicaoUsuario) return;
    const latLon: [number, number] = [posicaoUsuario.lat, posicaoUsuario.lon];

    const iconeUsuario = L.divIcon({
      className: 'marcador-usuario',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#4cc9f0;border:3px solid #fff;
        box-shadow:0 0 0 4px rgba(76,201,240,0.3);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (refMarcadorUsuario.current) {
      refMarcadorUsuario.current.setLatLng(latLon);
    } else {
      refMarcadorUsuario.current = L.marker(latLon, { icon: iconeUsuario, zIndexOffset: 999 })
        .bindPopup('Você está aqui')
        .addTo(mapa);
    }

    if (posicaoUsuario.precisao) {
      if (refCirculoPrecisao.current) {
        refCirculoPrecisao.current.setLatLng(latLon).setRadius(posicaoUsuario.precisao);
      } else {
        refCirculoPrecisao.current = L.circle(latLon, {
          radius: posicaoUsuario.precisao,
          color: '#4cc9f0',
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(mapa);
      }
    }

    if (!refJaCentralizou.current) {
      mapa.setView(latLon, 16);
      refJaCentralizou.current = true;
    }
  }, [posicaoUsuario]);

  useEffect(() => {
    const mapa = refMapa.current;
    if (!mapa) return;

    if (refLinhaRota.current) {
      mapa.removeLayer(refLinhaRota.current);
      refLinhaRota.current = null;
    }
    if (refContornoRota.current) {
      mapa.removeLayer(refContornoRota.current);
      refContornoRota.current = null;
    }
    if (!rota) return;

    // Contorno claro por baixo da linha colorida — sem isso, qualquer cor de
    // rota "some" um pouco em cima do mapa escuro. É a mesma técnica que
    // Google Maps/Waze usam pra rota ficar visível em qualquer fundo.
    refContornoRota.current = L.polyline(rota.coordenadas, {
      color: '#ffffff',
      weight: 9,
      opacity: 0.55,
      className: 'linha-rota-contorno',
    }).addTo(mapa);

    refLinhaRota.current = L.polyline(rota.coordenadas, {
      color: '#39ff9d',
      weight: 6,
      opacity: 1,
      className: 'linha-rota',
    }).addTo(mapa);
    mapa.fitBounds(refLinhaRota.current.getBounds(), { padding: [40, 40] });
  }, [rota]);

  return (
    <div
      ref={refContainer}
      className="visualizador-mapa"
      role="application"
      aria-label="Mapa interativo de Porto Alegre. Para navegação por leitor de tela, use a lista de pontos próximos e os alertas de proximidade em vez do mapa visual."
    />
  );
}
