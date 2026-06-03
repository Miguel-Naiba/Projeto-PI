import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LayerState, BusStop, RoadWork, Accident, LiveBus } from '../../types';
import './MapView.css';

// Fix Leaflet default icon paths in Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Custom circle marker factory ────────────────────────────────────────────
function circleIcon(color: string, size = 14) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.5);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function busIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:4px;
      background:#3b82f6;border:2px solid #fff;
      font-size:13px;display:flex;align-items:center;
      justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.5);
    ">🚌</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MapViewProps {
  layers: LayerState;
  busStops: BusStop[];
  roadWorks: RoadWork[];
  accidents: Accident[];
  liveBuses: LiveBus[];
  userPosition: [number, number] | null;
}

const POA_CENTER: [number, number] = [-30.0346, -51.2177];

export function MapView({ layers, busStops, roadWorks, accidents, liveBuses, userPosition }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  // ── Init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: POA_CENTER,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control repositioned
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Create layer groups
    const groups = {
      paradas:   L.layerGroup().addTo(map),
      semaforos: L.layerGroup().addTo(map),
      obras:     L.layerGroup().addTo(map),
      acidentes: L.layerGroup().addTo(map),
      onibus:    L.layerGroup().addTo(map),
    };

    layerGroupsRef.current = groups;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Layer visibility ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const groups = layerGroupsRef.current;
    if (!map) return;

    (Object.keys(layers) as Array<keyof typeof layers>).forEach((key) => {
      if (!groups[key]) return;
      if (layers[key]) {
        map.addLayer(groups[key]);
      } else {
        map.removeLayer(groups[key]);
      }
    });
  }, [layers]);

  // ── Bus stops ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = layerGroupsRef.current.paradas;
    if (!g) return;
    g.clearLayers();
    if (!layers.paradas) return;
    busStops.forEach((stop) => {
      L.marker([stop.stop_lat, stop.stop_lon], { icon: circleIcon('#22c55e', 14) })
        .bindPopup(`
          <strong>${stop.stop_name}</strong><br/>
          <small>Parada #${stop.stop_id}</small>
          ${stop.lines ? `<br/><small>Linhas: ${stop.lines.join(', ')}</small>` : ''}
        `)
        .addTo(g);
    });
  }, [busStops, layers.paradas]);

  // ── Road works ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = layerGroupsRef.current.obras;
    if (!g) return;
    g.clearLayers();
    if (!layers.obras) return;
    const colorMap = { low: '#facc15', medium: '#f97316', high: '#ef4444' };
    roadWorks.forEach((w) => {
      L.marker([w.lat, w.lon], { icon: circleIcon(colorMap[w.severity], 14) })
        .bindPopup(`<strong>${w.title}</strong><br/>${w.description}`)
        .addTo(g);
    });
  }, [roadWorks, layers.obras]);

  // ── Accidents ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = layerGroupsRef.current.acidentes;
    if (!g) return;
    g.clearLayers();
    if (!layers.acidentes) return;
    const colorMap = { leve: '#facc15', grave: '#f97316', fatal: '#ef4444' };
    accidents.forEach((a) => {
      L.marker([a.lat, a.lon], { icon: circleIcon(colorMap[a.severity], 12) })
        .bindPopup(`<strong>Acidente ${a.severity}</strong><br/>${a.date}<br/>${a.description ?? ''}`)
        .addTo(g);
    });
  }, [accidents, layers.acidentes]);

  // ── Live buses ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const g = layerGroupsRef.current.onibus;
    if (!g) return;
    g.clearLayers();
    if (!layers.onibus) return;
    liveBuses.forEach((b) => {
      L.marker([b.lat, b.lon], { icon: busIcon() })
        .bindPopup(`<strong>Linha ${b.line}</strong><br/>Veículo: ${b.vehicle_id}`)
        .addTo(g);
    });
  }, [liveBuses, layers.onibus]);

  // ── User position ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;

    const userIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#3b82f6;border:3px solid #fff;
        box-shadow:0 0 0 4px rgba(59,130,246,0.3);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userPosition);
    } else {
      userMarkerRef.current = L.marker(userPosition, { icon: userIcon, zIndexOffset: 999 })
        .bindPopup('Você está aqui')
        .addTo(map);
      map.setView(userPosition, 15);
    }
  }, [userPosition]);

  return <div ref={containerRef} className="map-view" role="application" aria-label="Mapa interativo de Porto Alegre" />;
}
