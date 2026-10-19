# Revisão 1 — interface, CSS, SVGs e acessibilidade

Revisão estática realizada após implementação, separada da revisão funcional.

- Ícones usam símbolos SVG vetoriais e `currentColor` no microfone; obras usam amarelo/preto por tokens, sem inversão global.
- Estado de escuta preserva `aria-pressed`, nomes acessíveis e desenho distinto. Callbacks de voz não alterados.
- Corrigidos seletores de inputs/textarea do reporte: os seletores anteriores não alcançavam o catálogo e a descrição.
- Botões do reporte, microfones, favoritos e fechamento têm alvos mínimos de 44px nos estilos revisados.
- Categorias continuam filtradas pelo mecanismo existente; grupo de botões substitui radiogroup sem navegação de rádio implementada.
- Barra inferior medida por ResizeObserver com fallback de resize, substituindo deslocamento fixo; rótulos quebram em telas pequenas.
- Modal acompanha VisualViewport com remoção de listeners; conteúdo rolável e safe areas preservadas.
- Aviso do mapa reserva espaço horizontal para botão de reporte; popups mantêm callbacks originais.
- Regra global `section` limitada ao painel de locais para não afetar outros componentes.
- Detectado contraste 4,37:1 do texto branco no verde claro original: criado token de ação mais escuro somente para o botão de reporte. Alto contraste possui token próprio.

BLOCKED: inspeção visual, medidas reais de toque/overflow, cliques, sobreposições, temas, teclado virtual, leitor de tela e telas 320/360/390/430/768/1024 px. Chromium ausente; detalhes em navegador.log. A revisão estática não aprova esses testes.
