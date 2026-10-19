import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ListaLocais } from './ListaLocais';
import { Reportar } from './UI/Reportar';
import { Cabecalho } from './UI/Cabecalho';
import { BarraInferior } from './UI/BarraInferior';
import { Autenticacao } from './UI/Autenticacao';
import type { User } from '@supabase/supabase-js';
import type { PontoProximidade } from '../types';

// Contratos de HTML renderizado, sem navegador, eventos ou envio externo.
// O ponto é lido do dataset existente, sem criar registros no aplicativo.
const oficial = JSON.parse(readFileSync('public/data/botoeiras-eptc.json', 'utf8')).botoeiras[0];
const pontoOficial: PontoProximidade = { id: oficial.id, tipo: 'botoeira', nome: oficial.local, lat: oficial.lat, lon: oficial.lon };
const propsLista: ComponentProps<typeof ListaLocais> = {
  paradasComTatil: [], sinaisSonoros: [{ ...pontoOficial }], obras: [], posicaoUsuario: null,
  visivel: true, aoFechar: vi.fn(), aoSelecionarDestino: vi.fn(),
};
const propsReporte: ComponentProps<typeof Reportar> = {
  aoFechar: vi.fn(), logado: true, authSuportado: true, latLonAtual: null,
  categoriaInicial: null, pontoPreenchido: null, distanciaDaRotaAtivaM: () => null,
  aoFalar: vi.fn(), aoEnviar: vi.fn(), aoAbrirConta: vi.fn(),
};

describe('Pontos próximos — apresentação direta sem Favoritos', () => {
  it('abre com pontos oficiais e sem abas, estrelas ou ações de Favoritos', () => {
    const html = renderToStaticMarkup(<ListaLocais {...propsLista} />);
    expect(html).toContain('Pontos próximos</h2>');
    expect(html).toContain(pontoOficial.nome);
    expect(html).toContain('class="item-local sinal"');
    expect(html).not.toMatch(/favorit|Visualização de locais|[★☆⭐]/i);
  });
  it('preserva os estados vazios dos catálogos sem adicionar dados', () => {
    const html = renderToStaticMarkup(<ListaLocais {...propsLista} sinaisSonoros={[]} />);
    expect(html).toContain('Nenhuma encontrada nesta área.');
    expect(html).toContain('Nenhuma parada com piso tátil confirmada nesta área.');
    expect(html).not.toContain(pontoOficial.nome);
  });
  it('não renderiza painel fechado', () => {
    expect(renderToStaticMarkup(<ListaLocais {...propsLista} visivel={false} />)).toBe('');
  });
  it('preserva obras e paradas dos datasets existentes na apresentação direta', () => {
    const parada = JSON.parse(readFileSync('public/data/paradas-tatil-eptc.json', 'utf8')).paradas[0];
    const obra = JSON.parse(readFileSync('public/data/obras-smoi.json', 'utf8')).obras[0];
    const html = renderToStaticMarkup(<ListaLocais {...propsLista}
      obras={[{ ...obra, tipo: 'outro' }]}
      paradasComTatil={[{ idParada: parada.stop_id, nomeParada: parada.stop_name, latParada: parada.lat, lonParada: parada.lon }]} />);
    expect(html).toContain(obra.nome);
    expect(html).toContain(parada.stop_name);
    expect(html).toContain('class="item-local parada"');
    expect(html).toContain('/icons.svg#obras');
  });
  it('ordena por distância sem modificar a lista de entrada', () => {
    const outro = JSON.parse(readFileSync('public/data/botoeiras-eptc.json', 'utf8')).botoeiras[1];
    const sinais = [{ id: outro.id, nome: outro.local, lat: outro.lat, lon: outro.lon }, { ...pontoOficial }];
    const original = JSON.stringify(sinais);
    const html = renderToStaticMarkup(<ListaLocais {...propsLista} sinaisSonoros={sinais} posicaoUsuario={{ lat: pontoOficial.lat, lon: pontoOficial.lon, timestamp: 0 }} />);
    expect(html.indexOf(pontoOficial.nome)).toBeLessThan(html.indexOf(outro.local));
    expect(JSON.stringify(sinais)).toBe(original);
  });
});

describe('Reporte — contratos de acesso, categorias e campos', () => {
  it('mantém indisponibilidade sem Supabase e não chama envio', () => {
    const html = renderToStaticMarkup(<Reportar {...propsReporte} authSuportado={false} />);
    expect(html).toContain('Supabase não configurado');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('reportar-tipo"');
    expect(propsReporte.aoEnviar).not.toHaveBeenCalled();
  });
  it('mantém exigência de conta', () => {
    const html = renderToStaticMarkup(<Reportar {...propsReporte} logado={false} />);
    expect(html).toContain('Entrar ou criar conta');
    expect(html).not.toContain('reportar-tipo"');
  });
  it('não reexibe categoria indisponível na interface', () => {
    const html = renderToStaticMarkup(<Reportar {...propsReporte} categoriasDisponiveis={{ obra: false, parada_tatil: true, botoeira: true }} />);
    expect(html).toContain('Parada com piso tátil');
    expect(html).toContain('Botoeira sonora');
    expect(html).not.toContain('>Obra<');
    expect(html).not.toContain('/icons.svg#obras');
  });
  it('dá nome acessível ao campo de endereço e mantém busca vazia desabilitada', () => {
    const html = renderToStaticMarkup(<Reportar {...propsReporte} categoriaInicial="botoeira" />);
    expect(html).toContain('aria-label="Buscar endereço do reporte"');
    expect(html).toMatch(/type="submit"[^>]*disabled=""/);
    expect(propsReporte.aoEnviar).not.toHaveBeenCalled();
  });
});

describe('Microfone — contrato visual e acessível', () => {
  it.each([false, true])('mantém estado e nome acessíveis ao ouvir=%s', (ouvindo) => {
    const html = renderToStaticMarkup(<Cabecalho valorBusca="" aoMudarBusca={vi.fn()} aoSubmeterBusca={vi.fn()} aoClicarMicrofone={vi.fn()} microfoneOuvindo={ouvindo} microfoneSuportado logado={false} aoClicarPerfil={vi.fn()} />);
    expect(html).toContain(`aria-pressed="${ouvindo}"`);
    expect(html).toContain(`/icons.svg#${ouvindo ? 'microfone-ativo' : 'microfone'}`);
    expect(html).toContain(ouvindo ? 'Ouvindo...' : 'Buscar ou traçar rota por voz');
  });
});


describe('Barra e cabeçalho — remoções autorizadas', () => {
  it('apresenta Pontos próximos e mantém controles de voz e camadas', () => {
    const html = renderToStaticMarkup(<BarraInferior
      camadas={{ paradas: true, botoneiras: true, obras: true, acidentes: false, onibus: false }}
      aoAlternar={vi.fn()} aoClicarVoz={vi.fn()} aoClicarMicrofone={vi.fn()}
      microfoneOuvindo={false} microfoneSuportado aoClicarPontosProximos={vi.fn()}
      aoClicarConfiguracoes={vi.fn()} aoClicarSobre={vi.fn()} />);
    expect(html).toContain('aria-label="Pontos próximos"');
    expect(html).toContain('Narrar situação atual');
    expect(html).toContain('/icons.svg#microfone');
    expect(html).not.toMatch(/favorit|[★☆⭐]/i);
  });
  it('remove câmera preservando marca, busca, microfone e conta', () => {
    const html = renderToStaticMarkup(<Cabecalho valorBusca="" aoMudarBusca={vi.fn()} aoSubmeterBusca={vi.fn()} aoClicarMicrofone={vi.fn()} microfoneOuvindo={false} microfoneSuportado logado={false} aoClicarPerfil={vi.fn()} />);
    expect(html).not.toMatch(/Câmera|Modo AR|📷/);
    expect(html).toContain('EchoPath');
    expect(html).toContain('id="campo-busca"');
    expect(html).toContain('Buscar ou traçar rota por voz');
    expect(html).toContain('Entrar ou criar conta');
  });
});

// Usuário fictício apenas para contrato de renderização; sem sessão ou escrita externa.
const propsAuth: ComponentProps<typeof Autenticacao> = {
  aberto: true, aoFechar: vi.fn(), usuario: null, suportado: true,
  aoEntrar: vi.fn(), aoCadastrar: vi.fn(), aoSair: vi.fn(), aoAtualizarPerfil: vi.fn(),
};
const usuarioTeste: User = {
  id: 'usuario-de-teste', aud: 'authenticated', app_metadata: {},
  user_metadata: { nome: 'Pessoa Teste' }, email: 'pessoa@example.test', created_at: '2026-10-19T00:00:00Z',
};
describe('Conta — leitura de avatar sem opção de fotografia', () => {
  it.each([false, true])('preserva avatar/initial e edição de nome, foto existente=%s', (comFoto) => {
    const usuario = { ...usuarioTeste, user_metadata: { ...usuarioTeste.user_metadata, ...(comFoto ? { avatar_url: '/avatar-existente.png' } : {}) } };
    const antes = JSON.stringify(usuario);
    const html = renderToStaticMarkup(<Autenticacao {...propsAuth} usuario={usuario} />);
    expect(html).toContain('role="img" aria-label="Avatar de perfil"');
    expect(html).not.toMatch(/type="file"|Alterar foto|📷|avatar-selo/);
    expect(html).toContain('Pessoa Teste');
    expect(html).toContain('auth-conta__nome-editar');
    expect(html).toContain('Sair da conta');
    if (comFoto) expect(html).toContain('src="/avatar-existente.png"');
    else expect(html).toContain('aria-hidden="true">P</span>');
    expect(JSON.stringify(usuario)).toBe(antes);
    expect(propsAuth.aoAtualizarPerfil).not.toHaveBeenCalled();
  });
  it('mantém login e acesso ao cadastro com campos nomeados', () => {
    const html = renderToStaticMarkup(<Autenticacao {...propsAuth} />);
    expect(html).toContain('Criar conta');
    expect(html).toContain('<span>E-mail</span>');
    expect(html).toContain('type="email"');
    expect(html).toContain('<span>Senha</span>');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('type="file"');
  });
});
