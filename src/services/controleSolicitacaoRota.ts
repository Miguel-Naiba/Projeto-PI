import type { PontoProximidade } from '../types';
import type { ContextoAcessibilidade } from './roteamento';
import type { RotaCandidata } from './avaliadorRota';
import { foiCancelado } from './requisicao';

export type MotivoRota = 'manual' | 'recalculo';
export interface EstadoSolicitacaoRota {
  rota: RotaCandidata | null;
  status: 'ocioso' | 'carregando' | 'sucesso' | 'erro';
  erro: string | null;
  erroStatus: number | null;
  motivo: MotivoRota;
  destinoSolicitado: PontoProximidade | null;
}
type Calcular = (origem: [number, number], destino: PontoProximidade, contexto: ContextoAcessibilidade, sinal: AbortSignal) => Promise<RotaCandidata>;

/** Controlador usado pelo hook; testável sem DOM, sem duplicar estado de rota. */
export class ControleSolicitacaoRota {
  estado: EstadoSolicitacaoRota = { rota: null, status: 'ocioso', erro: null, erroStatus: null, motivo: 'manual', destinoSolicitado: null };
  private ativa?: { chave: string; controle: AbortController; promessa: Promise<void> };
  private calcular: Calcular;
  private publicar: (estado: EstadoSolicitacaoRota) => void;
  constructor(calcular: Calcular, publicar: (estado: EstadoSolicitacaoRota) => void) {
    this.calcular = calcular; this.publicar = publicar;
  }
  private atualizar(campos: Partial<EstadoSolicitacaoRota>) {
    this.estado = { ...this.estado, ...campos };
    this.publicar(this.estado);
  }
  solicitar(origem: [number, number], destino: PontoProximidade, contexto: ContextoAcessibilidade, motivo: MotivoRota = 'manual'): Promise<void> {
    // GPS/contexto atualizado não duplica o mesmo pedido pendente ao mesmo destino.
    const chave = JSON.stringify([motivo, destino.id, destino.lat, destino.lon]);
    if (this.ativa?.chave === chave) return this.ativa.promessa;
    this.ativa?.controle.abort(); // troca de destino ou substituição explícita
    const controle = new AbortController();
    const tarefa = { chave, controle, promessa: Promise.resolve() };
    this.ativa = tarefa;
    this.atualizar({ status: 'carregando', erro: null, erroStatus: null, motivo, destinoSolicitado: destino });
    tarefa.promessa = this.executar(tarefa, origem, destino, contexto);
    return tarefa.promessa;
  }
  private async executar(tarefa: NonNullable<ControleSolicitacaoRota['ativa']>, origem: [number, number], destino: PontoProximidade, contexto: ContextoAcessibilidade) {
    try {
      const rota = await this.calcular(origem, destino, contexto, tarefa.controle.signal);
      if (this.ativa !== tarefa || tarefa.controle.signal.aborted) return;
      this.atualizar({ rota, status: 'sucesso' });
    } catch (erro) {
      if (this.ativa !== tarefa || tarefa.controle.signal.aborted) return;
      if (foiCancelado(erro)) {
        this.atualizar({ status: this.estado.rota ? 'sucesso' : 'ocioso' });
      } else {
        this.atualizar({ status: 'erro', erro: erro instanceof Error ? erro.message : 'Falha ao processar a rota. Tente novamente.',
          erroStatus: (erro as { status?: number } | null)?.status ?? null });
      }
    } finally {
      if (this.ativa === tarefa) this.ativa = undefined;
    }
  }
  cancelar(limpar = false) {
    this.ativa?.controle.abort();
    this.ativa = undefined;
    this.atualizar({ rota: limpar ? null : this.estado.rota,
      status: !limpar && this.estado.rota ? 'sucesso' : 'ocioso', erro: null, erroStatus: null });
  }
}
