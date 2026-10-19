# EchoPath — critérios e relatório de correção

## Critérios registrados antes da alteração do avaliador

1. Só comparar candidatas elegíveis: distância <= rota base + 100 m. Compensar exclusivamente arredondamento IEEE-754 com epsilon relativo à magnitude; +100,01 m continua proibido.
2. Comparação lexicográfica: menor número de obras conhecidas no corredor; maior fração de cobertura de botoeiras; maior fração de cobertura de Paradas com piso tátil; menor distância; menor duração. Manter os raios e a amostragem de 15 m existentes.
3. Cobertura parcial: qualquer diferença na fração calculada decide antes dos critérios seguintes. Não arredondar antes de comparar, nem inventar faixa de empate. A resolução já decorre da amostragem existente, não de um novo limiar de decisão.
4. Empates completos conservam a ordem de entrada. Pequenas diferenças reais contam; distância e tempo só desempatarão os critérios anteriores iguais.
5. Sem registros válidos, cobertura confirmada é zero para todas as candidatas; ausência de obras nos dados não comprova ausência física. Informar limitações de dados complementares na interface e narração.
6. A pontuação exibida é relativa ao conjunto comparado: grupos de preferência ordenados recebem 100 até 0 com espaçamento uniforme; empates recebem a mesma nota. Com apenas um grupo, 100 significa única preferência disponível, nunca segurança absoluta. Não comparar notas entre consultas distintas. A nota é atribuída após a ordenação e não determina a escolha.
7. A base permanece no conjunto de candidatas. Obras são penalizadas, não declaradas inexistentes quando nenhuma alternativa elegível as evita.

## Plano incorporado

Preservar endpoint ORS do ZIP; validar credencial/GeoJSON; limitar espera e propagar cancelamento; distinguir solicitação manual de recálculo; deduplicar solicitações idênticas pendentes; impedir respostas obsoletas; preservar rota válida após falha. Corrigir saída Overpass para `out body center`, validar nodes/centros de ways/relations e controlar frequência mesmo após erro. Não alterar MediaSession, dados oficiais, `.env`, PWA, dependências ou Git.

Para testar concorrência sem dependências de DOM, extrair apenas o controle assíncrono do hook para um módulo pequeno (`controleSolicitacaoRota.ts`), testando o mesmo controlador usado pelo hook. Compartilhar a gestão de prazo/cancelamento entre ORS e Overpass em `requisicao.ts`, com testes de contrato; isso evita duas implementações divergentes.

## Resultado e limites da conclusão

Correções locais implementadas e verificadas por testes unitários/de contrato, typecheck, lint e build. Não houve publicação. A versão de produção NÃO foi declarada corrigida. Nenhuma operação Git foi executada; nenhuma branch, agente ou workspace paralelo foi criado.

### Causas confirmadas no código e divergência de versões

- O ZIP original já usa `https://api.heigit.org/openrouteservice/v2`. O endereço foi preservado.
- A consulta HTTP pública do site `https://echo-path-rho.vercel.app/` nesta sessão retornou o aplicativo `/assets/Aplicativo-D6DlbCDy.js`, com o domínio antigo e sem o novo. SHA-256 desse JS: `06fc74b6c969cd3955ba3b48ad379e280960884695de3fd1fe934fc8c7bf12ac`.
- Isso comprova divergência entre o ZIP e os arquivos públicos servidos. Não comprova que o deployment atual é o commit `098331b`: esse commit e a branch `main` são o histórico informado pelo usuário. Não houve acesso autenticado à Vercel/GitHub para estabelecer o vínculo atual.
- A consulta pública de arquivos não reutiliza o cache de um PWA instalado. Portanto, um cache antigo no aparelho pode coexistir com a divergência de publicação, mas não explica sozinho o arquivo antigo ainda servido pelo site. O cache de um aparelho específico não foi inspecionado.
- ORS não possuía prazo de rede, validação suficiente do GeoJSON ou cancelamento por troca de solicitação. A resposta antiga podia atualizar o estado depois da nova, e o cancelamento visual não abortava a rede.
- O pipeline podia repetir alternativas idênticas após falha e deixava de incluir a base quando recebia alternativas.
- Pesos fixos não garantiam a hierarquia com cobertura parcial. O novo comparador avalia os critérios explicitamente; o custo ponderado legado continua apenas como dado de diagnóstico para compatibilidade interna, sem decidir escolha ou nota.
- Overpass utilizava `out center tags`, omitindo coordenadas de nodes. O hook registrava frequência só após sucesso, e descartava resultados em cada atualização do GPS sem abortar a rede.
- Falhas manuais tinham mensagem visual, mas não a mesma narração explícita dos recálculos.

### Hipóteses descartadas e hipóteses em aberto

Descartadas como explicação suficiente: endpoint antigo no ZIP; ausência de Polyline/fitBounds no componente; bloqueio direto do ORS aguardando Overpass; correção de CORS apenas por trocar a saída QL.

Continuam sem prova: causa específica do 504 original; validade/cota da credencial da Vercel; causa dos 406/500 públicos; configuração CORS no navegador; commit efetivamente implantado; estado do PWA em um aparelho real. Não foi necessário alterar o Service Worker.

## Arquivos modificados

| Arquivo | Antes → depois / motivo | Risco principal |
| --- | --- | --- |
| `src/services/api.ts` | JSON aceito sem contrato, sem prazo → validação de credencial, origem/destino, FeatureCollection, Feature, LineString, coordenadas, summary e instruções; erros classificados; prazo/cancelamento; espera Retry-After em memória. Endpoint preservado. HTTP 404 passou a indicar endereço do serviço ausente, sem presumir inexistência de caminho. | Respostas fora do contrato agora são rejeitadas. |
| `src/services/roteamento.ts` | Repetições genéricas e base ausente do conjunto → sinal propagado, base preservada, duplicatas removidas, fallback de parâmetros só em 400/422 com polígonos, epsilon de representação no limite inclusivo e aviso quando alternativas indisponíveis. | Mudança intencional na seleção e nos fallbacks. |
| `src/services/avaliadorRota.ts` | Ordenação por custo e faixa de empate de 5 → comparação lexicográfica explícita, empates estáveis e nota relativa atribuída após ordenar. | Pequena cobertura confirmada pode prevalecer sobre distância, conforme a prioridade autorizada. |
| `src/hooks/useRotaAcessivel.ts` | Solicitações sem identidade/cancelamento → uso de um controlador testável, motivo manual/recálculo, cleanup, cancelamento do cálculo separado de limpar a rota. | Integração React real ainda requer teste de navegador. |
| `src/services/osm.ts` | Saída sem coordenadas de nodes, sem prazo/validação → `out body center`, formulário `data`, validação de elementos e coordenadas, sinal e limite de duas instâncias. Mantidas as categorias consultadas e os servidores existentes. | Indisponibilidade das instâncias públicas permanece externa. |
| `src/hooks/useDadosAcessibilidade.ts` | Intervalo registrado só no sucesso e descarte a cada GPS → tentativa registrada no início, uma consulta em andamento, dados anteriores preservados, cleanup ao desmontar; limites existentes de 20s/60s mantidos. | Nova busca depende de nova leitura do GPS; não foi criado polling permanente. |
| `src/Aplicativo.tsx` | Erro manual sem anúncio explícito → erro narrado, início anunciado a partir do pedido aceito, botões cancelar cálculo/buscar novamente, nota relativa e aviso de dados incompletos. Região visual do erro não duplica sua região de anúncio. | Voz real, foco, leitor de tela e desenho precisam de validação em navegador/aparelho. |
| `src/services/api.test.ts` | Testes aceitavam 200 vazio → fixtures válidas e contratos de configuração, resposta, headers/corpo, timeout, cancelamento, HTTP e Retry-After. | Transporte simulado não valida API externa. |
| `src/services/roteamento.test.ts` | Só filtro de distância → pipeline com transporte simulado, base/fallbacks, sinal, conversão Leaflet, falhas simultâneas Overpass/ORS independentes e precisão numérica. | Não renderiza Leaflet. |
| `src/services/avaliadorRota.test.ts` | Cobertura sobretudo total → cenários parciais, pequenas diferenças, empates, coerência da nota e ordem de entrada. Testes anteriores mantidos. | Cobertura continua uma aproximação espacial. |

## Arquivos novos e justificativa

| Arquivo | Finalidade |
| --- | --- |
| `src/services/requisicao.ts` | Gestão compartilhada de prazo/sinal, coordenadas e Retry-After; evita duplicação entre ORS e Overpass. |
| `src/services/requisicao.test.ts` | Prazo incluindo corpo, cleanup, sinal já abortado e Retry-After numérico/data. |
| `src/services/controleSolicitacaoRota.ts` | Controle assíncrono mínimo utilizado pelo hook; uma única fonte para estado de rota, deduplicação e descarte de respostas obsoletas. |
| `src/services/controleSolicitacaoRota.test.ts` | Solicitações concorrentes, sucesso/erro fora de ordem, cancelamento voluntário, timeout/falha de recálculo, preservação e recuperação. |
| `src/services/fixturesRota.test-utils.ts` | Fixture compartilhada para contratos reais de GeoJSON, sem replicar dados de teste. |
| `src/services/osm.test.ts` | Nodes, ways, relations, registros inválidos, 406/500, rede, timeout, cancelamento, resposta parcial e fallback limitado. |
| `src/hooks/useDadosAcessibilidade.test.ts` | Política de frequência usada pelo hook e manutenção de dados EPTC sem retorno Overpass. É teste unitário; não monta React. |

## Cancelamento, falhas e estado

- Manual: um pedido pendente ao mesmo destino é compartilhado, inclusive entre cliques com pequenas atualizações do GPS. Origem/contexto desse pedido são os do primeiro disparo; um novo cálculo pode ser pedido depois de terminar ou cancelar.
- Troca de destino ou de motivo: aborta o anterior e muda a identidade da tarefa. Mesmo um transporte que entregue uma resposta tardia não consegue publicar resultado obsoleto.
- Cancelamento voluntário do cálculo: não apresenta erro e mantém a rota anterior. Limpar a rota também cancela o cálculo e remove a rota.
- Recálculo: falha mantém a rota anterior; preservado o backoff automático já existente. Solicitação manual permanece possível. Não foi criado retry infinito.
- Timeout: erro próprio (`TimeoutError`), distinto de `AbortError`. ORS tem prazo operacional de 60s por chamada; Overpass tem 30s por instância (25s declarados no servidor + margem de transporte). São limites operacionais documentados, não SLA medido. Incluem leitura do corpo, com cleanup.
- ORS 401/403/429/5xx, timeout e rede não são repetidos imediatamente pelo pipeline. Só 400/422 com polígonos justificam uma tentativa sem essa opção. Falha de alternativas usa a base válida e informa a limitação.
- HTTP 429 respeita `Retry-After`, quando presente, antes de nova chamada de rede. Sem esse header, mantém-se a recuperação manual e o backoff automático existente.
- Nenhuma trajetória, chave ou header de autenticação foi adicionada a logs/cache persistente.

## Testes e verificações

Ambiente: Node 24.19.0, npm 11.9.0, Vite 6.4.3 e Vitest 5.0.1 do projeto. Nenhuma dependência foi acrescentada; package.json e lockfile são idênticos aos recebidos.

| Verificação | Comando/procedimento | Resultado / evidência | Limitação |
| --- | --- | --- | --- |
| Instalação inicial | `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=10000` | PASSOU: 462 pacotes pelo lockfile. | Scripts de instalação desativados; não é auditoria de vulnerabilidades. |
| Typecheck final | `./node_modules/.bin/tsc -b` | PASSOU, exit 0. | Não executa UI. |
| Lint final | `npm run lint` | PASSOU, exit 0; evidência em `evidencias/lint.txt`. | Análise estática. |
| Testes finais | `npm test` | PASSOU: 238 testes em 25 arquivos; evidência em `evidencias/testes.txt`. Baseline: 170 em 21 arquivos. | Sem integração externa ou DOM real. |
| Build final | `npm run build` | PASSOU, exit 0, 148 módulos, SW e manifest gerados. | Não prova funcionamento das APIs. |
| Preview HTTP | Preview local com HTTP direto | PASSOU: página, scripts, manifest, SW, três datasets e GTFS retornaram 200; endpoint novo presente e antigo ausente do bundle. | Não monta/renderiza a UI num navegador. |
| Regressão de arquivos preservados | Comparação byte a byte com ZIP | PASSOU: dados oficiais/GTFS, .env, MediaSession, dependências e configuração PWA intactos. | Preservação de arquivos não substitui teste funcional de todas as telas. |
| ORS real autenticado | Credencial do projeto | PENDENTE: o `.env` recebido está sem chave ORS e não foi modificado. | Testes de contrato usam credenciais fictícias e fetch simulado. |
| Overpass real | POST formulário, consulta mínima `[out:json][timeout:5];node(0);out body center;` | NÃO RESOLVIDO: primeira instância HTTP 406; segunda HTTP 500. | Consulta mínima testa transporte/parser, não os dados da área nem CORS do navegador. A origem precisa do erro remoto não foi determinada. |
| Interface/Leaflet/zoom/voz/foco | Tentativa de iniciar Chromium via Playwright já disponível no ambiente | BLOCKED: executável Chromium ausente. Nenhum browser/dependência foi instalado. | Polyline, enquadramento, voz, leitor de tela e fluxo visual continuam PENDENTES de validação real. |
| Deployment e commit | Arquivos públicos servidos + informação do usuário | Domínio antigo confirmado no bundle público. Vínculo atual com `main`/`098331b`: PENDENTE. | Sem acesso autenticado à Vercel/GitHub. |
| PWA instalado | Atualização em aparelho | PENDENTE. | Nenhum aparelho/perfil de usuário foi acessado. |

Avisos do build: chunk JS do aplicativo acima de 500 kB e geocodificação importada de forma estática e dinâmica, já observados no baseline. O aplicativo final gerou chunk principal de 523,64 kB (gzip 150,23 kB), ante 514,77 kB (gzip 147,18 kB) no baseline; precache total de 771,73 KiB ante 759,95 KiB. Sem novas bibliotecas, intervalos permanentes ou otimizações especulativas. Não foi realizado benchmark de CPU/memória/aparelho.

## Prevenção de reincidência

Os testes de endpoint impedem a volta silenciosa ao domínio antigo. Respostas inválidas e configuração ausente não geram sucesso. O controlador testado é o mesmo utilizado pelo hook: cobre sucesso e erro obsoletos chegando antes/depois da nova resposta, deduplicação, cancelamento e preservação de rota. A comparação parcial e a tolerância inclusiva têm casos específicos. O pipeline é testado com ambas as instâncias Overpass falhando enquanto ORS conclui. O contrato Overpass verifica coordenadas de nodes e centros de ways/relations, sem inventar posições para registros inválidos.

Não foram adicionados testes amplos de interface sem infraestrutura adequada, nem dependências de DOM. O impedimento do Chromium está registrado, sem simular aprovação.

## Pendências, riscos remanescentes e fora de escopo

- Concluído e verificado localmente: contratos, seleção, concorrência, cancelamento, preservação, isolamento e checks descritos acima.
- Implementado, mas sem validação visual real: integração do controlador com React montado, mensagens de voz, foco dos botões, avisos/aria-live e Leaflet. Typecheck/lint cobrem estrutura; testes do controlador cobrem comportamento assíncrono, não a execução dos efeitos React.
- PENDENTE: chamada real ORS válida, geometria real, desenho/enquadramento e narração no aparelho; vínculo deployment/commit; atualização do PWA instalado.
- NÃO RESOLVIDO externamente: Overpass 406/500. Não se afirma correção de CORS. A aplicação informa dados incompletos e mantém funcionalidades independentes.
- Acesso a dados complementares continua limitado pela área de consulta existente; não representa inventário completo de obstáculos no trajeto. Centros de ways/relations são aproximações, não polígonos reais de obras. Mantidos buffer de 20m, corredor de 30m e amostragem de 15m existentes, sem novos limiares de escolha.
- A nota é comparativa e pode variar com o conjunto disponível. Uma candidata única recebe 100 como única preferência disponível, inclusive se houver obra conhecida; a mensagem ressalta limitações e não garante segurança.
- As variáveis VITE são públicas no bundle. Nenhum proxy ou mecanismo novo de segredo foi criado. Rever proteção/quota do ORS é recomendação separada, sem alteração de arquitetura nesta etapa.
- O pacote contém código, testes, relatório e evidências. Não inclui `.env`, node_modules, dist ou histórico Git. O `.env` recebido permaneceu intacto no workspace; manter a configuração existente no ambiente de trabalho do usuário.

## Checklist de publicação — somente por ação humana autorizada

1. Revisar o diff dos arquivos listados e conservar o `.env` local e os datasets oficiais existentes.
2. Reexecutar `npm ci`, `npm run lint`, `npm test` e `npm run build` no ambiente de publicação; configurar ORS na Vercel sem expor seu valor em mensagens.
3. Revisar as pendências de navegador e API real. Somente depois, efetuar commit/push autorizado à branch de produção `main`; nada disso foi executado nesta sessão.
4. Na Vercel, confirmar o novo deployment e seu commit efetivo. O histórico `098331b` não deve ser tomado como versão atual sem conferir.
5. Confirmar requisição real para `api.heigit.org`, HTTP bem-sucedido, GeoJSON válido, Polyline, enquadramento, fim do loading e confirmação falada.
6. Testar erro, timeout, cancelamento, troca de destino e falha de recálculo mantendo a rota anterior; conferir foco e leitor de tela, sem anúncios duplicados.
7. Testar Overpass indisponível com camadas oficiais e rota ainda utilizáveis, com aviso de dados incompletos. Não prometer ausência de obras não verificadas.
8. Conferir atualização do PWA instalado e suas abas abertas. Distinguir assets antigos em cache de arquivos antigos ainda servidos. Não alterar/limpar automaticamente o armazenamento do usuário durante uma navegação ativa.

## Critérios solicitados pelo usuário

- [x] Hierarquia corrigida e testada com coberturas parciais.
- [x] Concorrência/cancelamento seguros nos testes do controlador, preservando rotas válidas.
- [x] Contrato Overpass corrigido e falhas isoladas nos testes. Erros públicos 406/500 permanecem não resolvidos.
- [x] Diferença ZIP/deployment documentada, sem atribuição indevida de commit/cache.
- [x] Testes específicos sem dependências novas ou expansão de funcionalidades.
- [x] Typecheck, lint, 238 testes e build aprovados.
- [x] Nenhum commit, push, deploy ou alteração Git automático.
- [ ] Validação definitiva em produção e PWA instalado: PENDENTE.
- [ ] Validação visual/voz/leitor de tela: BLOCKED neste ambiente pela ausência do Chromium; PENDENTE no aparelho.
