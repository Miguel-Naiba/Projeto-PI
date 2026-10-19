# EchoPath — entrega incremental de interface

Data: 19/10/2026. **Implementado; aprovação visual/funcional em dispositivos reais PENDENTE.**

## Base oficial e preservação

Base: **EchoPath-final (2).zip**, 2.083.981 bytes.
SHA-256: `bbeae2d33301321caad96e81850291379d54df6ea4cafec540896b9b326ff3a1`.

O arquivo disponibilizado é byte a byte idêntico ao último ZIP corrigido anteriormente entregue. É diferente do ZIP inicial, que não continha as correções anteriores. A cópia íntegra foi preservada para comparação. O código local foi comparado antes das alterações: os arquivos de código eram idênticos; documentos/evidências da entrega anterior existentes apenas no ZIP são conservados integralmente no novo pacote.

A implementação reutiliza o projeto existente. O novo ZIP contém todos os arquivos da base, com as substituições explicitamente listadas abaixo, mais os novos testes, componente e documentação. Não inclui node_modules, dist ou .env real, assim como a base. A documentação antiga e seus testes permanecem no pacote; `RELATORIO-ECHOPATH.md` e `evidencias/` descrevem a etapa anterior, enquanto este relatório e `evidencias-ui/` descrevem esta etapa.

## Alterações e justificativas

| Arquivo | Alteração |
|---|---|
| `public/icons.svg` | Símbolos vetoriais próprios de microfone inativo/ativo e sinal de obras, inspirados nas duas imagens fornecidas. Não incorpora PNG nem a imagem de referência. |
| `src/components/UI/Icone.tsx` — novo | Reutilização dos símbolos, ícones decorativos e nome acessível no controle pai. |
| `src/components/ListaLocais.tsx` | Abertura em Favoritos, estado vazio acessível e visualização separada de Pontos próximos. Mantém seleção, ordenação, salvar e remover. |
| `src/components/ListaLocais.css` | Painel limitado à largura disponível, alvos de toque, quebra de nomes, seleção visível e regra `section` restrita ao componente. |
| `src/Aplicativo.css` | Tokens de ícones/ações/bordas, deslocamento baseado na altura medida da barra e espaço para avisos sem ocupar a coluna do botão de reporte. |
| `src/components/UI/Cabecalho.tsx` | Troca somente a apresentação do microfone por SVG, mantendo callbacks, estados e nomes acessíveis. |
| `src/components/UI/Cabecalho.css` | Busca flexível, alvos de 44px, fonte de entrada de 16px no tamanho padrão e cabeçalho compacto em telas pequenas. |
| `src/components/UI/BarraInferior.tsx` | SVG de microfone e medição da altura real por ResizeObserver, com limpeza dos recursos. |
| `src/components/UI/BarraInferior.css` | Camadas organizadas em três colunas no mobile, rótulos com quebra e ações flexíveis. |
| `src/components/UI/Alternador.tsx` | Sinal de obras vetorial; mantém a interface, o estado e o callback do alternador. |
| `src/components/UI/Reportar.tsx` | Ícones, nomes acessíveis dos campos, grupos de botões semanticamente corretos e ajuste do modal ao VisualViewport. Handlers de busca, validação e envio preservados. |
| `src/components/UI/Reportar.css` | Seletores que realmente atingem catálogo/descrição, campos e botões com área adequada, rolagem, foco, safe areas e contraste da ação. |
| `src/components/Mapa/VisualizadorMapa.tsx` | Somente apresentação de obras e atualização do tamanho interno do mapa após redimensionamento do painel. Dados, serviços, coordenadas e callbacks preservados. |
| `src/components/Mapa/VisualizadorMapa.css` | Alvo de toque do reporte em popup e tamanho do SVG no marcador. |
| `src/hooks/useFocoModal.ts` | Impede Shift+Tab de escapar do modal a partir do título inicial com tabindex=-1. Mantém os casos existentes. |
| `src/hooks/useFocoModal.test.ts` | Dois testes adicionais da regressão de foco. Nenhum teste anterior removido ou enfraquecido. |
| `src/components/interface.contrato.test.tsx` — novo | Nove contratos de HTML inicial: favoritos, ausência de dados fictícios na abertura, acesso/categorias do reporte e estado acessível do microfone. |

Total: **15 arquivos existentes modificados e 2 arquivos novos de código/teste**. Documentação e evidências adicionais estão separadas em `evidencias-ui/`.

Não foi encontrada carga de favoritos demonstrativos no hook. A causa identificada era o botão Favoritos mostrar pontos próximos reais. Nenhum dado persistido foi apagado ou filtrado adicionalmente; `useLocaisSalvos.ts` permanece idêntico à base.

## Testes antes e depois

| Verificação | Base | Versão entregue | Evidência |
|---|---|---|---|
| `npm test` | 238 testes / 25 arquivos, exit 0 | 249 testes / 26 arquivos, exit 0 | `antes-testes.log`, `depois-testes.log` |
| `npx tsc -b` | exit 0 | exit 0 | `antes-typecheck.log`, `depois-typecheck.log` |
| `npm run lint` | exit 0 | exit 0 | `antes-lint.log`, `depois-lint.log` |
| `npm run build` | exit 0 | exit 0 | `antes-build.log`, `depois-build.log` |
| Preview HTTP local | Evidência da etapa anterior preservada na base | 12 recursos responderam 200; símbolos SVG presentes | `preview-http.json` |
| Integridade | Código local idêntico à base antes de editar | 53 arquivos protegidos idênticos; handlers de reporte idênticos | `integridade.json`, `comparacao-base.json`, `alteracoes-ui.patch` |

Logs dentro de `evidencias-ui/`. Logs vazios de TypeScript significam execução sem diagnósticos, com exit code registrado em `resultados-comandos.json`.

Não houve falha nos quatro comandos da linha de base. Avisos preexistentes continuam: chunk JavaScript superior a 500 kB, importação estática/dinâmica de geocodificação e aviso ambiental do npm sobre http-proxy. Não foram tratados por estarem fora do escopo. Build final: 149 módulos; precache gerado com 15 entradas, 776,25 KiB.

Os nove testes novos de interface usam ReactDOMServer, já instalado. São contratos do HTML inicial, **não testes de cliques, navegador ou envio real**. O único ponto usado pelo teste é lido do dataset existente e não é gravado. Não houve dependência adicionada nem configuração de credenciais fictícias.

## Evidências mobile e temas

A tentativa real de iniciar Chromium falhou porque o executável não existe no ambiente. A biblioteca Playwright, isoladamente, não disponibiliza um navegador. Evidência: `navegador.log`. Nenhum navegador ou dependência foi instalado.

| Largura solicitada | Renderização, interação e sobreposições em navegador |
|---|---|
| 320 px | BLOCKED — navegador ausente |
| 360 px | BLOCKED — navegador ausente |
| 390 px | BLOCKED — navegador ausente |
| 430 px | BLOCKED — navegador ausente |
| 768 px | BLOCKED — navegador ausente |
| 1024 px ou superior | BLOCKED — navegador ausente |

Não há capturas simuladas. A adaptação existe no código, mas não foi aprovada visualmente nessas larguras.

Foram calculados os contrastes dos pares explícitos de tokens e validada a sintaxe XML do SVG. Isso não certifica toda a interface nem substitui inspeção visual:

| Tema | Texto do botão de confirmação / fundo | Traço do sinal de obras / fundo | Inspeção em navegador |
|---|---:|---:|---|
| Escuro | 10,22:1 | 14,21:1 | BLOCKED |
| Claro | 5,36:1 | 14,21:1 | BLOCKED |
| Alto contraste sobre escuro | 10,22:1 | 19,56:1 | BLOCKED |
| Alto contraste sobre claro | 7,20:1 | 19,56:1 | BLOCKED |

Evidência: `contraste-tokens.json`. Amarelo/preto mantêm a advertência em todos os temas; o microfone acompanha a cor do controle e distingue escuta por desenho, nome acessível e estado, sem depender somente de cor.

## Preservação funcional e dupla revisão

A primeira revisão examinou interface, CSS, SVGs e acessibilidade. A segunda comparou lógica, contratos, integridade e efeitos colaterais. Registros separados: `revisao-1.md` e `revisao-2.md`.

Foi confirmada a identidade dos serviços, datasets oficiais EPTC/SMOI, Aplicativo.tsx, hooks protegidos de rotas/concorrência/dados/voz/reportes/favoritos/preferências, categorias, configuração PWA e dependências. A hierarquia de acessibilidade, tolerância de +100m, ORS atualizado, Overpass/Nominatim, integração Supabase, narração, comandos e MediaSession não foram alterados. Os testes existentes desses módulos continuam passando.

Isso comprova preservação dos arquivos/contratos verificados, **não operação completa ao vivo**. Mapa renderizado, rotas reais, geolocalização, voz e modo offline precisam de validação em navegador/dispositivo. O ajuste compartilhado de foco e os observers de tamanho também exigem essa confirmação interativa.

## Limitações e riscos remanescentes

- **BLOCKED:** abrir/fechar/reabrir o reporte por toque, sobreposições, teclado virtual, leitores de tela e navegação real entre etapas nas seis larguras.
- **BLOCKED:** envio real autenticado e mensagens de erro retornadas pelo backend. Não há configuração Supabase utilizável/conta autenticada disponível no projeto local; .env foi preservado. Nenhum reporte foi enviado ou marcado como bem-sucedido.
- **PENDENTE:** adicionar, selecionar e remover favoritos pelo navegador, confirmar persistência após recarga e retorno entre as duas visualizações. O hook de persistência foi preservado e seus testes passaram.
- **PENDENTE:** validação visual completa dos temas, texto ampliado, orientação paisagem e suporte dos SVGs externos no navegador/PWA alvo.
- **PENDENTE:** validação dos demais modais após o ajuste do focus trap compartilhado.
- **PENDENTE:** APIs externas e produção. O deployment anteriormente informado como main/098331b é histórico; a versão publicada não foi alterada nem revalidada nesta etapa. O ZIP local não deve ser confundido com a aplicação publicada.
- **PENDENTE:** validar atualização do cache PWA após eventual publicação autorizada. O service worker/configuração offline não foram modificados.

## Checklist para validação e publicação posterior

- [x] Último ZIP identificado por igualdade binária e preservado.
- [x] Incrementos limitados à interface e ao foco necessário para o reporte.
- [x] Favoritos sem registros quando não há favoritos reais; armazenamento preservado.
- [x] SVGs vetoriais e tokens implementados.
- [x] Typecheck, lint, testes e build sem falhas.
- [x] Comparação de integridade e duas revisões documentadas.
- [x] Nenhuma dependência, branch, agente ou workspace paralelo criado.
- [x] Nenhum commit, push, deploy ou alteração no Git/.env realizado.
- [ ] Executar matriz de larguras, temas, texto ampliado, teclado e leitor de tela em navegador real.
- [ ] Validar formulário completo com conta autorizada, ponto real, erros e envio real, sem fabricar coordenadas.
- [ ] Validar mapa, rotas, voz, favoritos, categorias e offline em execução real.
- [ ] Conferir destino/versão de publicação e cache PWA, somente após autorização específica.

**Entrega para validação. Não há declaração de produção corrigida ou ausência total de regressões.**
