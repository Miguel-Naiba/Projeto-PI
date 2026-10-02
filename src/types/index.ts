export type TipoCamada = 'paradas' | 'botoneiras' | 'obras' | 'acidentes' | 'onibus';

// Nomenclatura e catálogo oficiais definidos na Fase 3: as 3 categorias de
// Reportar são exatamente estas — "parada_tatil" corresponde à categoria
// exibida como "Parada com piso tátil". Não existe mais "rua_obstruida"
// como categoria fechada.
export type TipoReporte = 'parada_tatil' | 'botoeira' | 'obra';

export type StatusReporte = 'pendente' | 'validado' | 'rejeitado';

export interface Reporte {
  id: string;
  tipo: TipoReporte;
  /** Sub-categoria do problema (ex.: "não funciona", "danificada") — texto livre curto, não um enum fechado, pra não travar em categorias que não cobrem o caso real. */
  problema?: string;
  lat: number;
  lon: number;
  descricao: string;
  /** Preenchido só quando o reporte parte de um ponto já existente no mapa (obra/botoeira/parada) — não pedimos de novo o que já sabemos. */
  pontoId?: string;
  pontoNome?: string;
  pontoFonte?: string;
  /** true quando o reporte foi feito com uma rota ativa — nunca inferido, só quando dá pra calcular de verdade. */
  rotaAtiva?: boolean;
  distanciaDaRotaM?: number;
  usuarioId: string;
  usuarioNome: string;
  criadoEm: string;
  status: StatusReporte;
}

export interface ParadaOnibus {
  idParada: string;
  nomeParada: string;
  latParada: number;
  lonParada: number;
  linhas?: string[];
  pisoTatil?: boolean;
  distanciaPisoTatilM?: number;
  fontePisoTatil?: 'eptc' | 'osm';
}

export interface SinalSonoro {
  id: string;
  idOsm?: number;
  lat: number;
  lon: number;
  nome?: string;
  pisoTatil?: boolean;
  fonte?: 'eptc' | 'osm';
}

export interface Obra {
  id: string;
  idOsm?: number;
  lat: number;
  lon: number;
  tipo: 'via' | 'calcada' | 'edificacao' | 'outro';
  nome?: string;
  endereco?: string | null;
  fonte?: 'smoi' | 'osm';
}

export interface OnibusAoVivo {
  idVeiculo: string;
  linha: string;
  lat: number;
  lon: number;
  velocidade?: number;
  direcao?: number;
  timestamp: number;
}

export interface Acidente {
  id: string;
  lat: number;
  lon: number;
  data: string;
  gravidade: 'leve' | 'grave' | 'fatal';
  descricao?: string;
}

export interface EstadoCamadas {
  paradas: boolean;
  botoneiras: boolean;
  obras: boolean;
  acidentes: boolean;
  onibus: boolean;
}

export interface LocalizacaoUsuario {
  lat: number;
  lon: number;
  precisao?: number;
  direcao?: number | null;
  velocidade?: number | null;
  timestamp: number;
}

export type TipoPonto = 'parada_tatil' | 'botoeira' | 'obra' | 'acidente' | 'destino';

export interface PontoProximidade {
  id: string;
  tipo: TipoPonto;
  nome: string;
  lat: number;
  lon: number;
}

export const LIMIARES_ALERTA = [200, 100, 50] as const;
export type LimiarAlerta = (typeof LIMIARES_ALERTA)[number];

export interface EventoProximidade {
  ponto: PontoProximidade;
  limiar: LimiarAlerta;
  distanciaM: number;
}

export interface EtapaRota {
  instrucao: string;
  distanciaM: number;
  duracaoS: number;
  lat: number;
  lon: number;
}

export interface RotaAcessivel {
  coordenadas: [number, number][];
  etapas: EtapaRota[];
  distanciaM: number;
  duracaoS: number;
  destino: PontoProximidade;
}

/**
 * Item do catálogo oficial de Reportar (Fase 3): só pontos geocodificados
 * das fontes oficiais (EPTC/SMOI) entram aqui — nunca um ponto pendente,
 * sem coordenada válida, ou só-OSM sem confirmação oficial (ver
 * fonte === 'eptc' | 'smoi' nos serviços de dados). O fluxo definitivo de
 * Reportar seleciona sempre um destes itens, nunca inventa coordenada.
 */
export interface ItemCatalogoReportar {
  id: string;
  nome: string;
  lat: number;
  lon: number;
  fonte: string;
  endereco?: string | null;
}
