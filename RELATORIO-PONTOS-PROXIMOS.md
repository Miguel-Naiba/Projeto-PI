# EchoPath — somente Pontos próximos, sem opções de fotografia

19/10/2026. **Implementado e validado por testes automatizados; validação real mobile e dos serviços permanece PENDENTE/BLOCKED.**

## Versão-base obrigatória

`EchoPath-interface-revisada-v2(1).zip`, 2.146.449 bytes.

SHA-256: `ae036d580558cc99460dad5fee7e800b1bac6029bb47762b935d024b33d5483f`.

O ZIP informado foi obtido, inspecionado e preservado íntegro. Os arquivos locais de código, dados, scripts e configuração foram comparados com ele antes de editar: nenhuma diferença. Todas as alterações foram feitas sobre esse conteúdo; nenhum componente foi substituído por versão anterior. A base contém 176 arquivos. O novo pacote mantém todos, exceto o utilitário de upload exclusivamente fotográfico cuja remoção é detalhada abaixo. Relatórios e evidências das etapas anteriores continuam no ZIP como histórico.

## Resultado implementado

- A barra inferior apresenta **Pontos próximos**, com marcador de localização e nome acessível atualizado, acionando a abertura/fechamento da lista existente.
- A lista abre diretamente em **Pontos próximos**, sem seletor de abas, visualização de Favoritos ou estrelas. Obras, botoeiras, paradas, ordenação por distância, estados vazios e callbacks de seleção/fechamento permanecem.
- As estrelas também saíram dos resultados da busca. Busca textual e seleção de destino foram mantidas.
- O botão **Câmera / Modo AR** foi removido. Busca, microfone, EchoPath e acesso à conta permanecem; o nome EchoPath também fica visível na regra mobile.
- A conta exibe a foto já existente ou a inicial, em elemento de apresentação, sem input de arquivo, botão, selo, estado ou handler de upload.
- Login, cadastro, edição de nome e logout conservam os handlers e formulários remanescentes. O serviço de autenticação não foi alterado.
- CSS ajustado somente nas áreas afetadas: exclusão de regras sem uso, alinhamento do rótulo Pontos próximos, alvos dos locais com mínimo de 44px e avatar sem aparência interativa. Temas e indicadores de foco existentes preservados.

## Arquivos alterados e removidos

| Arquivo | Justificativa |
|---|---|
| `src/Aplicativo.tsx` | Desconecta hook/callbacks de Favoritos, retira estrelas da busca e props antigas da lista, renomeia callback da barra. |
| `src/components/ListaLocais.tsx` | Retira seletor/estado de abas, bloco Favoritos e botões de estrela; apresenta diretamente o conteúdo de pontos próximos. |
| `src/components/ListaLocais.css` | Remove estilos exclusivos de favoritos/abas; mantém altura mínima dos itens após remover as estrelas. |
| `src/components/UI/BarraInferior.tsx` | Substitui rótulo, ícone, nome acessível e nome da prop; conserva os demais controles e a medição responsiva. |
| `src/components/UI/BarraInferior.css` | Alinha ícones e texto multilinha sem reservar espaço para controles removidos. |
| `src/components/UI/Cabecalho.tsx` | Exclui apenas o botão de câmera. |
| `src/components/UI/Cabecalho.css` | Reaproveita espaço liberado para a marca no mobile; preserva busca flexível e controles de 44px. |
| `src/components/UI/Autenticacao.tsx` | Retira upload, estado, ref e handler exclusivos; mantém avatar de leitura e autenticação. |
| `src/components/UI/Autenticacao.css` | Retira selo/spinner/efeitos de botão do avatar e aplica tokens existentes ao fundo/texto das iniciais. |
| `src/components/interface.contrato.test.tsx` | Atualiza os contratos de Favoritos para Pontos próximos e acrescenta verificações das remoções e preservações. |
| `src/utils/imagem.ts` — removido | Tinha um único consumidor, o upload de perfil retirado. Busca de dependências confirmou ausência de outros consumidores. Não era utilizado pelo reporte. |

Total: **10 arquivos alterados e 1 utilitário removido**. Nenhum teste ou documento histórico foi excluído. Documentação desta etapa em `evidencias-remocoes/` e neste relatório.

## Preservação dos dados e módulos legados

Nenhuma exclusão em localStorage, Supabase ou outro armazenamento foi implementada ou executada.

`src/hooks/useLocaisSalvos.ts` e seus testes foram mantidos como módulo legado desconectado da aplicação. Não há consumidor de produção; os testes existentes ainda utilizam suas funções de identidade/validação. Manter o módulo evita eliminar cobertura histórica desnecessariamente. Como o aplicativo não chama mais o hook, ele também não regrava automaticamente os favoritos antigos. A chave `echopath:locais-salvos` não consta do bundle final.

O hook `useAutenticacao.ts` permanece byte a byte idêntico, incluindo o contrato de atualização parcial dos metadados. A edição de nome continua enviando apenas o nome. Não houve alteração, exclusão ou substituição de `avatar_url` em contas existentes. O avatar é somente apresentado pela interface.

O utilitário fotográfico foi removido depois de confirmar que apenas a interface de upload o importava. Nenhum anexo, campo ou recurso de reporte foi removido.

## Testes antes e depois

| Verificação | Base | Entrega |
|---|---|---|
| `npm test` | 249 testes / 26 arquivos, exit 0 | 256 testes / 26 arquivos, exit 0 |
| `npx tsc -b` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 |
| Preview HTTP local | Evidências anteriores preservadas | 12 recursos HTTP 200 |
| Comparação de arquivos protegidos | Código local correspondente ao ZIP | 73 arquivos idênticos à base |
| Bundle final | Continha os recursos anteriores | Sem rótulos removidos, utilitário de foto ou chave de favoritos |

Logs completos: `evidencias-remocoes/antes-*.log`, `depois-*.log` e `resultados-comandos.json`. TypeScript sem diagnósticos gera log vazio; seu exit code foi registrado.

A base não apresentou falha nesses quatro comandos. Avisos preexistentes: chunk JavaScript grande, importação estática/dinâmica de geocodificação e aviso ambiental npm sobre http-proxy. Não foram corrigidos por estarem fora do escopo.

Os dois testes que exigiam a antiga apresentação de Favoritos foram atualizados para os requisitos agora autorizados, mantendo teste de painel fechado. Foram acrescentados sete casos para listas oficiais, ordenação sem mutação, barra, cabeçalho, foto existente/inicial e campos de login. Os contratos anteriores de reporte e microfone e os testes legados de favoritos continuam executando. Nenhum teste foi ignorado para obter aprovação.

Os contratos de interface usam ReactDOMServer, já existente. Validam HTML inicial, não cliques ou integrações reais. Dados geográficos dos testes vêm dos JSONs existentes; o usuário/URL de avatar do teste é uma fixture explicitamente fictícia, sem sessão ou escrita externa. Nenhum sucesso de envio foi simulado como evidência real.

## Duas revisões e proteção contra regressões

1. **Interface/CSS/acessibilidade:** registrada em `revisao-1.md`. Confere ausência dos controles removidos, nomes acessíveis, listas diretas, estilos afetados e limites de validação visual.
2. **Lógica/integridade:** registrada em `revisao-2.md`. Compara dependências, handlers, algoritmos e arquivos protegidos; registra riscos remanescentes.

Comparação detalhada: `comparacao-base.json`, `integridade.json` e `alteracoes.patch`.

Foram confirmados idênticos à base: serviços ORS/rotas/Overpass/Nominatim, hooks de rotas/concorrência/dados/voz/narração/MediaSession/autenticação/reportes/preferências, dados oficiais, componentes de mapa e reporte, categorias, ícones, tokens CSS gerais, configuração PWA e dependências. A prioridade de acessibilidade, tolerância de +100m e preservação de rotas válidas não foram modificadas.

Também foram comparados exatamente os handlers e formulários remanescentes de autenticação, o algoritmo de ordenação da lista e os trechos de busca/microfone do cabeçalho e microfone da barra. Isso demonstra preservação de código, sem substituir validação real de execução.

## Evidências mobile e temas

A tentativa de iniciar um navegador real falhou por ausência do executável Chromium. Evidência: `evidencias-remocoes/navegador.log`. Não foi instalada dependência adicional nem produzida captura simulada.

| Largura | Claro | Escuro | Alto contraste |
|---|---|---|---|
| 320 px | BLOCKED | BLOCKED | BLOCKED |
| 360 px | BLOCKED | BLOCKED | BLOCKED |
| 390 px | BLOCKED | BLOCKED | BLOCKED |
| 430 px | BLOCKED | BLOCKED | BLOCKED |
| 768 px | BLOCKED | BLOCKED | BLOCKED |
| 1024 px ou superior | BLOCKED | BLOCKED | BLOCKED |

A revisão estática do CSS e os contratos de HTML não aprovam essa matriz. Devem ser verificados em navegador: rótulo longo Pontos próximos, espaço útil da busca com EchoPath visível, alinhamentos, ausência de overflow, texto ampliado, foco, toque, leitor de tela e teclado virtual.

## Verificações funcionais ainda pendentes

| Fluxo solicitado | Evidência disponível | Verificação real |
|---|---|---|
| Cálculo/exibição de rotas | Módulos preservados e suíte existente aprovada | PENDENTE: navegador, localização e ORS configurado |
| Selecionar destino em Pontos próximos | Listas/ordenação testadas; callback mantido | BLOCKED: clique e mapa em navegador |
| Busca textual | Trecho de busca e serviços preservados | BLOCKED: interação e resposta externa |
| Ativar, ouvir e interromper microfone | Controles/hook preservados; contratos e testes existentes aprovados | BLOCKED: navegador, permissão e microfone físico |
| Processar comandos de voz | Código preservado e testes existentes aprovados | PENDENTE: fala real |
| Abrir reporte, validar campos e erros | Componente/serviço idênticos e contratos existentes aprovados | BLOCKED: fluxo completo em navegador |
| Enviar reporte real | Nenhuma escrita realizada | BLOCKED: sessão/credenciais e ambiente autenticado indisponíveis |
| Login, cadastro, editar nome e logout | Handlers preservados; campos/ações presentes no HTML | BLOCKED: navegador e conta de teste autorizada |
| Abrir/fechar painéis, teclado e foco | Callbacks e hook de foco preservados | BLOCKED: interação em navegador |
| Offline e atualização de cache | Configuração PWA preservada; build/recursos HTTP disponíveis | PENDENTE: instalação e atualização real |

Não foram enviados reportes, apagadas fotos ou alteradas contas. A versão publicada não foi modificada nem declarada corrigida. As limitações anteriores de APIs externas e cache PWA continuam exigindo validação própria.

## Checklist de entrega e publicação posterior

- [x] Base obrigatória identificada e preservada.
- [x] Somente Pontos próximos na interface; Favoritos/estrelas removidos.
- [x] Câmera e seleção/upload de foto retirados; avatar atual/iniciais preservados.
- [x] Dados antigos preservados, sem migração destrutiva.
- [x] Testes, TypeScript, lint e build aprovados.
- [x] Duas revisões e comparação documentadas.
- [x] Nenhuma branch, agente, workspace paralelo, commit, push ou deploy criado/executado.
- [x] Nenhuma alteração em .env, credenciais, dados oficiais ou dependências.
- [ ] Concluir matriz mobile/temas e fluxos reais acima.
- [ ] Validar regressões em mapa, voz, autenticação, reporte e offline em dispositivo real.
- [ ] Somente após autorização, conferir destino/versão de publicação e atualização do cache PWA.

**Não se declara ausência total de regressões nem aprovação integral enquanto as verificações reais estiverem pendentes.**
