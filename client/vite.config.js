import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      process: "process/browser",
      buffer: "buffer",
      util: "util",
      stream: "stream-browserify",
      crypto: "crypto-browserify",
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'stream-browserify', 'crypto-browserify'],
  },
})
