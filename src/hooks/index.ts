import { useState, useEffect } from 'react';
import { fetchBusStops, MOCK_BUS_STOPS, MOCK_ROAD_WORKS, MOCK_ACCIDENTS, MOCK_LIVE_BUSES } from '../services/api';
import type { BusStop, RoadWork, Accident, LiveBus } from '../types';

// ─── Bus Stops (GTFS) ─────────────────────────────────────────────────────────
export function useBusStops(enabled: boolean) {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    fetchBusStops()
      .then((data) => setStops(data as BusStop[]))
      .catch(() => setStops(MOCK_BUS_STOPS as BusStop[]))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { stops, loading };
}

// ─── Road Works ───────────────────────────────────────────────────────────────
export function useRoadWorks(enabled: boolean) {
  const [works, setWorks] = useState<RoadWork[]>([]);

  useEffect(() => {
    if (!enabled) return;
    // TODO: fetch real endpoint when available
    setWorks(MOCK_ROAD_WORKS as RoadWork[]);
  }, [enabled]);

  return { works };
}

// ─── Accidents ────────────────────────────────────────────────────────────────
export function useAccidents(enabled: boolean) {
  const [accidents, setAccidents] = useState<Accident[]>([]);

  useEffect(() => {
    if (!enabled) return;
    setAccidents(MOCK_ACCIDENTS as Accident[]);
  }, [enabled]);

  return { accidents };
}

// ─── Live Buses (TRI GPS) ─────────────────────────────────────────────────────
export function useLiveBuses(enabled: boolean, intervalMs = 15000) {
  const [buses, setBuses] = useState<LiveBus[]>([]);

  useEffect(() => {
    if (!enabled) return;
    setBuses(MOCK_LIVE_BUSES as LiveBus[]);

    // Pool a cada intervalMs
    const id = setInterval(() => {
      setBuses(MOCK_LIVE_BUSES as LiveBus[]); // swap for real fetch
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return { buses };
}

// ─── User Geolocation ─────────────────────────────────────────────────────────
export function useUserLocation() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      (err) => setError(err.message),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, error };
}
