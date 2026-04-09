// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/tokenize': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/attention': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/embed': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/sample': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/models': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
