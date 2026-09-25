import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface ResultadoAutenticacao {
  sucesso: boolean;
  mensagem: string;
}

export function useAutenticacao() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null);
      setCarregando(false);
    });
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setUsuario(sessao?.user ?? null);
    });
    return () => assinatura.subscription.unsubscribe();
  }, []);

  const entrar = useCallback(async (email: string, senha: string): Promise<ResultadoAutenticacao> => {
    if (!supabase) return { sucesso: false, mensagem: 'Login indisponível: Supabase não configurado neste app.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      const msg =
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message === 'Email not confirmed'
            ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
            : 'Não foi possível entrar agora. Tente novamente.';
      return { sucesso: false, mensagem: msg };
    }
    return { sucesso: true, mensagem: 'Login realizado com sucesso.' };
  }, []);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string): Promise<ResultadoAutenticacao> => {
    if (!supabase) return { sucesso: false, mensagem: 'Cadastro indisponível: Supabase não configurado neste app.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });
    if (error) {
      const msg =
        error.message === 'User already registered'
          ? 'Já existe uma conta com esse e-mail. Tente entrar.'
          : error.message.includes('Password')
            ? 'A senha precisa ter pelo menos 6 caracteres.'
            : 'Não foi possível criar a conta agora. Tente novamente.';
      return { sucesso: false, mensagem: msg };
    }
    // Se a confirmação por e-mail estiver ativa no projeto Supabase, a
    // sessão vem nula mesmo com sucesso — a pessoa só consegue entrar depois
    // de clicar no link recebido por e-mail.
    if (!data.session) {
      return { sucesso: true, mensagem: 'Conta criada! Verifique seu e-mail para confirmar antes de entrar.' };
    }
    return { sucesso: true, mensagem: 'Conta criada com sucesso.' };
  }, []);

  const sair = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const atualizarPerfil = useCallback(async (dados: { nome?: string; avatarUrl?: string }): Promise<ResultadoAutenticacao> => {
    if (!supabase) return { sucesso: false, mensagem: 'Indisponível: Supabase não configurado neste app.' };
    const metadados: Record<string, string> = {};
    if (dados.nome !== undefined) metadados.nome = dados.nome;
    if (dados.avatarUrl !== undefined) metadados.avatar_url = dados.avatarUrl;

    const { error } = await supabase.auth.updateUser({ data: metadados });
    if (error) return { sucesso: false, mensagem: 'Não foi possível salvar agora. Tente novamente.' };
    return { sucesso: true, mensagem: 'Perfil atualizado.' };
  }, []);

  return { usuario, carregando, suportado: !!supabase, entrar, cadastrar, sair, atualizarPerfil };
}
