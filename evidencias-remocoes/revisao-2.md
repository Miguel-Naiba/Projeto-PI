# Revisão 2 — lógica, dependências e regressões

- Comparação com o ZIP obrigatório: 10 arquivos alterados e um utilitário removido. 73 arquivos protegidos verificados idênticos por SHA-256, incluindo serviços, hooks, mapa, dados oficiais, reporte, ícones, tokens gerais, configuração PWA e dependências.
- Handlers de login, cadastro, logout e edição de nome e JSX remanescente dos formulários comparados exatamente com a base. Hook useAutenticacao.ts permanece íntegro, inclusive atualização parcial dos metadados, evitando alterar fotografias previamente salvas.
- Markup e callbacks de busca/microfone do cabeçalho e controle de microfone da barra comparados exatamente com a base. Hooks de voz, narração e MediaSession não foram editados.
- Algoritmo de ordenação da lista comparado exatamente com a base. Seleção de destino, listas e fechamento permanecem no componente existente; nenhum serviço de proximidade foi alterado.
- useLocaisSalvos.ts e seus testes foram preservados como módulo legado desconectado da aplicação. Nenhum consumidor de produção permanece e a chave de persistência não aparece no bundle. Não há migração, leitura/gravação automática ou exclusão dos favoritos antigos pela aplicação atual.
- prepararAvatarComoDataUrl tinha somente um consumidor, o upload de perfil. src/utils/imagem.ts foi removido após retirar esse consumidor; busca confirmou ausência de imports restantes. Não possui teste exclusivo removido e não é recurso do reporte.
- Testes antigos de apresentação Favoritos foram substituídos por requisitos novos de Pontos próximos; testes de persistência antigos permanecem. Adicionados contratos de listas, ordenação, cabeçalho, barra, avatar, ausência de upload e campos de login. Nenhum teste ignorado ou enfraquecido para encobrir falha.
- .env real comparado byte a byte com o original local e mantido. Nenhuma dependência instalada. Nenhum acesso de escrita ao Supabase ou ao armazenamento de usuários realizado.

Limites: os contratos de HTML inicial não executam login/cadastro/edição/logout, eventos de seleção, foco, microfone, mapas ou reportes. Não há sessão, microfone físico ou navegador disponível para validar esses fluxos reais. Testes existentes de rotas e voz passaram, sem equivaler a comprovação end-to-end.
