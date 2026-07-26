# UI Showcase Expansion & Structural Refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the 6 existing UI showcase themes to be genuinely structurally distinct (not just color/type swaps), and add 4 new themes (Minimalist List-First, Gamified Playful, Retro Skeuomorphic, Bento Grid), each implemented across 4 core screens (Main, Coach, Exercises, GymSession). 10 themes total, 40 theme-screen branches.

**Architecture:** The showcase already uses a flat file-per-screen pattern where each screen component (`MainScreen.tsx`, `CoachScreen.tsx`, etc.) checks `themeId` and renders a theme-specific branch. We extend this pattern: each file gets 10 `if (themeId === '...')` branches. CSS classes live in `showcase.css` organized by theme block. Shared types and mock data live in `types.ts` and `mockData.ts`.

**Tech Stack:** React 19, TypeScript 6.0 alpha, Vite, vanilla CSS (no framework), lucide-react icons

**Spec:** `docs/superpowers/specs/2026-07-26-ui-showcase-expansion-design.md`

**Constraint checklist (per theme):**

| Theme | Hard constraints (must NOT use) |
|-------|-------------------------------|
| Clay Indigo | No flat surfaces (extruded/recessed only). No borders — only shadows. Must use ticket-stub + horizontal avatar rail. |
| Warm Latte | No sans-serif headlines (serif only). No equal-column grids on Main (60/40 split). Must use issue-number framing + bezel dial. |
| Stealth Dark | No card borders (negative space only). No rounded data containers. No colored accents (white/gray/black only). Must use asymmetric grid + dot-matrix calendar. |
| Tactical Amber | No opaque cards (frosted glass + blur). No non-amber accent colors. Must use timeline stepper + attached badge CTAs. |
| Swiss Brutalist | No rounded corners (radius=0). No shadows. No lowercase headers (all-caps). Must use 2px black borders + square checkboxes. |
| Neumorphic Slate | Single hero focal point per screen. No flat surfaces (extruded or recessed only). No borders. Must use extruded/recessed binary (controls extruded, displays recessed). |
| List-First | No cards (content sits on bg). No shadows. No borders (hairlines only). No bg fills behind content. No icons in nav (text-only). Generous whitespace. |
| Gamified | No flat/static elements (everything animated/progress). No muted colors (saturated, bright). Must use progress rings + streak counter + badge grid. Large bouncy pill buttons. Emoji as functional elements. |
| Retro | No flat digital surfaces (textures everywhere). Handwritten-style fonts for headers. Physical metaphors: chalkboard (Main), notebook paper (Coach/GymSession), index cards (Exercises). Dividers are chalk/pen strokes, not clean CSS borders. |
| Bento | No vertical stacking of full-width sections (grid tiles only). Tiles must be varied sizes (1x1, 2x1, 1x2, 2x2). Each tile a self-contained widget. True CSS grid (not flex column). Varied corner radii (±4px). |

**Structure per screen (what the layout does):**

| Theme | Main | Coach | Exercises | GymSession |
|-------|------|-------|-----------|-------------|
| Clay | Ticket-stub card + search pill + avatar rail + slider | Sticky-note chat (peach coach, indigo user), recessed quick-reply chips, extruded avatar bubble | Category pill rail + mini ticket-stub cards (perforated left edge) + dotted divider | Punch-card timer header + set tokens (circular clay buttons) + floating clay FAB |
| Latte | 60/40 split: editorial cover (serif, issue#) + bottom sheet (2-col stats) + bezel dial | Letter-column chat: serif coach body (drop-cap first msg), sans user right-aligned, topics list quick-replies | Numbered magazine index (01, 02, … serif names, small-caps eyebrow, thin rules) | Barista order tickets: name in serif, sets as "shots" (○ ○ ○ ○), bezel timer dial, attached pill finish |
| Stealth | Asymmetric 1.2fr/1fr grid + dot-matrix calendar + huge white metrics | Terminal-log chat: monospace, `>` prefix coach, right-aligned user, timestamped, inline `> _` quick-replies | Dot-matrix table (tight grid, dot clusters for category/equipment, inline expand) | Minimal set table: large-white-num rows, completed = ▮, uncompleted = ▯, hairlines only |
| Amber | Timeline stepper + frosted-glass stat tiles + amber pill CTA with badge | Mission-briefing chat: frosted panels (amber "BRIEFING" / "REPORT" headers), amber pill quick-replies, glowing orb avatar | Tactical frosted-glass cards (amber category tag, icon-label detail rows, long-press targets) | Mission HUD: frosted panels, sets with "ARMED"/"COMPLETE" tags, timeline stepper persists, frosted timer pill |
| Swiss | "MONDAY" header + stacked day-accordions (2px border) + square-checkbox expanded day | Q&A broadsheet: full-width blocks (thick top border, "A:"/"Q:" labels), all-caps Helvetica, no bubbles, square-bordered quick-replies | Typeset table (full-width rows, 2px borders, uppercase 10px column headers, tap-inverts a row) | Log sheet: full-width blocks (thick top border, 18px uppercase name), square-bordered SET/WEIGHT/REPS/DONE table, completed = black-filled square |
| Neu | Hero extruded dial (ember glow) + recessed metric wells + orbited layout | Control-panel chat: recessed coach messages (amber status light), extruded user panels, extruded push-button quick-replies, recessed "speaker" AI well | Tactile cards on well: list inside one large recessed well, extruded cards inside, extruded toggle-buttons for filter | Control console: extruded panels (recessed set-table inside, ember-glow completed sets), recessed timer well (glowing ring), extruded circular add-set |
| List-First | Date header + "Today's workout" line item (chevron) + labeled sections (Recent, This Week) as plain lists, hairline dividers, text-only nav | Transcript chat: plain text lines ("Coach" / "You" label + timestamp), comma-separated inline quick-replies ("Ask about form, Log today's session, or View progress"), no bubbles | Typeset index: single column of names (clean sans-serif), tiny right-aligned category label, chevron, hairline dividers, thin-underline search, inline expand (no modal) | Plain log: exercise section headers, indented set lines ("1. 80kg × 10 ✓"), active set underlined, monospace timer top-right, text-link "Done →" finish |
| Gamified | Large animated progress ring (68%), "🔥 12-day streak!" flame counter, badge grid (some locked 🔒), "Let's Go! 💪" bouncy pill CTA | Cheerleader chat: rounded bubbles (emoji reactions floating 🎉💯), bright user bubbles, large rounded-pill quick-replies with icons, cartoon mascot avatar (bounces on typing), confetti on send | Collectible cards: rounded cards (big emoji icon, level badge 🌱/⭐/🔥, progress bar), locked cards grayed 🔒, horizontal scroll of round emoji category bubbles | Game HUD: rounded cards (progress bar, set tokens 💪/○), "+10 XP" floating animation on complete, circular countdown ring timer, streak counter persists, "Finish Strong! 🏆" bouncy pill |
| Retro | Dark green chalkboard slate, chalk-font header, chalk-drawn wavy dividers, "taped-on" index cards (slight rotation, tape pseudo-element), chalk date in corner | Notebook-page chat: cream lined-paper bg, blue-ink coach (handwritten), black-ink user, both follow ruled lines, sticky-note quick-replies, doodled-star avatar | Index-card stack: 3x5 cream cards (rounded corners, slight shadow), handwritten-marker name, pencil details, stacked with offset (visible card edges behind), card-catalog tabbed-divider filter, swipe to flip | Handwritten log: cream ruled-paper bg, blue-ink exercise entries, tally-style sets ("Bench Press  80×10  85×8  90×6"), pen-stroke cross-off on complete, doodled-stopwatch timer, "sign-off" finish |
| Bento | CSS grid: 2x2 "today's workout" tile (start btn), 1x1 body-weight, 2x1 weekly-volume sparkline, 1x2 streak, 1x1 recovery, 1x1 steps. Each tile self-contained widget. Varied radii. | Bento of conversation threads: grid of varied-size tiles (each = topic: Form Check, Nutrition, Recovery with preview), tap opens thread, active = large tile, quick-replies = small pill-tiles | Widget grid: bento of exercise cards (large tiles for favorites with thumbnail, small for others name+category), row of small category filter tiles, tap expands tile to full-screen, grid reflows on filter | Live widget board: bento grid (active exercise = large tile with set table, completed = small dimmed, next = medium), wide timer tile at top, small "+" tile for add, grid updates as session progresses |

---

### Task 1: Update types.ts + mockData.ts — add 4 new themes and structuralPrinciple

**Files:**
- Modify: `src/ui-showcase/types.ts`
- Modify: `src/ui-showcase/mockData.ts`

- [ ] **Step 1: Add new ThemeId values and structuralPrinciple to types.ts**

In `src/ui-showcase/types.ts`, extend `ThemeId` with 4 new values and add `structuralPrinciple` to `ThemeConfig`:

```typescript
export type ThemeId = 
  | 'clay-indigo'
  | 'warm-latte'
  | 'dark-stealth'
  | 'tactile-amber'
  | 'swiss-brutalist'
  | 'neumorphic-slate'
  | 'list-first'
  | 'gamified'
  | 'retro'
  | 'bento-grid';

export interface ThemeConfig {
  // ... existing fields ...
  structuralPrinciple: string;   // NEW
}
```

- [ ] **Step 2: Update mockData.ts — add structuralPrinciple to existing 6, append 4 new entries**

Add `structuralPrinciple` values to the existing 6 entries:
- `clay-indigo`: `"Tactile ticket-stub + horizontal story rail. Extruded/recessed surfaces, dotted dividers, clay avatar bubbles."`
- `warm-latte`: `"60/40 magazine spread + bottom sheet. Serif headlines, issue-number framing, circular bezel dial."`
- `dark-stealth`: `"Asymmetric grid + dot-matrix calendar. High density, zero chrome, negative-space zones only."`
- `tactile-amber`: `"Timeline stepper + frosted glass tiles. Translucent layers, amber-only accents, attached badge CTAs."`
- `swiss-brutalist`: `"Stacked day-accordions + square checklist. Zero radius, zero shadows, 2px black borders, all-caps Helvetica."`
- `neumorphic-slate`: `"Single hero dial + recessed wells. Extruded/recessed binary, ember glow focal point per screen."`

Then append 4 new theme entries to the array (see spec for full palettes).

- [ ] **Step 3: Run type check** — `npm run build 2>&1 | Select-String "error TS"`
- [ ] **Step 4: Commit** — `git add src/ui-showcase/types.ts src/ui-showcase/mockData.ts && git commit -m "feat: add 4 new themes + structuralPrinciple"`

---

### Task 2: Update showcase.css — refine existing + add classes for 4 new themes

**Files:**
- Modify: `src/ui-showcase/showcase.css`

- [ ] **Step 1: Add Caveat & EB Garamond fonts** to the `@import` line
- [ ] **Step 2: Fix Swiss background** — change `.theme-swiss-brutalist` bg to `#ffffff`
- [ ] **Step 3: Add 4 new theme CSS blocks** after the neumorphic-slate block:
  - `.theme-list-first` + `.list-first-*` classes (section, item, link, nav, input)
  - `.theme-gamified` + `.game-*` classes (progress-ring, streak-banner, badge-grid, badge, pill-btn, card, set-token, xp-float)
  - `.theme-retro` + `.retro-*` classes (chalkboard, chalk-divider, tape-card, tape-piece, notebook-page, ink-blue, ink-black, index-card, tab-divider, cross-off, doodle-timer)
  - `.theme-bento-grid` + `.bento-*` classes (grid, tile, tile-lg/md/sm/wide/tall, tile-label, tile-value, tile-title, tile-subtle)
- [ ] **Step 4: Run build** — `npm run build 2>&1 | Select-String "error|warning"`
- [ ] **Step 5: Commit** — `git add src/ui-showcase/showcase.css && git commit -m "feat: add CSS classes for 4 new showcase themes"`

---

### Task 3: Rewrite MainScreen.tsx — refine 6 + add 4 new branches

**Files:**
- Modify: `src/ui-showcase/screens/MainScreen.tsx`

For each of the 10 themes, write a branch that follows the structural principle from the plan header. Each branch is an `if (themeId === '...') { return (...); }` block. The last branch (neumorphic) should remain the default `return`.

- [ ] **Clays Indigo** — Verify ticket-stub card, recessed search pill, horizontal avatar rail, clay range slider
- [ ] **Warm Latte** — Verify 60/40 split, serif headline, issue number, bezel dial, bottom sheet with stats
- [ ] **Stealth Dark** — Verify asymmetric grid, dot-matrix calendar, no card borders, huge white metrics
- [ ] **Tactical Amber** — Verify timeline stepper, frosted-glass stat tiles, amber pill CTA w/ badge
- [ ] **Swiss Brutalist** — Verify "MONDAY" header, day-accordions, square checkboxes, zero radius/shadows
- [ ] **Neumorphic Slate** — Verify single hero dial, recessed metric wells, orbited layout
- [ ] **List-First** — Date header, "Today's workout" line item, labeled sections as plain lists, hairlines, text-only nav, no cards/borders/shadows
- [ ] **Gamified** — SVG progress ring (68%), flame streak counter, 2x3 badge grid (some locked), bouncy pill CTA, saturated colors
- [ ] **Retro** — Dark green chalkboard bg, Caveat chalk header, chalk-drawn wavy dividers, taped-on cream index cards (rotate -1deg/+1.5deg, tape pseudo-element), chalk date
- [ ] **Bento** — CSS grid (4 cols, 120px auto-rows), mixed tile sizes, each tile self-contained widget, varied radii

- [ ] **Verify constraints** — Re-read each branch against hard constraint checklist
- [ ] **Type check** — `npx tsc --noEmit --project tsconfig.app.json 2>&1 | Select-String "MainScreen"`
- [ ] **Commit** — `git add src/ui-showcase/screens/MainScreen.tsx && git commit -m "feat: refine 6 + add 4 new theme branches to MainScreen"`

---

### Task 4: Rewrite CoachScreen.tsx — refine 6 + add 4 new branches

**Files:**
- Modify: `src/ui-showcase/screens/CoachScreen.tsx`

Each branch must implement a structurally distinct chat paradigm. All branches share the same `messages` state and `handleSend` logic — only the render differs.

- [ ] **Clays Indigo** — Sticky-note chat: peach sticky-notes (coach, slight rotation, indigo text), indigo sticky-notes (user, peach text), extruded avatar bubble, recessed quick-reply chips
- [ ] **Warm Latte** — Reader's letter column: coach serif body w/ drop-cap, user right-aligned sans "letters," topics list quick-replies
- [ ] **Stealth Dark** — Terminal log: monospace, `>` prefix coach, right-aligned user, timestamps, `> _` prompt quick-replies
- [ ] **Tactical Amber** — Mission briefing: frosted panels ("BRIEFING"/"REPORT" headers), amber pill quick-replies, glowing orb avatar
- [ ] **Swiss Brutalist** — Q&A broadsheet: full-width blocks w/ thick top border + "A:"/"Q:" labels, all-caps, square-bordered quick-replies
- [ ] **Neumorphic Slate** — Control panel: recessed coach (amber status light), extruded user, extruded push-button quick-replies, recessed "speaker" AI well
- [ ] **List-First** — Transcript: plain text lines ("Coach"/"You" + timestamp), no bubbles, comma-separated inline quick-replies
- [ ] **Gamified** — Cheerleader: rounded bubbles w/ emoji reactions, bright user bubbles, pill quick-replies w/ icons, mascot avatar (bounces "typing"), confetti on send
- [ ] **Retro** — Notebook page: cream ruled-paper bg, Caveat blue-ink coach, black-ink user, sticky-note quick-replies, doodled-star avatar
- [ ] **Bento** — Thread grid: varied tiles (Form Check, Nutrition, Recovery w/ message preview), active = large, quick-replies = small pill-tiles

- [ ] **Verify constraints**
- [ ] **Type check** — `npx tsc --noEmit --project tsconfig.app.json 2>&1 | Select-String "CoachScreen"`
- [ ] **Commit** — `git add src/ui-showcase/screens/CoachScreen.tsx && git commit -m "feat: refine 6 + add 4 new theme branches to CoachScreen"`

---

### Task 5: Rewrite ExercisesScreen.tsx — refine 6 + add 4 new branches

**Files:**
- Modify: `src/ui-showcase/screens/ExercisesScreen.tsx`

All branches share the same `filtered` data, `search`, `selectedCategory`, `categories` state, and `setSearch`/`setSelectedCategory` handlers. On select, call `onSelectExercise(ex)`.

- [ ] **Clays Indigo** — Category pill rail, exercise cards as mini ticket-stubs (perforated left edge, dotted divider)
- [ ] **Warm Latte** — Numbered magazine index (01, 02, …), serif names, small-caps category eyebrow, thin rules
- [ ] **Stealth Dark** — Dot-matrix table: tight grid rows, dot-cluster columns, inline expand, blinking-caret search
- [ ] **Tactical Amber** — Frosted-glass cards, amber category tag, icon-label rows, long-press amber outline
- [ ] **Swiss Brutalist** — Typeset table: full-width 2px-border rows, uppercase 10px col headers, tap-inverts
- [ ] **Neumorphic Slate** — List inside large recessed well, extruded cards, extruded toggle-buttons for filter
- [ ] **List-First** — Single column typeset index, tiny right-aligned category label, hairlines, thin-underline search, inline expand
- [ ] **Gamified** — Rounded collectible cards (big emoji icon, level badge, progress bar), locked grayed 🔒, emoji category bubbles
- [ ] **Retro** — 3x5 cream index cards (handwritten marker name, pencil details), stacked w/ offset edges, card-catalog tabbed-divider filter
- [ ] **Bento** — Widget grid: large tiles for favorites (w/ thumbnail), small tiles for others, category filter tiles row, grid reflows

- [ ] **Verify constraints**
- [ ] **Type check** — `npx tsc --noEmit --project tsconfig.app.json 2>&1 | Select-String "ExercisesScreen"`
- [ ] **Commit** — `git add src/ui-showcase/screens/ExercisesScreen.tsx && git commit -m "feat: refine 6 + add 4 new theme branches to ExercisesScreen"`

---

### Task 6: Rewrite GymSessionScreen.tsx — refine 6 + add 4 new branches

**Files:**
- Modify: `src/ui-showcase/screens/GymSessionScreen.tsx`

All branches share `activeExercises`, `onToggleSet`, `onAddSet`, `onOpenAddExercise`, `onFinishSession`, and the `seconds` timer state. Only how they are RENDERED differs.

- [ ] **Clays Indigo** — Punch-card timer header, exercise tickets, circular clay set tokens (tap to "punch"), floating clay FAB
- [ ] **Warm Latte** — Barista order slips: name in serif, sets as "shots" (○ ○ ○ ○), large bezel timer dial, attached pill finish
- [ ] **Stealth Dark** — Minimal set table: large-white-num rows, completed = ▮ / uncompleted = ▯, hairlines, huge timer
- [ ] **Tactical Amber** — Mission HUD: frosted panels, "ARMED"/"COMPLETE" set tags, timeline stepper, frosted timer pill
- [ ] **Swiss Brutalist** — Log sheet: full-width blocks (thick top border), 18px uppercase name, square-bordered set table, black-filled ✓
- [ ] **Neumorphic Slate** — Control console: extruded panels (recessed set-table, ember-glow completed), recessed timer well, extruded add-set
- [ ] **List-First** — Plain log: exercise section headers, indented set lines ("1. 80kg × 10  ✓"), active set underlined, monospace timer, "Done →" text-link
- [ ] **Gamified** — Game HUD: rounded cards w/ progress bar, set tokens 💪/○, "+10 XP" float animation, circular ring timer, streak counter, 🏆 bouncy pill
- [ ] **Retro** — Handwritten log: cream ruled-paper bg, blue-ink entries, tally-style sets, pen-stroke cross-off, doodled-stopwatch, "sign-off" finish
- [ ] **Bento** — Live widget board: bento grid (active = large w/ set table, completed = small dimmed, next = medium), wide timer tile, small "+" tile

- [ ] **Verify constraints**
- [ ] **Type check** — `npx tsc --noEmit --project tsconfig.app.json 2>&1 | Select-String "GymSession"`
- [ ] **Commit** — `git add src/ui-showcase/screens/GymSessionScreen.tsx && git commit -m "feat: refine 6 + add 4 new theme branches to GymSessionScreen"`

---

### Task 7: Update ShowcaseApp.tsx — display structuralPrinciple

**Files:**
- Modify: `src/ui-showcase/ShowcaseApp.tsx`

- [ ] **Step 1: Display structuralPrinciple** — After the tagline `<p>` in the render section, add:
```jsx
<p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0', fontStyle: 'italic', maxWidth: '500px' }}>
  Layout: {currentThemeConfig.structuralPrinciple}
</p>
```
- [ ] **Step 2: Dev server test** — `npm run dev`, click through all 10 themes × 4 screens, verify no blank screens or errors
- [ ] **Commit** — `git add src/ui-showcase/ShowcaseApp.tsx && git commit -m "feat: display structuralPrinciple in showcase"`

---

### Task 8: Final verification — build, lint, constraint audit

**Files:** All modified files

- [ ] **Step 1: Full build** — `npm run build` — must succeed with no errors
- [ ] **Step 2: Lint** — `npm run lint` — must pass (pre-existing warnings in showcase files are acceptable)
- [ ] **Step 3: Constraint audit** — Re-read each of the 10 themes × 4 screens = 40 branches against the hard constraint checklist in the plan header. Fix any violations.
- [ ] **Step 4: Final commit** — `git add -A && git commit -m "feat: complete showcase expansion — 10 structurally distinct themes"`

---

## Execution Order

```
Task 1 (types + mockData)
    │
    ▼
Task 2 (CSS)
    │
    ├──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼
Task 3      Task 4     Task 5     Task 6
(Main)     (Coach)    (Exercises) (Gym)
    │          │          │          │
    └──────────┴──────────┴──────────┘
                    │
                    ▼
            Task 7 (ShowcaseApp)
                    │
                    ▼
            Task 8 (Verify)
```

Tasks 3-6 can ALL run in parallel (different files). Task 7 runs after all screen tasks complete. Task 8 is the final gate.
