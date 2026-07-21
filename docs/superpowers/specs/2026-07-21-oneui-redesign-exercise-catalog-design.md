# MorphIQ — One UI Redesign + Exercise Catalog Integration

**Date:** 2026-07-21
**Status:** Design approved in brainstorming — pending implementation plan
**Scope:** Complete UI redesign (Samsung One UI language) + integration of the 1,324-exercise dataset as the canonical exercise catalog

---

## 1. Summary

MorphIQ gets a ground-up UI rebuild in a Samsung One UI design language — adaptive light/dark themes, large collapsing headers, flat tonal surfaces, 22px-radius cards, pill buttons, bouncy spring motion. The app restructures from 5 tabs to **4 tabs: Home, Gym, Exercises, Coach**, with Settings behind a header gear icon.

The `hasaneyldrm/exercises-dataset` (1,324 exercises, MIT-licensed data) becomes the **canonical exercise catalog**: a new first-class **Exercises** tab (browse / search / filter / favorites / detail view with animation GIF + step-by-step instructions), and a catalog picker everywhere sets are logged. Custom free-text exercises are dropped; per-set notes are surfaced in the live tracker.

The **Bluetooth scale feature is removed entirely**. Samsung Health / Health Connect sync remains the body-composition intake path. Existing local data may be wiped during migration (user-approved).

---

## 2. Goals & Non-Goals

### Goals

- One UI design language, adaptive light + dark (follows `prefers-color-scheme`, matching Samsung app behavior)
- New design-system layer (`src/ui/`) — tokens + reusable primitives; no per-screen one-off styling
- 4-tab information architecture; food/daily logging folds into Home; Settings via header gear
- Exercise Library as a first-class tab: search, muscle/equipment filters, favorites, exercise detail
- Catalog picker (bottom sheet) in the live workout tracker and quick-log flows; **favorites and recents first**
- Per-set notes (comment) in the live tracker UI
- Feature parity otherwise: food logging, workout history/PRs, AI coach (Gemini), multi-profile, Health Connect sync, Local + Server DB

### Non-Goals (YAGNI)

- ❌ Custom user-created exercises (dataset-only catalog; old free-text history still renders)
- ❌ Localization — English only (dataset ships 10 languages; future consideration)
- ❌ Workout templates / programs / routines (possible future phase)
- ❌ Changes to Gemini coach logic, BIA calculation, or health-sync logic (re-skin only)
- ❌ E2E test framework (consistent with current project state — Vitest unit tests only)
- ❌ Bluetooth scale, smart-scale pairing, Web Bluetooth anything

---

## 3. Key Decisions (locked in brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Project shape | Single combined project: redesign + catalog integration |
| 2 | Legacy components | No reuse requirement — free structural redesign; new feature-based tree |
| 3 | Theme | Adaptive light **and** dark, system-driven |
| 4 | Dataset depth | Full Exercise Library (browse/search/filter/detail) + favorites |
| 5 | Media strategy | On-demand from CDN + Cache Storage caching; nothing bundled but the JSON |
| 6 | Navigation | 4 tabs (Home, Gym, Exercises, Coach); Settings via header gear; Logs folds into Home |
| 7 | Custom exercises | Dropped. Per-set notes kept (via existing `WorkoutSet.notes`) |
| 8 | Bluetooth scale | Removed entirely |
| 9 | Existing data | Wipe/migrate freely (approved) |
| 10 | Execution | Design-system-first vertical slice — Slice 1 (design system + Home) is a hard review gate |

---

## 4. Design Language

### 4.1 Color tokens

Light and dark schemes, applied via CSS custom properties in `src/ui/tokens.css` under `:root` / `@media (prefers-color-scheme: dark)`.

| Token | Light | Dark |
|---|---|---|
| `background` | `#F7F7F9` | `#101013` |
| `surface` (cards) | `#FFFFFF` | `#1C1C21` |
| `primary` | `#0381FE` | `#4C9AFF` |
| `on-primary` | `#FFFFFF` | `#06121F` |
| `tonal` (secondary container) | `#E5F1FF` | `#4C9AFF` @ 18% alpha |
| `on-tonal` | `#0366D6` | `#8AB8FF` |
| `success` | `#1A7F4B` | `#4BD88A` |
| `error` | `#C62828` | `#FF8A8A` |
| `text-primary` | `#101013` | `#F2F2F5` |
| `text-secondary` | `#6E6E76` | `#9A9AA2` |
| `outline` | `#E4E4E9` | `#2C2C33` |

Charts/rings may use a secondary hue (violet family: `#7C4DFF` light / `#9E7BFF` dark) sparingly for multi-series data.

### 4.2 Typography

- **Family:** Manrope (Google Fonts, closest free match to One UI Sans), `system-ui` fallback
- **Scale:** Display 34/800 (collapsing headers) · Title 22/800 · Headline 17/700 · Body 15/500 · Label 12/700 uppercase +0.06em
- Headings use tight letter-spacing (−0.5px to −1px)

### 4.3 Shape & motion

- Radii: 10px (chips small) · 16px (small cards/inputs) · **22px (cards)** · 28px (sheets/dialogs top) · pill (buttons, chips, nav indicator)
- Motion: One UI "bouncy" springs — `cubic-bezier(.2,.9,.25,1.2)`, 250–350 ms; collapsing large headers on scroll; cards scale to .98 on press; sheets spring up
- **Flat tonal surfaces** — no glassmorphism, no backdrop-blur panels, no neon glow (explicit break from "Cinema Dark")

---

## 5. Information Architecture

### 5.1 Root tabs

| Tab | Contents | Replaces |
|---|---|---|
| **Home** | Big "Today" header; weight/body-fat/muscle cards; food log for the day; log food/water/weight actions; 7-day trend | AnalyticsDashboard + DailyLog + ScaleConnector slot |
| **Gym** | Start workout; this-week summary; workout history; PRs by exercise | WorkoutTab + WorkoutHistoryTable + stats components |
| **Exercises** 🆕 | Search; muscle/equipment filter chips; Favorites row; exercise grid (static thumbnails) | — |
| **Coach** | Gemini chat thread + suggestion chips | CoachChat (re-skin only) |

**Settings** opens via header gear icon (slides in; Samsung-style): profiles, Health Connect sync, theme (auto), data/export, about.

### 5.2 Sub-screens & sheets

- **Exercise detail** — 180×180 animation GIF, target/equipment/muscle chips, step-by-step instructions, favorite toggle, "Log set" shortcut (opens the live tracker with this exercise pre-selected, starting a new session if none is active), user's PR/history on that exercise, © Gym visual attribution
- **Live workout** (full-screen) — session timer, current exercise + set entry (weight/reps for strength; distance/duration/speed for exercises whose catalog category is `cardio`), **per-set note field**, add-exercise via picker, finish flow; replaces GymTracker
- **Catalog picker** (bottom sheet) — search, Favorites first, then Recents (derived from recent sets), muscle chips, thumbnail list; used by the live tracker and by the Gym tab's log-past-workout flow
- **Add food / measurement sheets** — from Home

### 5.3 Removed surfaces

- Daily Logs tab (folds into Home)
- Bluetooth scale connector card and all pairing UI
- Debug console (dead code — defined, never imported)

---

## 6. Technical Architecture

### 6.1 New code layout

```
src/
├── ui/                        # NEW — One UI design system
│   ├── tokens.css             # light/dark design tokens (§4)
│   ├── ThemeProvider.tsx      # prefers-color-scheme tracking
│   └── primitives/            # CollapsingAppBar, Card, Button, Chip, ListItem,
│                              # BottomNav, Sheet, SearchBar, Switch, Ring,
│                              # SegmentedControl, EmptyState, ExerciseImage
├── features/                  # NEW — screens by feature (replaces presentation/components)
│   ├── home/                  # HomeScreen (+ food & measurement sheets)
│   ├── gym/                   # GymScreen, LiveWorkoutScreen, history, PRs
│   ├── exercises/             # ExerciseLibraryScreen, ExerciseDetailScreen,
│   │                          # ExercisePickerSheet
│   ├── coach/                 # CoachScreen
│   └── settings/              # SettingsScreen
├── core/entities/             # + Exercise.ts (catalog type); WorkoutSet + exerciseId
├── core/interfaces/           # IDatabase (± favorites methods); − IBluetooth.ts
├── data/
│   ├── exercises/             # NEW — exercises.json (EN-only, vendored),
│   │                          # ExerciseCatalog.ts, mediaCache.ts, build script
│   ├── database/              # LocalDatabase.ts, ServerDatabase.ts (kept, updated)
│   ├── health/                # kept as-is
│   └── ai/                    # kept as-is
└── presentation/state/        # Zustand store (updated; − BLE slices, + catalog/favorites)
```

`src/presentation/components/` is deleted incrementally as features land; `src/App.css` and the glassmorphism/M3 sections of `src/index.css` are removed (index.css keeps only global resets + token imports).

### 6.2 Exercise catalog data layer

- **Vendoring:** a one-time Node script (`scripts/build-exercises.mjs`) downloads `data/exercises.json` from the dataset repo and writes a stripped EN-only JSON (id, name, category/body_part, equipment, target, muscle_group, secondary_muscles, instructions.en, instruction_steps.en, image, gif_url, attribution) to `src/data/exercises/exercises.json` (~1–1.5 MB). Typed via `src/core/entities/Exercise.ts` mirroring the repo's JSON Schema.
- **`ExerciseCatalog` service** (singleton, framework-free): lazy-loads the JSON on first use (dynamic import → separate chunk), builds an in-memory lowercase search index over name/target/muscle_group/equipment/category.
  - `search(query: string, filters?: { category?: string; equipment?: string }): Exercise[]`
  - `getById(id: string): Exercise | undefined`
  - `facets(): { categories: string[]; equipment: string[] }`
  - `getMany(ids: string[]): Exercise[]` (favorites/recents hydration)
- **Favorites:** new Dexie table `favoriteExercises (id, profileId, exerciseId, addedAt)`; exposed through `IDatabase` (`getFavorites`, `addFavorite`, `removeFavorite`) with `ServerDatabase` HTTP counterparts; new endpoints in `server/index.js` + `server/schema.sql` following existing camelCase-quoted conventions.
- **Recents:** derived in the store from the profile's recent `WorkoutSet`s (distinct `exerciseId`, latest first) — no new table.

### 6.3 Media loading & caching

- `<ExerciseImage exercise size variant>` builds URLs against jsDelivr: `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/<image|gif_url>`.
- Library grid uses static JPG thumbnails; animation GIF loads only on the detail screen (1,324 autoplaying GIFs would be unusable).
- `mediaCache.ts`: on successful fetch, stores the response in Cache Storage (`morphiq-exercise-media`); subsequent renders serve from cache → offline after first view. Falls back to direct `<img src>` when Cache Storage is unavailable (tests, older WebViews).
- Attribution "© Gym visual — gymvisual.com" rendered on the exercise detail screen.

### 6.4 Data model changes

- `WorkoutSet`: **add** `exerciseId?: string` (catalog id, e.g. `"0025"`); `exerciseName` retained as denormalized display text so pre-catalog history renders unchanged; `notes` already exists and gets UI.
- `UserExercise` entity, repository methods, store slices, and its Dexie table: **removed**.
- Dexie schema version bump: add `favoriteExercises` table + `exerciseId` index on `workoutSets`; upgrade path may drop `userExercises` (data wipe approved).
- `server/schema.sql`: `favoriteExercises` table (camelCase-quoted columns per convention).

### 6.5 Removals (Slice 0)

- `src/data/bluetooth/` (WebBluetoothScaleAdapter, CapacitorBleAdapter, MockScaleAdapter + tests)
- `src/core/interfaces/IBluetooth.ts`
- `ScaleConnector.tsx`, `DebugConsole.tsx`, BLE-related store actions/state, BLE tests
- `App.css` (already nearly empty)
- Old M3/glassmorphism utility CSS in `index.css` (purged as features migrate)

---

## 7. Error Handling

| Failure | Behavior |
|---|---|
| Media CDN unreachable | Placeholder tile (muscle-group icon on tonal bg); retry on next view |
| Cache Storage quota exceeded | Skip caching silently; image still displays from network |
| Catalog JSON fails to load | Blocking error state on Exercises tab with retry (bundled asset — unreachable in practice) |
| Empty search / filter result | Friendly empty state + suggestion chips (popular muscles) |
| Favorite added offline (server DB) | Same queue/failure semantics as existing entities (parity with current app) |
| Health Connect unavailable | Existing behavior preserved (WebHealthProvider fallback) |

---

## 8. Testing Strategy

Vitest + jsdom + fake-indexeddb (existing setup), no new frameworks.

- `ExerciseCatalog`: search ranking, filters, facets, `getById`, `getMany` (fixture subset, not the full 1,324)
- Store: favorites add/remove/load per profile; recents derivation; BLE slices removed
- DB layer: Dexie migration (new tables/indexes; `userExercises` dropped), favorites CRUD on `LocalDatabase`
- Components: picker sheet (search → select), library filter chips, live-tracker set entry incl. notes field
- Media: URL builder + cache-hit/miss paths (mocked CacheStorage)
- Regression: existing health/coach/BIA tests stay green; store tests updated for removed BLE state

---

## 9. Execution Slices

| Slice | Contents | Exit criteria |
|---|---|---|
| **0 — Teardown & data foundation** | Delete BT scale stack, DebugConsole, UserExercise; vendor dataset + `ExerciseCatalog`; Dexie bump + favorites endpoints | Tests green; catalog searchable in unit tests |
| **1 — Design system + Home** ⭐ | `tokens.css`, ThemeProvider, primitives; Home rebuilt; App rewired to 4 tabs + gear | **Hard user review gate — run the app, approve the feel** |
| **2 — Exercises tab** | Library, detail, favorites UI, picker component, media cache | Tests + build green |
| **3 — Gym tab + live tracker** | Gym hub, live workout w/ picker + per-set notes, history, PRs | Tests + build green |
| **4 — Coach, Settings, polish** | Coach re-skin, Settings screens, delete remaining legacy components/CSS | `test` + `lint` + `build` green |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| 1–1.5 MB JSON import slows first load of Exercises tab | Dynamic import (separate chunk), lazy singleton load, loading skeleton |
| jsDelivr availability / rate limits | Graceful placeholder + retry; images cache after first success; raw.githubusercontent as fallback base |
| Vendored dataset goes stale | Re-run `build-exercises.mjs` to update; document in README |
| Dexie migration breaks existing installs | Migration test with fake-indexeddb; wipe approved by user anyway |
| Scope creep (18 legacy components) | Feature-folder deletes gate each slice; Slice 1 gate keeps style aligned before mass production |

---

## 11. Licensing & Attribution

- Dataset code/data: MIT (see repo LICENSE).
- Exercise **media** (JPGs/GIFs): © Gym visual (gymvisual.com), redistributed by the dataset at 180×180 with permission. We **hotlink, never bundle**, and render the attribution string from each record on the exercise detail screen. No media is committed to this repository.
- If MorphIQ is ever distributed commercially, re-check Gym visual's terms (their T&Cs govern media reuse).

---

## 12. Future Considerations (not in scope)

- Workout templates/routines built from the catalog
- Multi-language instructions (dataset ships 10 languages)
- Exercise video/GIF in the live tracker rest-timer view
- Dynamic (wallpaper-based) color, Material-You-style, if Samsung-style theming is ever extended
