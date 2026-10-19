# Revisão 2 — lógica, integridade e regressões

Revisão separada, após a revisão de interface.

- Comparação binária com o ZIP-base: 15 arquivos existentes alterados; 2 arquivos de código/teste acrescentados. Nenhum arquivo-base será removido no empacotamento.
- 53 arquivos protegidos verificados por SHA-256, idênticos: serviços, dados oficiais, configuração PWA, dependências, Aplicativo.tsx e hooks principais protegidos (lista completa em comparacao-base.json e seleção reproduzível em comparar_base.py).
- Trecho completo dos handlers do formulário, de escolherTipo até o JSX de autenticação, comparado exatamente e preservado. Nenhuma mudança na geocodificação, criação do reporte, coordenadas ou validação de envio.
- ListaLocais reutiliza handlers existentes de selecionar destino e alternar favorito; persistência useLocaisSalvos.ts idêntica. Não havia lista demonstrativa para apagar: pontos próximos oficiais estavam sendo exibidos pelo botão Favoritos.
- As categorias continuam usando categoriasVisiveis e TIPOS originais. Contrato de HTML testa que categoria indisponível não reaparece.
- Callbacks e hooks de reconhecimento de voz/ditado/narração/MediaSession permanecem intactos; somente ícones/apresentação mudaram.
- Correção do focus trap mantém casos existentes, incluindo null; adiciona tratamento para o título com tabindex=-1, com dois testes novos. É compartilhada pelos modais existentes; interação real nesses modais permanece pendente.
- ResizeObserver da barra possui disconnect e restauração da variável CSS. Adicionado observer de tamanho no mapa para evitar tamanho interno desatualizado após mudança da barra, sem mudar dados, serviços ou cálculo de rotas.
- Listeners de VisualViewport do reporte removidos no desmonte.
- .env local verificado byte a byte contra o arquivo original, sem alteração ou exposição; package.json e lockfile idênticos.
- 249 testes / 26 arquivos aprovados; antes, 238 / 25. Typecheck, lint e build finais com código de saída zero. 12 recursos do preview local responderam 200.

Limites: SSR valida o HTML inicial, não cliques ou persistência real no navegador. Testes existentes de lógica não equivalem a ORS real, mapa visual, voz, envio Supabase ou PWA offline. Esses fluxos seguem PENDENTES/BLOCKED conforme o relatório. Não se declara ausência total de regressões.
