import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    VitePWA({
      // 'autoUpdate': o novo service worker assume o controle assim que é
      // instalado (skipWaiting + clientsClaim), mas isso NÃO recarrega a
      // aba aberta sozinho — quem já está no meio de uma rota com narração
      // ativa só passa a usar os arquivos novos na próxima navegação/reload.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        id: '/',
        name: 'EchoPath — Guia acessível para pedestres',
        short_name: 'EchoPath',
        description:
          'Guia de navegação acessível para pedestres com deficiência visual em Porto Alegre: paradas com piso tátil, botoeiras sonoras e obras em execução, com alertas de proximidade e narração por voz.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Sem orientação travada — travar em portrait/landscape é uma
        // barreira de acessibilidade pra quem monta o celular de outro
        // jeito (suporte de bike, dashboard, etc.).
        theme_color: '#0a0f0d',
        background_color: '#0a0f0d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só faz precache dos artefatos ESTÁTICOS de build (JS/CSS/HTML/
        // ícones). Propositalmente NÃO existe nenhum `runtimeCaching` aqui
        // — sem isso, toda chamada de rede pra fora do build (Supabase,
        // OpenRouteService, Nominatim, Overpass, GTFS) passa direto pelo
        // service worker sem tocar no Cache Storage. Isso não é uma
        // omissão: é o que garante que nenhum token, sessão ou dado
        // sensível de usuário acabe em cache do PWA — inclusive as
        // futuras rotas /api/auth/* quando a autenticação migrar pra
        // cookie HttpOnly.
        navigateFallbackDenylist: [/^\/api\//],
      },
      // Desligado em dev de propósito (padrão do plugin) — testar o SW é
      // sempre via `npm run build && npm run preview`, nunca `npm run dev`.
    }),
  ],
});
