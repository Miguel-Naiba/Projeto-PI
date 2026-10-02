import { useEffect, useRef, useState } from 'react';
import { useDitadoVoz } from '../../hooks/useDitadoVoz';
import { geocodificarEndereco, geocodificarReverso } from '../../services/geocodificacao';
import { buscarNoCatalogo } from '../../services/catalogoReportar';
import type { DadosEnvioReporte } from '../../hooks/useReportes';
import type { ItemCatalogoReportar, TipoReporte } from '../../types';
import { TIPOS, categoriasVisiveis } from './categoriasReportar';
import './Reportar.css';

type Estado =
  | 'categoria'
  | 'catalogo'
  | 'localizacao'
  | 'confirmacao_localizacao'
  | 'descricao'
  | 'confirmacao_descricao'
  | 'resumo'
  | 'enviando'
  | 'sucesso'
  | 'erro';

export interface PontoPreenchido {
  tipo: TipoReporte;
  pontoId: string;
  pontoNome: string;
  pontoFonte: string;
  lat: number;
  lon: number;
}

interface PropsReportar {
  aoFechar: () => void;
  logado: boolean;
  authSuportado: boolean;
  latLonAtual: [number, number] | null;
  categoriaInicial: TipoReporte | null;
  pontoPreenchido: PontoPreenchido | null;
  categoriasDisponiveis?: Partial<Record<TipoReporte, boolean>>;
  catalogoOficial?: Record<TipoReporte, ItemCatalogoReportar[]>;
  distanciaDaRotaAtivaM: (lat: number, lon: number) => number | null;
  aoFalar: (texto: string) => void;
  aoEnviar: (dados: DadosEnvioReporte) => Promise<{ sucesso: boolean; mensagem: string }>;
  aoAbrirConta: () => void;
}

const CATALOGO_VAZIO: Record<TipoReporte, ItemCatalogoReportar[]> = { parada_tatil: [], botoeira: [], obra: [] };

export function Reportar({
  aoFechar,
  logado,
  authSuportado,
  latLonAtual,
  categoriaInicial,
  pontoPreenchido,
  categoriasDisponiveis,
  catalogoOficial = CATALOGO_VAZIO,
  distanciaDaRotaAtivaM,
  aoFalar,
  aoEnviar,
  aoAbrirConta,
}: PropsReportar) {
  const [estado, setEstado] = useState<Estado>(() => {
    if (pontoPreenchido) return 'confirmacao_localizacao';
    if (categoriaInicial) return catalogoOficial[categoriaInicial]?.length ? 'catalogo' : 'localizacao';
    return 'categoria';
  });
  const [tipo, setTipo] = useState<TipoReporte | null>(pontoPreenchido?.tipo ?? categoriaInicial);
  const [problema, setProblema] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(pontoPreenchido?.lat ?? null);
  const [lon, setLon] = useState<number | null>(pontoPreenchido?.lon ?? null);
  const [endereco, setEndereco] = useState<string | null>(pontoPreenchido?.pontoNome ?? null);
  const [pontoId, setPontoId] = useState<string | undefined>(pontoPreenchido?.pontoId);
  const [pontoNome, setPontoNome] = useState<string | undefined>(pontoPreenchido?.pontoNome);
  const [pontoFonte, setPontoFonte] = useState<string | undefined>(pontoPreenchido?.pontoFonte);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [consultaEndereco, setConsultaEndereco] = useState('');
  const [consultaCatalogo, setConsultaCatalogo] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<{ rotulo: string; lat: number; lon: number }[]>([]);
  const [descricao, setDescricao] = useState('');
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);

  // Lista completa (não a filtrada) — se um ponto já veio pré-selecionado
  // (clique no mapa) ou uma categoria inicial foi passada, ainda precisamos
  // achar os dados dela (ícone, problemas) mesmo que o botão de escolha
  // esteja escondido nesse momento por disponibilidade.
  const tiposVisiveis = categoriasVisiveis(TIPOS, categoriasDisponiveis);
  const opcaoTipo = TIPOS.find((t) => t.tipo === tipo) ?? null;
  const itensCatalogo = tipo ? catalogoOficial[tipo] ?? [] : [];
  const itensCatalogoFiltrados = buscarNoCatalogo(itensCatalogo, consultaCatalogo);

  const { ouvindo, suportado: vozSuportada, iniciar: iniciarDitado, parar: pararDitado } = useDitadoVoz((texto) => {
    if (estado === 'catalogo') {
      setConsultaCatalogo((atual) => (atual.trim() ? `${atual.trim()} ${texto}` : texto));
    } else if (estado === 'localizacao') {
      setConsultaEndereco((atual) => (atual.trim() ? `${atual.trim()} ${texto}` : texto));
    } else {
      setDescricao((atual) => (atual.trim() ? `${atual.trim()} ${texto}` : texto));
    }
  });

  useEffect(() => {
    refTitulo.current?.focus();
  }, [estado]);

  useEffect(() => {
    const lidarComTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    window.addEventListener('keydown', lidarComTecla);
    return () => window.removeEventListener('keydown', lidarComTecla);
  }, [aoFechar]);

  function escolherTipo(t: TipoReporte) {
    setTipo(t);
    setProblema(null);
    setConsultaCatalogo('');
    setEstado((catalogoOficial[t] ?? []).length ? 'catalogo' : 'localizacao');
  }

  // Passo "Catálogo oficial → Busca texto/voz → Selecionar ponto" do fluxo
  // definitivo de Reportar: o reporte sempre se ancora num ponto oficial já
  // geocodificado (nunca numa coordenada inventada).
  function selecionarDoCatalogo(item: ItemCatalogoReportar) {
    setLat(item.lat);
    setLon(item.lon);
    setPontoId(item.id);
    setPontoNome(item.nome);
    setPontoFonte(item.fonte);
    setEndereco(item.endereco ?? item.nome);
    aoFalar(`Você selecionou: ${item.nome}`);
    setEstado('confirmacao_localizacao');
  }

  function naoEncontreiNoCatalogo() {
    setPontoId(undefined);
    setPontoNome(undefined);
    setPontoFonte(undefined);
    setEstado('localizacao');
  }

  async function usarGps() {
    if (!latLonAtual) return;
    setLat(latLonAtual[0]);
    setLon(latLonAtual[1]);
    setPontoId(undefined);
    setPontoNome(undefined);
    setPontoFonte(undefined);
    setBuscandoEndereco(true);
    const enderecoEncontrado = await geocodificarReverso(latLonAtual[0], latLonAtual[1]);
    setBuscandoEndereco(false);
    const enderecoFinal = enderecoEncontrado ?? `${latLonAtual[0].toFixed(5)}, ${latLonAtual[1].toFixed(5)}`;
    setEndereco(enderecoFinal);
    aoFalar(`Você selecionou: ${enderecoFinal}`);
    setEstado('confirmacao_localizacao');
  }

  async function buscarEndereco(e: React.FormEvent) {
    e.preventDefault();
    if (!consultaEndereco.trim()) return;
    setBuscandoEndereco(true);
    setMensagemErro(null);
    try {
      const resultados = await geocodificarEndereco(consultaEndereco);
      setResultadosBusca(resultados);
      if (resultados.length === 0) setMensagemErro('Não encontrei esse endereço. Tente com bairro e número, ou fale de outro jeito.');
    } catch {
      setMensagemErro('Não foi possível buscar esse endereço agora.');
    } finally {
      setBuscandoEndereco(false);
    }
  }

  function escolherResultado(r: { rotulo: string; lat: number; lon: number }) {
    setLat(r.lat);
    setLon(r.lon);
    setEndereco(r.rotulo);
    setResultadosBusca([]);
    setConsultaEndereco('');
    aoFalar(`Você selecionou: ${r.rotulo}`);
    setEstado('confirmacao_localizacao');
  }

  function confirmarLocalizacao() {
    setEstado('descricao');
  }

  function corrigirLocalizacao() {
    if (!pontoPreenchido) {
      setLat(null);
      setLon(null);
      setEndereco(null);
      setPontoId(undefined);
      setPontoNome(undefined);
      setPontoFonte(undefined);
    }
    setEstado(!pontoPreenchido && tipo && (catalogoOficial[tipo] ?? []).length ? 'catalogo' : 'localizacao');
  }

  function continuarDescricao() {
    aoFalar(`Você disse: ${descricao || 'nenhuma descrição adicional'}.`);
    setEstado('confirmacao_descricao');
  }

  function corrigirDescricao() {
    setEstado('descricao');
  }

  function confirmarDescricao() {
    setEstado('resumo');
  }

  async function enviarReporteFinal() {
    if (!tipo || lat === null || lon === null) return;
    setEstado('enviando');
    const dist = distanciaDaRotaAtivaM(lat, lon);
    const resultado = await aoEnviar({
      tipo,
      problema: problema ?? undefined,
      lat,
      lon,
      descricao,
      pontoId,
      pontoNome,
      pontoFonte,
      rotaAtiva: dist !== null,
      distanciaDaRotaM: dist ?? undefined,
    });
    if (resultado.sucesso) {
      setEstado('sucesso');
      aoFalar(resultado.mensagem);
      setTimeout(aoFechar, 1600);
    } else {
      setMensagemErro(resultado.mensagem);
      setEstado('erro');
    }
  }

  if (!authSuportado) {
    return (
      <Casca aoFechar={aoFechar} refTitulo={refTitulo}>
        <p className="reportar-aviso">Reportar indisponível nesta instalação — Supabase não configurado.</p>
      </Casca>
    );
  }

  if (!logado) {
    return (
      <Casca aoFechar={aoFechar} refTitulo={refTitulo}>
        <div className="reportar-aviso-conta">
          <p>Reportar exige uma conta — assim outras pessoas sabem quem confirmou o problema.</p>
          <button type="button" className="reportar-botao-secundario" onClick={aoAbrirConta}>
            Entrar ou criar conta
          </button>
        </div>
      </Casca>
    );
  }

  return (
    <Casca aoFechar={aoFechar} refTitulo={refTitulo}>
      {estado === 'categoria' && (
        <div className="reportar-tipos" role="radiogroup" aria-label="Tipo de reporte">
          {tiposVisiveis.map((op) => (
            <button key={op.tipo} type="button" className="reportar-tipo" onClick={() => escolherTipo(op.tipo)}>
              <span className="reportar-tipo__icone" aria-hidden="true">{op.icone}</span>
              <span className="reportar-tipo__rotulo">{op.rotulo}</span>
            </button>
          ))}
        </div>
      )}

      {estado === 'catalogo' && opcaoTipo && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">{opcaoTipo.icone} {opcaoTipo.rotulo} — qual ponto?</p>
          <div className="reportar-campo__caixa">
            <input
              type="text"
              value={consultaCatalogo}
              onChange={(e) => setConsultaCatalogo(e.target.value)}
              placeholder={ouvindo ? 'Ouvindo...' : 'Buscar no catálogo oficial...'}
              aria-label="Buscar ponto no catálogo oficial"
            />
            {vozSuportada && (
              <button
                type="button"
                className={`reportar-botao-microfone${ouvindo ? ' ouvindo' : ''}`}
                onClick={ouvindo ? pararDitado : iniciarDitado}
                aria-label={ouvindo ? 'Parar de ouvir' : 'Falar nome ou endereço do ponto'}
                aria-pressed={ouvindo}
              >
                {ouvindo ? '🎙️' : '🎤'}
              </button>
            )}
          </div>
          <ul className="reportar-resultados" aria-live="polite">
            {itensCatalogoFiltrados.slice(0, 50).map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => selecionarDoCatalogo(item)}>{item.nome}</button>
              </li>
            ))}
            {itensCatalogoFiltrados.length === 0 && (
              <li className="reportar-mensagem">Nenhum ponto oficial encontrado para essa busca.</li>
            )}
          </ul>
          <button type="button" className="reportar-botao-secundario" onClick={naoEncontreiNoCatalogo}>
            Não encontrei o ponto — buscar por endereço
          </button>
        </div>
      )}

      {estado === 'localizacao' && opcaoTipo && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">{opcaoTipo.icone} {opcaoTipo.rotulo} — onde?</p>
          {latLonAtual && (
            <button type="button" className="reportar-opcao-local" onClick={usarGps} disabled={buscandoEndereco}>
              📍 Usar minha localização atual
            </button>
          )}
          <form onSubmit={buscarEndereco} className="reportar-busca-endereco">
            <div className="reportar-campo__caixa">
              <input
                type="text"
                value={consultaEndereco}
                onChange={(e) => setConsultaEndereco(e.target.value)}
                placeholder={ouvindo ? 'Ouvindo...' : 'Buscar endereço...'}
              />
              {vozSuportada && (
                <button
                  type="button"
                  className={`reportar-botao-microfone${ouvindo ? ' ouvindo' : ''}`}
                  onClick={ouvindo ? pararDitado : iniciarDitado}
                  aria-label={ouvindo ? 'Parar de ouvir' : 'Falar endereço'}
                  aria-pressed={ouvindo}
                >
                  {ouvindo ? '🎙️' : '🎤'}
                </button>
              )}
            </div>
            <button type="submit" className="reportar-botao-secundario" disabled={buscandoEndereco || !consultaEndereco.trim()}>
              {buscandoEndereco ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
          {mensagemErro && <p className="reportar-mensagem reportar-mensagem--erro">{mensagemErro}</p>}
          {resultadosBusca.length > 0 && (
            <ul className="reportar-resultados">
              {resultadosBusca.map((r) => (
                <li key={`${r.lat}-${r.lon}`}>
                  <button type="button" onClick={() => escolherResultado(r)}>{r.rotulo}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {estado === 'confirmacao_localizacao' && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">Você selecionou:</p>
          <p className="reportar-endereco-confirmar">{buscandoEndereco ? 'Localizando endereço...' : endereco ?? 'Localização sem endereço legível'}</p>
          <div className="reportar-acoes-confirmacao">
            <button type="button" className="reportar-botao" onClick={confirmarLocalizacao} disabled={buscandoEndereco}>
              Confirmar
            </button>
            <button type="button" className="reportar-botao-secundario" onClick={corrigirLocalizacao}>
              Corrigir
            </button>
          </div>
        </div>
      )}

      {estado === 'descricao' && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">Descreva o problema</p>
          {opcaoTipo && (
            <div className="reportar-problemas" role="radiogroup" aria-label="Tipo de problema">
              {opcaoTipo.problemas.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`reportar-chip${problema === p ? ' ativo' : ''}`}
                  role="radio"
                  aria-checked={problema === p}
                  onClick={() => setProblema(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="reportar-campo__caixa">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder={ouvindo ? 'Ouvindo...' : 'Descreva com suas palavras (opcional)'}
              maxLength={300}
            />
            {vozSuportada && (
              <button
                type="button"
                className={`reportar-botao-microfone${ouvindo ? ' ouvindo' : ''}`}
                onClick={ouvindo ? pararDitado : iniciarDitado}
                aria-label={ouvindo ? 'Parar de ouvir' : 'Falar descrição'}
                aria-pressed={ouvindo}
              >
                {ouvindo ? '🎙️' : '🎤'}
              </button>
            )}
          </div>
          <button type="button" className="reportar-botao" onClick={continuarDescricao} disabled={!problema}>
            Continuar
          </button>
        </div>
      )}

      {estado === 'confirmacao_descricao' && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">Você disse:</p>
          <p className="reportar-endereco-confirmar">"{descricao || 'nenhuma descrição adicional'}"</p>
          <div className="reportar-acoes-confirmacao">
            <button type="button" className="reportar-botao" onClick={confirmarDescricao}>
              Confirmar
            </button>
            <button type="button" className="reportar-botao-secundario" onClick={corrigirDescricao}>
              Corrigir
            </button>
          </div>
        </div>
      )}

      {estado === 'resumo' && opcaoTipo && (
        <div className="reportar-passo">
          <p className="reportar-passo__titulo">Resumo do reporte</p>
          <dl className="reportar-resumo">
            <dt>Categoria</dt>
            <dd>{opcaoTipo.icone} {opcaoTipo.rotulo}{problema ? ` — ${problema}` : ''}</dd>
            <dt>Local</dt>
            <dd>{endereco ?? '—'}</dd>
            {descricao && (
              <>
                <dt>Descrição</dt>
                <dd>"{descricao}"</dd>
              </>
            )}
            {pontoId && (
              <>
                <dt>Fonte</dt>
                <dd>{pontoFonte} (ponto oficial: {pontoNome})</dd>
              </>
            )}
          </dl>
          <div className="reportar-acoes-confirmacao">
            <button type="button" className="reportar-botao" onClick={enviarReporteFinal}>
              Confirmar reporte
            </button>
            <button type="button" className="reportar-botao-secundario" onClick={() => setEstado('descricao')}>
              Editar
            </button>
          </div>
        </div>
      )}

      {estado === 'enviando' && <p className="reportar-aviso">Enviando reporte...</p>}

      {estado === 'sucesso' && <p className="reportar-mensagem reportar-mensagem--sucesso">Reporte enviado — obrigado por avisar!</p>}

      {estado === 'erro' && (
        <div className="reportar-passo">
          <p className="reportar-mensagem reportar-mensagem--erro">{mensagemErro}</p>
          <button type="button" className="reportar-botao" onClick={() => setEstado('resumo')}>
            Tentar de novo
          </button>
        </div>
      )}
    </Casca>
  );
}

function Casca({
  aoFechar,
  refTitulo,
  children,
}: {
  aoFechar: () => void;
  refTitulo: React.RefObject<HTMLHeadingElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div className="reportar-sobreposicao" role="presentation" onClick={aoFechar}>
      <div className="reportar-modal" role="dialog" aria-modal="true" aria-labelledby="reportar-titulo" onClick={(e) => e.stopPropagation()}>
        <div className="reportar-modal__cabecalho">
          <h2 id="reportar-titulo" tabIndex={-1} ref={refTitulo}>
            <span aria-hidden="true">⚠️</span> Reportar
          </h2>
          <button className="botao-fechar" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="reportar-modal__conteudo">{children}</div>
      </div>
    </div>
  );
}
