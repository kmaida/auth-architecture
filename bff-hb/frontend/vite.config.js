import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/resource-api': {
        target: 'http://resource-api.local:5001/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/resource-api/, '')
      }
    }
  }
})
