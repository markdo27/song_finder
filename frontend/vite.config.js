import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local FastAPI backend (BPM analysis + Spotify endpoints in dev)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // cosine.club API (unused in current build, kept for reference)
      '/cosine-api': {
        target: 'https://cosine.club',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cosine-api/, '/api/v1'),
        secure: true,
      },
    },
  },
})
