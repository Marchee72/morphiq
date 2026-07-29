# Today Body Heat Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the arbitrary X/16 weekly-set-target block on the Today screen with a body heat map (front/back, tappable), a last-session summary, and a goal/streak nudge.

**Architecture:** Extend `buildMuscleLoad` to track `lastHitAt` and `bestSet` per exercise. Add a `heatColor` derivation that maps set counts to atlas CSS tokens. Build a new `AtlasHeatMap` card component (reusing `BodyMap`'s SVG) and extend `AtlasTodayDetail`'s muscle branch to show exercises latest-to-oldest with best-set info. All new strings go through i18n (`en.ts` + `es.ts`).

**Tech Stack:** React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`), Vitest + Testing Library, vanilla CSS with atlas design tokens.

**Spec:** `docs/superpowers/specs/2026-07-29-today-body-heat-map-design.md`

---

## File Structure

**Modify:**
- `src/ui-atlas/types.ts` — extend `MuscleLoadRow.exercises` item type with `lastHitAt` and `bestSet`
- `src/ui-atlas/derive/muscleLoad.ts` — track `lastHitAt` and `bestSet` per exercise; sort latest-to-oldest
- `src/ui-atlas/derive/todayTraining.ts` — add `freshGroups` derivation and `goalNudge` state logic
- `src/ui-atlas/atlas/AtlasToday.tsx` — replace muscle-load block with heat-map card
- `src/ui-atlas/atlas/AtlasTodayDetail.tsx` — rewrite the `muscle` branch for latest-to-oldest + best set
- `src/ui-atlas/atlas/atlas.css` — add heat-map card styles and front/back toggle styles
- `src/i18n/en.ts` — add new keys
- `src/i18n/es.ts` — add Spanish translations for new keys

**Create:**
- `src/ui-atlas/derive/heatColor.ts` — maps a set count to a CSS color from atlas tokens
- `src/ui-atlas/derive/__tests__/heatColor.test.ts` — tests for the color mapping
- `src/ui-atlas/derive/__tests__/todayTraining.test.ts` — extend with fresh-groups and goal-nudge tests (modify existing)
- `src/ui-atlas/atlas/AtlasHeatMap.tsx` — the combined card: body heat map + last session + today nudge

**Test files to update:**
- `src/ui-atlas/derive/__tests__/muscleLoad.test.ts` — verify `lastHitAt`, `bestSet`, and sort
- `src/ui-atlas/__tests__/screens.test.tsx` — replace X/16 assertions with heat-map assertions
- `src/ui-atlas/__tests__/todayCard.test.tsx` — update the "furthest behind" test (that text is gone)

---

### Task 1: Extend MuscleLoadRow exercise type with lastHitAt and bestSet

**Files:**
- Modify: `src/ui-atlas/types.ts:64-73`

- [ ] **Step 1: Write the failing test**

Add to `src/ui-atlas/derive/__tests__/muscleLoad.test.ts`, inside the `describe('buildMuscleLoad')` block, after the last existing test:

```typescript
  it('tracks the most recent set timestamp per exercise', () => {
    const older = set({ timestamp: new Date(NOW.getTime() - 48 * HOURS) });
    const newer = set({ setNumber: 2, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([older, newer], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises).toHaveLength(1);
    expect(chest.exercises[0].lastHitAt).toEqual(newer.timestamp);
  });

  it('tracks the best set by weight × reps per exercise', () => {
    const light = set({ weight: 60, reps: 10, timestamp: new Date(NOW.getTime() - 48 * HOURS) });
    const heavy = set({ setNumber: 2, weight: 85, reps: 5, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([light, heavy], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises[0].bestSet).toEqual({ weightKg: 85, reps: 5 });
  });

  it('sorts exercises latest-to-oldest by lastHitAt', () => {
    const older = set({ timestamp: new Date(NOW.getTime() - 72 * HOURS) });
    const newer = set({ exerciseName: 'Incline Dumbbell Press', setNumber: 1, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([older, newer], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises[0].name).toBe('Incline Dumbbell Press');
    expect(chest.exercises[1].name).toBe('Barbell Bench Press');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui-atlas/derive/__tests__/muscleLoad.test.ts`
Expected: FAIL — `lastHitAt` and `bestSet` do not exist on the exercise type; sort is still by sets descending.

- [ ] **Step 3: Extend the type in `src/ui-atlas/types.ts`**

Replace the `exercises` field in `MuscleLoadRow` (line 72):

```typescript
  /** What actually produced those sets, latest first. */
  exercises: { name: string; sets: number; volumeKg: number; lastHitAt: Date | null; bestSet: { weightKg: number; reps: number } | null }[];
```

- [ ] **Step 4: Extend `buildMuscleLoad` in `src/ui-atlas/derive/muscleLoad.ts`**

Replace the `GroupTally.exercises` Map value type and the tally logic. Find the `GroupTally` interface (around line 140) and change the `exercises` Map value type:

```typescript
  interface GroupTally {
    sets: number;
    lastHitAt: Date | null;
    /** Keyed by display name — what the detail sheet lists under the group. */
    exercises: Map<string, {
      name: string;
      sets: number;
      volumeKg: number;
      lastHitAt: Date | null;
      bestWeightKg: number;
      bestReps: number;
    }>;
  }
```

Then in the set-processing loop (around line 162-167), replace the tally update:

```typescript
    const name = set.exerciseName.trim();
    const key = name.toLowerCase();
    const tally = entry.exercises.get(key) ?? {
      name, sets: 0, volumeKg: 0,
      lastHitAt: null as Date | null,
      bestWeightKg: 0, bestReps: 0,
    };
    tally.sets++;
    tally.volumeKg += (set.weight ?? 0) * (set.reps ?? 0);
    if (!tally.lastHitAt || at > tally.lastHitAt) tally.lastHitAt = at;
    const setVolume = (set.weight ?? 0) * (set.reps ?? 0);
    const bestVolume = tally.bestWeightKg * tally.bestReps;
    if (setVolume > bestVolume) {
      tally.bestWeightKg = set.weight ?? 0;
      tally.bestReps = set.reps ?? 0;
    }
    entry.exercises.set(key, tally);
```

Then in the `rows` mapping (around line 185-188), change the exercise mapping and sort:

```typescript
      exercises: [...(entry?.exercises.values() ?? [])]
        .map(ex => ({
          ...ex,
          volumeKg: Math.round(ex.volumeKg),
          lastHitAt: ex.lastHitAt,
          bestSet: ex.bestWeightKg > 0 ? { weightKg: ex.bestWeightKg, reps: ex.bestReps } : null,
        }))
        .sort((a, b) => (b.lastHitAt?.getTime() ?? 0) - (a.lastHitAt?.getTime() ?? 0)),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui-atlas/derive/__tests__/muscleLoad.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: Some screen tests may fail (they assert X/16 text) — that's expected, we fix those in Task 6. All derive tests should pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui-atlas/types.ts src/ui-atlas/derive/muscleLoad.ts src/ui-atlas/derive/__tests__/muscleLoad.test.ts
git commit -m "feat: track lastHitAt and bestSet per exercise in muscle load, sort latest-to-oldest"
```

---

### Task 2: Add heatColor derivation

**Files:**
- Create: `src/ui-atlas/derive/heatColor.ts`
- Create: `src/ui-atlas/derive/__tests__/heatColor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui-atlas/derive/__tests__/heatColor.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { heatColor, heatLevel } from '../heatColor';

describe('heatLevel', () => {
  it('returns 0 for zero sets', () => {
    expect(heatLevel(0, 16)).toBe(0);
  });

  it('returns 1 when sets meet the reference target', () => {
    expect(heatLevel(16, 16)).toBe(1);
  });

  it('clamps above 1 when sets exceed the target', () => {
    expect(heatLevel(24, 16)).toBe(1);
  });

  it('returns 0.5 at half the target', () => {
    expect(heatLevel(8, 16)).toBeCloseTo(0.5);
  });
});

describe('heatColor', () => {
  it('returns the rested token at level 0', () => {
    expect(heatColor(0)).toBe('var(--at-figure-limb)');
  });

  it('returns the trained token at level 1', () => {
    expect(heatColor(1)).toBe('var(--clay-strong)');
  });

  it('returns an intermediate color at level 0.5', () => {
    const color = heatColor(0.5);
    // An rgba/hsl interpolation, not a raw token — the midpoint is a blend.
    expect(color).toMatch(/rgba|hsl|rgb/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui-atlas/derive/__tests__/heatColor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/ui-atlas/derive/heatColor.ts`:

```typescript
/**
 * Maps a muscle group's weekly set count to a heat color on the atlas palette.
 *
 * The gradient runs from the figure's limb tone (rested) through muted to
 * clay-strong (trained hard). The reference target is the midpoint of the
 * commonly cited 10–20 hypertrophy range — the same number the old X/16
 * display used — but here it only sets the scale, not a goal the user sees.
 */

/** The set count at which a group reads as "fully trained." Matches the old default target. */
const REFERENCE_SETS = 16;

/** Normalised 0–1 heat level, clamped. */
export function heatLevel(sets: number, reference = REFERENCE_SETS): number {
  if (reference <= 0) return 0;
  return Math.max(0, Math.min(1, sets / reference));
}

/**
 * Returns a CSS color for the given heat level.
 *
 * Level 0 → `--at-figure-limb` (rested, dark).
 * Level 1 → `--clay-strong` (trained hard, red).
 * Midpoints → an `rgba()` blend of the two, so the SVG `fill` is always a
 * concrete color the browser can render (CSS custom properties don't
 * interpolate inside SVG `fill` across all browsers).
 */
export function heatColor(level: number): string {
  if (level <= 0) return 'var(--at-figure-limb)';
  if (level >= 1) return 'var(--clay-strong)';

  // Blend from the limb tone (#3d3128 dark / #e0d0bc light) toward clay-strong
  // (#c4643c). We use the dark-mode limb tone as the rested anchor because the
  // card sits on a dark surface in both themes.
  const rested = { r: 0x3d, g: 0x31, b: 0x28 };
  const trained = { r: 0xc4, g: 0x64, b: 0x3c };
  const r = Math.round(rested.r + (trained.r - rested.r) * level);
  const g = Math.round(rested.g + (trained.g - rested.g) * level);
  const b = Math.round(rested.b + (trained.b - rested.b) * level);
  return `rgb(${r}, ${g}, ${b})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui-atlas/derive/__tests__/heatColor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui-atlas/derive/heatColor.ts src/ui-atlas/derive/__tests__/heatColor.test.ts
git commit -m "feat: add heatColor derivation for body heat map"
```

---

### Task 3: Add fresh-groups and goal-nudge derivation to todayTraining

**Files:**
- Modify: `src/ui-atlas/derive/todayTraining.ts`
- Modify: `src/ui-atlas/derive/__tests__/todayTraining.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/ui-atlas/derive/__tests__/todayTraining.test.ts`, after the existing `nextMuscleFocus` describe block:

```typescript
import { freshGroups, goalNudge, type GoalNudgeState } from '../todayTraining';

describe('freshGroups', () => {
  const HOUR = 3_600_000;

  function freshRow(group: string, hoursAgo: number | null): MuscleLoadRow {
    return {
      group: group as MuscleLoadRow['group'],
      labelKey: `muscle.${group}` as MuscleLoadRow['labelKey'],
      sets: 0, target: 16, recoveredPct: 100,
      lastHitAt: hoursAgo == null ? null : new Date(NOW.getTime() - hoursAgo * HOUR),
      exercises: [],
    };
  }

  it('returns groups that have never been trained', () => {
    const fresh = freshGroups([
      freshRow('chest', 2),
      freshRow('legs', null),
      freshRow('back', null),
    ], NOW);
    expect(fresh.map(f => f.group)).toEqual(['legs', 'back']);
  });

  it('returns groups past their recovery window', () => {
    // Chest recovers over 48h; 50h ago is past it.
    const fresh = freshGroups([
      freshRow('chest', 50),
      freshRow('back', 80), // back recovers over 72h; 80h is past
    ], NOW);
    expect(fresh.map(f => f.group)).toEqual(['back', 'chest']);
  });

  it('excludes groups still within their recovery window', () => {
    const fresh = freshGroups([
      freshRow('chest', 24), // 48h window, only halfway
    ], NOW);
    expect(fresh).toHaveLength(0);
  });

  it('sorts by longest rest first', () => {
    const fresh = freshGroups([
      freshRow('chest', 50),
      freshRow('legs', 200), // legs have a 72h window, 200h is way past
    ], NOW);
    expect(fresh[0].group).toBe('legs');
  });

  it('returns at most two groups', () => {
    const fresh = freshGroups([
      freshRow('chest', null),
      freshRow('back', null),
      freshRow('legs', null),
    ], NOW);
    expect(fresh).toHaveLength(2);
  });
});

describe('goalNudge', () => {
  const baseState = { weekDone: 3, weekGoal: 4, trainedToday: false };

  it('returns "goalFresh" when not trained and goal not met', () => {
    const state = goalNudge(baseState, []);
    expect(state.kind).toBe('goalFresh');
  });

  it('returns "goalMetFresh" when not trained but goal is met', () => {
    const state = goalNudge({ ...baseState, weekDone: 4 }, []);
    expect(state.kind).toBe('goalMetFresh');
  });

  it('returns "goalHit" when trained and goal met', () => {
    const state = goalNudge({ ...baseState, trainedToday: true, weekDone: 4 }, []);
    expect(state.kind).toBe('goalHit');
  });

  it('returns "goalRemaining" when trained but goal not met', () => {
    const state = goalNudge({ ...baseState, trainedToday: true }, []);
    expect(state.kind).toBe('goalRemaining');
    expect(state.remaining).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui-atlas/derive/__tests__/todayTraining.test.ts`
Expected: FAIL — `freshGroups` and `goalNudge` not exported.

- [ ] **Step 3: Write the implementation**

Add to the end of `src/ui-atlas/derive/todayTraining.ts` (after the existing `nextMuscleFocus` function):

```typescript
import { RECOVERY_HOURS } from './muscleLoad';
import { hoursBetween } from './buckets';
import type { MuscleLoadRow } from '../types';

/**
 * The groups that are rested enough to train — never trained, or past their
 * recovery window. Sorted by longest rest first, capped at two so the nudge
 * line stays a line, not a paragraph.
 */
export function freshGroups(rows: MuscleLoadRow[], now: Date): MuscleLoadRow[] {
  return rows
    .filter(row => {
      if (!row.lastHitAt) return true;
      return hoursBetween(row.lastHitAt, now) >= RECOVERY_HOURS[row.group];
    })
    .sort((a, b) => {
      const aHours = a.lastHitAt ? hoursBetween(a.lastHitAt, now) : Infinity;
      const bHours = b.lastHitAt ? hoursBetween(b.lastHitAt, now) : Infinity;
      return bHours - aHours;
    })
    .slice(0, 2);
}

export interface GoalNudgeInput {
  weekDone: number;
  weekGoal: number;
  trainedToday: boolean;
}

export type GoalNudgeState =
  | { kind: 'goalFresh' }
  | { kind: 'goalMetFresh' }
  | { kind: 'goalHit' }
  | { kind: 'goalRemaining'; remaining: number };

/**
 * The context-aware nudge under the goal/streak line. Four states, because the
 * goal and whether you have already trained today are independent — hitting 4/4
 * before training today is not the same as hitting it after.
 */
export function goalNudge(input: GoalNudgeInput, _fresh: MuscleLoadRow[]): GoalNudgeState {
  const { weekDone, weekGoal, trainedToday } = input;
  const met = weekDone >= weekGoal;

  if (!trainedToday && !met) return { kind: 'goalFresh' };
  if (!trainedToday && met) return { kind: 'goalMetFresh' };
  if (trainedToday && met) return { kind: 'goalHit' };
  return { kind: 'goalRemaining', remaining: weekGoal - weekDone };
}
```

Note: `MUSCLE_GROUP_LABELS` is not needed here — `freshGroups` returns `MuscleLoadRow[]` which already carries `labelKey`. The component translates labels at the render edge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui-atlas/derive/__tests__/todayTraining.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui-atlas/derive/todayTraining.ts src/ui-atlas/derive/__tests__/todayTraining.test.ts
git commit -m "feat: add freshGroups and goalNudge derivations for Today heat map card"
```

---

### Task 4: Add i18n keys

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/es.ts`

- [ ] **Step 1: Add keys to `src/i18n/en.ts`**

Find the muscle-group section (around line 103, after `'muscle.unattributed_other'`) and add:

```typescript
  'common.and': 'and',
```

Then find the Today section (around line 450, after `'today.suggestFocus'`) and add:

```typescript
  'today.bodyHeat': 'This week',
  'today.lastSession': 'Last session',
  'today.todayLabel': 'Today',
  'today.heatRested': 'rested',
  'today.heatTrained': 'trained',
  'today.goalHit': 'Goal hit for the week. 🎉',
  'today.goalRemaining_one': '{n} more day to hit your goal',
  'today.goalRemaining_other': '{n} more days to hit your goal',
  'today.goalFresh': '{groups} are fresh — {days} days rest',
  'today.goalFreshNoDays': '{groups} are fresh',
  'today.goalMetFresh': 'Goal met for the week. {groups} are fresh if you want to train.',
  'today.setsThisWeekShort': 'sets this week',
  'today.bestSet': 'best {weight} kg × {reps}',
  'today.noGroupWork': 'No {group} work this week',
  'today.front': 'Front',
  'today.back': 'Back',
  'today.recencyRecent': 'within 2 days',
  'today.recencyMid': '3–5 days',
  'today.recencyOld': 'older',
```

- [ ] **Step 2: Add Spanish translations to `src/i18n/es.ts`**

Find the corresponding sections and add the matching keys:

After `'common.of'` (around line 27):

```typescript
  'common.and': 'y',
```

After `'today.suggestFocus'` (around line 447):

```typescript
  'today.bodyHeat': 'Esta semana',
  'today.lastSession': 'Última sesión',
  'today.todayLabel': 'Hoy',
  'today.heatRested': 'descansado',
  'today.heatTrained': 'entrenado',
  'today.goalHit': 'Meta de la semana cumplida. 🎉',
  'today.goalRemaining_one': '{n} día más para cumplir la meta',
  'today.goalRemaining_other': '{n} días más para cumplir la meta',
  'today.goalFresh': '{groups} están frescos — {days} días de descanso',
  'today.goalFreshNoDays': '{groups} están frescos',
  'today.goalMetFresh': 'Meta cumplida. {groups} están frescos si quieres entrenar.',
  'today.setsThisWeekShort': 'series esta semana',
  'today.bestSet': 'mejor {weight} kg × {reps}',
  'today.noGroupWork': 'Sin trabajo de {group} esta semana',
  'today.front': 'Frente',
  'today.back': 'Espalda',
  'today.recencyRecent': 'dentro de 2 días',
  'today.recencyMid': '3–5 días',
  'today.recencyOld': 'más antiguo',
```

- [ ] **Step 3: Verify the type system catches any mismatch**

Run: `npx tsc -b --noEmit`
Expected: PASS — `es.ts` is typed as `Translations`, so a missing or extra key is a compile error.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts
git commit -m "feat: add i18n keys for body heat map, goal nudge, and detail sheet"
```

---

### Task 5: Build the AtlasHeatMap card component

**Files:**
- Create: `src/ui-atlas/atlas/AtlasHeatMap.tsx`
- Modify: `src/ui-atlas/atlas/atlas.css`

- [ ] **Step 1: Add the CSS styles**

Add to the end of `src/ui-atlas/atlas/atlas.css`:

```css
/* ---------- heat map card ---------- */

.at-heatmap {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.at-heatmap-figure { flex-shrink: 0; }

.at-heatmap-figure .at-map-region {
  /* Override the Library's hover/active styles — here the fill is data-driven. */
  cursor: pointer;
}

.at-heatmap-legend {
  width: 80px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--at-figure-limb), var(--muted), var(--clay-strong));
  margin: 6px auto 0;
}

.at-heatmap-legend-labels {
  display: flex;
  justify-content: space-between;
  width: 80px;
  margin: 2px auto 0;
  font-size: 8px;
  color: var(--muted);
}

.at-heatmap-side {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: center;
}

.at-heatmap-side button {
  min-height: 32px;
  flex: 1;
  border: 1.5px solid var(--hair);
  background: transparent;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 650;
  padding: 4px 0;
  color: var(--muted);
  cursor: pointer;
}

.at-heatmap-side button[data-on='true'] {
  background: var(--cocoa);
  border-color: var(--cocoa);
  color: var(--sand);
}

.at-heatmap-info { flex: 1; min-width: 0; }

.at-heatmap-info h4 {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 2px;
  letter-spacing: -0.02em;
}

.at-heatmap-info .at-heatmap-exercises {
  font-size: 11px;
  color: var(--clay);
  margin-bottom: 8px;
  line-height: 1.4;
}

.at-heatmap-stats {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 12px;
}

.at-heatmap-stats b { color: var(--sand); }

.at-heatmap-today {
  border-top: 1px solid var(--hair);
  padding-top: 10px;
}

.at-heatmap-today-label {
  font-size: 10px;
  color: var(--muted);
  margin-bottom: 4px;
}

.at-heatmap-today-goal {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.at-heatmap-today-nudge {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}
```

- [ ] **Step 2: Write the component**

Create `src/ui-atlas/atlas/AtlasHeatMap.tsx`:

```typescript
import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { heatColor, heatLevel } from '../derive/heatColor';
import { freshGroups, goalNudge } from '../derive/todayTraining';
import { MUSCLE_GROUPS } from '../derive/muscleLoad';
import { BodyMap, type Side } from './BodyMap';
import type { MuscleGroupId } from '../types';

/**
 * The combined card that replaces the old X/16 muscle-load block on Today.
 *
 * Left: a body heat map (front/back toggle) with each region colored by weekly
 * set volume. Right: the last session summary and a goal/streak nudge. Tapping
 * a region opens the detail sheet — the parent owns that state.
 */
export const AtlasHeatMap: React.FC<{
  onPickRegion: (group: MuscleGroupId) => void;
}> = ({ onPickRegion }) => {
  const { t, tp, fmt } = useT();
  const { training } = useAppData();
  const now = new Date();

  const [side, setSide] = useState<Side>('front');

  const previous = training.today.previous;
  const streak = training.streak;
  const trainedToday = training.today.sessions.length > 0;

  const nudge = goalNudge(
    { weekDone: streak.weekDone, weekGoal: streak.weekGoal, trainedToday },
    training.muscleLoad.rows,
  );
  const fresh = freshGroups(training.muscleLoad.rows, now);

  /** Join up to two group labels with the locale's "and". */
  const freshLabels = () => {
    const labels = fresh.map(f => t(f.labelKey));
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return `${labels[0]} ${t('common.and')} ${labels[1]}`;
  };

  /** Days since the freshest of the fresh groups was last trained. */
  const freshDays = () => {
    if (fresh.length === 0) return 0;
    const last = fresh[0].lastHitAt;
    if (!last) return 0;
    return Math.round((now.getTime() - last.getTime()) / 86_400_000);
  };

  const nudgeText = (): string => {
    switch (nudge.kind) {
      case 'goalHit':
        return t('today.goalHit');
      case 'goalRemaining':
        return tp('today.goalRemaining', nudge.remaining);
      case 'goalMetFresh': {
        const groups = freshLabels();
        return groups
          ? t('today.goalMetFresh', { groups })
          : t('today.goalHit');
      }
      case 'goalFresh': {
        const groups = freshLabels();
        const days = freshDays();
        if (!groups) return tp('today.goalRemaining', streak.weekGoal - streak.weekDone);
        return days > 0
          ? t('today.goalFresh', { groups, days })
          : t('today.goalFreshNoDays', { groups });
      }
    }
  };

  /** Render a region with its heat color instead of the Library's active/hover fill. */
  const renderRegion = (group: MuscleGroupId) => {
    const row = training.muscleLoad.rows.find(r => r.group === group);
    const level = heatLevel(row?.sets ?? 0);
    return { group, fill: heatColor(level) };
  };

  // BodyMap renders its own regions, but we need to override the fill per-group.
  // We pass a custom render by wrapping BodyMap and applying inline fills after render.
  // Since BodyMap's regions use CSS classes, we use a data attribute + inline style approach:
  // We render BodyMap normally, then the heat fill is applied via a style override on the SVG.

  return (
    <div className="at-card" style={{ padding: 14 }}>
      <div className="at-heatmap">
        {/* Body heat map */}
        <div className="at-heatmap-figure">
          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginBottom: 6 }}>
            {t('today.bodyHeat')}
          </div>
          <BodyMap
            side={side}
            active={null}
            onPick={onPickRegion}
          />
          {/* Override region fills with heat colors via a style tag scoped to this SVG.
              BodyMap's regions are <g class="at-map-region"> — we set fill inline. */}
          <HeatFillOverride rows={training.muscleLoad.rows} />
          <div className="at-heatmap-legend" />
          <div className="at-heatmap-legend-labels">
            <span>{t('today.heatRested')}</span>
            <span>{t('today.heatTrained')}</span>
          </div>
          <div className="at-heatmap-side">
            <button data-on={side === 'front'} onClick={() => setSide('front')}>
              {t('today.front')}
            </button>
            <button data-on={side === 'back'} onClick={() => setSide('back')}>
              {t('today.back')}
            </button>
          </div>
        </div>

        {/* Last session + Today */}
        <div className="at-heatmap-info">
          {previous ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>
                {t('today.lastSession')}
              </div>
              <h4>{previous.title}</h4>
              <div className="at-heatmap-exercises">
                {previous.exercises.join(' · ')}
              </div>
              <div className="at-heatmap-stats">
                <span><b>{tp('unit.sets', previous.sets)}</b></span>
                <span><b>{fmt.n(previous.volumeKg / 1000, 1)} {t('unit.tonnes')}</b></span>
                <span><b>{previous.durationMin} min</b></span>
                {previous.prs > 0 && (
                  <span><b style={{ color: 'var(--clay)' }}><Trophy size={11} /> {previous.prs}</b></span>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>
                {t('today.lastSession')}
              </div>
              <h4>{t('today.neverTrained')}</h4>
            </>
          )}

          <div className="at-heatmap-today">
            <div className="at-heatmap-today-label">{t('today.todayLabel')}</div>
            <div className="at-heatmap-today-goal">
              🎯 {t('today.weeklyGoal', { done: streak.weekDone, goal: streak.weekGoal })}
              {streak.current > 0 && ` · ${t('today.streak', { n: streak.current })}`}
            </div>
            <div className="at-heatmap-today-nudge">{nudgeText()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Applies heat-map fill colors to BodyMap's SVG regions.
 *
 * BodyMap renders <g class="at-map-region"> elements whose fill is controlled
 * by CSS. For the heat map we need a per-group fill driven by data, so we inject
 * a <style> tag that overrides `.at-map-region` fill based on a `data-heat-group`
 * attribute. This is simpler and more robust than reaching into BodyMap's DOM
 * after render.
 */
const HeatFillOverride: React.FC<{ rows: { group: MuscleGroupId; sets: number }[] }> = ({ rows }) => {
  const rules = rows.map(row => {
    const level = heatLevel(row.sets);
    const color = heatColor(level);
    return `.at-heatmap-figure .at-map-region[data-group="${row.group}"] { fill: ${color} !important; }`;
  }).join('\n');

  return <style>{rules}</style>;
};
```

**Important:** The `BodyMap` component's `<g>` elements need a `data-group` attribute for the `HeatFillOverride` to target them. We need to modify `BodyMap.tsx` to add this attribute. Add this as a sub-step:

- [ ] **Step 2b: Add `data-group` attribute to BodyMap regions**

In `src/ui-atlas/atlas/BodyMap.tsx`, find the region `<g>` element (around line 68-79) and add `data-group={region.id}`:

```typescript
      <g
        key={region.id}
        className="at-map-region"
        data-group={region.id}
        data-on={active === region.id}
        onClick={() => onPick(region.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onPick(region.id); }}
      >
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui-atlas/atlas/AtlasHeatMap.tsx src/ui-atlas/atlas/BodyMap.tsx src/ui-atlas/atlas/atlas.css
git commit -m "feat: add AtlasHeatMap card with body heat map, last session, and goal nudge"
```

---

### Task 6: Replace the muscle-load block in AtlasToday and update AtlasTodayDetail

**Files:**
- Modify: `src/ui-atlas/atlas/AtlasToday.tsx:276-306`
- Modify: `src/ui-atlas/atlas/AtlasTodayDetail.tsx:262-294`

- [ ] **Step 1: Replace the muscle-load block in AtlasToday**

In `src/ui-atlas/atlas/AtlasToday.tsx`, find the muscle-load section (lines 276-306, starting with `<div className="at-rail-head">` containing `t('today.muscleLoad')` and ending at the closing `</div>` before the recent section). Replace the entire block with:

```tsx
      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <AtlasHeatMap onPickRegion={(group) => setDetail({ kind: 'muscle', group })} />
      </div>
```

Also add the import at the top of the file:

```typescript
import { AtlasHeatMap } from './AtlasHeatMap';
```

And remove the now-unused imports: `nextMuscleFocus` from `../derive/todayTraining` (if it's only used for the old focus text — check that the "Training today" card's focus line still uses it; if so, keep the import). The `Sparkles` import may also become unused — check before removing.

- [ ] **Step 2: Rewrite the muscle branch in AtlasTodayDetail**

In `src/ui-atlas/atlas/AtlasTodayDetail.tsx`, replace the entire muscle branch (lines 262-294, from `const muscleRow = training.muscleLoad.rows.find(...)` to the end of the `return sheet(...)`) with:

```typescript
  const muscleRow = training.muscleLoad.rows.find(r => r.group === detail.group);
  if (!muscleRow) return null;

  /** Recency dot color matching the heat gradient. */
  const recencyColor = (lastHitAt: Date | null): string => {
    if (!lastHitAt) return 'var(--at-figure-limb)';
    const hours = (now.getTime() - lastHitAt.getTime()) / 3_600_000;
    if (hours <= 48) return 'var(--clay-strong)';
    if (hours <= 120) return 'var(--muted)';
    return 'var(--at-figure-limb)';
  };

  /** Resolve the session title for an exercise by looking up its workoutLogId. */
  const sessionTitleFor = (exerciseName: string): string => {
    // The muscle load exercises don't carry workoutLogId, but the history
    // entries do. Find the most recent history entry whose exercise list
    // contains this exercise.
    const entry = training.history.find(h => h.exercises.includes(exerciseName));
    return entry?.title ?? '';
  };

  return sheet(
    t(muscleRow.labelKey),
    `${muscleRow.sets} ${t('today.setsThisWeekShort')}`,
    muscleRow.exercises.length > 0 ? (
      <div className="at-card" style={{ padding: '8px 20px' }}>
        {muscleRow.exercises.map((exercise, i) => (
          <div
            key={exercise.name}
            className="at-routine-item"
            style={{ borderTop: i === 0 ? 'none' : undefined }}
          >
            <span>
              <span style={{ color: recencyColor(exercise.lastHitAt) }}>●</span>{' '}
              {exercise.name}
              <small>
                {exercise.lastHitAt
                  ? `${fmt.relativeDay(exercise.lastHitAt, now)}${
                      sessionTitleFor(exercise.name) ? ` · ${sessionTitleFor(exercise.name)}` : ''
                    }`
                  : t('common.noData')}
              </small>
            </span>
            <b>
              {tp('unit.sets', exercise.sets)}
              {exercise.bestSet && (
                <small style={{ display: 'block', fontWeight: 400 }}>
                  {t('today.bestSet', { weight: fmt.n(exercise.bestSet.weightKg, 1), reps: exercise.bestSet.reps })}
                </small>
              )}
            </b>
          </div>
        ))}
      </div>
    ) : (
      <p className="at-summary-empty">
        {t('today.noGroupWork', { group: t(muscleRow.labelKey) })}
      </p>
    ),
    <button className="at-btn" onClick={go('library')}>
      {t('nav.library')} <i><ArrowRight size={16} /></i>
    </button>,
  );
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc -b --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/ui-atlas/atlas/AtlasToday.tsx src/ui-atlas/atlas/AtlasTodayDetail.tsx
git commit -m "feat: replace muscle-load block with heat map card on Today, rewrite detail sheet"
```

---

### Task 7: Update existing tests

**Files:**
- Modify: `src/ui-atlas/__tests__/screens.test.tsx`
- Modify: `src/ui-atlas/__tests__/todayCard.test.tsx`

- [ ] **Step 1: Update screen tests**

In `src/ui-atlas/__tests__/screens.test.tsx`, replace the test "counts real weekly sets against each group target" (lines 30-37) with:

```typescript
    it('shows the body heat map instead of X/16 set targets', () => {
      renderScreen('today', { data: 'rich' });
      const text = visibleText();
      // The X/16 targets are gone — no "/16" or "/8" should appear.
      expect(text).not.toContain('/16');
      expect(text).not.toContain('/8');
      // The heat map card is present with its labels.
      expect(text).toContain('This week');
      expect(text).toContain('Last session');
    });
```

Replace the test "shows zeros rather than blank rows when there is no history" (lines 39-43) with:

```typescript
    it('renders the heat map card with no history', () => {
      renderScreen('today', { data: 'empty' });
      const text = visibleText();
      expect(text).toContain('Last session');
      // All groups render in the SVG, even with zero sets.
      expect(screen.getAllByText('Chest').length).toBeGreaterThan(0);
    });
```

- [ ] **Step 2: Update the todayCard test**

In `src/ui-atlas/__tests__/todayCard.test.tsx`, replace the test "suggests the group furthest behind when nothing has been trained" (lines 122-132) with:

```typescript
  it('shows the goal nudge instead of a furthest-behind suggestion', async () => {
    await seedSession(new Date(Date.now() - DAY), 'Push A', [
      { name: 'Barbell Bench Press', weight: 80 },
    ]);
    render();

    // The old "Furthest behind" text is gone.
    await waitFor(() => expect(card()).toBeTruthy());
    expect(card()?.textContent).not.toMatch(/Furthest behind|Lo mas atrasado/i);
  });
```

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS. If any fail, read the failure, understand the root cause, and fix the test or implementation. Do not skip tests.

- [ ] **Step 4: Commit**

```bash
git add src/ui-atlas/__tests__/screens.test.tsx src/ui-atlas/__tests__/todayCard.test.tsx
git commit -m "test: update screen and card tests for heat map replacement"
```

---

### Task 8: Final validation

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: PASS — no errors. If there are unused imports (e.g., `nextMuscleFocus`, `Sparkles`), remove them.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: PASS — `tsc -b` and `vite build` both succeed.

- [ ] **Step 4: Verify the spec's exit criteria**

Check each item:
- [ ] The X/16 muscle-load rows are gone from the Today screen
- [ ] A combined card shows the body heat map (with Front/Back toggle), last session summary, and today's goal nudge
- [ ] Tapping a muscle region opens a detail sheet with exercises (latest to oldest, with best set and recency dot)
- [ ] The heat gradient uses only existing atlas CSS tokens
- [ ] All new strings are in `en.ts` and `es.ts`, typed through `StaticKey` / `TKey`
- [ ] `buildMuscleLoad` extended with `lastHitAt` and `bestSet` per exercise, sorted latest-to-oldest
- [ ] Existing tests updated; new tests pass
- [ ] `npm run build` (tsc + vite) succeeds
- [ ] `npm run lint` passes
- [ ] `npm run test` passes

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: final cleanup for heat map feature"
```