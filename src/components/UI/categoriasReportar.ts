import type { TipoReporte } from '../../types';

export interface OpcaoTipo {
  tipo: TipoReporte;
  rotulo: string;
  icone: string;
  problemas: string[];
}

export const TIPOS: OpcaoTipo[] = [
  {
    tipo: 'obra',
    rotulo: 'Obra',
    icone: '🚧',
    problemas: ['Nova obra / calçada quebrada', 'Bloqueia a passagem', 'Representa risco', 'Não existe mais', 'Localização incorreta', 'Outro'],
  },
  {
    tipo: 'botoeira_quebrada',
    rotulo: 'Botoeira quebrada',
    icone: '🔇',
    problemas: ['Não funciona', 'Não existe', 'Danificada', 'Localização incorreta', 'Outro'],
  },
  {
    tipo: 'rua_obstruida',
    rotulo: 'Rua obstruída',
    icone: '🚫',
    problemas: ['Carro na calçada', 'Árvore caída', 'Alagamento', 'Obra sem sinalização', 'Outro'],
  },
];

/**
 * Disponibilidade dinâmica das categorias do Reportar (PROMPT MESTRE, seção
 * 17): uma categoria só some quando o dataset oficial correspondente não tem
 * NENHUM ponto reportável no momento (ex.: obras:geocode ainda não rodou, ou
 * rodou e não achou nenhuma obra válida). `rua_obstruida` não depende de
 * catálogo — é sempre um relato livre — então não entra nesse mapa e fica
 * sempre visível. Ausência de uma chave (ou o parâmetro inteiro undefined,
 * enquanto os dados ainda carregam) significa "disponível", pra não sumir
 * botões durante o carregamento inicial.
 */
export function categoriasVisiveis(tipos: OpcaoTipo[], disponibilidade?: Partial<Record<TipoReporte, boolean>>): OpcaoTipo[] {
  if (!disponibilidade) return tipos;
  return tipos.filter((t) => disponibilidade[t.tipo] !== false);
}
