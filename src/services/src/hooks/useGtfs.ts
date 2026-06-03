import { useState, useEffect } from 'react';
import { loadGtfsStops } from '../services/gtfs';
import { MOCK_BUS_STOPS } from '../services/api';
import type { BusStop } from '../types';

export type GtfsStatus = 'idle' | 'loading' | 'success' | 'error';

export function useGtfsStops(enabled: boolean) {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [status, setStatus] = useState<GtfsStatus>('idle');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    setStatus('loading');

    loadGtfsStops()
      .then((data) => {
        setStops(data);
        setCount(data.length);
        setStatus('success');
      })
      .catch((err) => {
        console.warn('GTFS falhou, usando mocks:', err);
        setStops(MOCK_BUS_STOPS as BusStop[]);
        setCount(MOCK_BUS_STOPS.length);
        setStatus('error');
      });
  }, [enabled]);

  return { stops, status, count };
}
