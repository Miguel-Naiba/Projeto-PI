import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { prepararAvatarComoDataUrl } from '../../utils/imagem';
import './Autenticacao.css';

type Modo = 'entrar' | 'cadastro';

interface PropsAutenticacao {
  aberto: boolean;
  aoFechar: () => void;
  usuario: User | null;
  suportado: boolean;
  aoEntrar: (email: string, senha: string) => Promise<{ sucesso: boolean; mensagem: string }>;
  aoCadastrar: (nome: string, email: string, senha: string) => Promise<{ sucesso: boolean; mensagem: string }>;
  aoSair: () => Promise<void>;
  aoAtualizarPerfil: (dados: { nome?: string; avatarUrl?: string }) => Promise<{ sucesso: boolean; mensagem: string }>;
}

export function Autenticacao({
  aberto,
  aoFechar,
  usuario,
  suportado,
  aoEntrar,
  aoCadastrar,
  aoSair,
  aoAtualizarPerfil,
}: PropsAutenticacao) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'erro' | 'sucesso' } | null>(null);
  const [camposInvalidos, setCamposInvalidos] = useState<Set<'email' | 'senha' | 'confirmarSenha'>>(new Set());
  const refTitulo = useRef<HTMLHeadingElement>(null);
  const refInputArquivo = useRef<HTMLInputElement>(null);

  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [mensagemPerfil, setMensagemPerfil] = useState<{ texto: string; tipo: 'erro' | 'sucesso' } | null>(null);

  useEffect(() => {
    if (aberto) refTitulo.current?.focus();
  }, [aberto]);

  // Limpa o formulário ao fechar ou trocar de aba, pra não deixar senha
  // antiga visível se a pessoa reabrir depois — feito na própria ação, não
  // num efeito observando `aberto`/`modo`, pra não disparar setState em
  // cascata a partir de um efeito.
  const fechar = useCallback(() => {
    setMensagem(null);
    setSenha('');
    setConfirmarSenha('');
    aoFechar();
  }, [aoFechar]);

  useEffect(() => {
    if (!aberto) return;
    const lidarComTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', lidarComTecla);
    return () => window.removeEventListener('keydown', lidarComTecla);
  }, [aberto, fechar]);

  if (!aberto) return null;

  function trocarModo(novoModo: Modo) {
    setModo(novoModo);
    setMensagem(null);
    setCamposInvalidos(new Set());
    setSenha('');
    setConfirmarSenha('');
  }

  async function lidarComEnvio(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    setCamposInvalidos(new Set());

    if (!email.trim() || !senha) {
      setMensagem({ texto: 'Preencha e-mail e senha.', tipo: 'erro' });
      setCamposInvalidos(new Set([!email.trim() ? 'email' : 'senha']));
      return;
    }
    if (senha.length < 6) {
      setMensagem({ texto: 'A senha precisa ter pelo menos 6 caracteres.', tipo: 'erro' });
      setCamposInvalidos(new Set(['senha']));
      return;
    }
    if (modo === 'cadastro' && senha !== confirmarSenha) {
      setMensagem({ texto: 'As senhas não coincidem.', tipo: 'erro' });
      setCamposInvalidos(new Set(['senha', 'confirmarSenha']));
      return;
    }

    setCarregando(true);
    const resultado =
      modo === 'entrar' ? await aoEntrar(email.trim(), senha) : await aoCadastrar(nome.trim(), email.trim(), senha);
    setCarregando(false);
    setMensagem({ texto: resultado.mensagem, tipo: resultado.sucesso ? 'sucesso' : 'erro' });
    if (!resultado.sucesso) {
      setCamposInvalidos(resultado.mensagem.toLowerCase().includes('e-mail') ? new Set(['email']) : new Set(['senha']));
    }
    if (resultado.sucesso && modo === 'entrar') fechar();
  }

  async function lidarComSair() {
    setCarregando(true);
    await aoSair();
    setCarregando(false);
    fechar();
  }

  function abrirEdicaoNome() {
    setNomeEdicao((usuario?.user_metadata?.nome as string | undefined) ?? '');
    setMensagemPerfil(null);
    setEditandoNome(true);
  }

  async function lidarComSalvarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeEdicao.trim()) return;
    setSalvandoNome(true);
    const resultado = await aoAtualizarPerfil({ nome: nomeEdicao.trim() });
    setSalvandoNome(false);
    if (resultado.sucesso) {
      setEditandoNome(false);
      setMensagemPerfil(null);
    } else {
      setMensagemPerfil({ texto: resultado.mensagem, tipo: 'erro' });
    }
  }

  async function lidarComEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    setMensagemPerfil(null);
    setEnviandoFoto(true);
    try {
      const dataUrl = await prepararAvatarComoDataUrl(arquivo);
      const resultado = await aoAtualizarPerfil({ avatarUrl: dataUrl });
      if (!resultado.sucesso) setMensagemPerfil({ texto: resultado.mensagem, tipo: 'erro' });
    } catch (err) {
      setMensagemPerfil({ texto: err instanceof Error ? err.message : 'Não foi possível usar essa foto.', tipo: 'erro' });
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <div className="auth-sobreposicao" role="presentation" onClick={fechar}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-modal__cabecalho">
          <h2 id="auth-titulo" tabIndex={-1} ref={refTitulo}>
            <span aria-hidden="true">👤</span> {usuario ? 'Minha conta' : 'Entrar no EchoPath'}
          </h2>
          <button className="botao-fechar" onClick={fechar} aria-label="Fechar">✕</button>
        </div>

        <div className="auth-modal__conteudo">
          {!suportado && (
            <p className="auth-aviso">
              Login indisponível nesta instalação — as chaves do Supabase não foram configuradas. O restante do app
              funciona normalmente sem conta.
            </p>
          )}

          {suportado && usuario && (
            <div className="auth-conta">
              <div className="auth-conta__avatar-wrap">
                <button
                  type="button"
                  className="auth-conta__avatar"
                  onClick={() => refInputArquivo.current?.click()}
                  disabled={enviandoFoto}
                  aria-label="Alterar foto de perfil"
                >
                  {usuario.user_metadata?.avatar_url ? (
                    <img src={usuario.user_metadata.avatar_url as string} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {(usuario.user_metadata?.nome as string | undefined)?.[0]?.toUpperCase() ??
                        usuario.email?.[0]?.toUpperCase() ??
                        '?'}
                    </span>
                  )}
                  {enviandoFoto && <span className="auth-conta__avatar-carregando" aria-hidden="true" />}
                </button>
                <span className="auth-conta__avatar-selo" aria-hidden="true">📷</span>
                <input
                  ref={refInputArquivo}
                  type="file"
                  accept="image/*"
                  onChange={lidarComEscolherFoto}
                  className="apenas-leitor-tela"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>

              {editandoNome ? (
                <form className="auth-conta__form-nome" onSubmit={lidarComSalvarNome}>
                  <input
                    type="text"
                    value={nomeEdicao}
                    onChange={(e) => setNomeEdicao(e.target.value)}
                    aria-label="Nome de usuário"
                    autoFocus
                    maxLength={40}
                  />
                  <button type="submit" className="auth-conta__botao-icone" disabled={salvandoNome} aria-label="Salvar nome">
                    {salvandoNome ? '…' : '✓'}
                  </button>
                  <button
                    type="button"
                    className="auth-conta__botao-icone"
                    onClick={() => setEditandoNome(false)}
                    aria-label="Cancelar edição do nome"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button type="button" className="auth-conta__nome-editar" onClick={abrirEdicaoNome}>
                  <span className="auth-conta__nome">{(usuario.user_metadata?.nome as string | undefined) || 'Sem nome cadastrado'}</span>
                  <span className="auth-conta__lapis" aria-hidden="true">✎</span>
                </button>
              )}

              <p className="auth-conta__email">{usuario.email}</p>

              {mensagemPerfil && (
                <p className={`auth-mensagem auth-mensagem--${mensagemPerfil.tipo}`} role="status">
                  {mensagemPerfil.texto}
                </p>
              )}

              <button type="button" className="auth-botao auth-botao--secundario" onClick={lidarComSair} disabled={carregando}>
                {carregando ? 'Saindo...' : 'Sair da conta'}
              </button>
            </div>
          )}

          {suportado && !usuario && (
            <>
              <div className="auth-abas" role="tablist" aria-label="Entrar ou criar conta">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modo === 'entrar'}
                  className={modo === 'entrar' ? 'ativo' : ''}
                  onClick={() => trocarModo('entrar')}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modo === 'cadastro'}
                  className={modo === 'cadastro' ? 'ativo' : ''}
                  onClick={() => trocarModo('cadastro')}
                >
                  Criar conta
                </button>
              </div>

              <form onSubmit={lidarComEnvio} noValidate>
                {modo === 'cadastro' && (
                  <label className="auth-campo">
                    <span>Nome</span>
                    <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
                  </label>
                )}

                <label className="auth-campo">
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    aria-invalid={camposInvalidos.has('email')}
                    className={camposInvalidos.has('email') ? 'invalido' : ''}
                    required
                  />
                </label>

                <label className="auth-campo">
                  <span>Senha</span>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                    aria-invalid={camposInvalidos.has('senha')}
                    className={camposInvalidos.has('senha') ? 'invalido' : ''}
                    minLength={6}
                    required
                  />
                </label>

                {modo === 'cadastro' && (
                  <label className="auth-campo">
                    <span>Confirmar senha</span>
                    <input
                      type="password"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={camposInvalidos.has('confirmarSenha')}
                      className={camposInvalidos.has('confirmarSenha') ? 'invalido' : ''}
                      minLength={6}
                      required
                    />
                  </label>
                )}

                <div role="status" aria-live="polite" className="auth-mensagem-espaco">
                  {mensagem && <p className={`auth-mensagem auth-mensagem--${mensagem.tipo}`}>{mensagem.texto}</p>}
                </div>

                <button type="submit" className="auth-botao" disabled={carregando}>
                  {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
