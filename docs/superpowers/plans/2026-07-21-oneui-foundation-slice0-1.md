# One UI Foundation (Slice 0 + Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Bluetooth scale feature, vendor the 1,324-exercise catalog into the app, build the One UI design system, and rebuild the Home tab in it — ending at the user review gate.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-21-oneui-redesign-exercise-catalog-design.md`. Additive foundation first (catalog + favorites DB + design system + Home, zero breakage), then a coordinated teardown of legacy BLE/user-exercise code, then a new 4-tab App shell. Slices 2–4 (Exercises tab, Gym tab, Coach/Settings) get separate plans after the Slice 1 review gate.

**Tech Stack:** React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals/Parameters`), Zustand 5, Dexie 4 (+fake-indexeddb), Vitest 4 + jsdom + @testing-library/react, Vite 8, Express/pg server.

**Project conventions (from AGENTS.md):**
- `import type` for type-only imports (verbatimModuleSyntax)
- No runtime enums / namespaces / decorators
- Tests run with `npx vitest run` (package.json `test` script is added in Task 1)
- DB tests use fake-indexeddb; store tests must reset DB + store in `beforeEach`
- Server columns are camelCase with PostgreSQL quoting (`"profileId"`)
- ThemeProvider is intentionally NOT built in this plan — adaptive theming is pure CSS `prefers-color-scheme`; a manual override lands with Settings in Slice 4 (spec deviation, YAGNI)

---

## File Structure

**Created — data foundation:**
- `src/core/entities/Exercise.ts` — catalog exercise type
- `src/core/entities/FavoriteExercise.ts` — favorite record type
- `scripts/build-exercises.mjs` — dataset vendor script (EN strip + validation)
- `src/data/exercises/exercises.json` — generated, ~1,324 records (committed)
- `src/data/exercises/ExerciseCatalog.ts` — search/filter/facet service + lazy singleton
- `src/data/exercises/ExerciseCatalog.test.ts`

**Created — design system:**
- `src/ui/tokens.css` — One UI light/dark design tokens
- `src/ui/ui.css` — primitive styles
- `src/ui/primitives/Button.tsx`, `Card.tsx`, `AppBar.tsx`, `BottomNav.tsx`, `Chip.tsx`, `ListItem.tsx`, `Sheet.tsx`, `Ring.tsx`, `EmptyState.tsx`
- `src/ui/primitives/__tests__/primitives.test.tsx`

**Created — Home feature:**
- `src/features/home/MetricHeroCard.tsx`, `CompRingsCard.tsx`, `FoodTodayCard.tsx`, `AddFoodSheet.tsx`, `LogWeightSheet.tsx`, `TrendCard.tsx`, `SyncCard.tsx`, `HomeScreen.tsx`
- `src/features/home/__tests__/home.test.tsx`
- `src/features/onboarding/OnboardingScreen.tsx`
- `src/features/onboarding/__tests__/onboarding.test.tsx`
- `src/features/placeholder/ComingSoonScreen.tsx`
- `src/features/settings/SettingsScreen.tsx` (Slice-1 scope: profile switcher only)

**Modified:**
- `package.json` (test script; BLE deps removed in Task 22)
- `tsconfig.app.json` (`resolveJsonModule`; `types` cleaned in Task 22)
- `src/core/interfaces/IDatabase.ts` (+IFavoriteExerciseRepository; −IUserExerciseRepository in Task 22)
- `src/core/entities/WorkoutSet.ts` (+exerciseId)
- `src/data/database/LocalDatabase.ts` (Dexie v4, favorites repo; v5 drop in Task 22)
- `src/data/database/ServerDatabase.ts` (+ServerFavoriteExerciseRepository; −ServerUserExerciseRepository in Task 22)
- `server/schema.sql`, `server/index.js` (favorites; user-exercises removed in Task 22)
- `src/presentation/state/store.ts` (+favorites, +addManualMeasurement, −BLE/userExercise/debug in Task 21)
- `src/presentation/state/store.test.ts` (pruned in Task 21)
- `src/main.tsx` (CSS imports)
- `src/App.tsx` (rewritten in Task 23)
- `src/index.css` (purged in Task 22)

**Deleted (Task 22):**
- `src/data/bluetooth/` (whole dir), `src/core/interfaces/IBluetooth.ts`, `src/core/entities/UserExercise.ts`, `src/presentation/components/` (whole dir), `src/App.css`
- npm deps: `@capacitor-community/bluetooth-le`, `@types/web-bluetooth`

---

## Phase 1 — Data Foundation (additive, nothing breaks)

### Task 1: Baseline + `test` script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify the baseline is green**

Run: `npx vitest run`
Expected: PASS — 24 tests (per AGENTS.md). If the baseline is red, STOP and report before continuing.

- [ ] **Step 2: Add the missing test script**

In `package.json` scripts, add:

```json
"test": "vitest run",
```

- [ ] **Step 3: Verify**

Run: `npm run test`
Expected: PASS — same 24 tests.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Add missing npm test script for Vitest"
```

---

### Task 2: Exercise entity

**Files:**
- Create: `src/core/entities/Exercise.ts`

- [ ] **Step 1: Create the type**

```ts
export interface Exercise {
  id: string;                 // dataset id, e.g. "0025"
  name: string;
  category: string;           // body-part category, e.g. "chest"
  equipment: string;          // e.g. "barbell", "body weight"
  target: string;             // primary target muscle
  muscleGroup: string;        // primary synergist muscle group
  secondaryMuscles: string[];
  instructionSteps: string[]; // English step-by-step
  image: string;              // repo-relative 180x180 jpg, e.g. "images/0025-EIeI8Vf.jpg"
  gifUrl: string;             // repo-relative 180x180 gif, e.g. "videos/0025-EIeI8Vf.gif"
  attribution: string;        // "© Gym visual — https://gymvisual.com/"
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/core/entities/Exercise.ts
git commit -m "Add Exercise catalog entity type"
```

---

### Task 3: Vendor script + generated dataset JSON

**Files:**
- Create: `scripts/build-exercises.mjs`
- Create: `src/data/exercises/exercises.json` (generated)
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Write the vendor script**

```js
// scripts/build-exercises.mjs
// Vendors the hasaneyldrm/exercises-dataset into src/data/exercises/exercises.json,
// stripped to English-only fields per the design spec (media stays on the CDN).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const OUT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'exercises', 'exercises.json');

const REQUIRED = ['id', 'name', 'category', 'equipment', 'target', 'muscle_group', 'image', 'gif_url', 'attribution'];

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const raw = await res.json();
if (!Array.isArray(raw)) throw new Error('Dataset is not a JSON array');

const stripped = raw.map((ex, i) => {
  for (const key of REQUIRED) {
    if (ex[key] === undefined || ex[key] === null) {
      throw new Error(`Record ${i} (${ex.name ?? 'unknown'}) is missing "${key}"`);
    }
  }
  const steps = ex.instruction_steps?.en;
  return {
    id: String(ex.id),
    name: ex.name,
    category: ex.category,
    equipment: ex.equipment,
    target: ex.target,
    muscleGroup: ex.muscle_group,
    secondaryMuscles: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    instructionSteps: Array.isArray(steps)
      ? steps
      : (typeof ex.instructions?.en === 'string' ? [ex.instructions.en] : []),
    image: ex.image,
    gifUrl: ex.gif_url,
    attribution: ex.attribution,
  };
});

if (stripped.length < 1300) throw new Error(`Sanity check failed: only ${stripped.length} exercises`);

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(stripped));
console.log(`Wrote ${stripped.length} exercises (${Math.round(JSON.stringify(stripped).length / 1024)} KB)`);
console.log(`Sample: ${stripped[24].name} — ${stripped[24].category}/${stripped[24].equipment}`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/build-exercises.mjs`
Expected output: `Wrote 1324 exercises (... KB)` and a sample line naming `barbell bench press`.

- [ ] **Step 3: Enable JSON imports in TypeScript**

In `tsconfig.app.json` compilerOptions, add:

```json
"resolveJsonModule": true,
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc -b`
Expected: PASS

```bash
git add scripts/build-exercises.mjs src/data/exercises/exercises.json tsconfig.app.json
git commit -m "Vendor exercises dataset (EN-only, 1324 records) with build script"
```

---

### Task 4: ExerciseCatalog service (TDD)

**Files:**
- Test: `src/data/exercises/ExerciseCatalog.test.ts`
- Create: `src/data/exercises/ExerciseCatalog.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/exercises/ExerciseCatalog.test.ts
import { describe, it, expect } from 'vitest';
import { ExerciseCatalog } from './ExerciseCatalog';
import type { Exercise } from '../../core/entities/Exercise';

const fixture: Exercise[] = [
  { id: '0025', name: 'barbell bench press', category: 'chest', equipment: 'barbell', target: 'pectorals', muscleGroup: 'triceps', secondaryMuscles: ['triceps', 'shoulders'], instructionSteps: ['Lie down.', 'Press.'], image: 'images/0025-x.jpg', gifUrl: 'videos/0025-x.gif', attribution: '© Gym visual' },
  { id: '0043', name: 'barbell full squat', category: 'upper legs', equipment: 'barbell', target: 'glutes', muscleGroup: 'quadriceps', secondaryMuscles: ['hamstrings'], instructionSteps: ['Brace.', 'Squat.'], image: 'images/0043-x.jpg', gifUrl: 'videos/0043-x.gif', attribution: '© Gym visual' },
  { id: '0652', name: 'pull-up', category: 'back', equipment: 'body weight', target: 'lats', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], instructionSteps: ['Hang.', 'Pull.'], image: 'images/0652-x.jpg', gifUrl: 'videos/0652-x.gif', attribution: '© Gym visual' },
  { id: '0334', name: 'dumbbell lateral raise', category: 'shoulders', equipment: 'dumbbell', target: 'delts', muscleGroup: 'traps', secondaryMuscles: [], instructionSteps: ['Raise.'], image: 'images/0334-x.jpg', gifUrl: 'videos/0334-x.gif', attribution: '© Gym visual' },
];

describe('ExerciseCatalog', () => {
  const catalog = new ExerciseCatalog(fixture);

  it('reports the catalog size', () => {
    expect(catalog.size).toBe(4);
  });

  it('finds exercises by case-insensitive name substring', () => {
    expect(catalog.search('BENCH').map(e => e.id)).toEqual(['0025']);
  });

  it('requires every query term to match somewhere in name/target/muscles/category/equipment', () => {
    expect(catalog.search('barbell glutes').map(e => e.id)).toEqual(['0043']);
    expect(catalog.search('barbell lats')).toEqual([]);
  });

  it('ranks name-prefix matches before other name matches before field matches', () => {
    const results = catalog.search('barbell');
    expect(results.map(e => e.id)).toEqual(['0025', '0043']);
  });

  it('filters by category and equipment', () => {
    expect(catalog.search('', { category: 'back' }).map(e => e.id)).toEqual(['0652']);
    expect(catalog.search('', { equipment: 'barbell' })).toHaveLength(2);
    expect(catalog.search('barbell', { category: 'chest' }).map(e => e.id)).toEqual(['0025']);
  });

  it('returns all exercises for an empty query without filters, alphabetically', () => {
    expect(catalog.search().map(e => e.name)).toEqual([...fixture.map(e => e.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('getById returns the exercise or undefined', () => {
    expect(catalog.getById('0652')?.name).toBe('pull-up');
    expect(catalog.getById('9999')).toBeUndefined();
  });

  it('getMany hydrates ids in order, skipping unknown ids', () => {
    expect(catalog.getMany(['0652', '9999', '0025']).map(e => e.id)).toEqual(['0652', '0025']);
  });

  it('facets returns sorted unique categories and equipment', () => {
    expect(catalog.facets()).toEqual({
      categories: ['back', 'chest', 'shoulders', 'upper legs'],
      equipment: ['barbell', 'body weight', 'dumbbell'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/exercises/ExerciseCatalog.test.ts`
Expected: FAIL — "Cannot find module './ExerciseCatalog'"

- [ ] **Step 3: Implement the service**

```ts
// src/data/exercises/ExerciseCatalog.ts
import type { Exercise } from '../../core/entities/Exercise';

export interface ExerciseFilters {
  category?: string;
  equipment?: string;
}

interface IndexedExercise {
  exercise: Exercise;
  haystack: string;
}

export class ExerciseCatalog {
  private readonly byId: Map<string, Exercise>;
  private readonly index: IndexedExercise[];

  constructor(exercises: Exercise[]) {
    this.byId = new Map(exercises.map(e => [e.id, e]));
    this.index = exercises.map(exercise => ({
      exercise,
      haystack: [exercise.name, exercise.target, exercise.muscleGroup, exercise.category, exercise.equipment]
        .join(' ')
        .toLowerCase(),
    }));
  }

  get size(): number {
    return this.byId.size;
  }

  search(query: string = '', filters: ExerciseFilters = {}): Exercise[] {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = this.index
      .filter(({ exercise, haystack }) => {
        if (filters.category && exercise.category !== filters.category) return false;
        if (filters.equipment && exercise.equipment !== filters.equipment) return false;
        return terms.every(t => haystack.includes(t));
      })
      .map(({ exercise }) => exercise);

    const q = terms.join(' ');
    const rank = (e: Exercise): number => {
      if (!q) return 0;
      const name = e.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.includes(q)) return 1;
      return 2;
    };
    return [...matches].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }

  getById(id: string): Exercise | undefined {
    return this.byId.get(id);
  }

  getMany(ids: string[]): Exercise[] {
    return ids.map(id => this.byId.get(id)).filter((e): e is Exercise => e !== undefined);
  }

  facets(): { categories: string[]; equipment: string[] } {
    const categories = new Set<string>();
    const equipment = new Set<string>();
    for (const { exercise } of this.index) {
      categories.add(exercise.category);
      equipment.add(exercise.equipment);
    }
    return { categories: [...categories].sort(), equipment: [...equipment].sort() };
  }
}

let catalogPromise: Promise<ExerciseCatalog> | null = null;

/** Lazily loads the vendored JSON (separate chunk) and memoizes the catalog. */
export function getExerciseCatalog(): Promise<ExerciseCatalog> {
  if (!catalogPromise) {
    catalogPromise = import('./exercises.json').then(
      mod => new ExerciseCatalog(mod.default as Exercise[]),
    );
  }
  return catalogPromise;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/exercises/ExerciseCatalog.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Smoke-test the real dataset through the catalog**

Run: `npx vitest run`
Expected: PASS — whole suite still green

- [ ] **Step 6: Commit**

```bash
git add src/data/exercises/ExerciseCatalog.ts src/data/exercises/ExerciseCatalog.test.ts
git commit -m "Add ExerciseCatalog search/filter service with lazy JSON loading"
```

---

### Task 5: Favorites — entity, interface, Dexie v4, local repository (TDD)

**Files:**
- Create: `src/core/entities/FavoriteExercise.ts`
- Modify: `src/core/interfaces/IDatabase.ts`
- Modify: `src/data/database/LocalDatabase.ts`
- Test: `src/data/database/FavoriteExerciseRepository.test.ts`

Note: Dexie v4 **keeps** the `userExercises` table (dropped in v5 during Task 22) so nothing in the legacy app breaks mid-plan.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/database/FavoriteExerciseRepository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db, FavoriteExerciseRepository } from './LocalDatabase';

describe('FavoriteExerciseRepository (Dexie v4)', () => {
  const repo = new FavoriteExerciseRepository();

  beforeEach(async () => {
    await db.favoriteExercises.clear();
  });

  it('exposes the favoriteExercises table after upgrade', () => {
    expect(db.tables.map(t => t.name)).toContain('favoriteExercises');
  });

  it('adds and lists favorites for a profile', async () => {
    await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    await repo.add({ profileId: 'p1', exerciseId: '0652', addedAt: new Date() });
    await repo.add({ profileId: 'p2', exerciseId: '0043', addedAt: new Date() });

    const p1 = await repo.getAll('p1');
    expect(p1.map(f => f.exerciseId).sort()).toEqual(['0025', '0652']);
    expect(await repo.getAll('p2')).toHaveLength(1);
  });

  it('returns string ids on added favorites', async () => {
    const id = await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    expect(typeof id).toBe('string');
    const all = await repo.getAll('p1');
    expect(typeof all[0].id).toBe('string');
  });

  it('removes a favorite by profileId + exerciseId only', async () => {
    await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    await repo.add({ profileId: 'p2', exerciseId: '0025', addedAt: new Date() });

    await repo.remove('p1', '0025');

    expect(await repo.getAll('p1')).toHaveLength(0);
    expect(await repo.getAll('p2')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/database/FavoriteExerciseRepository.test.ts`
Expected: FAIL — `FavoriteExerciseRepository` is not exported / table missing

- [ ] **Step 3: Create the entity**

```ts
// src/core/entities/FavoriteExercise.ts
export interface FavoriteExercise {
  id?: string;
  profileId: string;
  exerciseId: string;   // catalog Exercise.id, e.g. "0025"
  addedAt: Date;
}
```

- [ ] **Step 4: Add the repository interface**

In `src/core/interfaces/IDatabase.ts`, append:

```ts
import type { FavoriteExercise } from '../entities/FavoriteExercise';

export interface IFavoriteExerciseRepository {
  add(favorite: FavoriteExercise): Promise<string>;
  remove(profileId: string, exerciseId: string): Promise<void>;
  getAll(profileId: string): Promise<FavoriteExercise[]>;
}
```

- [ ] **Step 5: Dexie v4 + local repository**

In `src/data/database/LocalDatabase.ts`:

a) Add imports at the top:

```ts
import type { FavoriteExercise } from '../../core/entities/FavoriteExercise';
```

Add `IFavoriteExerciseRepository` to the existing interface import block.

b) In `DexieDatabase`, add the table declaration after `userExercises!`:

```ts
  favoriteExercises!: Table<FavoriteExercise, number>;
```

c) In the constructor, after the `this.version(3).stores({...})` block, add:

```ts
    this.version(4).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: '++id, profileId, name',
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
    });
```

d) Update `UserProfileRepository.delete` to also clear favorites — add `db.favoriteExercises` to the transaction table list and this line inside the transaction:

```ts
      await db.favoriteExercises.where('profileId').equals(id).delete();
```

e) Append the repository implementation at the end of the file:

```ts
export class FavoriteExerciseRepository implements IFavoriteExerciseRepository {
  async add(favorite: FavoriteExercise): Promise<string> {
    const id = await db.favoriteExercises.add({
      ...favorite,
      addedAt: favorite.addedAt || new Date(),
    });
    return id.toString();
  }

  async remove(profileId: string, exerciseId: string): Promise<void> {
    await db.favoriteExercises
      .where('profileId')
      .equals(profileId)
      .and(f => f.exerciseId === exerciseId)
      .delete();
  }

  async getAll(profileId: string): Promise<FavoriteExercise[]> {
    const records = await db.favoriteExercises
      .where('profileId')
      .equals(profileId)
      .toArray();
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/data/database/FavoriteExerciseRepository.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 7: Full suite + commit**

Run: `npx vitest run`
Expected: PASS (existing LocalDatabase tests unaffected)

```bash
git add src/core/entities/FavoriteExercise.ts src/core/interfaces/IDatabase.ts src/data/database/LocalDatabase.ts src/data/database/FavoriteExerciseRepository.test.ts
git commit -m "Add exercise favorites storage (Dexie v4) with local repository"
```

---

### Task 6: Server favorites endpoints + ServerDatabase repository

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/index.js`
- Modify: `src/data/database/ServerDatabase.ts`

The project has no server test suite (per AGENTS.md) — verification is a documented manual curl check.

- [ ] **Step 1: Extend the schema**

Append to `server/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS exercise_favorites (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("profileId", "exerciseId")
);

ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "exerciseId" TEXT;
```

- [ ] **Step 2: Add the REST endpoints**

In `server/index.js`, add before the "Error Handling Middleware" comment block:

```js
app.get('/api/profiles/:profileId/exercise-favorites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM exercise_favorites WHERE "profileId" = $1 ORDER BY "addedAt" DESC',
      [req.params.profileId]
    );
    res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/exercise-favorites', async (req, res) => {
  const f = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO exercise_favorites ("profileId", "exerciseId", "addedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("profileId", "exerciseId") DO NOTHING
       RETURNING *`,
      [f.profileId, f.exerciseId, f.addedAt || new Date()]
    );
    if (rows.length > 0) {
      res.status(201).json({ ...rows[0], id: rows[0].id.toString() });
    } else {
      const { rows: existing } = await pool.query(
        'SELECT * FROM exercise_favorites WHERE "profileId" = $1 AND "exerciseId" = $2',
        [f.profileId, f.exerciseId]
      );
      res.status(200).json({ ...existing[0], id: existing[0].id.toString() });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/exercise-favorites', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM exercise_favorites WHERE "profileId" = $1 AND "exerciseId" = $2',
      [req.query.profileId, req.query.exerciseId]
    );
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 3: Add the client repository**

In `src/data/database/ServerDatabase.ts`:

a) Add imports:

```ts
import type { FavoriteExercise } from '../../core/entities/FavoriteExercise';
```

Add `IFavoriteExerciseRepository` to the interface import block.

b) Add a parse helper next to the other parse helpers:

```ts
function parseFavoriteExercise(raw: Record<string, unknown>): FavoriteExercise {
  return { ...raw, id: String(raw.id), addedAt: new Date(raw.addedAt as string) } as FavoriteExercise;
}
```

c) Append at the end of the file:

```ts
// ─── Favorite Exercise Repository ─────────────────────────────────────────────
export class ServerFavoriteExerciseRepository implements IFavoriteExerciseRepository {
  async add(favorite: FavoriteExercise): Promise<string> {
    const result = await api<{ id: string }>('/api/exercise-favorites', {
      method: 'POST',
      body: JSON.stringify(favorite),
    });
    return result.id;
  }

  async remove(profileId: string, exerciseId: string): Promise<void> {
    await api(
      `/api/exercise-favorites?profileId=${encodeURIComponent(profileId)}&exerciseId=${encodeURIComponent(exerciseId)}`,
      { method: 'DELETE' }
    );
  }

  async getAll(profileId: string): Promise<FavoriteExercise[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/exercise-favorites`
    );
    return rows.map(parseFavoriteExercise);
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: PASS

- [ ] **Step 5: Manual verification (only if the Pi server is running — otherwise note and skip)**

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/exercise-favorites -H "Content-Type: application/json" -d '{"profileId":"1","exerciseId":"0025"}'
curl http://localhost:3000/api/profiles/1/exercise-favorites
curl -X DELETE "http://localhost:3000/api/exercise-favorites?profileId=1&exerciseId=0025"
```

Expected: POST → 201 with `{"id":...}`; GET → array containing `0025`; DELETE → 204.

- [ ] **Step 6: Commit**

```bash
git add server/schema.sql server/index.js src/data/database/ServerDatabase.ts
git commit -m "Add exercise favorites REST endpoints and server repository"
```

---

### Task 7: `WorkoutSet.exerciseId`

**Files:**
- Modify: `src/core/entities/WorkoutSet.ts`

The Dexie `exerciseId` index was added in Task 5 and the server column in Task 6. `ServerDatabase.parseWorkoutSet` spreads `...raw`, so the new field passes through with no further change.

- [ ] **Step 1: Add the field**

In `src/core/entities/WorkoutSet.ts`, add after `exerciseName`:

```ts
  exerciseId?: string;  // catalog Exercise.id when picked from the dataset; absent on legacy logs
```

- [ ] **Step 2: Type-check + test + commit**

Run: `npx tsc -b && npx vitest run`
Expected: PASS

```bash
git add src/core/entities/WorkoutSet.ts
git commit -m "Add optional exerciseId to WorkoutSet for catalog linkage"
```

---

### Task 8: Store favorites slice (TDD)

**Files:**
- Modify: `src/presentation/state/store.ts`
- Test: `src/presentation/state/favorites.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/state/favorites.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

const initialState = useStore.getState();

describe('store — exercise favorites', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));

    const profileId = await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
    });
    await useStore.getState().setActiveProfile(String(profileId));
  });

  it('starts with no favorites', async () => {
    await useStore.getState().loadFavorites();
    expect(useStore.getState().favoriteExerciseIds).toEqual([]);
  });

  it('toggleFavorite adds and removes an exercise id', async () => {
    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025']);

    await useStore.getState().toggleFavorite('0652');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025', '0652']);

    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0652']);
  });

  it('persists favorites across loadFavorites calls', async () => {
    await useStore.getState().toggleFavorite('0025');
    useStore.setState({ favoriteExerciseIds: [] });

    await useStore.getState().loadFavorites();
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025']);
  });

  it('toggleFavorite is a no-op without an active profile', async () => {
    useStore.setState({ activeProfile: null });
    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/state/favorites.test.ts`
Expected: FAIL — `favoriteExerciseIds` / actions do not exist

- [ ] **Step 3: Implement the store slice**

In `src/presentation/state/store.ts`:

a) Add imports:

```ts
import {
  FavoriteExerciseRepository,
} from '../../data/database/LocalDatabase';
```

Add `ServerFavoriteExerciseRepository` to the existing `ServerDatabase` import block.

b) Add the repository instance next to the others:

```ts
const favoriteRepo = isServer ? new ServerFavoriteExerciseRepository() : new FavoriteExerciseRepository();
```

c) In `StoreState`, add state + actions:

```ts
  favoriteExerciseIds: string[];
  loadFavorites: () => Promise<void>;
  toggleFavorite: (exerciseId: string) => Promise<void>;
```

d) In the initial state (next to `userExercises: []`), add:

```ts
  favoriteExerciseIds: [],
```

e) Add the actions (place near `saveUserExercise`):

```ts
  loadFavorites: async () => {
    const profile = get().activeProfile;
    if (!profile?.id) {
      set({ favoriteExerciseIds: [] });
      return;
    }
    const favorites = await favoriteRepo.getAll(profile.id);
    set({ favoriteExerciseIds: favorites.map(f => f.exerciseId) });
  },

  toggleFavorite: async (exerciseId) => {
    const profile = get().activeProfile;
    if (!profile?.id) return;
    const ids = get().favoriteExerciseIds;
    if (ids.includes(exerciseId)) {
      await favoriteRepo.remove(profile.id, exerciseId);
      set({ favoriteExerciseIds: ids.filter(i => i !== exerciseId) });
    } else {
      await favoriteRepo.add({ profileId: profile.id, exerciseId, addedAt: new Date() });
      set({ favoriteExerciseIds: [...ids, exerciseId] });
    }
  },
```

f) Wire loading into `setActiveProfile` — at the end of the `set({...})` block that sets `activeWorkout`, add `loadFavorites` as a fire-and-forget call right after:

```ts
      get().loadFavorites();
```

g) Wire the reset into `loadProfiles` — in the empty-profiles `set({...})` call, add `favoriteExerciseIds: []` to the reset object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/presentation/state/favorites.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run`
Expected: PASS (existing store tests unaffected — the slice is additive)

```bash
git add src/presentation/state/store.ts src/presentation/state/favorites.test.ts
git commit -m "Add exercise favorites slice to store"
```

---

## Phase 2 — One UI Design System (additive)

### Task 9: Design tokens CSS

**Files:**
- Create: `src/ui/tokens.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create the token stylesheet**

```css
/* src/ui/tokens.css — One UI design tokens (adaptive light/dark) */
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

:root {
  color-scheme: light;
  --ui-font: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  --ui-bg: #F7F7F9;
  --ui-surface: #FFFFFF;
  --ui-surface-dim: #EFEFF3;
  --ui-primary: #0381FE;
  --ui-on-primary: #FFFFFF;
  --ui-tonal: #E5F1FF;
  --ui-on-tonal: #0366D6;
  --ui-success: #1A7F4B;
  --ui-success-bg: #E3F2E9;
  --ui-error: #C62828;
  --ui-error-bg: #FDEAEA;
  --ui-text-primary: #101013;
  --ui-text-secondary: #6E6E76;
  --ui-outline: #E4E4E9;
  --ui-outline-strong: #D6D6DC;
  --ui-scrim: rgba(16, 16, 19, 0.45);
  --ui-card-shadow: 0 1px 4px rgba(16, 16, 19, 0.06);
  --ui-chart-accent: #7C4DFF;

  --ui-radius-sm: 10px;
  --ui-radius-md: 16px;
  --ui-radius-card: 22px;
  --ui-radius-sheet: 28px;
  --ui-radius-pill: 999px;

  --ui-space-1: 4px;
  --ui-space-2: 8px;
  --ui-space-3: 12px;
  --ui-space-4: 16px;
  --ui-space-5: 20px;
  --ui-space-6: 24px;

  --ui-text-display: 34px;
  --ui-text-title: 22px;
  --ui-text-headline: 17px;
  --ui-text-body: 15px;
  --ui-text-label: 12px;

  --ui-motion: 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.2);
  --ui-motion-fast: 0.18s cubic-bezier(0.2, 0.9, 0.25, 1.2);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --ui-bg: #101013;
    --ui-surface: #1C1C21;
    --ui-surface-dim: #26262C;
    --ui-primary: #4C9AFF;
    --ui-on-primary: #06121F;
    --ui-tonal: rgba(76, 154, 255, 0.18);
    --ui-on-tonal: #8AB8FF;
    --ui-success: #4BD88A;
    --ui-success-bg: rgba(75, 216, 138, 0.15);
    --ui-error: #FF8A8A;
    --ui-error-bg: rgba(255, 138, 138, 0.12);
    --ui-text-primary: #F2F2F5;
    --ui-text-secondary: #9A9AA2;
    --ui-outline: #2C2C33;
    --ui-outline-strong: #3A3A42;
    --ui-scrim: rgba(0, 0, 0, 0.6);
    --ui-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    --ui-chart-accent: #9E7BFF;
  }
}
```

- [ ] **Step 2: Import it**

In `src/main.tsx`, add after the `./index.css` import:

```ts
import './ui/tokens.css'
```

- [ ] **Step 3: Visual smoke check**

Run: `npm run dev`, open the app, toggle OS dark/light.
Expected: no visual regressions yet (tokens are unused); page still works. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add src/ui/tokens.css src/main.tsx
git commit -m "Add One UI design tokens (adaptive light/dark)"
```

---

### Task 10: `ui.css` foundation + Button + Card (TDD)

**Files:**
- Create: `src/ui/ui.css`
- Create: `src/ui/primitives/Button.tsx`
- Create: `src/ui/primitives/Card.tsx`
- Test: `src/ui/primitives/__tests__/ButtonCard.test.tsx`
- Modify: `src/main.tsx`

The full primitive stylesheet is written in this one task so later primitive tasks are TSX-only.

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/ButtonCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';
import { Card } from '../Card';

describe('Button', () => {
  it('renders the filled variant by default', () => {
    render(<Button>Start workout</Button>);
    expect(screen.getByRole('button', { name: 'Start workout' })).toHaveClass('ui-btn', 'ui-btn-filled');
  });

  it('applies tonal and outlined variant classes', () => {
    const { rerender } = render(<Button variant="tonal">Log</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-btn-tonal');
    rerender(<Button variant="outlined">Log</Button>);
    expect(screen.getByRole('button')).toHaveClass('ui-btn-outlined');
  });

  it('forwards click handlers and merges className', () => {
    const onClick = vi.fn();
    render(<Button className="extra" onClick={onClick}>Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('extra');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Card', () => {
  it('renders children inside a ui-card container', () => {
    render(<Card>Body content</Card>);
    expect(screen.getByText('Body content')).toHaveClass('ui-card');
  });

  it('merges additional class names', () => {
    render(<Card className="hero">X</Card>);
    expect(screen.getByText('X')).toHaveClass('ui-card', 'hero');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Create the primitive stylesheet**

```css
/* src/ui/ui.css — One UI primitive styles (tokens from tokens.css) */

.ui-card {
  background: var(--ui-surface);
  border-radius: var(--ui-radius-card);
  padding: var(--ui-space-4);
  box-shadow: var(--ui-card-shadow);
}

.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 12px 24px;
  border-radius: var(--ui-radius-pill);
  font-family: var(--ui-font);
  font-size: var(--ui-text-body);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: transform var(--ui-motion-fast), opacity var(--ui-motion-fast), background-color var(--ui-motion-fast);
}
.ui-btn:active:not(:disabled) { transform: scale(0.97); opacity: 0.9; }
.ui-btn:disabled { opacity: 0.45; cursor: default; }
.ui-btn-filled { background: var(--ui-primary); color: var(--ui-on-primary); }
.ui-btn-tonal { background: var(--ui-tonal); color: var(--ui-on-tonal); }
.ui-btn-outlined { background: transparent; color: var(--ui-primary); border: 1.5px solid var(--ui-outline-strong); }

.ui-icon-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--ui-radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ui-text-secondary);
  border: none;
  cursor: pointer;
  transition: background-color var(--ui-motion-fast), transform var(--ui-motion-fast);
}
.ui-icon-btn:active { transform: scale(0.94); }

.ui-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--ui-radius-pill);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--ui-font);
  background: var(--ui-surface-dim);
  color: var(--ui-text-secondary);
  border: none;
  cursor: pointer;
  transition: background-color var(--ui-motion-fast), color var(--ui-motion-fast), transform var(--ui-motion-fast);
}
.ui-chip:active { transform: scale(0.96); }
.ui-chip-selected { background: var(--ui-text-primary); color: var(--ui-bg); }

.ui-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 4px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--ui-text-primary);
  font-family: var(--ui-font);
  font-size: var(--ui-text-body);
  font-weight: 600;
}
.ui-list-item-icon {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: var(--ui-tonal);
  color: var(--ui-on-tonal);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ui-list-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ui-list-item-sub { font-size: 12.5px; font-weight: 500; color: var(--ui-text-secondary); }
.ui-list-item-trailing { margin-left: auto; color: var(--ui-text-secondary); flex-shrink: 0; }

.ui-appbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 20px 12px;
  background: var(--ui-bg);
  transition: padding var(--ui-motion);
}
.ui-appbar-titles { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ui-appbar-overline { font-size: 13px; font-weight: 600; color: var(--ui-text-secondary); }
.ui-appbar-title {
  font-size: var(--ui-text-display);
  font-weight: 800;
  letter-spacing: -1px;
  line-height: 1.1;
  color: var(--ui-text-primary);
  transition: font-size var(--ui-motion);
}
.ui-appbar.collapsed { padding-top: 12px; }
.ui-appbar.collapsed .ui-appbar-title { font-size: var(--ui-text-title); }
.ui-appbar-actions { display: flex; align-items: center; gap: 8px; padding-bottom: 2px; }

.ui-bottomnav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  background: var(--ui-surface);
  border-top: 1px solid var(--ui-outline);
  padding: 6px 8px calc(8px + env(safe-area-inset-bottom, 0px));
}
.ui-bottomnav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ui-text-secondary);
  font-family: var(--ui-font);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 0 2px;
}
.ui-bottomnav-pill {
  width: 52px;
  height: 30px;
  border-radius: var(--ui-radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--ui-motion), color var(--ui-motion);
}
.ui-bottomnav-item.active { color: var(--ui-text-primary); }
.ui-bottomnav-item.active .ui-bottomnav-pill { background: var(--ui-tonal); color: var(--ui-on-tonal); }

.ui-sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--ui-scrim);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: ui-fade-in 0.2s ease-out;
}
.ui-sheet {
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--ui-surface);
  border-radius: var(--ui-radius-sheet) var(--ui-radius-sheet) 0 0;
  padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  animation: ui-sheet-up var(--ui-motion);
}
.ui-sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: var(--ui-outline-strong); margin: 0 auto 12px; }
.ui-sheet-title { font-size: var(--ui-text-headline); font-weight: 800; letter-spacing: -0.3px; margin-bottom: 12px; color: var(--ui-text-primary); }

.ui-ring-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
.ui-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
.ui-ring-center strong { font-size: 15px; font-weight: 800; color: var(--ui-text-primary); line-height: 1; }
.ui-ring-center small { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ui-text-secondary); }

.ui-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; text-align: center; color: var(--ui-text-secondary); }
.ui-empty-icon { width: 56px; height: 56px; border-radius: 20px; background: var(--ui-tonal); color: var(--ui-on-tonal); display: flex; align-items: center; justify-content: center; }
.ui-empty-title { font-size: var(--ui-text-body); font-weight: 700; color: var(--ui-text-primary); }

@keyframes ui-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-sheet-up { from { transform: translateY(24px); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
```

- [ ] **Step 4: Implement Button and Card**

```tsx
// src/ui/primitives/Button.tsx
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`}
    {...rest}
  />
);
```

```tsx
// src/ui/primitives/Card.tsx
import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...rest }) => (
  <div className={`ui-card${className ? ` ${className}` : ''}`} {...rest} />
);
```

- [ ] **Step 5: Import the stylesheet**

In `src/main.tsx`, add after the tokens import:

```ts
import './ui/ui.css'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives`
Expected: PASS — 5 tests

- [ ] **Step 7: Commit**

```bash
git add src/ui/ui.css src/ui/primitives/Button.tsx src/ui/primitives/Card.tsx src/ui/primitives/__tests__/ButtonCard.test.tsx src/main.tsx
git commit -m "Add ui.css foundation with Button and Card primitives"
```

---

### Task 11: AppBar with collapsing title (TDD)

**Files:**
- Create: `src/ui/primitives/AppBar.tsx`
- Test: `src/ui/primitives/__tests__/AppBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/AppBar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppBar } from '../AppBar';

describe('AppBar', () => {
  it('renders the title and optional overline', () => {
    render(<AppBar title="Today" overline="Good evening, Alex" />);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Good evening, Alex')).toBeInTheDocument();
  });

  it('starts expanded and collapses after scrolling past the threshold', () => {
    render(<AppBar title="Today" />);
    const header = screen.getByRole('banner');
    expect(header).not.toHaveClass('collapsed');

    Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
    fireEvent.scroll(window);
    expect(header).toHaveClass('collapsed');

    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    fireEvent.scroll(window);
    expect(header).not.toHaveClass('collapsed');
  });

  it('renders action content', () => {
    render(<AppBar title="Today" actions={<button>gear</button>} />);
    expect(screen.getByRole('button', { name: 'gear' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives/__tests__/AppBar.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```tsx
// src/ui/primitives/AppBar.tsx
import React, { useEffect, useState } from 'react';

export interface AppBarProps {
  title: string;
  overline?: string;
  actions?: React.ReactNode;
}

const COLLAPSE_THRESHOLD = 24;

export const AppBar: React.FC<AppBarProps> = ({ title, overline, actions }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`ui-appbar${collapsed ? ' collapsed' : ''}`}>
      <div className="ui-appbar-titles">
        {overline && <span className="ui-appbar-overline">{overline}</span>}
        <h1 className="ui-appbar-title">{title}</h1>
      </div>
      {actions && <div className="ui-appbar-actions">{actions}</div>}
    </header>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives/__tests__/AppBar.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/primitives/AppBar.tsx src/ui/primitives/__tests__/AppBar.test.tsx
git commit -m "Add collapsing AppBar primitive"
```

---

### Task 12: BottomNav (TDD)

**Files:**
- Create: `src/ui/primitives/BottomNav.tsx`
- Test: `src/ui/primitives/__tests__/BottomNav.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/BottomNav.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNav } from '../BottomNav';

const items = [
  { id: 'home', label: 'Home', icon: <span>H</span> },
  { id: 'gym', label: 'Gym', icon: <span>G</span> },
  { id: 'exercises', label: 'Exercises', icon: <span>E</span> },
  { id: 'coach', label: 'Coach', icon: <span>C</span> },
];

describe('BottomNav', () => {
  it('renders every item with its label', () => {
    render(<BottomNav items={items} activeId="home" onSelect={() => {}} />);
    for (const item of items) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument();
    }
  });

  it('marks only the active item with aria-current', () => {
    render(<BottomNav items={items} activeId="gym" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Gym' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the tapped item id', () => {
    const onSelect = vi.fn();
    render(<BottomNav items={items} activeId="home" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    expect(onSelect).toHaveBeenCalledWith('exercises');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives/__tests__/BottomNav.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```tsx
// src/ui/primitives/BottomNav.tsx
import React from 'react';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ items, activeId, onSelect }) => (
  <nav className="ui-bottomnav" aria-label="Main navigation">
    {items.map(item => {
      const active = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          className={`ui-bottomnav-item${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-label={item.label}
          onClick={() => onSelect(item.id)}
        >
          <span className="ui-bottomnav-pill">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      );
    })}
  </nav>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives/__tests__/BottomNav.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/primitives/BottomNav.tsx src/ui/primitives/__tests__/BottomNav.test.tsx
git commit -m "Add BottomNav primitive"
```

---

### Task 13: Chip + ListItem (TDD)

**Files:**
- Create: `src/ui/primitives/Chip.tsx`
- Create: `src/ui/primitives/ListItem.tsx`
- Test: `src/ui/primitives/__tests__/ChipListItem.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/ChipListItem.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from '../Chip';
import { ListItem } from '../ListItem';

describe('Chip', () => {
  it('reflects the selected state in its class', () => {
    const { rerender } = render(<Chip>Chest</Chip>);
    expect(screen.getByRole('button')).not.toHaveClass('ui-chip-selected');
    rerender(<Chip selected>Chest</Chip>);
    expect(screen.getByRole('button')).toHaveClass('ui-chip-selected');
  });

  it('forwards clicks', () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Back</Chip>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('ListItem', () => {
  it('renders title, subtitle, and trailing content', () => {
    render(<ListItem title="Barbell bench press" subtitle="Chest · Barbell" trailing={<span>›</span>} />);
    expect(screen.getByText('Barbell bench press')).toBeInTheDocument();
    expect(screen.getByText('Chest · Barbell')).toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });

  it('renders the icon slot and forwards clicks', () => {
    const onClick = vi.fn();
    render(<ListItem title="Item" icon={<span data-testid="ico">★</span>} onClick={onClick} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives/__tests__/ChipListItem.test.tsx`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement**

```tsx
// src/ui/primitives/Chip.tsx
import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export const Chip: React.FC<ChipProps> = ({ selected = false, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    className={`ui-chip${selected ? ' ui-chip-selected' : ''}${className ? ` ${className}` : ''}`}
    aria-pressed={selected}
    {...rest}
  />
);
```

```tsx
// src/ui/primitives/ListItem.tsx
import React from 'react';

export interface ListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

export const ListItem: React.FC<ListItemProps> = ({ icon, title, subtitle, trailing, type = 'button', ...rest }) => (
  <button type={type} className="ui-list-item" {...rest}>
    {icon && <span className="ui-list-item-icon">{icon}</span>}
    <span className="ui-list-item-text">
      <span>{title}</span>
      {subtitle && <span className="ui-list-item-sub">{subtitle}</span>}
    </span>
    {trailing && <span className="ui-list-item-trailing">{trailing}</span>}
  </button>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives/__tests__/ChipListItem.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/primitives/Chip.tsx src/ui/primitives/ListItem.tsx src/ui/primitives/__tests__/ChipListItem.test.tsx
git commit -m "Add Chip and ListItem primitives"
```

---

### Task 14: Sheet (TDD)

**Files:**
- Create: `src/ui/primitives/Sheet.tsx`
- Test: `src/ui/primitives/__tests__/Sheet.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/Sheet.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(<Sheet open={false} onClose={() => {}} title="Add food">Form</Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a dialog with title and children when open', () => {
    render(<Sheet open onClose={() => {}} title="Add food">Form</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Add food' })).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.click(screen.getByTestId('sheet-overlay'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close when the sheet body is clicked', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose} title="Add food">Form</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives/__tests__/Sheet.test.tsx`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement**

```tsx
// src/ui/primitives/Sheet.tsx
import React, { useEffect } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ui-sheet-overlay" data-testid="sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <div className="ui-sheet-handle" />
        {title && <h2 className="ui-sheet-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives/__tests__/Sheet.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/ui/primitives/Sheet.tsx src/ui/primitives/__tests__/Sheet.test.tsx
git commit -m "Add bottom Sheet primitive"
```

---

### Task 15: Ring + EmptyState (TDD)

**Files:**
- Create: `src/ui/primitives/Ring.tsx`
- Create: `src/ui/primitives/EmptyState.tsx`
- Test: `src/ui/primitives/__tests__/RingEmptyState.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/ui/primitives/__tests__/RingEmptyState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Ring } from '../Ring';
import { EmptyState } from '../EmptyState';

describe('Ring', () => {
  it('renders progress arc offset proportional to value', () => {
    const { container } = render(<Ring value={50} size={72} stroke={8} label="Fat" valueText="18%" />);
    const circles = container.querySelectorAll('circle');
    const radius = (72 - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(circles[1]).toHaveAttribute('stroke-dashoffset', String(circumference * 0.5));
  });

  it('clamps values above 100 to a full ring', () => {
    const { container } = render(<Ring value={140} size={72} stroke={8} />);
    const circles = container.querySelectorAll('circle');
    expect(circles[1]).toHaveAttribute('stroke-dashoffset', '0');
  });

  it('renders center label and value text', () => {
    render(<Ring value={66} label="Muscle" valueText="34.1" />);
    expect(screen.getByText('Muscle')).toBeInTheDocument();
    expect(screen.getByText('34.1')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, message, and icon', () => {
    render(<EmptyState icon={<span data-testid="eico">∅</span>} title="No data" message="Sync to get started" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Sync to get started')).toBeInTheDocument();
    expect(screen.getByTestId('eico')).toBeInTheDocument();
  });

  it('renders and activates an optional action', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={<button onClick={onClick}>Retry</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/primitives/__tests__/RingEmptyState.test.tsx`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement**

```tsx
// src/ui/primitives/Ring.tsx
import React from 'react';

export interface RingProps {
  value: number;      // 0–100
  size?: number;      // px
  stroke?: number;    // px
  label?: string;
  valueText?: string;
}

export const Ring: React.FC<RingProps> = ({ value, size = 72, stroke = 8, label, valueText }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <span className="ui-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label ?? 'progress'}>
        <circle cx={center} cy={center} r={radius} stroke="var(--ui-surface-dim)" strokeWidth={stroke} fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--ui-primary)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="ui-ring-center">
        {valueText && <strong>{valueText}</strong>}
        {label && <small>{label}</small>}
      </span>
    </span>
  );
};
```

```tsx
// src/ui/primitives/EmptyState.tsx
import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => (
  <div className="ui-empty">
    {icon && <div className="ui-empty-icon">{icon}</div>}
    <div className="ui-empty-title">{title}</div>
    {message && <div>{message}</div>}
    {action}
  </div>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/primitives/__tests__/RingEmptyState.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Full suite + commit**

Run: `npx vitest run`
Expected: PASS

```bash
git add src/ui/primitives/Ring.tsx src/ui/primitives/EmptyState.tsx src/ui/primitives/__tests__/RingEmptyState.test.tsx
git commit -m "Add Ring and EmptyState primitives"
```

---

## Phase 3 — Home Feature

### Task 16: Store `addManualMeasurement` (TDD)

**Files:**
- Modify: `src/presentation/state/store.ts`
- Test: `src/presentation/state/manualMeasurement.test.ts`

This replaces the BLE-tangled `saveWeightOnly` with a clean manual weight entry. BMI/BMR math mirrors the existing implementation; BIA fields stay 0 (composition comes from Samsung Health sync).

- [ ] **Step 1: Write the failing test**

```ts
// src/presentation/state/manualMeasurement.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

const initialState = useStore.getState();

describe('store — addManualMeasurement', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));

    const profileId = await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
    });
    await useStore.getState().setActiveProfile(String(profileId));
  });

  it('saves a weight-only measurement with computed BMI/BMR', async () => {
    await useStore.getState().addManualMeasurement(80);

    const measurements = useStore.getState().measurements;
    expect(measurements).toHaveLength(1);
    expect(measurements[0].weight).toBe(80);
    expect(measurements[0].impedance).toBe(0);
    // BMI = 80 / 1.8^2 = 24.69
    expect(measurements[0].bmi).toBeCloseTo(24.69, 2);
    expect(measurements[0].bmr).toBeGreaterThan(1700);
    expect(measurements[0].bodyFat).toBe(0);
  });

  it('appends to existing measurements in chronological order', async () => {
    await useStore.getState().addManualMeasurement(81);
    await useStore.getState().addManualMeasurement(80.5);

    const weights = useStore.getState().measurements.map(m => m.weight);
    expect(weights).toEqual([81, 80.5]);
  });

  it('rejects implausible weights', async () => {
    await useStore.getState().addManualMeasurement(5);
    await useStore.getState().addManualMeasurement(500);
    expect(useStore.getState().measurements).toHaveLength(0);
  });

  it('is a no-op without an active profile', async () => {
    useStore.setState({ activeProfile: null });
    await useStore.getState().addManualMeasurement(80);
    expect(useStore.getState().measurements).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/presentation/state/manualMeasurement.test.ts`
Expected: FAIL — `addManualMeasurement` does not exist

- [ ] **Step 3: Implement the action**

In `src/presentation/state/store.ts`:

a) In `StoreState`, next to `saveWeightOnly`, add:

```ts
  addManualMeasurement: (weightKg: number) => Promise<void>;
```

b) Add the implementation near `saveWeightOnly`:

```ts
  addManualMeasurement: async (weightKg) => {
    const profile = get().activeProfile;
    if (!profile?.id) return;
    if (!Number.isFinite(weightKg) || weightKg < 15 || weightKg > 400) return;

    const bmi = weightKg / Math.pow(profile.height / 100, 2);
    const age = getAge(profile.birthDate);
    const bmr = profile.gender === 'male'
      ? 66.47 + 13.75 * weightKg + 5.003 * profile.height - 6.755 * age
      : 655.1 + 9.563 * weightKg + 1.85 * profile.height - 4.676 * age;

    await measurementRepo.save({
      profileId: profile.id,
      timestamp: new Date(),
      weight: weightKg,
      impedance: 0,
      bmi: Number(bmi.toFixed(2)),
      bmr: Number(bmr.toFixed(2)),
      bodyFat: 0,
      bodyWater: 0,
      boneMass: 0,
      muscleMass: 0,
      visceralFat: 0,
      metabolicAge: 0,
      protein: 0,
      bodyType: 4,
    });
    set({ measurements: await measurementRepo.getAll(profile.id) });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/presentation/state/manualMeasurement.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/presentation/state/store.ts src/presentation/state/manualMeasurement.test.ts
git commit -m "Add clean addManualMeasurement store action"
```

---

### Task 17: MetricHeroCard + CompRingsCard (TDD)

**Files:**
- Create: `src/features/home/MetricHeroCard.tsx`
- Create: `src/features/home/CompRingsCard.tsx`
- Test: `src/features/home/__tests__/MetricCards.test.tsx`

Presentational components — `HomeScreen` wires the store. Keeps tests prop-driven and simple.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/home/__tests__/MetricCards.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricHeroCard } from '../MetricHeroCard';
import { CompRingsCard } from '../CompRingsCard';

describe('MetricHeroCard', () => {
  it('shows the latest weight with unit', () => {
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={null} onLogWeight={() => {}} />);
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
  });

  it('shows a signed delta versus the previous measurement', () => {
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={-0.6} onLogWeight={() => {}} />);
    expect(screen.getByText(/-0\.6/)).toBeInTheDocument();
  });

  it('shows a helpful empty state without measurements', () => {
    render(<MetricHeroCard latestWeightKg={null} deltaKg={null} onLogWeight={() => {}} />);
    expect(screen.getByText(/no measurements yet/i)).toBeInTheDocument();
  });

  it('invokes onLogWeight from its action button', () => {
    const onLogWeight = vi.fn();
    render(<MetricHeroCard latestWeightKg={78.4} deltaKg={null} onLogWeight={onLogWeight} />);
    fireEvent.click(screen.getByRole('button', { name: /log weight/i }));
    expect(onLogWeight).toHaveBeenCalledOnce();
  });
});

describe('CompRingsCard', () => {
  it('renders body fat and muscle rings from the latest measurement', () => {
    render(<CompRingsCard bodyFatPct={18.2} muscleMassKg={34.1} />);
    expect(screen.getByText('18.2%')).toBeInTheDocument();
    expect(screen.getByText('34.1')).toBeInTheDocument();
  });

  it('shows a sync hint when composition data is missing (weight-only)', () => {
    render(<CompRingsCard bodyFatPct={0} muscleMassKg={0} />);
    expect(screen.getByText(/samsung health/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement**

```tsx
// src/features/home/MetricHeroCard.tsx
import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';

export interface MetricHeroCardProps {
  latestWeightKg: number | null;
  deltaKg: number | null;
  onLogWeight: () => void;
}

export const MetricHeroCard: React.FC<MetricHeroCardProps> = ({ latestWeightKg, deltaKg, onLogWeight }) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
          Weight
        </div>
        {latestWeightKg !== null ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>
              <span>{latestWeightKg}</span> <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>kg</span>
            </div>
            {deltaKg !== null && (
              <span style={{
                display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999,
                fontSize: 11, fontWeight: 700,
                background: deltaKg <= 0 ? 'var(--ui-success-bg)' : 'var(--ui-error-bg)',
                color: deltaKg <= 0 ? 'var(--ui-success)' : 'var(--ui-error)',
              }}>
                {deltaKg > 0 ? '+' : ''}{deltaKg} this week
              </span>
            )}
          </>
        ) : (
          <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ui-text-secondary)', maxWidth: 260 }}>
            No measurements yet — sync from Samsung Health or log your weight.
          </p>
        )}
      </div>
      <Button variant="tonal" onClick={onLogWeight}>Log weight</Button>
    </div>
  </Card>
);
```

```tsx
// src/features/home/CompRingsCard.tsx
import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Ring } from '../../ui/primitives/Ring';

export interface CompRingsCardProps {
  bodyFatPct: number;
  muscleMassKg: number;
}

/** Body-fat ring fills toward 50% as reference max; muscle ring toward 60 kg. */
export const CompRingsCard: React.FC<CompRingsCardProps> = ({ bodyFatPct, muscleMassKg }) => {
  const hasComposition = bodyFatPct > 0 || muscleMassKg > 0;

  if (!hasComposition) {
    return (
      <Card>
        <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
          No body composition data — sync from Samsung Health to see body fat and muscle.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
        <Ring value={(bodyFatPct / 50) * 100} label="Body fat" valueText={`${bodyFatPct}%`} />
        <Ring value={(muscleMassKg / 60) * 100} label="Muscle" valueText={`${muscleMassKg}`} />
      </div>
    </Card>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/home/MetricHeroCard.tsx src/features/home/CompRingsCard.tsx src/features/home/__tests__/MetricCards.test.tsx
git commit -m "Add Home metric hero and composition rings cards"
```

---

### Task 18: FoodTodayCard + AddFoodSheet + LogWeightSheet (TDD)

**Files:**
- Create: `src/features/home/FoodTodayCard.tsx`
- Create: `src/features/home/AddFoodSheet.tsx`
- Create: `src/features/home/LogWeightSheet.tsx`
- Test: `src/features/home/__tests__/FoodAndWeight.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/home/__tests__/FoodAndWeight.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FoodTodayCard } from '../FoodTodayCard';
import { AddFoodSheet } from '../AddFoodSheet';
import { LogWeightSheet } from '../LogWeightSheet';
import type { FoodLog } from '../../../core/entities/FoodLog';

const logs: FoodLog[] = [
  { id: '1', profileId: 'p1', timestamp: new Date(), mealType: 'breakfast', description: 'Oats', calories: 350, protein: 12, carbs: 60, fat: 7 },
  { id: '2', profileId: 'p1', timestamp: new Date(), mealType: 'lunch', description: 'Chicken bowl', calories: 620, protein: 45, carbs: 55, fat: 18 },
];

describe('FoodTodayCard', () => {
  it('lists entries with a total calorie sum', () => {
    render(<FoodTodayCard logs={logs} onDelete={() => {}} onAdd={() => {}} />);
    expect(screen.getByText('Oats')).toBeInTheDocument();
    expect(screen.getByText('Chicken bowl')).toBeInTheDocument();
    expect(screen.getByText('970')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is logged', () => {
    render(<FoodTodayCard logs={[]} onDelete={() => {}} onAdd={() => {}} />);
    expect(screen.getByText(/nothing logged/i)).toBeInTheDocument();
  });

  it('calls onDelete with the entry id', () => {
    const onDelete = vi.fn();
    render(<FoodTodayCard logs={logs} onDelete={onDelete} onAdd={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('calls onAdd from its action button', () => {
    const onAdd = vi.fn();
    render(<FoodTodayCard logs={[]} onDelete={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /add food/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('AddFoodSheet', () => {
  it('submits parsed values with the selected meal type', () => {
    const onSubmit = vi.fn();
    render(<AddFoodSheet open onClose={() => {}} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Protein shake' } });
    fireEvent.change(screen.getByLabelText(/calories/i), { target: { value: '220' } });
    fireEvent.change(screen.getByLabelText(/protein/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/carbs/i), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/fat/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lunch' }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      mealType: 'lunch',
      description: 'Protein shake',
      calories: 220,
      protein: 30,
      carbs: 8,
      fat: 3,
    });
  });

  it('does not submit without a description', () => {
    const onSubmit = vi.fn();
    render(<AddFoodSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LogWeightSheet', () => {
  it('submits the parsed weight', () => {
    const onSubmit = vi.fn();
    render(<LogWeightSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '78.4' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith(78.4);
  });

  it('rejects invalid input', () => {
    const onSubmit = vi.fn();
    render(<LogWeightSheet open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/__tests__/FoodAndWeight.test.tsx`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement**

```tsx
// src/features/home/FoodTodayCard.tsx
import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import type { FoodLog } from '../../../core/entities/FoodLog';

export interface FoodTodayCardProps {
  logs: FoodLog[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export const FoodTodayCard: React.FC<FoodTodayCardProps> = ({ logs, onDelete, onAdd }) => {
  const totalKcal = logs.reduce((sum, l) => sum + l.calories, 0);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
          Food today · <span>{totalKcal}</span> kcal
        </div>
        <Button variant="tonal" onClick={onAdd}>Add food</Button>
      </div>

      {logs.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
          Nothing logged yet today.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--ui-outline)' }}>
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: 'var(--ui-tonal)', color: 'var(--ui-on-tonal)',
                padding: '3px 8px', borderRadius: 999, flexShrink: 0,
              }}>
                {log.mealType}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }}>
                {log.description}
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>
                  {log.calories} kcal · P{log.protein} C{log.carbs} F{log.fat}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Delete ${log.description}`}
                onClick={() => log.id && onDelete(log.id)}
                style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
```

```tsx
// src/features/home/AddFoodSheet.tsx
import React, { useState } from 'react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Chip } from '../../ui/primitives/Chip';
import { Button } from '../../ui/primitives/Button';
import type { FoodLog } from '../../../core/entities/FoodLog';

export interface AddFoodSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (entry: Omit<FoodLog, 'id' | 'profileId' | 'timestamp'>) => void;
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '10px 14px',
  borderRadius: 'var(--ui-radius-md)', border: '1.5px solid var(--ui-outline-strong)',
  background: 'var(--ui-bg)', color: 'var(--ui-text-primary)', fontSize: 16,
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ui-text-secondary)' }}>
    {label}
    {children}
  </label>
);

export const AddFoodSheet: React.FC<AddFoodSheetProps> = ({ open, onClose, onSubmit }) => {
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const handleSave = () => {
    if (!description.trim()) return;
    onSubmit({
      mealType,
      description: description.trim(),
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
    });
    setDescription(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {MEAL_TYPES.map(m => (
          <Chip key={m} selected={mealType === m} onClick={() => setMealType(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Description">
          <input aria-label="Description" style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="Chicken bowl" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Calories">
            <input aria-label="Calories" style={inputStyle} inputMode="numeric" value={calories} onChange={e => setCalories(e.target.value)} />
          </Field>
          <Field label="Protein (g)">
            <input aria-label="Protein" style={inputStyle} inputMode="numeric" value={protein} onChange={e => setProtein(e.target.value)} />
          </Field>
          <Field label="Carbs (g)">
            <input aria-label="Carbs" style={inputStyle} inputMode="numeric" value={carbs} onChange={e => setCarbs(e.target.value)} />
          </Field>
          <Field label="Fat (g)">
            <input aria-label="Fat" style={inputStyle} inputMode="numeric" value={fat} onChange={e => setFat(e.target.value)} />
          </Field>
        </div>
        <Button onClick={handleSave} disabled={!description.trim()}>Save</Button>
      </div>
    </Sheet>
  );
};
```

```tsx
// src/features/home/LogWeightSheet.tsx
import React, { useState } from 'react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';

export interface LogWeightSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (weightKg: number) => void;
}

export const LogWeightSheet: React.FC<LogWeightSheetProps> = ({ open, onClose, onSubmit }) => {
  const [value, setValue] = useState('');
  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 15 && parsed <= 400;

  const handleSave = () => {
    if (!valid) return;
    onSubmit(parsed);
    setValue('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ui-text-secondary)' }}>
        Weight (kg)
        <input
          aria-label="Weight"
          inputMode="decimal"
          placeholder="78.4"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            width: '100%', minHeight: 48, padding: '10px 14px',
            borderRadius: 'var(--ui-radius-md)', border: '1.5px solid var(--ui-outline-strong)',
            background: 'var(--ui-bg)', color: 'var(--ui-text-primary)', fontSize: 16,
          }}
        />
      </label>
      <div style={{ marginTop: 16 }}>
        <Button onClick={handleSave} disabled={!valid}>Save</Button>
      </div>
    </Sheet>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/__tests__/FoodAndWeight.test.tsx`
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/home/FoodTodayCard.tsx src/features/home/AddFoodSheet.tsx src/features/home/LogWeightSheet.tsx src/features/home/__tests__/FoodAndWeight.test.tsx
git commit -m "Add Home food card with add-food and log-weight sheets"
```

---

### Task 19: TrendCard + SyncCard (TDD)

**Files:**
- Create: `src/features/home/TrendCard.tsx`
- Create: `src/features/home/SyncCard.tsx`
- Test: `src/features/home/__tests__/TrendAndSync.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/home/__tests__/TrendAndSync.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendCard } from '../TrendCard';
import { SyncCard } from '../SyncCard';

describe('TrendCard', () => {
  it('shows a hint when there are fewer than two points', () => {
    render(<TrendCard points={[{ label: 'Mon', weight: 78 }]} />);
    expect(screen.getByText(/at least two measurements/i)).toBeInTheDocument();
  });

  it('renders the chart region when enough points exist', () => {
    render(<TrendCard points={[{ label: 'Mon', weight: 78 }, { label: 'Tue', weight: 77.8 }]} />);
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });
});

describe('SyncCard', () => {
  it('triggers onSync from its button', () => {
    const onSync = vi.fn();
    render(<SyncCard state="idle" onSync={onSync} />);
    fireEvent.click(screen.getByRole('button', { name: /sync/i }));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('disables the button while syncing', () => {
    render(<SyncCard state="syncing" onSync={() => {}} />);
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });

  it('shows feedback messages for success and error states', () => {
    const { rerender } = render(<SyncCard state="success" message="Synced 3 records" onSync={() => {}} />);
    expect(screen.getByText('Synced 3 records')).toBeInTheDocument();
    rerender(<SyncCard state="error" message="Permission denied" onSync={() => {}} />);
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/home/__tests__/TrendAndSync.test.tsx`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement**

```tsx
// src/features/home/TrendCard.tsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '../../ui/primitives/Card';

export interface TrendPoint {
  label: string;
  weight: number;
}

export const TrendCard: React.FC<{ points: TrendPoint[] }> = ({ points }) => (
  <Card>
    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 10 }}>
      Weight trend
    </div>
    {points.length < 2 ? (
      <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
        Log at least two measurements to see your trend.
      </p>
    ) : (
      <div data-testid="trend-chart" style={{ width: '100%', height: 140 }}>
        <LineChart width={520} height={140} data={points} style={{ maxWidth: '100%' }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ui-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip />
          <Line type="monotone" dataKey="weight" stroke="var(--ui-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--ui-primary)' }} />
        </LineChart>
      </div>
    )}
  </Card>
);
```

```tsx
// src/features/home/SyncCard.tsx
import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';

export interface SyncCardProps {
  state: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
  onSync: () => void;
}

export const SyncCard: React.FC<SyncCardProps> = ({ state, message, onSync }) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
        Samsung Health
      </div>
      <Button variant="tonal" onClick={onSync} disabled={state === 'syncing'}>
        {state === 'syncing' ? 'Syncing…' : 'Sync now'}
      </Button>
    </div>
    {message && (
      <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: state === 'error' ? 'var(--ui-error)' : 'var(--ui-success)' }}>
        {message}
      </p>
    )}
  </Card>
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/home/__tests__/TrendAndSync.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/features/home/TrendCard.tsx src/features/home/SyncCard.tsx src/features/home/__tests__/TrendAndSync.test.tsx
git commit -m "Add Home trend chart and Samsung Health sync cards"
```

---

### Task 20: HomeScreen + OnboardingScreen (TDD)

**Files:**
- Create: `src/features/home/HomeScreen.tsx`
- Create: `src/features/onboarding/OnboardingScreen.tsx`
- Test: `src/features/home/__tests__/HomeScreen.test.tsx`
- Test: `src/features/onboarding/__tests__/OnboardingScreen.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/features/home/__tests__/HomeScreen.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen } from '../HomeScreen';
import { useStore } from '../../../presentation/state/store';
import { db } from '../../../data/database/LocalDatabase';
import type { Measurement } from '../../../core/entities/Measurement';

const initialState = useStore.getState();

function makeMeasurement(weight: number, daysAgo: number): Measurement {
  return {
    profileId: 'p1', timestamp: new Date(Date.now() - daysAgo * 86400000),
    weight, impedance: 0, bmi: 24, bmr: 1800, bodyFat: 18.2, bodyWater: 55,
    boneMass: 3, muscleMass: 34.1, visceralFat: 8, metabolicAge: 30, protein: 18, bodyType: 4,
  };
}

describe('HomeScreen', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    useStore.setState({
      activeProfile: { id: 'p1', name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date() },
      measurements: [makeMeasurement(79, 5), makeMeasurement(78.4, 0)],
      foodLogs: [],
    });
  });

  it('renders the weight hero with delta, rings, food, trend, and sync sections', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText(/-0\.6/)).toBeInTheDocument();
    expect(screen.getByText('18.2%')).toBeInTheDocument();
    expect(screen.getByText(/food today/i)).toBeInTheDocument();
    expect(screen.getByText(/weight trend/i)).toBeInTheDocument();
    expect(screen.getByText(/samsung health/i)).toBeInTheDocument();
  });

  it('greets the active profile by name', () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    expect(screen.getByText(/alex/i)).toBeInTheDocument();
  });

  it('opens the log-weight sheet and saves a manual measurement', async () => {
    render(<HomeScreen onOpenSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /log weight/i }));
    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: '78.1' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await screen.findByText('78.1');
    expect(useStore.getState().measurements.at(-1)?.weight).toBe(78.1);
  });

  it('opens the settings screen from the gear action', () => {
    const onOpenSettings = vi.fn();
    render(<HomeScreen onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
```

```tsx
// src/features/onboarding/__tests__/OnboardingScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingScreen } from '../OnboardingScreen';
import { useStore } from '../../../presentation/state/store';

const initialState = useStore.getState();

describe('OnboardingScreen', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('keeps the submit disabled until all required fields are filled', () => {
    render(<OnboardingScreen />);
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1995-01-01' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '180' } });

    expect(screen.getByRole('button', { name: /create profile/i })).toBeEnabled();
  });

  it('calls createProfile with the entered values', () => {
    const createProfile = vi.fn().mockResolvedValue('1');
    useStore.setState({ createProfile });

    render(<OnboardingScreen />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    fireEvent.change(screen.getByLabelText(/birth date/i), { target: { value: '1992-05-10' } });
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '168' } });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alex',
      gender: 'female',
      height: 168,
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/home/__tests__/HomeScreen.test.tsx src/features/onboarding`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Implement HomeScreen**

```tsx
// src/features/home/HomeScreen.tsx
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useStore } from '../../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { MetricHeroCard } from './MetricHeroCard';
import { CompRingsCard } from './CompRingsCard';
import { FoodTodayCard } from './FoodTodayCard';
import { TrendCard } from './TrendCard';
import { SyncCard } from './SyncCard';
import { AddFoodSheet } from './AddFoodSheet';
import { LogWeightSheet } from './LogWeightSheet';
import { CapacitorHealthProvider } from '../../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../../data/health/WebHealthProvider';

export interface HomeScreenProps {
  onOpenSettings: () => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenSettings }) => {
  const {
    activeProfile, measurements, foodLogs,
    addFoodLog, deleteFoodLog, addManualMeasurement, importMeasurements,
  } = useStore();

  const [foodSheetOpen, setFoodSheetOpen] = useState(false);
  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>();

  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;
  const delta = latest && previous ? Number((latest.weight - previous.weight).toFixed(1)) : null;

  const trendPoints = measurements.slice(-7).map(m => ({
    label: new Date(m.timestamp).toLocaleDateString(undefined, { weekday: 'short' }),
    weight: m.weight,
  }));

  const handleSync = async () => {
    setSyncState('syncing');
    setSyncMessage(undefined);
    try {
      const provider = new CapacitorHealthProvider();
      const fallback = new WebHealthProvider();
      const healthProvider = provider.isAvailable() ? provider : fallback;

      const granted = await healthProvider.requestPermissions();
      if (!granted) {
        setSyncState('error');
        setSyncMessage('Permission denied — enable Health Connect permissions.');
        return;
      }
      const since = new Date();
      since.setDate(since.getDate() - 30);
      if (healthProvider.importBodyComposition && activeProfile) {
        const records = await healthProvider.importBodyComposition(since, activeProfile);
        if (records.length > 0) {
          await importMeasurements(records);
          setSyncState('success');
          setSyncMessage(`Synced ${records.length} body composition records.`);
        } else {
          setSyncState('success');
          setSyncMessage('No new body composition scans found.');
        }
      } else {
        setSyncState('error');
        setSyncMessage('Body composition sync is not supported on this platform.');
      }
    } catch (err) {
      setSyncState('error');
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed.');
    }
  };

  return (
    <>
      <AppBar
        title="Today"
        overline={activeProfile ? `${greeting()}, ${activeProfile.name}` : undefined}
        actions={
          <button type="button" className="ui-icon-btn" aria-label="Settings" onClick={onOpenSettings}>
            <Settings size={22} />
          </button>
        }
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 120px' }}>
        <MetricHeroCard
          latestWeightKg={latest?.weight ?? null}
          deltaKg={delta}
          onLogWeight={() => setWeightSheetOpen(true)}
        />
        <CompRingsCard bodyFatPct={latest?.bodyFat ?? 0} muscleMassKg={latest?.muscleMass ?? 0} />
        <FoodTodayCard
          logs={foodLogs}
          onDelete={id => deleteFoodLog(id)}
          onAdd={() => setFoodSheetOpen(true)}
        />
        <TrendCard points={trendPoints} />
        <SyncCard state={syncState} message={syncMessage} onSync={handleSync} />
      </div>

      <AddFoodSheet
        open={foodSheetOpen}
        onClose={() => setFoodSheetOpen(false)}
        onSubmit={entry => addFoodLog(entry)}
      />
      <LogWeightSheet
        open={weightSheetOpen}
        onClose={() => setWeightSheetOpen(false)}
        onSubmit={w => addManualMeasurement(w)}
      />
    </>
  );
};
```

- [ ] **Step 4: Implement OnboardingScreen**

```tsx
// src/features/onboarding/OnboardingScreen.tsx
import React, { useState } from 'react';
import { useStore } from '../../presentation/state/store';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';

const inputStyle: React.CSSProperties = {
  width: '100%', minHeight: 48, padding: '10px 14px',
  borderRadius: 'var(--ui-radius-md)', border: '1.5px solid var(--ui-outline-strong)',
  background: 'var(--ui-surface)', color: 'var(--ui-text-primary)', fontSize: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--ui-text-secondary)',
};

export const OnboardingScreen: React.FC = () => {
  const { createProfile } = useStore();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');

  const heightNum = Number(height);
  const valid = name.trim().length > 0 && gender !== null && birthDate.length > 0
    && Number.isFinite(heightNum) && heightNum >= 100 && heightNum <= 230;

  const handleCreate = async () => {
    if (!valid || !gender) return;
    await createProfile({
      name: name.trim(),
      gender,
      birthDate: new Date(birthDate),
      height: heightNum,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 16 }}>
      <h1 style={{ fontSize: 'var(--ui-text-display)', fontWeight: 800, letterSpacing: -1, marginBottom: 4 }}>MorphIQ</h1>
      <p style={{ color: 'var(--ui-text-secondary)', marginBottom: 24, fontWeight: 600 }}>Create your profile</p>
      <Card className="w-full" style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={labelStyle}>
            Name
            <input aria-label="Name" style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Alex" />
          </label>
          <div style={labelStyle}>
            Gender
            <div style={{ display: 'flex', gap: 8 }}>
              <Chip selected={gender === 'male'} onClick={() => setGender('male')}>Male</Chip>
              <Chip selected={gender === 'female'} onClick={() => setGender('female')}>Female</Chip>
            </div>
          </div>
          <label style={labelStyle}>
            Birth date
            <input aria-label="Birth date" type="date" style={inputStyle} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
          </label>
          <label style={labelStyle}>
            Height (cm)
            <input aria-label="Height" inputMode="numeric" style={inputStyle} value={height} onChange={e => setHeight(e.target.value)} placeholder="180" />
          </label>
          <Button onClick={handleCreate} disabled={!valid}>Create profile</Button>
          <p style={{ fontSize: 12, color: 'var(--ui-text-secondary)', lineHeight: 1.5 }}>
            MorphIQ uses your height, age, and gender to compute body composition metrics from Samsung Health measurements.
          </p>
        </div>
      </Card>
    </div>
  );
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features`
Expected: PASS — 4 onboarding/home tests in this task plus previous ones

- [ ] **Step 6: Full suite + commit**

Run: `npx vitest run`
Expected: PASS

```bash
git add src/features/home/HomeScreen.tsx src/features/home/__tests__/HomeScreen.test.tsx src/features/onboarding
git commit -m "Add HomeScreen and OnboardingScreen"
```

---

## Phase 4 — App Shell + Teardown

> ⚠️ **Tasks 21–22 intentionally leave `npm run build` red** (legacy components reference removed store state until they're deleted and `App.tsx` is replaced). Do not stop between tasks — Task 23 restores a green build. Tests (`vitest`) must stay green throughout: Vitest does not type-check legacy components.

### Task 21: Store teardown — remove BLE, user-exercise, and debug slices

**Files:**
- Modify: `src/presentation/state/store.ts`
- Modify: `src/presentation/state/store.test.ts`

- [ ] **Step 1: Remove BLE/user-exercise imports and instances**

In `src/presentation/state/store.ts`, delete:

```ts
import { WebBluetoothScaleAdapter, MockScaleAdapter } from '../../data/bluetooth/WebBluetoothScale';
import { CapacitorBleAdapter } from '../../data/bluetooth/CapacitorBleAdapter';
```

```ts
const bleAdapter = Capacitor.isNativePlatform()
  ? new CapacitorBleAdapter()
  : new WebBluetoothScaleAdapter();
const mockAdapter = new MockScaleAdapter();
```

```ts
const userExerciseRepo = isServer ? new ServerUserExerciseRepository() : new UserExerciseRepository();
```

Also remove `UserExerciseRepository` from the `LocalDatabase` import block, `ServerUserExerciseRepository` from the `ServerDatabase` import block, and the `import type { UserExercise }` line. Remove the `Capacitor` import **only if** it is no longer referenced anywhere else in the file (check first — if still used, keep it).

- [ ] **Step 2: Remove scale/debug/user-exercise state from `StoreState` and initial values**

Delete these interface members and their matching initial values:

```ts
  isScanning: boolean;
  scaleError: string | null;
  scaleWeight: number;
  scaleImpedance: number;
  scaleStabilized: boolean;
  scaleImpedancePresent: boolean;
  scaleLastStabilizedWeight: number;
  scanSuccess: { weight: number; impedance: number } | null;
  isSimulator: boolean;
  debugLogs: string[];
  userExercises: UserExercise[];
```

Delete these action signatures and their full implementations:

```ts
  addMeasurementFromScale: () => Promise<void>;
  saveWeightOnly: (customWeight?: number) => Promise<void>;
  startScaleScan: () => Promise<void>;
  stopScaleScan: () => Promise<void>;
  setSimulator: (active: boolean) => void;
  confirmAndSaveScaleMeasurement: () => Promise<void>;
  discardScaleMeasurement: () => Promise<void>;
  addDebugLog: (log: string) => void;
  clearDebugLogs: () => void;
  saveUserExercise: (exercise: Omit<UserExercise, 'id' | 'profileId' | 'lastUsed'>) => Promise<void>;
```

- [ ] **Step 3: Clean remaining references**

- In `loadProfiles`'s empty-profiles reset `set({...})`: remove `userExercises: []` from the object (keep `favoriteExerciseIds: []` added in Task 8).
- In `setActiveProfile`: remove the `const exercises = await userExerciseRepo.getAll(id);` line and the `userExercises: exercises,` property from the `set({...})` call.

- [ ] **Step 4: Update the tab type**

In `StoreState`, replace:

```ts
  activeTab: 'dashboard' | 'logs' | 'workout' | 'coach' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'logs' | 'workout' | 'coach' | 'settings') => void;
```

with:

```ts
  activeTab: 'home' | 'gym' | 'exercises' | 'coach' | 'settings';
  setActiveTab: (tab: 'home' | 'gym' | 'exercises' | 'coach' | 'settings') => void;
```

and change the initial value `activeTab: 'dashboard'` to `activeTab: 'home'`.

- [ ] **Step 5: Prune store tests**

In `src/presentation/state/store.test.ts`, delete every `describe`/`it` block that references removed API surface: `startScaleScan`, `stopScaleScan`, `setSimulator`, `isSimulator`, `scaleWeight`, `scaleImpedance`, `scaleError`, `scanSuccess`, `addMeasurementFromScale`, `saveWeightOnly`, `confirmAndSaveScaleMeasurement`, `discardScaleMeasurement`, `saveUserExercise`, `userExercises`, `addDebugLog`, `clearDebugLogs`, `debugLogs`, and any `MockScaleAdapter`/BLE imports. Keep everything else intact.

- [ ] **Step 6: Verify tests green (build red is expected here)**

Run: `npx vitest run`
Expected: PASS — remaining store tests + all new tests. If anything outside the pruned blocks fails, STOP and report.

Run: `npm run build`
Expected: FAIL with TS errors inside `src/presentation/components/*` and `src/App.tsx` referencing removed store members. This is expected — continue.

- [ ] **Step 7: Commit**

```bash
git add src/presentation/state/store.ts src/presentation/state/store.test.ts
git commit -m "Remove Bluetooth scale, user-exercise, and debug slices from store"
```

---

### Task 22: Delete legacy code, Dexie v5, server cleanup, CSS purge

**Files:**
- Delete: `src/data/bluetooth/` (whole directory)
- Delete: `src/core/interfaces/IBluetooth.ts`
- Delete: `src/core/entities/UserExercise.ts`
- Delete: `src/presentation/components/` (whole directory)
- Delete: `src/App.css`
- Modify: `src/core/interfaces/IDatabase.ts`
- Modify: `src/data/database/LocalDatabase.ts` (Dexie v5)
- Modify: `src/data/database/ServerDatabase.ts`
- Modify: `server/schema.sql`, `server/index.js`
- Modify: `tsconfig.app.json`, `package.json`
- Modify: `src/index.css`
- Test: `src/data/database/FavoriteExerciseRepository.test.ts` (one added assertion)

- [ ] **Step 1: Delete legacy files**

```bash
git rm -r src/data/bluetooth src/presentation/components src/App.css
git rm src/core/interfaces/IBluetooth.ts src/core/entities/UserExercise.ts
```

- [ ] **Step 2: Remove UserExercise from interfaces and databases**

In `src/core/interfaces/IDatabase.ts`: delete the `IUserExerciseRepository` interface and its `import type { UserExercise }` line.

In `src/data/database/ServerDatabase.ts`: delete the `ServerUserExerciseRepository` class, its `UserExercise` import, and `IUserExerciseRepository` from the interface import.

In `src/data/database/LocalDatabase.ts`:
- Delete the `UserExerciseRepository` class, its `UserExercise` import, `IUserExerciseRepository` from the interface import, and the `userExercises!: Table<UserExercise, number>;` declaration.
- Replace the v4 schema block with v5 (drops the table via `null`):

```ts
    this.version(5).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: null,
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
    });
```

- [ ] **Step 3: Verify the table is gone**

Add this test to `src/data/database/FavoriteExerciseRepository.test.ts`:

```ts
  it('drops the legacy userExercises table at v5', () => {
    expect(db.tables.map(t => t.name)).not.toContain('userExercises');
  });
```

Run: `npx vitest run src/data/database`
Expected: PASS — 5 tests

- [ ] **Step 4: Server cleanup**

In `server/index.js`: delete the three user-exercise endpoints (`GET /api/profiles/:profileId/exercises`, `POST /api/exercises`, `DELETE /api/exercises/:id`).

In `server/schema.sql`: delete the `CREATE TABLE IF NOT EXISTS user_exercises (...)` block and append:

```sql
-- Teardown: custom user exercises replaced by the vendored catalog
DROP TABLE IF EXISTS user_exercises;
```

- [ ] **Step 5: Remove BLE dependencies and TS types**

Run: `npm uninstall @capacitor-community/bluetooth-le @types/web-bluetooth`

In `tsconfig.app.json`, change:

```json
"types": ["vite/client", "web-bluetooth"],
```

to:

```json
"types": ["vite/client"],
```

- [ ] **Step 6: Purge index.css**

Replace the entire contents of `src/index.css` with:

```css
/* MorphIQ global styles — One UI era.
   Design tokens: ./ui/tokens.css · Primitive styles: ./ui/ui.css */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

html, body { height: 100%; }

body {
  background: var(--ui-bg);
  color: var(--ui-text-primary);
  font-family: var(--ui-font);
  font-size: var(--ui-text-body);
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color var(--ui-motion-fast), color var(--ui-motion-fast);
}

#root {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

button, input, select, textarea { font-family: inherit; }

:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: var(--ui-outline-strong); border-radius: 999px; }
```

- [ ] **Step 7: Verify tests still green**

Run: `npx vitest run`
Expected: PASS. `npm run build` still fails only on `src/App.tsx` imports — expected; fixed next task.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Delete Bluetooth scale and legacy presentation layer; Dexie v5 drops userExercises"
```

---

### Task 23: New App shell (4 tabs) + ComingSoonScreen + SettingsScreen (TDD)

**Files:**
- Create: `src/features/placeholder/ComingSoonScreen.tsx`
- Create: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/App.tsx` (full rewrite)
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/App.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { useStore } from './presentation/state/store';
import { db } from './data/database/LocalDatabase';

const initialState = useStore.getState();

async function seedProfile() {
  await db.userProfiles.add({
    name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
  });
}

describe('App shell', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('shows onboarding when no profiles exist', async () => {
    render(<App />);
    expect(await screen.findByText('Create your profile')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });

  it('renders the four One UI tabs with Home active', async () => {
    await seedProfile();
    render(<App />);
    for (const tab of ['Home', 'Gym', 'Exercises', 'Coach']) {
      expect(await screen.findByRole('button', { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  it('switches to the Gym placeholder tab', async () => {
    await seedProfile();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gym' }));
    expect(await screen.findByText(/arriving in slice 3/i)).toBeInTheDocument();
  });

  it('opens Settings from the gear and switches the active profile', async () => {
    await seedProfile();
    await db.userProfiles.add({
      name: 'Sam', gender: 'female', birthDate: new Date('1992-05-10'), height: 168, createdAt: new Date(),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sam'));
    expect(useStore.getState().activeProfile?.name).toBe('Sam');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — modules/components don't exist

- [ ] **Step 3: Implement ComingSoonScreen**

```tsx
// src/features/placeholder/ComingSoonScreen.tsx
import React from 'react';
import { AppBar } from '../../ui/primitives/AppBar';
import { EmptyState } from '../../ui/primitives/EmptyState';

export interface ComingSoonScreenProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export const ComingSoonScreen: React.FC<ComingSoonScreenProps> = ({ title, description, icon }) => (
  <>
    <AppBar title={title} />
    <div style={{ padding: '0 16px' }}>
      <EmptyState icon={icon} title={description} />
    </div>
  </>
);
```

- [ ] **Step 4: Implement SettingsScreen (Slice-1 scope: profile switching)**

```tsx
// src/features/settings/SettingsScreen.tsx
import React from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { Card } from '../../ui/primitives/Card';
import { ListItem } from '../../ui/primitives/ListItem';

export const SettingsScreen: React.FC = () => {
  const { profiles, activeProfile, setActiveProfile } = useStore();

  return (
    <>
      <AppBar title="Settings" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 120px' }}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 6 }}>
            Profiles
          </div>
          {profiles.map(p => (
            <ListItem
              key={p.id}
              title={p.name}
              subtitle={`${p.height} cm · ${p.gender}`}
              trailing={activeProfile?.id === p.id ? <Check size={18} /> : undefined}
              onClick={() => p.id && setActiveProfile(p.id)}
            />
          ))}
        </Card>
        <Card>
          <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
            Full settings — Health Connect, theme, data management — arrive in Slice 4.
          </p>
        </Card>
      </div>
    </>
  );
};
```

- [ ] **Step 5: Rewrite App.tsx**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { LayoutDashboard, Dumbbell, LibraryBig, Sparkles } from 'lucide-react';
import { useStore } from './presentation/state/store';
import { BottomNav } from './ui/primitives/BottomNav';
import { HomeScreen } from './features/home/HomeScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { ComingSoonScreen } from './features/placeholder/ComingSoonScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: <LayoutDashboard size={22} /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell size={22} /> },
  { id: 'exercises', label: 'Exercises', icon: <LibraryBig size={22} /> },
  { id: 'coach', label: 'Coach', icon: <Sparkles size={22} /> },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

function App() {
  const { loadProfiles, profiles, activeProfile, activeTab, setActiveTab } = useStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    loadProfiles();
    const timer = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(timer);
  }, [loadProfiles]);

  // Automatic sync from Samsung Health (via Health Connect) on launch
  useEffect(() => {
    if (!activeProfile) return;

    const autoSync = async () => {
      try {
        const provider = new CapacitorHealthProvider();
        const fallbackProvider = new WebHealthProvider();
        const healthProvider = provider.isAvailable() ? provider : fallbackProvider;

        const granted = await healthProvider.requestPermissions();
        if (granted) {
          const since = new Date();
          since.setDate(since.getDate() - 30);

          const workouts = await healthProvider.importWorkouts(since);
          if (healthProvider.importBodyComposition) {
            const measurements = await healthProvider.importBodyComposition(since, activeProfile);
            if (measurements.length > 0) {
              await useStore.getState().importMeasurements(measurements);
            }
          }
          await useStore.getState().importWorkouts(workouts);
          console.log('MorphIQ Launch Auto-Sync: Health synchronization completed successfully.');
        }
      } catch (err) {
        console.error('MorphIQ Launch Auto-Sync error:', err);
      }
    };

    autoSync();
  }, [activeProfile]);

  const splash = showSplash && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      background: 'var(--ui-bg)',
    }}>
      <img src="/app_icon.png" alt="MorphIQ" style={{ width: 96, height: 96, borderRadius: 28, objectFit: 'cover' }} />
      <h1 style={{ fontFamily: 'var(--ui-font)', fontSize: 'var(--ui-text-title)', fontWeight: 800, letterSpacing: '-0.5px' }}>MorphIQ</h1>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ui-text-secondary)' }}>
        Body Intelligence
      </span>
    </div>
  );

  if (profiles.length === 0) {
    return (
      <>
        {splash}
        <OnboardingScreen />
      </>
    );
  }

  return (
    <>
      {splash}
      <main style={{ flex: 1 }}>
        {activeTab === 'home' && <HomeScreen onOpenSettings={() => setActiveTab('settings')} />}
        {activeTab === 'gym' && (
          <ComingSoonScreen title="Gym" description="Gym hub — arriving in Slice 3" icon={<Dumbbell size={26} />} />
        )}
        {activeTab === 'exercises' && (
          <ComingSoonScreen title="Exercises" description="Exercise library — arriving in Slice 2" icon={<LibraryBig size={26} />} />
        )}
        {activeTab === 'coach' && (
          <ComingSoonScreen title="Coach" description="AI coach — arriving in Slice 4" icon={<Sparkles size={26} />} />
        )}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav
        items={[...NAV_ITEMS]}
        activeId={activeTab}
        onSelect={id => setActiveTab(id as TabId)}
      />
    </>
  );
}

export default App;
```

Note: the old floating workout banner + GymTracker overlay is intentionally dropped — Slice 3 rebuilds the live workout entry point inside the Gym tab.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 7: Full green gate**

Run: `npm run test && npm run lint && npm run build`
Expected: all three PASS. If lint flags anything in the new code (unused imports etc.), fix it and re-run.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Rebuild App shell as 4-tab One UI layout with onboarding and settings"
```

---

### Task 24: Final validation + user review gate

**Files:** none — verification only

- [ ] **Step 1: Full automated gate**

Run: `npm run test && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 2: Manual smoke checklist**

Run: `npm run dev` and verify in the browser (both light and dark OS themes):

- [ ] Splash shows, then Onboarding appears with no profiles; creating a profile lands on Home
- [ ] Home shows weight hero (+delta), composition rings, food card, trend, sync card
- [ ] Log weight sheet saves and updates the hero + trend
- [ ] Add food sheet saves an entry; total kcal updates; Delete removes it
- [ ] Large "Today" header collapses on scroll; bottom nav switches all 4 tabs; placeholders show for Gym/Exercises/Coach; gear opens Settings; profile switching works
- [ ] No console errors

- [ ] **Step 3: ⭐ USER REVIEW GATE**

Present the running app to the user. **This is the hard gate from the spec — do not proceed to Slice 2 planning until the user approves the look and feel of the One UI Home.**

---

## Self-Review Notes (completed by plan author)

- **Spec coverage (Slice 0+1 scope):** BT scale removal (T21–22) ✓ · vendored catalog (T2–4) ✓ · favorites DB+server+store (T5–8) ✓ · WorkoutSet.exerciseId (T7) ✓ · design tokens (T9) ✓ · primitives incl. CollapsingAppBar/Card/Button/Chip/ListItem/BottomNav/Sheet/Ring/EmptyState (T10–15) ✓ · Home = metrics+food+trend+sync (T16–20) ✓ · 4-tab shell + header gear (T23) ✓ · legacy deletion + CSS purge (T22) ✓ · test/lint/build gates (T23–24) ✓. Slices 2–4 (Exercises tab, Gym, Coach/Settings, ThemeProvider, SearchBar/ExerciseImage primitives, media cache) are explicitly deferred to follow-up plans after the gate.
- **Type consistency:** `favoriteExerciseIds: string[]` everywhere; `toggleFavorite(exerciseId: string)`; `ExerciseCatalog.search(query, {category, equipment})`; `IFavoriteExerciseRepository.add/remove/getAll`; `addManualMeasurement(weightKg: number)`; `BottomNavItem.id: string` cast to `TabId` at the App boundary; `activeTab` union updated in T21 before App rewrite in T23.
- **Known intentional deviations from spec:** ThemeProvider skipped (pure CSS theming; YAGNI until Slice 4 manual override). Profile *editing* is unavailable between Task 23 and Slice 4 (switching + creation remain) — flagged to user.




