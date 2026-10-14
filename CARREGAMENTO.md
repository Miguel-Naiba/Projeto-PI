# EchoPath — carregamento com caminhada contínua

A animação de troca de imagens foi substituída por um personagem com articulações em SVG. A imagem existente fornece apenas um recorte fixo do rosto/tronco/mochila; ela nunca muda de quadro. Pernas, joelhos, tênis, braços, mãos e bengala movem-se continuamente por transformações calculadas em requestAnimationFrame.

Cada ciclo dura 1,4 segundo. A posição dos pés define os ângulos de quadril e joelho: na parte apoiada da passada, o pé fica na altura do piso; na parte elevada, o joelho flexiona e o pé avança. Braços e oscilação do tronco acompanham o ciclo. A bengala fica presa à mão e sua ponta acompanha o chão. Não há sprites, steps(), troca de background-position ou atualizações React a cada quadro.

Identidade visual: fundo azul-marinho, camiseta branca, mochila preta, calça azul, tênis brancos, bengala branca com detalhe vermelho, anel elíptico azul/ciano, porcentagem e “Carregando o EchoPath...”. As partes articuladas foram redesenhadas em SVG, mantendo essa identidade. O estilo segue a referência, sem promessa de cópia pixel a pixel.

A animação respeita prefers-reduced-motion, inclusive quando a preferência muda com a tela aberta. Pausa em abas ocultas e cancela o agendamento ao desmontar. O filtro de fundo atua apenas sobre a região do tronco, para evitar processar o atlas inteiro.

Arquivos principais:
- src/components/UI/HomemCaminhando.tsx
- src/components/UI/TelaCarregamento.tsx e .css
- src/Inicializacao.tsx
- src/principal.tsx
- public/images/echopath-caminhada.png (arte fixa reutilizada)
- vite.config.ts (precache da arte para o PWA)

25%, 75% e 100% são etapas de inicialização, não porcentagem de bytes ou conclusão de dados externos. O aplicativo abre após sua montagem com uma transição curta. GPS, voz, autenticação, mapa e APIs mantêm os sistemas existentes. A arte é pré-carregada com limite de espera de oito segundos; falha na arte não impede o aplicativo. Falha ao importar o aplicativo oferece tentar novamente.

Executar: npm ci, depois npm run dev.
Compilar: npm run build.

Validação: build, lint e 116 testes existentes aprovados. Teste em Chromium nas dimensões 390×844 e 1440×900; saída da tela e ausência de erros de execução verificadas. Em uma amostra de 100 pinturas, houve 96 poses distintas, com variação máxima de aproximadamente 3,84 graus na articulação do quadril entre amostras. Redução de movimento, retomada e transição aprovadas. A taxa de atualização final depende do dispositivo e do navegador; não há garantia de FPS fixo.
