# Revisão 1 — interface, CSS e acessibilidade

- Busca em componentes executáveis e Aplicativo.tsx sem referências a Favoritos, câmera, upload de foto ou input file. Menções em testes/documentação histórica não são interface.
- Lista abre diretamente com título Pontos próximos; elimina seletor de abas e estrelas, preservando listas/estados vazios de botoeiras e paradas e lista condicional de obras.
- Ordenação por distância preservada. Teste verifica ordenação e não mutação da entrada usando pontos do dataset existente.
- Botões dos locais mantêm altura mínima de 44px após retirada das estrelas, que antes sustentavam a altura da linha.
- Barra inferior usa marcador de localização e nome acessível Pontos próximos; rótulo longo pode quebrar e ícones ficam alinhados ao topo. Medição responsiva da barra mantida.
- Cabeçalho sem câmera e sem espaço reservado; nome EchoPath também visível na regra mobile. Busca, microfone e conta permanecem.
- Avatar convertido em elemento de apresentação com nome acessível, sem hover/active de botão, selo de câmera ou spinner de upload. Foto existente ou inicial preservadas. Cores de iniciais usam tokens temáticos de contraste existentes.
- Estilos exclusivos de favoritos, abas e upload retirados; temas e foco existentes preservados.

Evidências automatizadas: contratos ReactDOMServer no teste de interface e busca de resíduos no bundle final. Não validam eventos reais, overflow ou aparência.

BLOCKED: matriz 320, 360, 390, 430, 768 e 1024 px nos temas claro, escuro e alto contraste. Executável Chromium ausente; tentativa registrada em navegador.log. Também faltam teclado virtual, foco/teclado e leitor de tela reais. Nenhuma captura simulada.
