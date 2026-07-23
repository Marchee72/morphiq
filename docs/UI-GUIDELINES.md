# MorphIQ — UI Design Guidelines (One UI 9)

> **Version:** 1.0 — July 22, 2026
> **Status:** Active — apply to every screen, component, and contribution
> **Base:** Samsung One UI 9 design language + Samsung Health app patterns
> **Reference files:** `src/ui/tokens.css`, `src/ui/ui.css`, `src/ui/primitives/`

---

## 1. Design Philosophy

MorphIQ follows the **Samsung One UI 9** design language, adapted for a health/fitness application.

### Core Principles

| Principle | Practical Meaning |
|-----------|-------------------|
| **Adaptive** | Theme adapts automatically to system `prefers-color-scheme` (light/dark). No manual toggle. |
| **Flat & Tonal** | Flat, tonal surfaces. No gradients, no glassmorphism, no elaborate shadows. |
| **Bouncy Spring** | Every transition uses `cubic-bezier(0.2, 0.9, 0.25, 1.2)` — a spring curve with slight overshoot. |
| **Card-First** | All information organized in cards with `border-radius: 22px`. |
| **Large Headers** | Screen titles are large (`34px`) and collapse on scroll. |
| **Pill Everything** | Buttons, chips, pills, nav bars — all use `border-radius: 999px` (pill). |
| **Floating Navigation** | Navigation bar floats over content, not stuck to the bottom. |
| **Minimal Depth** | Subtle, uniform shadows. Single elevation layer. No multi-level depth. |

### Accent Colors

- **Primary:** `#0381FE` (light) / `#4C9AFF` (dark) — Samsung Blue. Used exclusively for primary actions, links, and active state.
- **Secondary:** `#7C4DFF` / `#9E7BFF` — Violet. Only for charts/graphs with multiple series.
- **Success:** `#1A7F4B` / `#4BD88A` — Green. Only for positive state, confirmations.
- **Error:** `#C62828` / `#FF8A8A` — Red. Only for errors, deletion, danger.

---

## 2. Design Tokens System

All styles are defined in `src/ui/tokens.css` as CSS custom properties. **Never hardcode values** in components.

### Strict Rule

```css
/* CORRECT - uses tokens */
color: var(--ui-text-primary);
background: var(--ui-surface);
border-radius: var(--ui-radius-card);

/* INCORRECT - hardcoded values */
color: #101013;
background: #FFFFFF;
border-radius: 22px;
```

### Token Files

| File | Contents |
|------|----------|
| `src/ui/tokens.css` | All design tokens (colors, radii, spacing, typography, motion) |
| `src/ui/ui.css` | Base primitive styles (card, btn, chip, appbar, bottomnav, sheet) |
| `src/ui/primitives/*.tsx` | React components that consume these tokens |

---

## 3. Color Palette

### 3.1 Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--ui-bg` | `#F7F7F9` | Screen background, AppBar bg |
| `--ui-surface` | `#FFFFFF` | Cards, BottomNav, Sheets |
| `--ui-surface-dim` | `#EFEFF3` | Unselected chips, search bars |
| `--ui-primary` | `#0381FE` | Filled buttons, links, active nav, FAB |
| `--ui-on-primary` | `#FFFFFF` | Text/icons on primary |
| `--ui-tonal` | `#E5F1FF` | Selected chips, active pill, tonal buttons |
| `--ui-on-tonal` | `#0366D6` | Text/icons on tonal |
| `--ui-success` | `#1A7F4B` | Positive state, confirmations |
| `--ui-success-bg` | `#E3F2E9` | Success background |
| `--ui-error` | `#C62828` | Errors, delete, danger |
| `--ui-error-bg` | `#FDEAEA` | Error background |
| `--ui-text-primary` | `#101013` | Primary text |
| `--ui-text-secondary` | `#6E6E76` | Secondary text, labels, subtitles |
| `--ui-outline` | `#E4E4E9` | Subtle borders, dividers |
| `--ui-outline-strong` | `#D6D6DC` | More visible borders, handles |
| `--ui-scrim` | `rgba(16,16,19,0.45)` | Sheet/modal overlay |
| `--ui-chart-accent` | `#7C4DFF` | Charts with multiple series |

### 3.2 Dark Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--ui-bg` | `#101013` | Screen background |
| `--ui-surface` | `#1C1C21` | Cards, BottomNav |
| `--ui-surface-dim` | `#26262C` | Chips, search bars |
| `--ui-primary` | `#4C9AFF` | Primary actions |
| `--ui-on-primary` | `#06121F` | Text on primary |
| `--ui-tonal` | `rgba(76,154,255,0.18)` | Tonal containers |
| `--ui-on-tonal` | `#8AB8FF` | Text on tonal |
| `--ui-success` | `#4BD88A` | Positive state |
| `--ui-error` | `#FF8A8A` | Errors |
| `--ui-text-primary` | `#F2F2F5` | Primary text |
| `--ui-text-secondary` | `#9A9AA2` | Secondary text |
| `--ui-outline` | `#2C2C33` | Subtle borders |
| `--ui-scrim` | `rgba(0,0,0,0.6)` | Overlays |

### 3.3 Color Rules

1. **Never use colors outside the palette.** If you need a color, ask if it should be a new token.
2. **Success = green, Error = red, Primary = blue.** Do not use other colors for these purposes.
3. **Chart color may be violet** (`--ui-chart-accent`) but only for secondary data series.
4. **Active nav color is `--ui-primary`** — never use another color for active state.
5. **Tonal (`--ui-tonal`) is the background for "selected" elements** — chips, pills, tonal buttons.

---

## 4. Typography

### 4.1 Font

- **Family:** Manrope (Google Fonts)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)
- **Fallback:** `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **Token:** `--ui-font`

### 4.2 Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--ui-text-display` | `34px` | Screen title (AppBar expanded) |
| `--ui-text-title` | `22px` | Collapsed title, section headers |
| `--ui-text-headline` | `17px` | Card titles, sheet titles |
| `--ui-text-body` | `15px` | Body text, buttons, inputs |
| `--ui-text-label` | `12px` | Labels, overlines, subtitles |

### 4.3 Typography Rules

1. **Screen titles use `800` weight** with `letter-spacing: -1px` at display size.
2. **Labels use `700` weight** with `text-transform: uppercase` and `letter-spacing: 0.06em`.
3. **Body text uses `600` weight** — not `400` nor `500` for main content.
4. **Never use `font-style: italic`** — One UI does not use italics.
5. **Never use `text-decoration: underline`** on non-link text — use primary color for links.
6. **Large numbers** (metrics, scores) use `800` weight with `letter-spacing: -0.5px` to `-1px`.

### 4.4 Label Pattern

```jsx
<span style={{
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--ui-text-secondary)'
}}>
  LABEL
</span>
```

---

## 5. Border Radii and Shapes

### 5.1 Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ui-radius-sm` | `10px` | Small elements (icon containers in lists) |
| `--ui-radius-md` | `16px` | Inputs, date pickers |
| `--ui-radius-card` | `22px` | Main cards, MetricTiles |
| `--ui-radius-sheet` | `28px` | Bottom sheets (top corners only) |
| `--ui-radius-pill` | `999px` | Buttons, chips, nav bar, FAB, badges, pills |

### 5.2 Radius Rules

1. **Cards always use `22px`.** Never `16px` or `12px` for cards.
2. **Buttons, chips, nav items use `999px`** (pill). Always.
3. **Bottom sheets use `28px`** on top corners.
4. **Inputs use `16px`.**
5. **Never use `0px` or `4px`** — One UI has no sharp corners or minimal radii.
6. **Do not apply border-radius to `<p>` or `<span>`** — only to containers.

### 5.3 Shapes

- **No decorative shapes** (circles, diamonds, etc.) — everything is rectangular with radii.
- **No background patterns** — flat, clean surfaces.
- **No decorative borders** — only subtle outlines when functional.

---

## 6. Spacing

### 6.1 Spacing Tokens

| Token | Value |
|-------|-------|
| `--ui-space-1` | `4px` |
| `--ui-space-2` | `8px` |
| `--ui-space-3` | `12px` |
| `--ui-space-4` | `16px` |
| `--ui-space-5` | `20px` |
| `--ui-space-6` | `24px` |

### 6.2 Spacing Rules

1. **Gap between cards:** `14px` in Home, `16px` in Gym, `12px` in Exercises.
2. **Horizontal padding of screens:** `16px` (always).
3. **Bottom padding of screens:** `120px-140px` to leave space for the floating nav.
4. **Internal padding of cards:** `16px` (use `--ui-space-4`).
5. **Gap between grid items:** `10px`.
6. **Gap between internal card elements:** `6px-8px`.
7. **AppBar padding:** `20px 20px 12px` (collapses to `12px` top).
8. **Floating nav position:** `16px` from sides, `12px` from bottom.
9. **FAB position:** `20px` from right, `84px` from bottom (above nav).

---

## 7. Motion and Animation

### 7.1 Motion Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ui-motion` | `0.3s cubic-bezier(0.2, 0.9, 0.25, 1.2)` | Standard transitions |
| `--ui-motion-fast` | `0.18s cubic-bezier(0.2, 0.9, 0.25, 1.2)` | Fast transitions (hover, press) |

### 7.2 The Spring Curve

```
cubic-bezier(0.2, 0.9, 0.25, 1.2)
```

This curve has a slight **overshoot** (value exceeds target then returns), creating a "spring" effect. It is the visual signature of One UI.

### 7.3 Defined Animations

| Animation | Keyframe | Duration | Usage |
|-----------|----------|----------|-------|
| `ui-fade-in` | `opacity: 0 to 1` | 0.2s | Scrim, overlays |
| `ui-sheet-up` | `translateY(24px) + opacity to normal` | `var(--ui-motion)` | Sheets, dialogs, menus |
| `ui-nav-pop` | `translateY(12px) + scale(0.96) + opacity to normal` | 0.35s spring | Nav bar on mount |

### 7.4 Animation Rules

1. **Always use `var(--ui-motion)` or `var(--ui-motion-fast)`** — never define custom durations.
2. **Never use `linear` or `ease-in-out`** — always spring (`cubic-bezier(0.2, 0.9, 0.25, 1.2)`).
3. **Buttons use `scale(0.97)` on press** — visual haptic feedback.
4. **Icon buttons use `scale(0.94)` on press** — more aggressive because smaller.
5. **Chips use `scale(0.96)` on press.**
6. **Nav items use `scale(0.92)` on press.**
7. **No entrance animations on full screens** — only on sheets, modals, and nav bar.
8. **No transition animations between tabs** — content changes instantly.
9. **Never use `transition` on non-visible properties** (like `display` or `visibility`).

### 7.5 Button Transition Example

```css
.ui-btn {
  transition: transform var(--ui-motion-fast), opacity var(--ui-motion-fast),
              background-color var(--ui-motion-fast);
}
.ui-btn:active:not(:disabled) {
  transform: scale(0.97);
  opacity: 0.9;
}
```

---

## 8. UI Primitive Components

All components live in `src/ui/primitives/` and consume tokens from `tokens.css`.

### 8.1 Card (`Card.tsx`)

- **CSS class:** `.ui-card`
- **Background:** `var(--ui-surface)`
- **Border-radius:** `var(--ui-radius-card)` (22px)
- **Padding:** `var(--ui-space-4)` (16px)
- **Shadow:** `var(--ui-card-shadow)` — subtle, uniform
- **No border** — shadow defines elevation
- **Usage:** Main content container. All grouped information goes in a card.

```jsx
<Card>
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    {/* content */}
  </div>
</Card>
```

### 8.2 Button (`Button.tsx`)

- **Variants:** `filled`, `tonal`, `outlined`
- **Border-radius:** `var(--ui-radius-pill)` (999px) — always pill
- **Min-height:** `48px`
- **Font:** `var(--ui-font)`, `var(--ui-text-body)` (15px), `700` weight
- **Transitions:** `transform`, `opacity`, `background-color` with `var(--ui-motion-fast)`

| Variant | Background | Color | Border |
|---------|------------|-------|--------|
| `filled` | `var(--ui-primary)` | `var(--ui-on-primary)` | none |
| `tonal` | `var(--ui-tonal)` | `var(--ui-on-tonal)` | none |
| `outlined` | transparent | `var(--ui-primary)` | `1.5px solid var(--ui-outline-strong)` |

**Rules:**
- **filled** = primary action (max one per screen)
- **tonal** = secondary action
- **outlined** = tertiary / cancel
- **Never use custom variants** — only these three
- **Disabled button has `opacity: 0.45`**

### 8.3 Icon Button (`.ui-icon-btn`)

- **CSS class:** `.ui-icon-btn`
- **Size:** `44px x 44px`
- **Background:** transparent
- **Color:** `var(--ui-text-secondary)` (changes to `var(--ui-text-primary)` on hover)
- **Border-radius:** pill
- **Usage:** AppBar actions (settings, back, search)

### 8.4 Chip (`Chip.tsx`)

- **CSS class:** `.ui-chip`
- **Border-radius:** pill
- **Padding:** `8px 16px`
- **Font:** `13px`, `700` weight
- **Unselected background:** `var(--ui-surface-dim)`
- **Selected background:** `var(--ui-text-primary)` with color `var(--ui-bg)` (inverted)
- **Usage:** Filters, state toggles, tags

**Rules:**
- **Never use chips for navigation** — use bottom nav or category toolbar
- **Filter chips displayed in `flex-wrap`** — no horizontal scroll
- **Selected chip is dark (inverted)**, does not use primary color

### 8.5 AppBar (`AppBar.tsx`)

- **CSS class:** `.ui-appbar`
- **Position:** `sticky` at top
- **Z-index:** 40
- **Display title:** `34px`, `800` weight, `letter-spacing: -1px`
- **Collapsed title:** `22px`, `800` weight
- **Collapse threshold:** `24px` of scroll
- **Overline:** `13px`, `600` weight, `var(--ui-text-secondary)`
- **Padding:** `20px 20px 12px` (expanded) / `12px` (collapsed)

**Rules:**
- **Each screen has its own AppBar**
- **Overline shows context** (greeting + date on Home, "Workout Hub" on Gym)
- **Actions go on the right** (icon buttons)
- **No "back" icon in AppBar** — navigation is by tabs, not stack

### 8.6 Bottom Navigation (`BottomNav.tsx`)

- **CSS class:** `.ui-bottomnav`
- **Position:** `fixed`, floating (`16px` sides, `12px` bottom)
- **Background:** `var(--ui-surface)`
- **Border:** `1px solid var(--ui-outline)` — defines edge against content
- **Border-radius:** pill
- **Shadow:** Double layer `0 6px 24px` + `0 2px 8px` — high elevation
- **Z-index:** 60
- **Entry animation:** `ui-nav-pop` (spring, 0.35s)
- **Items:** 4 maximum (Home, Gym, Exercises, Coach)
- **Icons:** `size={22}`, inline in pill
- **Active state:** Label changes to `var(--ui-primary)`, pill background `var(--ui-tonal)` with blue glow shadow

**Rules:**
- **Always visible** — never hidden on scroll
- **Always 4 items** — never add a fifth
- **Active item has icon + label** — never icon only
- **Content padding-bottom must be `120px+`** to not be covered by nav

### 8.7 Sheet / Bottom Sheet (`Sheet.tsx`)

- **Overlay:** `var(--ui-scrim)` with `ui-fade-in`
- **Sheet:** `var(--ui-surface)`, `border-radius: 28px 28px 0 0`
- **Handle:** `36px x 4px`, `var(--ui-outline-strong)`
- **Drag to dismiss:** `> 90px` of drag closes the sheet
- **Z-index:** 80
- **Max-height:** `88vh`
- **Animation:** `ui-sheet-up` (spring)

**Rules:**
- **Always bottom sheet** — no center modals (except ConfirmDialog)
- **Handle is mandatory** — indicates it can be dragged
- **Title goes in the handle area** — not inside content
- **Escape key closes** the sheet
- **Body overflow is blocked** when sheet is open

### 8.8 Confirm Dialog (`ConfirmDialog.tsx`)

- **The only center modal** — all others are bottom sheets
- **Background:** `var(--ui-surface)`
- **Border:** `1px solid var(--ui-outline)`
- **Shadow:** `0 12px 36px rgba(0,0,0,0.5)`
- **Border-radius:** `26px`
- **Z-index:** 120
- **Confirm variants:** `primary` (filled) / `danger` (error bg)

**Rules:**
- **Use only for destructive actions** (delete account, erase data)
- **Never for normal confirmations** — use sheets or inline feedback
- **Always has Cancel + Confirm** — never Confirm only

### 8.9 Ring (`Ring.tsx`)

- **SVG-based** progress ring
- **Stroke:** `var(--ui-surface-dim)` (track) + `var(--ui-primary)` (fill)
- **StrokeLinecap:** `round`
- **Usage:** Energy Score, progress indicators

### 8.10 MetricTile (`MetricTile.tsx`)

- **Layout:** Flex column, `gap: 6`
- **Background:** `var(--ui-surface)`
- **Border-radius:** `var(--ui-radius-card)` (22px)
- **Padding:** `14px 16px`
- **Label:** `11px`, `700`, uppercase, `letter-spacing: 0.06em`
- **Value:** `24px`, `800`, `letter-spacing: -0.5px`
- **Delta:** `11px`, `700`, color by tone (positive/negative/neutral)

**Rules:**
- **Always in 2-column grid** (`gridTemplateColumns: 'repeat(2, 1fr)'`)
- **Grid gap:** `10px`
- **No gradients, no glow** — flat tonal
- **Optionally clickable** (renders `<button>` if it has `onClick`)

### 8.11 CategoryToolbar (`CategoryToolbar.tsx`)

- **Container:** `var(--ui-surface-dim)`, pill, `padding: 4`
- **Tabs:** pill buttons inside container
- **Active tab:** `var(--ui-surface)` background with `var(--ui-card-shadow)`
- **Inactive tab:** transparent background
- **Icon + label** in each tab
- **Usage:** Category selector on Home (Activity/Nutrition/Body)

**Rules:**
- **Always above content** — below AppBar
- **Maximum 4 tabs** — ideally 3
- **Tabs have icon + text** — never just one

### 8.12 QuickAdd (`QuickAdd.tsx`)

- **FAB button:** `56px x 56px`, `var(--ui-primary)`, pill
- **Shadow:** `0 4px 14px rgba(3, 129, 254, 0.4)` — blue glow
- **Position:** Fixed, bottom-right, above nav (`84px` from bottom)
- **On open:** Scrim + vertical action menu + 45-degree icon rotation
- **Actions:** Pills with tonal icon + label
- **Z-index:** 71 (above nav's 60)

**Rules:**
- **Home screen only** — not on other screens
- **Maximum 3 actions** — no more
- **FAB is always visible** — never hidden on scroll

### 8.13 EmptyState (`EmptyState.tsx`)

- **Icon container:** `56px x 56px`, `border-radius: 20px`, `var(--ui-tonal)`
- **Title:** `var(--ui-text-body)`, `700` weight
- **Message:** `var(--ui-text-secondary)`
- **Usage:** When there is no data (no workouts, no food logs, etc.)

---

## 9. Layout and Screen Structure

### 9.1 Base Screen Structure

```jsx
<>
  <AppBar title="..." overline="..." actions={...} />
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 16px 140px' }}>
    {/* Cards and content */}
  </div>
</>
```

### 9.2 Layout Rules

1. **Horizontal padding:** `16px` always (AppBar uses `20px`).
2. **Bottom padding:** `120px-140px` for floating nav space.
3. **Flex direction:** `column` — never `row` for main layout.
4. **Gap between cards:** `14px` (Home), `16px` (Gym), `12px` (Exercises).
5. **Content scrolls** — nav and AppBar are fixed/sticky.
6. **No horizontal scroll** in main layout — only for PR cards and limited horizontal content.

### 9.3 Metric Grid

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
  <MetricTile ... />
  <MetricTile ... />
</div>
```

- **Always 2 columns** — not 3, not 4
- **Gap:** `10px`

### 9.4 Section Headers

```jsx
<div style={{
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--ui-text-secondary)',
  marginBottom: 8,
}}>
  SECTION TITLE
</div>
```

- **Always uppercase, 12px, 700 weight, secondary color**
- **Margin bottom:** `8px`

---

## 10. Screen-Specific Patterns

### 10.1 Home Screen

**Structure:**
1. AppBar ("Today" + greeting + date + settings gear)
2. CategoryToolbar (Activity / Nutrition / Body)
3. EnergyScore card (always visible at top)
4. Content by active category:
   - **Activity:** 2 MetricTiles (Gym this week + Workouts 7d) + SyncCard
   - **Nutrition:** 2 MetricTiles (Calories + Protein) + FoodTodayCard
   - **Body:** MetricHeroCard (weight) + 2 MetricTiles (Body fat + Muscle) + TrendCard
5. QuickAdd FAB (bottom-right)

**Home Rules:**
- **EnergyScore always visible** — does not depend on category
- **CategoryToolbar below AppBar** — not inside cards
- **MetricTiles in 2-column grid** — never solo
- **SyncCard only in Activity**
- **TrendCard only in Body**
- **FoodTodayCard only in Nutrition**

### 10.2 Gym Screen

**Structure:**
1. AppBar ("Gym" + "Workout Hub & Tracking")
2. Hero Card (Start Session / Active Session status)
3. Weekly Stats Grid (3 columns: Workouts, Duration, Burn)
4. Personal Records (horizontal scroll cards)
5. Workout History section (filter chips + date search + list)

**Gym Rules:**
- **Hero card has status pill** (colored badge "In progress" / "Live Workout Tracker")
- **Weekly stats are 3 columns** — not 2 nor 4
- **PR cards are horizontal** (`overflowX: auto`, `flexShrink: 0`, `minWidth: 140`)
- **Filter chips in `flex-wrap`** — no horizontal scroll
- **Date search has Calendar icon** + clear button

### 10.3 Exercise Library Screen

**Structure:**
1. AppBar ("Exercises" + count)
2. Search bar (pill, `var(--ui-surface-dim)` bg) + Filter button (with badge)
3. Active filter chips (inline, only when filtering)
4. Result count
5. Favorites section (only when not filtering)
6. Main exercise list (single column, `gap: 8`)
7. "Show more" button
8. Filter bottom sheet
9. Exercise detail bottom sheet

**Exercise Rules:**
- **Search bar is pill** — not rectangular
- **Filter button has badge** with active filter count
- **Filters go in bottom sheet** — not inline
- **Exercise cards are single column** — not grid
- **"Show more" is a text button** — not a chip
- **Favorites appear only when no active filters**
- **Loading state:** Spinner with dumbbell icon + "Loading exercises..."

### 10.4 Coach Screen (Coming Soon)

- **Placeholder** with `Sparkles` icon and descriptive text
- **No functional content** yet

### 10.5 Settings Screen

- **Accessible from gear icon in AppBar on Home**
- **Not a tab** — renders when `activeTab === 'settings'`
- **Uses ListItem components** for each option

---

## 11. Navigation

### 11.1 Navigation Model

- **Bottom Navigation** with 4 fixed tabs: Home, Gym, Exercises, Coach
- **Settings** behind gear icon in AppBar on Home
- **No navigation stack** — each tab is an independent screen
- **No "back" button** — navigation is by tabs, not hierarchical

### 11.2 Tab Transitions

- **No transition animation** — content changes instantly
- **Scroll resets** on tab change
- **Tab state is preserved** (useState in each screen)

### 11.3 Floating Workout Bar

- **Appears when there is an active session** — shown above nav
- **Position:** Fixed, bottom, above nav
- **Shows:** Workout type + duration + resume button

### 11.4 Navigation Rules

1. **Never add a fifth tab** — 4 is the maximum
2. **Never use navigation stacks** — keep flat
3. **Active tab always has label + icon**
4. **Nav bar is never hidden** — always visible
5. **Settings is not a tab** — always behind an icon

---

## 12. Iconography

### 12.1 Library

- **lucide-react** — the only icon library
- **Sizes:** `16px` (tiles, chips), `18px` (buttons), `22px` (nav items), `26px` (empty states)

### 12.2 Icon Rules

1. **Always use lucide-react** — no FontAwesome, no Material Icons, no custom SVGs
2. **Icons are monochromatic** — inherit parent color
3. **No decorative icons** — every icon has functional purpose
4. **Nav icons are `size={22}`** — not larger
5. **Tile icons are `size={16}`** — consistent
6. **Empty state icons are `size={36-40}`** with `opacity: 0.4-0.5`

### 12.3 Common Icons

| Icon | Lucide name | Usage |
|------|-------------|-------|
| Home/Dashboard | `LayoutDashboard` | Home tab |
| Dumbbell | `Dumbbell` | Gym tab, exercises, workouts |
| Library | `LibraryBig` | Exercises tab |
| Sparkles | `Sparkles` | Coach tab |
| Settings | `Settings` | AppBar actions |
| Search | `Search` | Search bars |
| Filter | `SlidersHorizontal` | Filter buttons |
| Heart | `Heart` | Favorites (fill when active) |
| Trophy | `Trophy` | Personal records |
| Play | `Play` | Start/resume workout |
| Scale | `Scale` | Weight, body |
| Flame | `Flame` | Calories |
| Beef | `Beef` | Protein |
| Activity | `Activity` | Body fat, general activity |
| Calendar | `Calendar` | Date-related |
| Plus | `Plus` | FAB, add actions |
| X | `X` | Clear, close |

---

## 13. Dark Mode

### 13.1 Activation

- **Automatic** — follows system `prefers-color-scheme`
- **No manual toggle** — user controls from OS settings
- **Transition:** instantaneous (no animation)

### 13.2 Differences from Light

| Element | Light | Dark |
|---------|-------|------|
| Background | `#F7F7F9` | `#101013` |
| Surface | `#FFFFFF` | `#1C1C21` |
| Primary | `#0381FE` | `#4C9AFF` |
| Tonal | `#E5F1FF` | `rgba(76,154,255,0.18)` |
| Text Primary | `#101013` | `#F2F2F5` |
| Text Secondary | `#6E6E76` | `#9A9AA2` |
| Outline | `#E4E4E9` | `#2C2C33` |
| Shadow | `rgba(16,16,19,0.06)` | `rgba(0,0,0,0.4)` |

### 13.3 Dark Mode Rules

1. **Never hardcode light mode colors** — always use tokens
2. **Shadows in dark mode are more pronounced** (`rgba(0,0,0,0.4)`)
3. **Scrim is darker** (`rgba(0,0,0,0.6)`)
4. **Success/error colors adapt** — brighter in dark
5. **Primary lightens** — from `#0381FE` to `#4C9AFF` for better contrast

---

## 14. Behavioral Rules

### 14.1 Dates

- **Format:** `dd/mm/yyyy` — always
- **Implementation:** `String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth()+1).padStart(2, '0') + '/' + d.getFullYear()`
- **Never use:** `mm/dd/yyyy`, `yyyy-mm-dd`, `January 1, 2026`, or any other format
- **Exception:** DB schema uses ISO — but UI always displays dd/mm/yyyy

### 14.2 Numbers

- **Weight:** `XX.X kg` (one decimal)
- **Percentages:** `XX%` (no decimal)
- **Calories:** `XXXX kcal` (no decimal)
- **Protein:** `XXX g` (no decimal)
- **Scores:** `XX` (no decimal)

### 14.3 Text

- **Language:** English — no localization
- **Tone:** Direct, informative, no emojis
- **Labels:** Always uppercase with letter-spacing
- **Empty states:** Always have icon + title + message + optional action

### 14.4 Loading States

- **Exercise Library:** Spinner with dumbbell + "Loading exercises..."
- **Sync:** Button changes to "Syncing..." with spinner
- **No skeleton screens** — only spinners or messages
- **No shimmer effects**

### 14.5 Empty States

- **Always use EmptyState component** — not loose text
- **Icon in tonal container** (56px, border-radius 20px)
- **Title + message** — always
- **Optional action** (button)

### 14.6 Errors

- **Inline feedback** — no custom alerts or toasts
- **Error bg is `var(--ui-error-bg)`** with text `var(--ui-error)`
- **Form errors go below the field**
- **System errors go in the card/empty state**

### 14.7 Scroll

- **Content scrolls** — nav and AppBar are fixed
- **AppBar collapses** to `22px` after `24px` of scroll
- **No "scroll to top" button** — user taps the tab
- **No infinite scroll** — only "Show more" button (exercises)

---

## 15. What NOT to Do

### Absolutely Prohibited

1. **Do not use glassmorphism** — no `backdrop-filter`, no blur, no transparency
2. **Do not use gradients** — not on cards, backgrounds, or buttons
3. **Do not use elaborate shadows** — only `var(--ui-card-shadow)`
4. **Do not use colors outside the palette** — always tokens
5. **Do not hardcode values** — always use tokens from `tokens.css`
6. **Do not use `font-style: italic`** anywhere
7. **Do not use `text-decoration: underline`** except on links
8. **Do not use border-radius < 10px** — One UI has no sharp corners
9. **Do not use linear animations** — always spring
10. **Do not use `ease-in-out`** — always `cubic-bezier(0.2, 0.9, 0.25, 1.2)`
11. **Do not add a fifth navigation tab**
12. **Do not use navigation stacks** — keep flat
13. **Do not use center modals** — except ConfirmDialog for destructive actions
14. **Do not use skeleton screens** — only spinners
15. **Do not use shimmer effects**
16. **Do not use emojis** in the UI (not in labels, empty states, or alerts)
17. **Do not use custom `box-shadow`** — only tokens
18. **Do not use decorative `border`** — only `var(--ui-outline)` when functional
19. **Do not use `<p>` for layout** — use divs with flex/grid
20. **Do not use `<br>` for spacing** — use gap/margin/padding

### Do Not Do in Components

21. **Do not create new UI primitives** without adding them to `src/ui/primitives/`
22. **Do not make inline styles with raw values** — always tokens or variables
23. **Do not use `className` with hardcoded strings** — use CSS modules or tokens
24. **Do not duplicate styles** — if repeated, it is a component or token
25. **Do not use `!important`** — never
26. **Do not use `position: absolute`** for general layout — only for overlays and FABs
27. **Do not use `overflow: hidden`** without reason — may clip content
28. **Do not use `min-width: 0`** without reason — only for flex children that need to shrink

---

## 16. What TO Do

### Always

1. **Always use tokens** from `tokens.css` for colors, radii, spacing, motion
2. **Always use Manrope** as the font
3. **Always use pill shape** for buttons, chips, nav items
4. **Always use `22px` radius** for cards
5. **Always use spring animation** `cubic-bezier(0.2, 0.9, 0.25, 1.2)`
6. **Always use `flex-direction: column`** for main layouts
7. **Always use `gap`** instead of margin for sibling separation
8. **Always use `padStart(2, '0')`** for dates (dd/mm/yyyy)
9. **Always use EmptyState** for empty states
10. **Always use uppercase labels** with `letter-spacing: 0.06em`
11. **Always set `padding-bottom: 120px+`** on screens with floating nav
12. **Always make AppBar sticky** at top
13. **Always collapse AppBar** on scroll
14. **Always use lucide-react** for icons
15. **Always use Button variants** (filled/tonal/outlined) — not custom

### In Components

16. **Always export interfaces** for component props
17. **Always use `React.FC`** for functional components
18. **Always set `type="button"`** on buttons that are not submit
19. **Always set `aria-label`** on icon buttons and FABs
20. **Always use `aria-pressed`** on selectable chips
21. **Always use `aria-current="page"`** on active nav item
22. **Always set `role="dialog"` and `aria-modal="true"`** on sheets
23. **Always block body overflow** when a sheet is open
24. **Always close sheets with Escape key**
25. **Always use `e.stopPropagation()`** on clicks inside overlays

### In Grids and Layouts

26. **Always use `gridTemplateColumns: 'repeat(2, 1fr)'`** for MetricTiles
27. **Always use `gap: 10px`** in MetricTile grids
28. **Always use `flex-wrap: wrap`** for filter chips — not scroll
29. **Always use `overflowX: auto`** only for PR cards and limited horizontal content
30. **Always set `flexShrink: 0`** on items that must not compress

### In Screen Patterns

31. **Always have AppBar** on every screen
32. **Always have bottom padding** for floating nav
33. **Always have empty state** when no data exists
34. **Always have loading state** for async data
35. **Always have favorites section** in Exercise Library (when not filtering)
36. **Always show EnergyScore** on Home
37. **Always show CategoryToolbar** on Home below AppBar
38. **Always show QuickAdd FAB** on Home screen
39. **Always use filter bottom sheet** in Exercise Library — not inline filters
40. **Always show status pill** on Gym hero card

---

## Appendix A: File Reference

| File | Purpose |
|------|---------|
| `src/ui/tokens.css` | Design tokens (colors, radii, spacing, motion) |
| `src/ui/ui.css` | Base primitive styles (card, btn, chip, appbar, nav, sheet) |
| `src/ui/primitives/AppBar.tsx` | Sticky AppBar with collapse |
| `src/ui/primitives/BottomNav.tsx` | Floating nav with 4 tabs |
| `src/ui/primitives/Button.tsx` | Buttons (filled/tonal/outlined) |
| `src/ui/primitives/Card.tsx` | Card container |
| `src/ui/primitives/Chip.tsx` | Filter/tag chips |
| `src/ui/primitives/Sheet.tsx` | Bottom sheet with drag-to-dismiss |
| `src/ui/primitives/Ring.tsx` | SVG progress ring |
| `src/ui/primitives/MetricTile.tsx` | Small metric tile |
| `src/ui/primitives/QuickAdd.tsx` | FAB with action menu |
| `src/ui/primitives/CategoryToolbar.tsx` | Segmented pill control |
| `src/ui/primitives/EmptyState.tsx` | Empty state with icon |
| `src/ui/primitives/ListItem.tsx` | List item for settings |
| `src/ui/primitives/ConfirmDialog.tsx` | Confirmation dialog (only modal) |
| `src/features/home/HomeScreen.tsx` | Main screen |
| `src/features/home/EnergyScore.tsx` | AI Energy Score card |
| `src/features/home/MetricHeroCard.tsx` | Weight hero card |
| `src/features/home/TrendCard.tsx` | Trend chart (Recharts) |
| `src/features/home/FoodTodayCard.tsx` | Daily food card |
| `src/features/home/SyncCard.tsx` | Samsung Health sync card |
| `src/features/gym/GymScreen.tsx` | Gym screen |
| `src/features/exercises/ExerciseLibraryScreen.tsx` | Exercise library screen |
| `src/App.tsx` | Main shell with tabs |

---

## Appendix B: Checklist Before Adding a New Screen

- [ ] Has AppBar with title and overline?
- [ ] Has bottom padding for floating nav (`120px+`)?
- [ ] Uses tokens from `tokens.css` for all colors/radii/spacing?
- [ ] Cards use `22px` radius?
- [ ] Buttons are pill (`999px`)?
- [ ] Labels are uppercase with `letter-spacing: 0.06em`?
- [ ] Has empty state when no data?
- [ ] Has loading state when loading?
- [ ] Dates are `dd/mm/yyyy`?
- [ ] No glassmorphism, gradients, or elaborate shadows?
- [ ] No colors outside the palette?
- [ ] No `font-style: italic` or `text-decoration: underline`?
- [ ] No linear animations?
- [ ] No emojis?
- [ ] Icons are from lucide-react?
- [ ] Dark mode works correctly (uses tokens)?
- [ ] Reusable components are in `src/ui/primitives/`?
- [ ] Has `aria-label` on icon buttons?
- [ ] Has `aria-pressed` on selectable chips?
- [ ] Has `aria-current="page"` on active nav item?
- [ ] Sheet has `role="dialog"` and `aria-modal="true"`?
- [ ] Sheet blocks body overflow when open?
- [ ] Sheet closes with Escape key?
- [ ] No `<p>` for layout, no `<br>` for spacing?
- [ ] No `!important` anywhere?

---

*This document is the single source of truth for MorphIQ UI. When in doubt, refer to this file and the implementation in `src/ui/`.*
