
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Guards against the "Cannot read properties of null (reading 'useRef')"
  // blank screen: it happens when two copies of React end up in the page
  // (Vite served two dependency chunks built at different times, so hooks
  // resolved against a React instance with no current dispatcher). Pinning
  // a single React/React-DOM instance and pre-bundling them together keeps
  // the dep graph consistent across restarts.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'zustand'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/webhook': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
