// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          // Ativa o React Compiler automaticamente em todo o projeto
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
  ],
})