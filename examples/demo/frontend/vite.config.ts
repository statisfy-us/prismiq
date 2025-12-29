import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Path to the @prismiq/react source
const prismiqReactSrc = path.resolve(__dirname, '../../../packages/react/src')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
    // Allow serving files from the packages directory
    fs: {
      allow: [
        // Default search directories
        '.',
        // Allow the @prismiq/react source
        prismiqReactSrc,
        // Allow node_modules
        path.resolve(__dirname, '../../../node_modules'),
      ],
    },
    // Watch the @prismiq/react source for hot reload
    watch: {
      // Use polling for better cross-filesystem support
      usePolling: true,
      interval: 1000,
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Point to source files for hot reload during development
      '@prismiq/react': prismiqReactSrc,
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    // Don't pre-bundle @prismiq/react so we can hot reload it
    exclude: ['@prismiq/react'],
  },
})
