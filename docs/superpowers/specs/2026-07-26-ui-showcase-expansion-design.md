# UI Showcase Expansion & Structural Refinement

**Session ID:** 2026-07-26-ui-showcase-expansion
**Created:** 2026-07-26
**Status:** approved (pending spec review)

## Current Request

> Analyze the screenshots on ui-examples. Create different design proposals for each kind of design. Analyze them and create a few screens (main, coach, exercise list, active gym session) with different styles. Do not create the same style with different colors — I want different UI proposals.

Refined scope (after brainstorming):
- **Refine** the existing 6 themes in `src/ui-showcase/` so each is genuinely structurally distinct (different layouts, component shapes, information density, navigation patterns — not just color/type swaps).
- **Add** 4 new themes from the 8 proposed directions (C minimalist list-first, D gamified playful, E retro skeuomorphic, H bento grid).
- All 4 core screens (Main, Coach, Exercises, GymSession) implemented for every theme.
- AddExercise modal kept for the existing 6 only; not added for the 4 new themes.

## Context Files (Standards to Follow)

- `AGENTS.md` — project conventions (TypeScript quirks, architecture, testing)
- `src/ui-showcase/` — existing showcase code (the artifact being extended)

## Reference Files (Source Material)

- `ui-examples/bbae999223e85e11158c0208bb145087.jpg` → Theme 1 (Clay Indigo)
- `ui-examples/coffeejpg.jpg` → Theme 2 (Warm Latte)
- `ui-examples/dropset.jpg` → Theme 3 (Stealth Dark)
- `ui-examples/logisticjpg.jpg` → Theme 4 (Tactical Amber)
- `ui-examples/malendarjpg.jpg` → Theme 5 (Swiss Brutalist)
- `ui-examples/playerjpg.jpg` → Theme 6 (Neumorphic Slate)
- `src/ui-showcase/mockData.ts` — existing theme definitions
- `src/ui-showcase/types.ts` — existing type contracts
- `src/ui-showcase/showcase.css` — existing per-theme styling
- `src/ui-showcase/screens/*.tsx` — existing screen implementations

## External Docs Fetched

None — this is internal UI work using existing dependencies (React, lucide-react).

## Components

### The 10 themes (6 refined + 4 new)

Each theme has a **structural principle** (the layout DNA) and **hard constraints** (what it must NOT use, to prevent drift back to "same skeleton, different colors").

---

### Theme 1 — Clay Indigo & Peach (REFINED)

**Source:** `bbae999223e85e11158c0208bb145087.jpg`
**Structural principle:** Tactile ticket-stub + horizontal story rail. Information is presented as physical "tickets." Components are extruded/recessed (dual shadows), never flat.

**Hard constraints:**
- No flat surfaces — every surface is extruded or recessed (dual soft shadows)
- No borders — only shadows define edges
- Must use the ticket-stub metaphor (perforated/dotted dividers) on Main
- Must include a horizontal avatar/story rail on Main

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Perforated ticket-stub workout card (dotted divider, "TICKET #042"), recessed search pill, horizontal story-bubble rail of gym buddies, clay range-slider for target volume. |
| Coach | Chat as a stack of "sticky notes" — coach messages are peach sticky notes pinned at a slight angle, user messages are indigo sticky notes. Quick-reply chips are recessed clay pills. AI avatar is a large extruded clay bubble. |
| Exercises | Horizontal category rail (clay pills), exercise cards as mini ticket-stubs with a perforated left edge you "tear off" to add to a session. Dotted divider between name and muscle/equipment info. |
| GymSession | Active session as a punch-card — each set is a circular clay token you press to "punch" (complete). Exercises stacked as ticket-stubs. Floating clay FAB with extruded shadow adds sets. Timer is a recessed well with a peach progress ring. |

**Palette:** bg `#252243`, cardBg `#fce3b8`, accent `#ffb562`, text `#ffffff`

---

### Theme 2 — Warm Latte Minimal (REFINED)

**Source:** `coffeejpg.jpg`
**Structural principle:** Magazine spread + bottom sheet. Top half is a full-bleed editorial cover (serif headline, issue number), bottom half is a cream bottom sheet that slides up with stats. 60/40 vertical split.

**Hard constraints:**
- No sans-serif headlines — headlines must be serif
- No equal-column grids on Main — must use the 60/40 cover+sheet split
- Must frame content as a "magazine issue" (issue number, "flavour of the day")
- Must use a circular bezel dial motif

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | 60/40 split: top is full-bleed editorial cover (serif headline, issue #, "flavour of the day" card with circular bezel dial), bottom is cream bottom-sheet with progress stats in 2-col grid. |
| Coach | Chat as a reader's letter column — coach responses in serif body type like a magazine advice column, drop-cap on first message. User messages are right-aligned sans-serif "letters to the editor." Quick replies typeset as "this issue's topics" list. |
| Exercises | Exercises as a magazine index — numbered list (01, 02, 03…) with names in serif, category as small-caps eyebrow, thin rule between entries. Filter chips typeset as a "departments" row. |
| GymSession | Active session as a barista's order ticket — each exercise is a tall order-slip with name in serif, sets as "shots" (○ ○ ○ ○ that fill in). Timer is a large circular bezel dial. Finish button is an "attached pill" with circular badge. |

**Palette:** bg `#755439`, cardBg `#e6decb`, accent `#3e2918`, text `#3d2918`

---

### Theme 3 — Ultra Stealth Dark (REFINED)

**Source:** `dropset.jpg`
**Structural principle:** Asymmetric grid + dot-matrix calendar. High data density, zero chrome. No card borders — just negative space separating data zones.

**Hard constraints:**
- No card borders — only negative space separates zones
- No rounded corners on data containers
- No colored accents — only white/gray/black (the dot-matrix calendar is the visual centerpiece)
- Must use an asymmetric grid (not equal columns) on Main
- Must include the 3-month dot-matrix consistency calendar on Main

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Asymmetric 1.2fr/1fr grid (current routine + body weight), 3-month dot-matrix consistency calendar as centerpiece, huge white metric numbers, no borders. |
| Coach | Chat as a terminal log — monospace, coach messages dim white left-aligned with `>` prefix, user messages bright white right-aligned. No bubbles, no avatars — timestamped log. Quick replies are inline `> _` prompt suggestions. |
| Exercises | Exercises as a dot-matrix table — tight grid, each row an exercise, columns rendered as small dot clusters (filled vs unfilled). Tapping a row expands inline. Filter is a single search field with blinking-caret aesthetic. |
| GymSession | Active session as a minimal set table — each exercise a row with set numbers as large white numerals, weight/reps in dim gray, completed sets as filled square (▮) vs unfilled (▯). No cards — rows separated by hairlines. Timer is huge white number top-right. |

**Palette:** bg `#0d0d0f`, cardBg `#1c1c22`, accent `#ffffff`, text `#ffffff`

---

### Theme 4 — Tactical Black & Amber (REFINED)

**Source:** `logisticjpg.jpg`
**Structural principle:** Timeline tracker + frosted glass tiles. Components are translucent layers, not solid surfaces. Horizontal timeline stepper shows session progress.

**Hard constraints:**
- No opaque cards — everything is frosted glass (`backdrop-filter: blur`)
- No non-amber accent colors — amber is the only accent
- Must use the horizontal timeline stepper on Main and GymSession
- CTA buttons must be pill-shaped with an attached circular badge

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Horizontal timeline stepper (Warm Up → Bench → Triceps → Finish), frosted-glass stat tiles with blur, amber CTA pill with attached circular badge. |
| Coach | Chat as a mission briefing — coach messages are frosted-glass panels with amber "BRIEFING" header, user messages are amber-outlined panels labeled "REPORT." Quick replies are amber pill buttons like a command palette. AI avatar is a glowing amber orb. |
| Exercises | Exercises as tactical cards — frosted-glass cards with amber category tag in corner, equipment/difficulty as icon+label rows. Filter is a frosted search bar with amber placeholder. Long-press "targets" a card (amber outline). |
| GymSession | Active session as a mission HUD — frosted-glass exercise panels, each set a row with amber "ARMED" tag when active, "COMPLETE" when done. Timeline stepper persists at top. Timer is a frosted pill with amber digits. |

**Palette:** bg `#141519`, cardBg `#21242b`, accent `#ff6000`, text `#ffffff`

---

### Theme 5 — Swiss High-Contrast (REFINED)

**Source:** `malendarjpg.jpg`
**Structural principle:** Stacked day-accordions + square checklist. Huge uppercase Helvetica headers, thick 2px black borders, zero radius, zero shadows. Pure borders + type.

**Hard constraints:**
- No rounded corners — radius = 0 everywhere
- No shadows
- No lowercase headers — all uppercase
- Must use 2px black borders as the primary visual divider
- Must use square checkboxes (not circles, not rounded)

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Huge "MONDAY" header, vertical stack of full-width day rows with 2px black borders, active day expands into square-checkbox checklist, collapsed days show "+". |
| Coach | Chat as a Q&A broadsheet — coach messages are full-width blocks with thick top border and tiny "A:" label, user messages same with "Q:". All uppercase, all Helvetica, no bubbles. Quick replies are square-bordered buttons. |
| Exercises | Exercises as a typeset table — full-width rows with 2px black borders, columns NAME / CATEGORY / EQUIPMENT in uppercase 10px headers. Tapping inverts a row (black bg, white text). Filter is square-bordered category buttons, active = filled black. |
| GymSession | Active session as a log sheet — each exercise a full-width block with thick top border, name in 18px uppercase, sets as a square-bordered table (SET / WEIGHT / REPS / DONE columns). Completed sets get black-filled square with white ✓. |

**Palette:** bg `#1a1a1a`, cardBg `#262626`, accent `#ff3b00`, text `#f5f5f5`

---

### Theme 6 — Tactile Neumorphic Slate (REFINED)

**Source:** `playerjpg.jpg`
**Structural principle:** Single hero dial + recessed wells. Everything orbits one central tactile control per screen. Components are either extruded (raised, drop-shadow down-right) or recessed (inset, shadow up-left).

**Hard constraints:**
- Must have a single hero focal point per screen (one large dial/button/control)
- No flat surfaces — extruded or recessed only (dual shadows)
- No borders — only shadows define edges
- Must use the extruded/recessed binary consistently (controls extruded, displays recessed)

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Single large extruded circular dial (start workout) with glowing ember ring, flanked by recessed wells with metrics. Everything orbits the central dial. |
| Coach | Chat as a control panel — coach messages are recessed wells with glowing amber status light, user messages are extruded panels. Quick replies are a row of extruded push-buttons. AI is a single large recessed "speaker" well with animated ember pulse. |
| Exercises | Exercises as tactile cards on a well — the list sits inside one large recessed well, each exercise is an extruded card you press. Category filter is a row of extruded toggle-buttons (pressed = recessed). |
| GymSession | Active session as a control console — each exercise is an extruded panel with a recessed set-table inside. Completed sets light up with ember glow. Main timer is a large recessed well with glowing ring. Add-set is an extruded circular push-button. |

**Palette:** bg `#1e2228`, cardBg `#242930`, accent `#ff4f00`, text `#e1e7ed`

---

### Theme 7 — Minimalist List-First (NEW)

**Direction:** C (minimalist list-first, inspired by Things / Linear)
**Structural principle:** Pure typeset list, almost no chrome. No cards, no shadows, no borders — just type, hairline dividers, and space.

**Hard constraints:**
- No cards — content sits directly on the background
- No shadows
- No borders (only 1px hairline dividers between sections)
- No background fills behind content
- No icons in the nav bar — text-only navigation
- Generous whitespace is the primary visual separator

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Date header ("Monday, July 26"), single "Today's workout" line item with chevron, plain labeled sections (Recent, This Week) as lists with generous whitespace. Hairline dividers. Thin text-only bottom nav. |
| Coach | Chat as a transcript — coach and user messages are plain text lines with small label ("Coach" / "You") and timestamp, separated by whitespace. No bubbles. Quick replies are a comma-separated inline sentence: "Ask about form, Log today's session, or View progress." Tapping a phrase sends it. |
| Exercises | Exercises as a typeset index — single column of names in clean sans-serif, tiny right-aligned category label, chevron. Hairline dividers. Filter is a single search field with thin underline. Tapping expands a row inline (no modal, no card — just more text indented below). |
| GymSession | Active session as a plain log — each exercise is a section header (name), sets listed below as indented lines: "1. 80kg × 10  ✓", "2. 85kg × 8  ✓". Completed sets get a checkmark, active set underlined. Timer is a small monospace number top-right. Finish is a text link "Done →". No buttons, no cards. |

**Palette:** bg `#FAFAFA`, cardBg `#FFFFFF` (unused — no cards), accent `#3B82F6` (muted blue, used only for the active chevron and links), text `#111111`, secondary text `#999999`

---

### Theme 8 — Gamified Playful (NEW)

**Direction:** D (gamified, inspired by Duolingo)
**Structural principle:** Progress rings + streak banner + badge grid. Bright saturated colors, rounded everything, celebratory micro-interactions.

**Hard constraints:**
- No flat/static elements — everything has motion or a progress indicator
- No muted colors — saturated, bright palette
- Must use progress rings as a primary structural element
- Must include a streak counter on Main and GymSession
- Buttons must be large pill shapes with bounce animations
- Must use emoji as functional elements (not decorative)

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Large animated progress ring (weekly goal, 68% filled), flame streak counter ("🔥 12-day streak!"), grid of round achievement badges (some grayed/locked), big bouncy pill CTA ("Let's Go! 💪"). Bright saturated colors, rounded everything. |
| Coach | Chat as a cheerleader conversation — coach messages are rounded bubbles with emoji reactions floating off them (🎉, 💯), user messages are bright-colored bubbles. Quick replies are big rounded pill buttons with icons. AI avatar is a cartoon mascot that bounces when typing. Sending a message triggers a confetti burst. |
| Exercises | Exercises as collectible cards — each exercise is a rounded card with big emoji icon, "level" badge (Beginner = 🌱, Intermediate = ⭐, Advanced = 🔥), progress bar showing how often you've done it. Locked exercises grayed with 🔒. Filter is a horizontal scroll of round category bubbles with emoji. |
| GymSession | Active session as a game HUD — each exercise is a rounded card with progress bar, sets shown as row of round tokens (filled = 💪, empty = ○). Completing a set triggers "+10 XP" floating animation. Timer is a big circular ring counting down. Streak counter persists at top. Finish button is a huge bouncy pill ("Finish Strong! 🏆"). |

**Palette:** bg `#1E1B4B` (deep indigo), cardBg `#312E81` (vibrant indigo), accent `#A855F7` (purple), secondary accent `#22C55E` (green for success/streaks), tertiary accent `#F59E0B` (amber for XP/badges), text `#FFFFFF`

---

### Theme 9 — Retro Skeuomorphic (NEW)

**Direction:** E (retro skeuomorphic — chalkboard, notebook paper, tape)
**Structural principle:** Physical metaphors throughout. Every surface has a physical texture (chalkboard, notebook paper, tape, ink). No flat digital surfaces.

**Hard constraints:**
- No flat digital surfaces — everything has a physical texture
- Must use handwritten-style fonts for headers
- Must use physical metaphors: chalkboard (Main), notebook paper (Coach/GymSession), index cards (Exercises), tape, ink, chalk
- Dividers are chalk-drawn (wavy) or pen-stroked, never clean CSS borders
- Slight rotations on "taped" elements to feel hand-placed

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Chalkboard — dark green slate texture, handwritten-style chalk font for headers ("Today's Workout"), chalk-drawn dividers (wavy lines), workout items as "taped-on" index cards (slight rotation, piece of "tape" at top). Date written in chalk in corner. |
| Coach | Chat as a notebook page — cream lined-paper background, coach messages handwritten in blue ink, user messages in black ink, both following ruled lines. Quick replies are "sticky notes" stuck to page edge. AI avatar is a doodled star. |
| Exercises | Exercises as index cards in a stack — each exercise is a 3x5 index card (cream, rounded corners, slight shadow), name in handwritten marker, details in pencil. Cards stacked with slight offset so you see edges behind. Swipe to flip through. Filter is a "tabbed divider" like a card catalog. |
| GymSession | Active session as a handwritten log on lined paper — cream ruled-paper background, each exercise written in blue ink with sets as handwritten tally ("Bench Press  80×10  85×8  90×6"). Completing a set crosses it off with a single pen stroke. Timer is a doodled stopwatch in the margin. Finish is "signing off" the page. |

**Palette:** chalkboard bg `#1E3A2F` (dark green slate), chalk `#F5F5DC` (cream chalk), notebook paper `#FFF8E7` (cream), blue ink `#1E40AF`, black ink `#1A1A1A`, tape `rgba(255,255,200,0.6)`

---

### Theme 10 — Bento Grid (NEW)

**Direction:** H (bento grid, inspired by iOS 16 widget grids)
**Structural principle:** Varied-size widget tiles in a grid. Each tile is a self-contained widget with its own micro-layout. No vertical stacking of full-width sections.

**Hard constraints:**
- No vertical stacking of full-width sections — everything is a grid tile
- Tiles must be varied sizes (mix of 1x1, 2x1, 1x2, 2x2)
- Each tile must be a self-contained widget (own micro-layout, not just a card)
- Must use a true 2D grid (CSS grid), not flex column
- Tiles may have varied corner radii (subtle, not uniform)

**Screen treatments:**
| Screen | Structure |
|--------|-----------|
| Main | Bento grid: large 2x2 "today's workout" tile (with start button), small 1x1 body-weight tile, wide 2x1 weekly-volume sparkline tile, tall 1x2 streak tile, 1x1 recovery tile, 1x1 steps tile. Each tile a self-contained widget. Varied corner radii, subtle borders. |
| Coach | Chat as a bento of conversation threads — grid of varied-size tiles, each tile a conversation topic (Form Check, Nutrition, Recovery) with latest message preview. Tapping a tile opens that thread. Active thread is a large tile, others small. Quick replies are a row of small pill-tiles. |
| Exercises | Exercises as a widget grid — bento of exercise cards: large tiles for favorites (with thumbnail), small tiles for others (name + category). Filter is a row of small category tiles at top. Tapping a tile expands to full-screen. Grid reflows as you filter. |
| GymSession | Active session as a live widget board — bento grid where active exercise is a large tile (with set table inside), completed exercises are small dimmed tiles, next exercise is a medium tile. Timer is a wide tile across the top. Add-exercise is a small "+" tile. Grid updates as you progress. |

**Palette:** bg `#F4F4F6` (light neutral), tile backgrounds vary: `#FFFFFF`, `#EEF2FF` (indigo-tinted), `#FEF3C7` (amber-tinted), `#DCFCE7` (green-tinted), accent `#4F46E5` (indigo), text `#1F2937`, secondary text `#6B7280`. Tile corner radii vary by ±4px (e.g., 16px, 20px, 24px — not wildly different shapes, subtly varied).

---

## Constraints

### Technical constraints
- TypeScript 6.0 alpha, `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `erasableSyntaxOnly: true` — no runtime enums, decorators, or `namespace`
- `noUnusedLocals` / `noUnusedParameters` — both enabled
- `npm run build` (tsc -b && vite build) must pass
- `npm run lint` must pass
- Showcase is isolated from production app — do not touch `src/features/*`, `src/ui/*`, `src/App.tsx`, `src/ui/tokens.css`
- Showcase uses inline styles + `showcase.css`, not the app's token system

### Structural constraints (enforce theme distinctness)
Each theme has hard constraints (listed above) that prevent drift back to "same skeleton, different colors." These are enforced by code review against the constraint checklist, not by tooling.

### Scope constraints
- 10 themes total (6 refined + 4 new)
- 4 core screens per theme (Main, Coach, Exercises, GymSession)
- AddExercise modal: existing 6 only, no new themes
- No tests added (showcase is a visual tool, not tested code)
- No production app changes

## Exit Criteria

- [ ] All 10 themes defined in `THEME_CONFIGS` with `structuralPrinciple` field
- [ ] All 10 themes implemented across 4 screens (40 theme-screen branches)
- [ ] Each theme branch passes its hard-constraint checklist (no violations)
- [ ] `showcase.css` contains all classes needed by the 10 themes
- [ ] `npm run build` passes (typecheck + bundle)
- [ ] `npm run lint` passes
- [ ] `ShowcaseApp.tsx` displays the `structuralPrinciple` in the theme selector UI
- [ ] User visually inspects the showcase via `npm run dev` and confirms themes are structurally distinct
