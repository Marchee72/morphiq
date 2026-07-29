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
    // `**/node_modules/**` rather than `node_modules/**`: tooling directories such
    // as `.opencode/` and `.gemini/` carry their own nested node_modules, and the
    // top-level-only glob let their vendored test suites into our run.
    //
    // `server/` used to be excluded wholesale. Its ownership guards are the only
    // thing standing between two users' data, so they are tested here rather than
    // not at all; only its dependencies stay out.
    exclude: ['e2e/**', 'server/node_modules/**', '**/node_modules/**'],
    // The exercise catalogue is a 1 MB lazy chunk. Screens that wait on it need
    // more than the 5s default, and hitting that default produced failures that
    // looked like flakiness but were purely the timeout.
    testTimeout: 30000,
    env: {
      VITE_DB_TYPE: 'local',
    },
  },
})
