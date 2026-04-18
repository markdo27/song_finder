import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cosine-api': {
        target: 'https://cosine.club',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cosine-api/, '/api/v1'),
        secure: true,
      },
    },
  },
})
