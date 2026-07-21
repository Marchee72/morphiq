# MorphIQ — Agent Instructions

## Quick start

```bash
npm install          # install deps
npm run dev          # Vite dev server (http://localhost, HTTPS disabled — Node 22 regression)
npm run build        # tsc -b && vite build — typecheck + bundle
npm run lint         # ESLint flat config — run before PR
npm run test         # Vitest (24 unit tests, no E2E)
npx vitest run --coverage   # with coverage
npx vitest run src/path/to/file.test.ts   # single test file
```

## TypeScript quirks

- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `erasableSyntaxOnly: true` — no runtime enums, decorators, or `namespace`
- `noUnusedLocals` / `noUnusedParameters` — both enabled
- `jsx: "react-jsx"`, project references pattern (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`)
- TypeScript 6.0 alpha (`~` semver)

## Architecture

Single-page React 19 app + standalone Express server (`server/`). Not a monorepo.

```
src/
├── core/entities/        # TS interfaces: UserProfile, Measurement, FoodLog, WorkoutLog, Message
├── core/interfaces/      # Repository contracts: IDatabase, ICoachAgentService, IBluetoothScaleAdapter
├── data/database/        # Two implementations of IDatabase:
│   ├── LocalDatabase.ts  #   Dexie.js (IndexedDB) — default
│   └── ServerDatabase.ts #   HTTP REST client — for Pi PostgreSQL backend
├── data/ai/              # GeminiCoach — direct REST (no SDK)
├── data/bluetooth/       # WebBluetoothScaleAdapter + MockScaleAdapter
├── data/calculation/     # BiaCalculator — Huami reverse-engineered BIA math engine
├── presentation/components/  # 5 React components, vanilla CSS (no Tailwind/CSS-in-JS)
└── presentation/state/   # Zustand store
```

- **Storage selection**: `VITE_DB_TYPE` env var (`local` / `server`), selected at import time. Not runtime-swappable.
- **App.css is intentionally empty** — all CSS lives in `index.css`.
- **`dist/` is committed** to git (unusual but intentional).
- **`.agents/` is gitignored** — agent skill files are local-only.

## Design system

All CSS is hand-written in `src/index.css` (~487 lines, "Cinema Dark" theme). No Tailwind, no CSS-in-JS.

Utility classes follow Tailwind naming conventions (`flex`, `gap-4`, `p-6`, `text-sm`, etc.) but are custom, not imported.

Key classes: `.glass-panel` (glassmorphism), `.glow-btn` (indigo gradient + glow).

## Testing

- **Vitest** with `jsdom`, `fake-indexeddb`, `@testing-library/jest-dom`
- **No E2E tests** (no Playwright/Cypress)
- Database tests use `fake-indexeddb` — never import real Dexie in tests
- Store tests must manually reset both DB and store state in `beforeEach`

## Server (Raspberry Pi / Express)

- `server/index.js` — all REST endpoints in one file, ES module (`"type": "module"`)
- PostgreSQL schema auto-applied on startup (`CREATE TABLE IF NOT EXISTS`)
- Columns use camelCase with PostgreSQL quoting (e.g., `"profileId"`)
- `cors({ origin: '*' })` — permissive for Tailscale VPN setup
- Deploy: `scp server/{index.js,schema.sql} pi:/home/marche/morphiq-server/ && ssh pi "sudo systemctl restart morphiq-server"`

## Key gotchas

- `setApiKey` in the Zustand store is a **no-op** — API keys are `.env`-only (`VITE_GEMINI_API_KEY`), not configurable at runtime
- Vite's `@vitejs/plugin-basic-ssl` is in devDeps but disabled — Node 22.21.0 has a regression (`server.shouldUpgradeCallback`), and modern browsers treat `http://localhost` as secure for Web Bluetooth
- iOS requires Bluefy or WebBLE browser for Web Bluetooth
- BIA calculation uses reverse-engineered Huami constants — do not modify without understanding the physiology
- `BiaCalculator.getFatPercentage` caps values > 63% to 75% before clamping
- No formatter configured (no Prettier/biome/dprint)
