import type { GeojsonOrs } from './api';
export function geojsonValido(geometria: Record<string, unknown> = {}): GeojsonOrs {
  return { type: 'FeatureCollection', features: [{ type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[-51.23, -30.03], [-51.229, -30.03]], ...geometria },
    properties: { summary: { distance: 100, duration: 90 }, segments: [{ distance: 100, duration: 90,
      steps: [{ instruction: 'Siga em frente', distance: 100, duration: 90, way_points: [0, 1] }] }] },
  }] };
}
