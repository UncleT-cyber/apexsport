import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    // In dev, proxy to local backend; in production, VITE_API_URL is used directly via authFetch
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true, timeout: 30000 },
      '/health': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: (process.env.VITE_API_URL || 'http://localhost:8000').replace(/^http/, 'ws'), ws: true, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
  },
})
