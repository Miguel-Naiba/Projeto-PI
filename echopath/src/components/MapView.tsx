import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';


import { PontoInteresse } from '../types';
 
import 'leaflet/dist/leaflet.css';
 
interface MapViewProps {

  pontos: PontoInteresse[];

}
 
export function MapView({ pontos }: MapViewProps) {

  // Coordenadas centrais de Porto Alegre

  const centroPOA: [number, number] = [-30.0346, -51.2177];
 
  return (
<div role="application" aria-label="Mapa interativo de Porto Alegre">
<MapContainer center={centroPOA} zoom={13} style={{ height: "400px", width: "100%" }}>
<TileLayer

          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

        />

        {pontos.map((ponto) => {

          const lat = typeof ponto.latitude === 'string' ? parseFloat(ponto.latitude) : ponto.latitude;

          const lng = typeof ponto.longitude === 'string' ? parseFloat(ponto.longitude) : ponto.longitude;
 
          if (isNaN(lat) || isNaN(lng)) return null;
 
          return (
<Marker key={ponto._id} position={[lat, lng]}>
<Popup>
<strong>{ponto.nome}</strong>

                {ponto.endereco && <p>{ponto.endereco}</p>}
</Popup>
</Marker>

          );

        })}
</MapContainer>
</div>

  );

}
 