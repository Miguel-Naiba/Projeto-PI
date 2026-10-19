# EchoPath — revisão incremental V2

19/10/2026. **Implementação entregue para validação; aprovação integral PENDENTE.**

## Base identificada

Base exclusiva: `EchoPath-interface-revisada.zip`, última entrega concluída nesta conversa, 2.125.117 bytes, SHA-256 `7c425d749bc20a90c0612f2133fb8eec0eb29f7f906750be814d398f399d35fb`.

A base foi preservada íntegra. Todos os arquivos locais de código, recursos públicos e configuração foram comparados com esse ZIP antes de editar e eram idênticos. Não se voltou ao ZIP anterior. Os 161 arquivos da base são mantidos no novo pacote, com seis atualizações pontuais. Relatórios, testes e evidências anteriores continuam incluídos.

O escopo principal já estava implementado nessa base: Favoritos vazio sem favoritos reais, preservação do armazenamento, SVGs de microfone/obras, tokens e ajustes de CSS/reporte. Esta revisão mantém tudo isso e incorpora as referências mais recentes.

## Alterações desta revisão

A captura `image(20261019-145147).png` mostra o aviso de dados complementares atrás do cabeçalho. A imagem `image(20261019-145107).png` fornece a referência de advertência triangular.

| Arquivo modificado | Alteração e justificativa |
|---|---|
| `src/Aplicativo.tsx` | Classe no aviso de dados complementares e SVG no botão de reporte. Texto, condição de exibição, aria-live e handlers preservados. |
| `src/Aplicativo.css` | Posiciona o aviso abaixo do cabeçalho, reserva a coluna do zoom, limita largura/altura e permite rolagem. Estende estilos vetoriais ao novo símbolo. |
| `public/icons.svg` | Acrescenta símbolo triangular com exclamação, desenhado em SVG. Todos os símbolos anteriores preservados, inclusive obras e microfone. |
| `src/components/UI/Icone.tsx` | Aceita o novo nome `aviso`, sem mudar os anteriores. |
| `src/components/UI/Reportar.tsx` | Usa o SVG no título do modal. Nenhuma alteração no fluxo/formulário. |
| `src/components/UI/Reportar.css` | Superfície temática e ícone de 32px no botão flutuante existente de 52px. |

Não houve alteração de arquitetura, dependências, favoritos armazenados, categorias, geocodificação, roteamento, integrações, narração, microfone, fones/MediaSession ou PWA. O sinal específico de obras continua com a figura do trabalhador; a advertência genérica é usada no reporte.

## Verificações antes e depois

| Comando/verificação | Base | V2 |
|---|---|---|
| `npm test` | 249 testes / 26 arquivos, exit 0 | 249 testes / 26 arquivos, exit 0 |
| `npx tsc -b` | exit 0 | exit 0 |
| `npm run lint` | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 |
| Preview HTTP local | Evidências da entrega anterior preservadas | 12 recursos HTTP 200; novo símbolo presente |
| Comparação dos arquivos | Código local idêntico à base | Seis arquivos alterados; nenhum arquivo-base removido |

Evidências em `evidencias-ui-v2/`: logs antes/depois, `comparacao-base.json`, `alteracoes.patch`, `preview-http.json` e `navegador.log`. Os avisos de build sobre chunk grande/importação mista e o aviso ambiental npm http-proxy são preexistentes. Não houve falha nos comandos da linha de base.

Os testes existentes não foram removidos, enfraquecidos ou ignorados. Nenhum teste redundante ou dependência foi acrescentado nesta revisão. A aprovação automatizada não equivale à aprovação visual ou ao envio real.

## Duas revisões e proteção funcional

Primeira revisão: interface, CSS, SVG e acessibilidade (`revisao-1.md`). Segunda: lógica, integridade e efeitos colaterais (`revisao-2.md`). Ambas registradas separadamente.

A comparação confirmou identidade dos serviços, hooks, dados oficiais, testes, configuração de PWA e dependências. Aplicativo.tsx e Reportar.tsx foram comparados integralmente, limitando as diferenças aos elementos visuais descritos acima. Símbolos SVG antigos comparados por XML e preservados.

ORS atualizado, hierarquia de acessibilidade, tolerância de +100m, concorrência/cancelamento, preservação de rotas válidas, Overpass, Nominatim, Supabase, EPTC/SMOI, comandos de voz e offline não foram modificados. Essa preservação de código e os testes não comprovam todos os fluxos ao vivo.

## Mobile e temas — pendências explícitas

O executável Chromium continua ausente. A nova tentativa de inicialização está registrada em `navegador.log`. Não houve captura ou envio bem-sucedido simulado.

| Largura | Validação visual e funcional em navegador |
|---|---|
| 320 px | BLOCKED |
| 360 px | BLOCKED |
| 390 px | BLOCKED |
| 430 px | BLOCKED |
| 768 px | BLOCKED |
| 1024 px ou superior | BLOCKED |

| Tema | Evidência disponível | Validação visual |
|---|---|---|
| Claro | Novo símbolo usa os tokens existentes amarelo/preto | BLOCKED |
| Escuro | Novo símbolo usa os mesmos tokens, sem inversão | BLOCKED |
| Alto contraste | Tokens existentes amarelo vivo/preto e proteção em forced-colors | BLOCKED |

Os cálculos dos pares de tokens da etapa anterior estão preservados em `evidencias-ui/contraste-tokens.json`; não são capturas nem certificação de toda a interface.

**PENDENTE:** verificar a correção do aviso na tela real, abrir/fechar reporte, categorias disponíveis, validação, mensagens de erro, toque, sobreposições, teclado virtual, foco e leitor de tela. Também continuam pendentes favoritos com persistência, mapa visual, rotas, voz e offline em execução real.

**BLOCKED:** envio real autenticado, pois não há sessão/credenciais utilizáveis disponíveis para essa validação. Não se alterou .env nem se criaram registros/coordenadas. A lógica de categorias permanece exatamente a da base.

## Checklist de publicação posterior

- [x] Base mais recente identificada, preservada e comparada.
- [x] Alterações incrementais; todos os arquivos-base mantidos.
- [x] Testes, TypeScript, lint e build aprovados antes/depois.
- [x] Duas revisões documentadas.
- [x] Nenhum agente, branch, workspace paralelo, commit, push ou deploy criado/executado.
- [x] Nenhuma alteração em .env, credenciais, dados oficiais ou dependências.
- [ ] Executar matriz mobile e temas em navegador real.
- [ ] Validar reporte completo com conta autorizada, ponto real e retorno real do backend.
- [ ] Confirmar mapa, rotas, favoritos, voz, foco e offline em execução.
- [ ] Conferir versão efetivamente publicada e cache PWA antes/depois de eventual publicação autorizada.

A versão publicada não foi modificada nem declarada corrigida. Não se declara ausência total de regressões sem concluir as verificações pendentes.
