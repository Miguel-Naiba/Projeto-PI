import type { BusStop, RoadWork } from '../../types';
import './LocationList.css';

interface LocationListProps {
  busStops: BusStop[];
  roadWorks: RoadWork[];
  userPosition: [number, number] | null;
  visible: boolean;
  onClose: () => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LocationList({ busStops, roadWorks, userPosition, visible, onClose }: LocationListProps) {
  if (!visible) return null;

  const sortedStops = userPosition
    ? [...busStops].sort(
        (a, b) =>
          haversineKm(userPosition[0], userPosition[1], a.stop_lat, a.stop_lon) -
          haversineKm(userPosition[0], userPosition[1], b.stop_lat, b.stop_lon)
      )
    : busStops;

  return (
    <aside className="location-list" role="complementary" aria-label="Lista de pontos próximos">
      <div className="location-list__header">
        <h2>Pontos próximos</h2>
        <button className="close-btn" onClick={onClose} aria-label="Fechar lista">✕</button>
      </div>

      {roadWorks.length > 0 && (
        <section>
          <h3 className="section-title warning">⚠️ Obras ativas</h3>
          <ul className="location-items">
            {roadWorks.map((w) => (
              <li key={w.id} className={`location-item obra severity-${w.severity}`}>
                <span className="item-icon">🚧</span>
                <div className="item-info">
                  <span className="item-name">{w.title}</span>
                  <span className="item-desc">{w.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="section-title">🚏 Paradas de ônibus</h3>
        <ul className="location-items">
          {sortedStops.slice(0, 10).map((stop) => {
            const dist = userPosition
              ? haversineKm(userPosition[0], userPosition[1], stop.stop_lat, stop.stop_lon)
              : null;
            return (
              <li key={stop.stop_id} className="location-item parada">
                <span className="item-icon">🟢</span>
                <div className="item-info">
                  <span className="item-name">{stop.stop_name}</span>
                  {dist !== null && (
                    <span className="item-dist">{dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
