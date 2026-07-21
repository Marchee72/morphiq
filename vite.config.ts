/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Note: We disabled `@vitejs/plugin-basic-ssl` to work around a regression in Node.js v22.21.0
// that causes crashes with "TypeError: server.shouldUpgradeCallback is not a function".
// Since modern browsers treat http://localhost as a secure context, Web Bluetooth still works
// perfectly on http://localhost:5173 without HTTPS!
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    env: {
      VITE_DB_TYPE: 'local',
    },
  },
})
