import { useCallback, useEffect, useState } from 'react';
import { buscarReportesRecentes, criarReporte, apagarReporte } from '../services/reportes';
import { supabase } from '../services/supabaseClient';
import type { Reporte, TipoReporte } from '../types';

// Reconsulta periodicamente pra pegar reportes de outras pessoas sem
// precisar recarregar o app — não é tempo real (isso pediria Realtime do
// Supabase, um passo a mais), mas 2 minutos é frequente o bastante pra um
// alerta sobre obra/botoeira/rua obstruída continuar útil.
const INTERVALO_ATUALIZACAO_MS = 2 * 60 * 1000;

export interface DadosEnvioReporte {
  tipo: TipoReporte;
  problema?: string;
  lat: number;
  lon: number;
  descricao: string;
  pontoId?: string;
  pontoNome?: string;
  pontoFonte?: string;
  rotaAtiva?: boolean;
  distanciaDaRotaM?: number;
}

interface ResultadoUseReportes {
  reportes: Reporte[];
  carregando: boolean;
  erro: string | null;
  suportado: boolean;
  enviando: boolean;
  enviarReporte: (
    dados: DadosEnvioReporte,
    usuario: { id: string; nome: string }
  ) => Promise<{ sucesso: boolean; mensagem: string }>;
  removerReporte: (id: string) => Promise<void>;
}

export function useReportes(): ResultadoUseReportes {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [carregando, setCarregando] = useState(!!supabase);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!supabase) return;
    try {
      const dados = await buscarReportesRecentes();
      setReportes(dados);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar reportes.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let cancelado = false;

    buscarReportesRecentes()
      .then((dados) => {
        if (cancelado) return;
        setReportes(dados);
        setErro(null);
      })
      .catch((err) => {
        if (cancelado) return;
        setErro(err instanceof Error ? err.message : 'Falha ao carregar reportes.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    const id = setInterval(recarregar, INTERVALO_ATUALIZACAO_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [recarregar]);

  const enviarReporte = useCallback(async (dados: DadosEnvioReporte, usuario: { id: string; nome: string }) => {
    setEnviando(true);
    try {
      const novo = await criarReporte({
        ...dados,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
      });
      setReportes((atual) => [novo, ...atual]);
      return { sucesso: true, mensagem: 'Reporte enviado — obrigado por avisar!' };
    } catch (err) {
      return { sucesso: false, mensagem: err instanceof Error ? err.message : 'Não foi possível enviar.' };
    } finally {
      setEnviando(false);
    }
  }, []);

  const removerReporte = useCallback(async (id: string) => {
    setReportes((atual) => atual.filter((r) => r.id !== id));
    await apagarReporte(id);
  }, []);

  return { reportes, carregando, erro, suportado: !!supabase, enviando, enviarReporte, removerReporte };
}
