# Today Screen: Replace Weekly Sets with Body Heat Map + Session Summary

Date: 2026-07-29
Session: morphiq-today-redesign

## Problem

The Today screen's "Muscle load" block shows six rows of `Chest 10/16 · 62% · 2d ago`. The `X/16` weekly set targets are arbitrary — the user didn't choose them and doesn't relate to them. The block doesn't answer the questions the user opens the app for: *how was my last gym session?* and *should I train today?*

## Solution

Replace the entire muscle-load block with one combined card containing:

1. **Body heat map** (left) — the existing `BodyMap` SVG figure with a Front/Back toggle, each muscle region colored by training volume this week (dark = rested, red = trained hard). Regions are tappable.
2. **Last session** (top right) — title, exercise list, sets/volume/duration/PRs, relative day.
3. **Today** (bottom right) — streak/goal read + a context-aware nudge about whether to train and what's fresh.

Tapping a muscle region opens a detail sheet listing the exercises performed for that group this week, latest to oldest, with best-set info and a recency dot matching the heat gradient.

## What's Removed

- The six `X/16` set-target rows (`Chest 10/16`, `Back 6/16`, etc.)
- The recovery percentage (`62%`) and "last hit Xd ago" text on each row
- The "unattributed sets" note
- `MUSCLE_GROUP_TARGETS` no longer drives anything on the Today screen (it stays in `muscleLoad.ts` since Library may still reference it)

## What Stays

- Everything else on Today: greeting, hero, "Training today" card, "So far today" rail, "This week" ring strip, "Recent" list
- `buildMuscleLoad` still runs — we use `row.sets` for heat color and `row.exercises` for the detail sheet
- `BodyMap` component is reused (not rewritten) — it already supports front/back via the `side` prop and tappable regions via `onPick`
- The `AtlasTodayDetail` sheet pattern is reused for the muscle-group drill-down

## Design Details

### Body Heat Map

**Component:** `BodyMap` (existing, `src/ui-atlas/atlas/BodyMap.tsx`), reused with a new rendering mode.

**Front/Back toggle:** A two-button switch (Front | Back) below the figure. Tapping swaps the SVG regions. Default: Front. Toggle state is local React state in the card.

**Region coloring:** Each of the six muscle groups gets a fill color on a gradient driven by `row.sets` (sets this week, from `buildMuscleLoad`):

- 0 sets → dark / silhouette color (rested)
- Low sets → muted/amber tone
- High sets → clay/red tone (trained hard)

The gradient is built from the app's existing CSS custom properties, not custom hex values. Candidate tokens: `--cocoa` / `--muted` / `--clay` / `--clay-strong` (light mode) and their dark-mode equivalents. The exact interpolation stops are an implementation detail, but the gradient must use only existing palette tokens.

**No numbers on the figure.** The figure shows color only — the set count appears in the detail sheet when you tap.

**Gradient legend:** A small bar under the figure: `rested → trained`, using the same gradient. Labeled with i18n strings.

**Tappable regions:** Each region is a button (same as Library today). Tapping opens the detail sheet (below). Regions get a hover/press state via the existing `.at-map-region` CSS.

### Last Session (top right of card)

**Data source:** `training.today.previous` (the most recent finished session before today) from `TodayTrainingVM`. If today has sessions, the "Training today" card above already covers those — this shows the *previous* one.

**Fields:**
- **Title** — `previous.title` (e.g., "Push Day")
- **Exercise list** — `previous.exercises.join(' · ')` (distinct exercises in order performed)
- **Stats row** — sets (`previous.sets`), volume (`previous.volumeKg / 1000` tonnes), duration (`previous.durationMin` min), PRs (`previous.prs` with trophy icon if > 0)
- **When** — relative day via `fmt.relativeDay(previous.at, now)` (e.g., "yesterday", "3d ago")

**Empty state:** If `previous` is null (no sessions ever logged), show the existing `today.neverTrained` string.

### Today / Goal Nudge (bottom right of card, separated by divider)

**Data source:** `training.streak` (`StreakVM`).

**Goal/streak line:** "🎯 {weekDone} of {weekGoal} days" + streak if > 0: "🔥 {n}-day streak". Uses existing `today.weeklyGoal` and `today.streak` i18n keys.

**Context-aware nudge** — one line below the goal, with three states:

| State | Condition | Text (EN) |
|---|---|---|
| Not trained today, goal not met | `!trainedToday && weekDone < weekGoal` | "One more hits your goal. {freshGroups} are fresh — {days} days rest." |
| Not trained today, goal met | `!trainedToday && weekDone >= weekGoal` | "Goal met for the week. {freshGroups} are fresh if you want to train." |
| Trained today, goal met | `trainedToday && weekDone >= weekGoal` | "Goal hit for the week. 🎉" |
| Trained today, goal not met | `trainedToday && weekDone < weekGoal` | "{remaining} more day(s) to hit your goal." |

**Fresh groups derivation:** From `muscleLoad.rows`, find groups where `lastHitAt` is null or `hoursBetween(lastHitAt, now) >= RECOVERY_HOURS[group]`. Sort by longest rest first. Take up to two. Map to labels via `MUSCLE_GROUP_LABELS`, joined with " and " (i18n: `common.and`). If only one group is fresh, use it alone (singular phrasing). If all groups are recently trained, omit the fresh-groups clause entirely — the nudge line is dropped, leaving only the goal/streak line.

### Detail Sheet (tap a muscle region)

**Pattern:** Reuses `AtlasTodayDetail` sheet (slides up from bottom, same as other Today detail sheets).

**Header:**
- Muscle group name — `t(row.labelKey)` (e.g., "Chest")
- Total sets this week — `row.sets` (no target, just the count)
- Label: i18n key for "sets this week"

**Exercise list — latest to oldest:**

Each line shows:
- **Exercise name** — `exercise.name`
- **When** — relative day + session title (e.g., "yesterday · Push Day"). The session title comes from the workout log that owns the set. `buildMuscleLoad` processes `WorkoutSet[]` — each set carries a `workoutLogId`. The detail sheet resolves the session title by looking up that id in `training.history` (already available in `AppData`). If multiple sessions produced sets for the same exercise this week, the "when" reflects the most recent one.
- **Sets** — `exercise.sets`
- **Best set** — heaviest set by weight × reps (e.g., "best 85 kg × 5"). Requires tracking per-set weight and reps, not just the aggregated volume.
- **Recency dot** — colored dot matching the heat gradient:
  - Red (within 2 days)
  - Amber (3–5 days)
  - Dark (older than 5 days)

**Sort:** Strictly latest to oldest, by the most recent set timestamp for that exercise.

**Empty state:** "No {group} work this week." — i18n key, with the group label interpolated.

### Data Changes

**`MuscleLoadRow` (existing, `src/ui-atlas/types.ts`):**

The `exercises` array currently has `{ name, sets, volumeKg }`. We need to add:
- `lastHitAt: Date | null` — most recent set timestamp for this exercise (for sorting and recency dot)
- `bestSet: { weightKg: number; reps: number } | null` — heaviest set by weight × reps

**`buildMuscleLoad` (existing, `src/ui-atlas/derive/muscleLoad.ts`):**

The per-exercise tally (`GroupTally.exercises`) already tracks `sets` and `volumeKg`. Extend it to also track:
- `lastHitAt` — update on each set if `at > lastHitAt`
- `bestWeightKg` / `bestReps` — update on each set if `weight × reps > bestWeight × bestReps`

The final sort changes from "sets descending" to "latest to oldest" (`lastHitAt` descending).

**No new derived view models.** The heat-map card and detail sheet read from the existing `MuscleLoadVM` / `MuscleLoadRow` with the extended `exercises` array. The card also reads `training.today.previous` and `training.streak`, both already computed.

### i18n

All new user-facing strings go through the i18n system. New keys added to both `en.ts` and `es.ts`:

| Key | EN | ES |
|---|---|---|
| `today.bodyHeat` | "This week" | "Esta semana" |
| `today.lastSession` | "Last session" | "Última sesión" |
| `today.today` | "Today" | "Hoy" |
| `today.heatRested` | "rested" | "descansado" |
| `today.heatTrained` | "trained" | "entrenado" |
| `today.goalHit` | "Goal hit for the week. 🎉" | "Meta de la semana cumplida. 🎉" |
| `today.goalRemaining_one` | "{n} more day to hit your goal" | "{n} día más para cumplir la meta" |
| `today.goalRemaining_other` | "{n} more days to hit your goal" | "{n} días más para cumplir la meta" |
| `today.goalFresh` | "{groups} are fresh — {days} days rest" | "{groups} están frescos — {days} días de descanso" |
| `today.goalFreshNoDays` | "{groups} are fresh" | "{groups} están frescos" |
| `today.goalMetFresh` | "Goal met for the week. {groups} are fresh if you want to train." | "Meta cumplida. {groups} están frescos si quieres entrenar." |
| `today.setsThisWeekShort` | "sets this week" | "series esta semana" |
| `today.bestSet` | "best {weight} kg × {reps}" | "mejor {weight} kg × {reps}" |
| `today.noGroupWork` | "No {group} work this week" | "Sin trabajo de {group} esta semana" |
| `today.front` | "Front" | "Frente" |
| `today.back` | "Back" | "Espalda" |
| `common.and` | "and" | "y" |
| `today.recencyRecent` | "within 2 days" | "dentro de 2 días" |
| `today.recencyMid` | "3–5 days" | "3–5 días" |
| `today.recencyOld` | "older" | "más antiguo" |

**Removed keys** (no longer referenced by Today, but kept in dictionaries if Library or other screens use them — verify before removing):
- `today.muscleLoad` ("Weekly sets" / "Series semanales") — check if Library uses it
- `today.suggestFocus` — the old "furthest behind" text, replaced by the goal nudge
- `today.lastHit` — replaced by recency dot + relative day in detail sheet
- `today.setsThisWeek` — replaced by `today.setsThisWeekShort` in the detail sheet header

**Existing keys reused** (no changes):
- `muscle.chest`, `muscle.back`, `muscle.legs`, `muscle.shoulders`, `muscle.arms`, `muscle.core`
- `today.weeklyGoal`, `today.streak`
- `today.neverTrained`
- `unit.sets`, `unit.tonnes`, `unit.kg`
- `summary.duration`

### Visual Style

- Use existing atlas CSS classes and design tokens throughout — no custom hex colors
- Card container: `.at-card` (existing)
- Exercise list rows in detail sheet: `.at-routine-item` (existing, used everywhere)
- Front/Back toggle: new CSS class in `atlas.css`, styled with `--cocoa` / `--muted` / `--clay` tokens
- Heat gradient: built from `--cocoa` (rested) → `--muted` → `--clay` → `--clay-strong` (trained), using CSS `linear-gradient` or per-region `fill` with interpolated opacity
- Body map: existing `.at-map-region` / `.at-map-figure` CSS, extended with a `data-heat` attribute or inline `fill` for the heat color
- Typography: existing font sizes and weights from the atlas system

### Testing

- **Unit tests** (`src/ui-atlas/derive/__tests__/muscleLoad.test.ts`): extend to verify `lastHitAt` and `bestSet` are populated per exercise, and that the sort is latest-to-oldest
- **Unit tests** (`src/ui-atlas/derive/__tests__/todayTraining.test.ts`): verify the fresh-groups derivation and goal-nudge state logic
- **Component tests** (`src/ui-atlas/__tests__/`): verify the heat-map card renders correct colors for given set counts, the Front/Back toggle swaps regions, tapping a region opens the detail sheet, and the detail sheet shows exercises in latest-to-oldest order with best-set info
- **Screen tests** (`src/ui-atlas/__tests__/screens.test.ts`): update the test that "counts real weekly sets against each group target" — the X/16 display is gone; replace with a test that verifies the heat colors and detail sheet content
- **i18n tests**: verify all new keys exist in both `en.ts` and `es.ts` (the `Dictionary` type already enforces this at compile time, but an explicit test guards against empty strings)

## Exit Criteria

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