import type { TipoReporte } from '../../types';

export interface OpcaoTipo {
  tipo: TipoReporte;
  rotulo: string;
  icone: string;
  problemas: string[];
}

export const TIPOS: OpcaoTipo[] = [
  {
    tipo: 'parada_tatil',
    rotulo: 'Parada com piso tátil',
    icone: '🟢',
    problemas: ['Piso tátil ausente ou removido', 'Piso tátil danificado', 'Obstrução no acesso à parada', 'Localização incorreta', 'Outro'],
  },
  {
    tipo: 'botoeira',
    rotulo: 'Botoeira sonora',
    icone: '🔊',
    problemas: ['Não funciona', 'Não existe mais', 'Danificada', 'Localização incorreta', 'Outro'],
  },
  {
    tipo: 'obra',
    rotulo: 'Obra',
    icone: '🚧',
    problemas: ['Nova obra / calçada quebrada', 'Bloqueia a passagem', 'Representa risco', 'Não existe mais', 'Localização incorreta', 'Outro'],
  },
];

/**
 * Disponibilidade dinâmica das categorias do Reportar (checklist Fase 3,
 * item 3): uma categoria só some quando o dataset oficial correspondente não
 * tem NENHUM ponto reportável no momento (ex.: obras geocode ainda não
 * rodou, ou rodou e não achou nenhuma obra válida). Ausência de uma chave
 * (ou o parâmetro inteiro undefined, enquanto os dados ainda carregam)
 * significa "disponível", pra não sumir botões durante o carregamento
 * inicial.
 */
export function categoriasVisiveis(tipos: OpcaoTipo[], disponibilidade?: Partial<Record<TipoReporte, boolean>>): OpcaoTipo[] {
  if (!disponibilidade) return tipos;
  return tipos.filter((t) => disponibilidade[t.tipo] !== false);
}
