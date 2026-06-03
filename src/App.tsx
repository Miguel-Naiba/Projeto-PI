import { useState, useCallback } from 'react';
import { Header } from './components/UI/Header';
import { BottomBar } from './components/UI/BottomBar';
import { MapView } from './components/Map/MapView';
import { LocationList } from './components/LocationList';
import { useBusStops, useRoadWorks, useAccidents, useLiveBuses, useUserLocation } from './hooks';
import type { LayerState, LayerType } from './types';
import './App.css';

const DEFAULT_LAYERS: LayerState = {
  paradas:   true,
  semaforos: true,
  obras:     true,
  acidentes: false,
  onibus:    false,
};

export default function App() {
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  // Data hooks
  const { stops }    = useBusStops(layers.paradas);
  const { works }    = useRoadWorks(layers.obras);
  const { accidents } = useAccidents(layers.acidentes);
  const { buses }    = useLiveBuses(layers.onibus);
  const { position } = useUserLocation();

  const handleToggle = useCallback((id: LayerType, val: boolean) => {
    setLayers((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleSearchSubmit = useCallback((query: string) => {
    if (!query.trim()) return;
    // TODO: geocode query and fly to result
    console.log('Search:', query);
  }, []);

  // Voice navigation (screen reader + speech synthesis)
  const handleVoice = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      alert('Síntese de voz não suportada neste navegador.');
      return;
    }
    const msg = position
      ? `Sua posição atual: latitude ${position[0].toFixed(4)}, longitude ${position[1].toFixed(4)}. ${stops.length} paradas disponíveis na camada ativa.`
      : 'Localização não disponível. Ative o GPS para navegação guiada.';
    const utter = new SpeechSynthesisUtterance(msg);
    utter.lang = 'pt-BR';
    window.speechSynthesis.speak(utter);
  }, [position, stops.length]);

  return (
    <div className="app" lang="pt-BR">
      <Header
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
      />

      <main className="app-main">
        <MapView
          layers={layers}
          busStops={stops}
          roadWorks={works}
          accidents={accidents}
          liveBuses={buses}
          userPosition={position}
        />

        <LocationList
          busStops={stops}
          roadWorks={works}
          userPosition={position}
          visible={showList}
          onClose={() => setShowList(false)}
        />
      </main>

      <BottomBar
        layers={layers}
        onToggle={handleToggle}
        onVoiceClick={handleVoice}
        onFavoritesClick={() => setShowList(true)}
        onConfigClick={() => console.log('Config')}
        onAboutClick={() => console.log('Sobre')}
      />
    </div>
  );
}
