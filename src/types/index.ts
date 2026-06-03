export type LayerType = 'paradas' | 'semaforos' | 'obras' | 'acidentes' | 'onibus';

export interface BusStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  lines?: string[];
}

export interface TrafficLight {
  id: string;
  lat: number;
  lon: number;
  status?: 'ok' | 'broken' | 'unknown';
}

export interface RoadWork {
  id: string;
  title: string;
  description: string;
  lat: number;
  lon: number;
  severity: 'low' | 'medium' | 'high';
  start_date?: string;
  end_date?: string;
}

export interface LiveBus {
  vehicle_id: string;
  line: string;
  lat: number;
  lon: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface Accident {
  id: string;
  lat: number;
  lon: number;
  date: string;
  severity: 'leve' | 'grave' | 'fatal';
  description?: string;
}

export interface LayerState {
  paradas: boolean;
  semaforos: boolean;
  obras: boolean;
  acidentes: boolean;
  onibus: boolean;
}

export interface UserLocation {
  lat: number;
  lon: number;
  accuracy?: number;
}
