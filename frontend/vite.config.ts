
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
    sourcemap: true,
    rollupOptions: {
      output: {
        // Splits rarely-changing vendor libraries into their own
        // chunks, separate from this app's own code -- by direct
        // request ("fix the speed response recommendations
        // permanently"). Every route is already lazy-loaded (its own
        // small chunk, confirmed via `ls dist/assets`), so this isn't
        // about first-load byte count; it's about REPEAT visits. Right
        // now a routine app-code-only deploy changes the single large
        // shared "index" chunk's hash (619KB, confirmed via `vite
        // build`'s own warning), forcing every returning user to
        // re-download React/React-Router/Zustand/Axios/lucide-react
        // again even though none of them changed. Splitting those into
        // their own chunk means its hash -- and the browser cache entry
        // for it -- only changes when a DEPENDENCY actually changes,
        // not on every app deploy. react/react-dom/react-router-dom
        // stay bundled TOGETHER in one chunk (never split from each
        // other) so this doesn't reintroduce the duplicate-React
        // "useRef" blank-screen bug the `dedupe` option above already
        // exists to prevent.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts-vendor': ['recharts'],
        },
      },
    },
  }
})
