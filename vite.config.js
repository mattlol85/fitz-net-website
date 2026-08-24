import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://api.fitznet.doomdns.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/actuator-fitz': {
        target: 'https://api.fitznet.doomdns.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/actuator-fitz/, '/actuator')
      },
      '/actuator-gamerbell': {
        target: 'https://gamerbell.fitznet.doomdns.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/actuator-gamerbell/, '/actuator')
      },
      '/gamerbell-firmware': {
        target: 'https://gamerbell.fitznet.doomdns.org',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/gamerbell-firmware/, '/api/firmware')
      }
    }
  },
  build: {
    outDir: 'build',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
    include: [
      'src/**/*.test.jsx',
      'src/**/*.spec.jsx',
      'src/**/*.test.js',
      'src/**/*.spec.js'
    ]
  }
})
