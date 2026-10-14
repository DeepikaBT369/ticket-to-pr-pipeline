import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Plain Vite config for deployment (Figma Make's editor-preview-only
// plugins were removed — they only matter inside the Figma Make canvas).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // In local dev, the client runs on 5173 and the backend on 3000 —
    // this forwards /api/* calls to the backend so fetch('/api/...') works.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
})
