# MorphIQ — Agent Instructions

## Quick start

```bash
npm install          # install deps
npm run dev          # Vite dev server (http://localhost, HTTPS disabled — Node 22 regression)
npm run build        # tsc -b && vite build — typecheck + bundle
npm run lint         # ESLint flat config — run before PR
npm run test         # Vitest — unit tests for src/ and server/, no E2E
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
- **`dist/` is ignored** (`.gitignore:11`) and holds no tracked files. Vercel
  builds it from source via `@vercel/static-build`, and Capacitor syncs it into
  the APK — nothing reads a committed copy.
- **`.agents/` is gitignored** — agent skill files are local-only.

## Design system

Two stylesheets side by side:

- `src/ui-atlas/atlas/atlas.css` (~4400 lines, `.at-*` classes, unlayered) owns
  the palette tokens and every existing screen. The palette is sand + ember,
  light and dark, under `.at` / `.at[data-mode='dark']`; the original token
  names (`--sand`, `--clay`, `--cocoa`, …) are kept, plus `--ember`, `--lime`,
  `--amber`, `--coral` and the relief tokens `--d-*`.
- `src/ui-atlas/tw.css` is Tailwind v4 **without preflight** (theme +
  utilities only). Its `@theme inline` maps the shadcn tokens onto the atlas
  palette, so registry components land in the app's colours. `index.css`
  declares the layer order and keeps its reset in `@layer base`, below the
  utilities.

Relief ("system D"): primary = `--d-grad` + `--d-hi`; secondary = `--d-tonal`
+ `--d-soft`, no border, no outer shadow; selected pill = `--d-pill`; danger =
`--d-danger` + `--d-danger-hi`; cards = `--d-card` + `--d-card-hi`, no outer
shadow. Only what floats (sheets, notifications, dock, menus) casts a shadow,
`--shadow-float`.

Type: **Urbanist** only, self-hosted in `public/fonts/`. Titles 800, text
400–700.

Components built for the redesign live in `src/ui-atlas/kit/` (`@/ui-atlas/kit`).
Watermelon components install with `npx shadcn add @watermelon/<name>`
(`components.json`); swap their icons to `lucide-react` and their strings to
i18n.

Motion: `motion/react` only. `AppShell` wraps everything in
`MotionConfig reducedMotion="user"`; tests set
`MotionGlobalConfig.skipAnimations`. Never animate `transform`/`filter` on
`.at` itself (see `app-base.css`) — animate `.app-scroll` or children.

`npm run check:contrast` verifies AA for every text/background token pair.

## Testing

- **Vitest** with `jsdom`, `fake-indexeddb`, `@testing-library/jest-dom`
- **No E2E tests** (no Playwright/Cypress)
- Database tests use `fake-indexeddb` — never import real Dexie in tests
- Store tests must manually reset both DB and store state in `beforeEach`

## Server (Raspberry Pi / Express)

- `server/index.js` — all REST endpoints in one file, ES module (`"type": "module"`)
- PostgreSQL schema auto-applied on startup (`CREATE TABLE IF NOT EXISTS`)
- Columns use camelCase with PostgreSQL quoting (e.g., `"profileId"`)
- CORS is an allow-list, not `*` — add any new origin to `ALLOWED_ORIGINS`
- `/api` sends `Cache-Control: no-store`. The platform default lets shared
  caches keep per-account responses and omits `Authorization` from `Vary`
- Every route addressing a row by id, or taking `profileId` from the body/query,
  carries an ownership guard from `auth.js`. Adding a route without one reopens
  the hole those guards exist to close (`server/__tests__/ownership.test.js`)
- Deploy: `scp server/{index.js,schema.sql} pi:/home/marche/morphiq-server/ && ssh pi "sudo systemctl restart morphiq-server"`
- Web + API on one Vercel deployment: `server/DEPLOY_WEB.md`

## Key gotchas

- `setApiKey` in the Zustand store is a **no-op** — API keys are `.env`-only (`VITE_GEMINI_API_KEY`), not configurable at runtime
- Vite's `@vitejs/plugin-basic-ssl` is in devDeps but disabled — Node 22.21.0 has a regression (`server.shouldUpgradeCallback`), and modern browsers treat `http://localhost` as secure for Web Bluetooth
- iOS requires Bluefy or WebBLE browser for Web Bluetooth
- BIA calculation uses reverse-engineered Huami constants — do not modify without understanding the physiology
- `BiaCalculator.getFatPercentage` caps values > 63% to 75% before clamping
- No formatter configured (no Prettier/biome/dprint)
