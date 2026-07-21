# MorphIQ v2 — Expansion Plan

## Overview

Three major additions to MorphIQ: responsive full-width dashboard layout, dedicated workout/fitness tab with stats, and Samsung Health integration via a Capacitor-wrapped mobile app.

---

## Feature 1: UI Layout Overhaul

### Problem

All content is center-aligned within `max-w-7xl` containers, leaving the right side of the screen empty on wide displays. The dashboard tab is the only one using a grid (`lg:grid-cols-3`), and even that doesn't fill the screen properly. Other tabs (Daily Logs, AI Coach, Settings) are single-column and hug the center.

### Solution

Restructure the layout to fill the available viewport using a responsive grid system that adapts to screen width.

### Changes

#### `App.tsx` — new tab structure and layout

- Add new `workout` tab alongside existing `dashboard`, `logs`, `coach`, `settings`
- Restructure `<main>` to use `grid grid-cols-12` or a flex-based approach that fills width
- Every tab uses the full viewport width, not a constrained `max-w-4xl`

#### Dashboard tab layout

```
┌──────────────────────────────────────────────────────────┐
│  ScaleConnector  │       AnalyticsDashboard (charts)      │
│   (1/3 width)    │           (2/3 width)                  │
│                  │                                        │
│                  │                                        │
└──────────────────────────────────────────────────────────┘
```

This already exists as `lg:grid-cols-3` but should stretch to fill the available horizontal space instead of being constrained. Convert `max-w-7xl` on `<main>` to `w-full` with responsive padding.

#### Daily Logs tab layout

```
┌──────────────────────┬───────────────────────────────────┐
│   Food Log Form      │     Food & Workout Log Lists      │
│   (1/3 width)        │       (2/3 width)                 │
│                      │                                   │
│   Workout Log Form   │   - Today's food entries          │
│   (1/3 width)        │   - Today's workout entries       │
│                      │   - Macro summary cards           │
└──────────────────────┴───────────────────────────────────┘
```

Split the current single-column form+list into a two-column layout. Form stays on the left, log entries on the right.

#### AI Coach tab layout

```
┌──────────────────────────────────┬───────────────────────┐
│     Chat Messages                │    Context Sidebar    │
│     (3/4 width)                  │    (1/4 width)        │
│                                  │                       │
│                                  │  - Profile summary    │
│                                  │  - Latest measurement │
│                                  │  - Today's macros     │
└──────────────────────────────────┴───────────────────────┘
```

Add a context sidebar showing what the AI Coach knows about the user (profile stats, latest measurement, recent food). Currently there's no context visibility — the user can't see what data is being sent to the coach.

#### Settings tab

Keep as single-column but use full width with a card-based dashboard for profile management.

#### Shared CSS additions (`src/index.css`)

Add grid utility classes for the new layout:

```css
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.col-span-3 { grid-column: span 3 / span 3; }
.col-span-4 { grid-column: span 4 / span 4; }
.col-span-6 { grid-column: span 6 / span 6; }
.col-span-8 { grid-column: span 8 / span 8; }
.col-span-9 { grid-column: span 9 / span 9; }
/* Responsive variants */
.lg\:col-span-3 { ... }
.lg\:col-span-4 { ... }
.lg\:col-span-8 { ... }
.lg\:col-span-9 { ... }
```

### Files touched

| File | Change |
|------|--------|
| `src/App.tsx` | New tab enum, grid layout for all tabs, full-width main |
| `src/index.css` | New `grid-cols-12` span classes, responsive variants |
| `src/presentation/components/DailyLog.tsx` | Split into two-column form+list |
| `src/presentation/components/CoachChat.tsx` | Add context sidebar component |

---

## Feature 2: Dedicated Workout Tab

### Problem

Workout tracking is mixed into the "Daily Logs" tab as a secondary form. There's no workout-only view, no workout stats, no progress charts, and no workout history view beyond today's entries. The user wants a complete workout hub.

### Solution

Create a new "Workout" tab that pulls workout data from the Zustand store and displays:

1. Workout log form (moved from Daily Logs)
2. Workout history (past 30 days)
3. Workout type distribution chart (pie/donut)
4. Weekly workout duration trend chart
5. Calorie burn summary
6. When Health Connect is connected: imported workout feed

### Component structure

```
WorkoutTab (new component)
├── WorkoutLogForm      — existing form, extracted from DailyLog.tsx
├── WorkoutStatsSummary — cards: total workouts this week, total minutes, total cals burned
├── WorkoutTypeChart    — Recharts PieChart of workout types
├── WorkoutDurationChart— Recharts BarChart of weekly duration
└── WorkoutHistoryTable — scrollable table of past workouts (30 days)
```

### WorkoutLog entity enhancement

The current `WorkoutLog` interface is minimal. Add optional fields for richer data:

```typescript
export interface WorkoutLog {
  id?: string;
  profileId: string;
  timestamp: Date;
  type: string;           // e.g., "Strength Training", "Running", "Yoga"
  duration: number;       // in minutes
  description: string;
  caloriesBurned?: number;
  // New fields for Health Connect integration
  distanceKm?: number;    // for running/cycling
  avgHeartRate?: number;  // from Health Connect
  maxHeartRate?: number;
  source?: 'manual' | 'health-connect';  // track origin
  externalId?: string;    // Health Connect record ID (for dedup)
}
```

### Store changes (`store.ts`)

Add workout-specific actions:

```typescript
loadWorkoutHistory(days?: number): Promise<void>   // fetch N days of workout logs
loadWorkoutRange(start: Date, end: Date): Promise<void>  // date range query
importWorkouts(logs: WorkoutLog[]): Promise<void>  // batch import from Health Connect
```

The LocalDatabase and ServerDatabase repositories need corresponding `getRange()` methods.

### Files touched

| File | Change |
|------|--------|
| `src/presentation/components/WorkoutTab.tsx` | **New** — workout hub component |
| `src/presentation/components/WorkoutStatsSummary.tsx` | **New** — stat cards |
| `src/presentation/components/WorkoutTypeChart.tsx` | **New** — pie chart |
| `src/presentation/components/WorkoutDurationChart.tsx` | **New** — bar chart |
| `src/presentation/components/WorkoutHistoryTable.tsx` | **New** — history table |
| `src/core/entities/WorkoutLog.ts` | Add optional fields |
| `src/presentation/state/store.ts` | Add workout query/import actions |
| `src/data/database/LocalDatabase.ts` | Add `getRange()` query method |
| `src/data/database/ServerDatabase.ts` | Add `getRange()` query method |
| `src/core/interfaces/IDatabase.ts` | Add `IWorkoutLogRepository.getRange()` |
| `src/App.tsx` | Register new tab and route |

---

## Feature 3: Samsung Health Integration via Mobile App

### Problem

Samsung Health cannot be accessed from a web browser. There is no public REST API for Samsung Health data. The Samsung Health Data SDK is partner-only and requires a formal partnership application with Samsung — not viable for an indie/hobby project.

### Solution: Health Connect Bridge

Samsung Health (on Android) syncs its workout data to **Health Connect** — Google's centralized on-device health data platform (Android 14+, available as Play Store app for 9+). Any Android app can read from Health Connect with user consent. No Samsung partnership needed.

The integration path:

```
Samsung Health  ──writes──▶  Health Connect  ──reads──▶  MorphIQ Mobile App
(Galaxy Watch)              (Android on-device hub)       (Capacitor + capacitor-health)
```

### Mobile app approach: Capacitor

**Capacitor** wraps the existing React SPA in a native Android/iOS shell. This is NOT a rewrite — the entire web codebase is preserved. Capacitor adds a thin native bridge that lets web code call platform APIs.

```
┌─────────────────────────────────────┐
│       MorphIQ React SPA (Vite)      │  ← unchanged
├─────────────────────────────────────┤
│      Capacitor Runtime Bridge       │  ← wraps web app
├──────────────┬──────────────────────┤
│   Android    │        iOS           │
│   WebView    │       WKWebView      │
│              │                      │
│  capacitor-  │  capacitor-health    │
│  health    │  (HealthKit)         │
│  (Health     │                      │
│  Connect)    │                      │
└──────────────┴──────────────────────┘
```

### Capacitor setup

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install capacitor-health  # Health Connect + HealthKit
npx cap init MorphIQ com.morphiq.app
npx cap add android
npx cap add ios
npm run build                    # builds the Vite SPA
npx cap sync                     # syncs web build into native projects
npx cap open android             # opens in Android Studio for final build
```

### Plugin: `capacitor-health`

Provides a cross-platform API for reading health data:

| Platform | Backend | Data Access |
|----------|---------|-------------|
| Android | Health Connect | Workouts, steps, distance, calories, heart rate, route |
| iOS | HealthKit | Workouts, steps, distance, calories, heart rate |

Key API for workout import:

```typescript
import { CapacitorHealth } from 'capacitor-health';

// Request permissions
await CapacitorHealth.requestPermissions({
  permissions: ['READ_WORKOUTS', 'READ_STEPS', 'READ_DISTANCE', 'READ_CALORIES']
});

// Query workouts (pulls Samsung Health data via Health Connect)
const result = await CapacitorHealth.queryWorkouts({
  startDate: '2026-05-01T00:00:00.000Z',
  endDate: '2026-05-24T23:59:59.000Z',
  includeSteps: true,
  includeHeartRate: true,
});

// result.workouts[] contains: startDate, endDate, workoutType, duration, 
//   distance (meters), caloriesBurned, steps, avgHeartRate, maxHeartRate
```

### Google Play requirements

- Submit a **Health Connect declaration form** to Google (approval ~7 days)
- Privacy Policy page required in-app and on Play Store
- Target Android 14+ (API 34), min SDK 26
- Health Connect permissions can only be requested 3 times before the user must go to system Settings to grant them

### Data import flow

1. User taps "Connect Health Data" in the Workout tab
2. App requests Health Connect permissions
3. User grants access to workout data
4. App queries Health Connect for workouts from the past 30 days (first import) or since last sync
5. Workouts are mapped to `WorkoutLog` entities (with `source: 'health-connect'`)
6. Duplicates are detected by `externalId` (Health Connect record ID)
7. Workouts are saved to IndexedDB (local mode) or PostgreSQL (server mode)
8. Workout stats and charts update automatically from the store

### Health Connect import component

```typescript
// src/presentation/components/HealthConnectButton.tsx (NEW)
// Only renders on Android within Capacitor
// Calls capacitor-health to import workouts
// Shows loading state and import count
// Falls back to "only available on mobile app" message in browser
```

### Platform detection

The app already runs in a browser. With Capacitor, it also runs inside a native WebView. We need platform awareness:

```typescript
// src/core/interfaces/IHealthProvider.ts (NEW)
export interface IHealthProvider {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  importWorkouts(since: Date): Promise<ImportedWorkout[]>;
}

// Browser implementation: always returns "not available"
// Capacitor implementation: uses capacitor-health plugin
```

### Files touched (mobile app)

| File | Change |
|------|--------|
| `package.json` | Add capacitor deps |
| `capacitor.config.ts` | **New** — Capacitor configuration |
| `android/` | **New** — Android native project (generated by Capacitor) |
| `ios/` | **New** — iOS native project (generated by Capacitor) |
| `src/core/interfaces/IHealthProvider.ts` | **New** — health data provider contract |
| `src/data/health/CapacitorHealthProvider.ts` | **New** — capacitor-health implementation |
| `src/data/health/WebHealthProvider.ts` | **New** — browser stub (returns "not available") |
| `src/presentation/components/HealthConnectButton.tsx` | **New** — import button UI |
| `src/presentation/components/WorkoutTab.tsx` | Integrate import button |
| `src/presentation/state/store.ts` | Add `importWorkouts()` action |
| `src/core/entities/WorkoutLog.ts` | Add health-connect fields |

---

## Feature 4: Scroll-Aware Header & Floating Tabs

### Problem

The large header with logo, profile badge, and navigation tabs scrolls away as soon as the user moves down the page. On long pages (Analytics Dashboard, Daily Logs), the user loses access to tab navigation and the active profile indicator. The header occupies significant vertical space — wasting screen real estate on scroll.

### Solution

Implement a scroll-aware header that **shrinks** on scroll and keeps the **tab navigation floating/fixed** at the top of the viewport.

### Behavior

```
Initial state (top of page):           After scrolling 80px:
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  [Logo] MorphIQ               │       │ [Logo] MQ  [Dash] [Logs]... │
│  Body Intelligence            │       │       Active: User          │
│                               │       └──────────────────────────────┘
│  [Dashboard] [Logs] [Coach]   │       
│         Active: User          │       
└──────────────────────────────┘       
```

1. **Full header** at scroll top: logo, subtitle, tabs, profile badge (current state)
2. **Compact header** after scrolling > 80px: small logo icon, tab bar only, profile dot — height collapses from ~100px to ~48px
3. **Tabs are always visible** — they stick to the top even when the logo collapses

### Implementation

#### `App.tsx` — scroll listener + compact class

```tsx
const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const handleScroll = () => setScrolled(window.scrollY > 80);
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

Add a `scrolled` boolean that toggles CSS classes on the header:

```tsx
<header className={`main-header ${scrolled ? 'header-compact' : ''}`}>
```

#### CSS additions (`src/index.css`)

```css
.main-header {
  position: sticky;
  top: 0;
  z-index: 50;
  transition: padding 0.3s ease, height 0.3s ease;
}

.header-compact {
  padding-top: 6px;
  padding-bottom: 6px;
}

.header-compact .header-logo-subtitle { display: none; }
.header-compact .header-logo-text { font-size: 1rem; }
.header-compact .header-logo-icon { width: 32px; height: 32px; padding: 6px; }
```

#### Tab navigation — always floating

Currently tabs are inside the header alongside the logo. When the header shrinks, tabs should remain visible. The compact header shows: `[small logo] [tabs] [profile dot]` in a single row.

### Files touched

| File | Change |
|------|--------|
| `src/App.tsx` | Add scroll listener, `scrolled` state, compact header class toggle |
| `src/index.css` | Add `.header-compact` transition styles |

---

## Feature 5: Progress Timeline with Labels & Context

### Problem

The `Progress Timeline` chart in `AnalyticsDashboard.tsx` shows a line chart with two tracks (weight in purple, fat % in teal) but has no descriptive labels, no axis titles, no legend explaining which color means what, and no hover tooltip explaining the data point context. The user sees a graph but doesn't know what it represents.

### Solution

Transform the bare chart into a reader-friendly timeline with descriptive labels, consistent color legend, helper text, and trend arrows.

### Changes to `AnalyticsDashboard.tsx`

#### Chart title and description

Replace the bare `<h2>Progress Timeline</h2>` with a labeled header:

```tsx
<div className="flex justify-between items-center mb-4">
  <div>
    <h2 className="text-lg font-bold">Body Composition Timeline</h2>
    <p className="text-xs text-gray-500 mt-0.5">
      Tracking weight (kg) and body fat (%) across {measurements.length} measurements
    </p>
  </div>
  <div className="flex items-center gap-4 text-xs">
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-0.5 bg-purple-400 rounded" /> Weight
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-3 h-0.5 bg-teal-400 rounded" /> Body Fat %
    </span>
  </div>
</div>
```

#### Y-axis labels

Add chart labels to clarify what each axis tracks:

```
Weight (kg) ← left Y-axis, purple
Body Fat % ← right Y-axis, teal
```

Use Recharts `<Label>` on each YAxis:

```tsx
<YAxis yAxisId="left">
  <Label value="Weight (kg)" angle={-90} position="insideLeft" style={{ fill: '#c084fc' }} />
</YAxis>
<YAxis yAxisId="right" orientation="right">
  <Label value="Body Fat %" angle={90} position="insideRight" style={{ fill: '#2dd4bf' }} />
</YAxis>
```

#### Empty state

When only 1 measurement exists (single dot, no line), show a helper message:

```tsx
{measurements.length === 1 && (
  <p className="text-xs text-gray-500 text-center mt-2">
    Only one measurement recorded — trends will appear after your next check-in
  </p>
)}
```

#### Tooltip enhancement

The existing Recharts `<Tooltip>` shows date, weight, and fat. Ensure it's readable with dark theme styling (already done).

### Files touched

| File | Change |
|------|--------|
| `src/presentation/components/AnalyticsDashboard.tsx` | Chart title, legend, axis labels, empty state message |

---

## Feature 6: Click-to-Expand Metric Cards with History & Detail

### Problem

The Analytics Dashboard displays 8 metric cards in a grid: BMR, Visceral Fat, Body Water, Bone Mass, Protein, Metabolic Age, BMI, Ideal Weight. Each card shows only the current value — there's no way to see how that metric has trended over time or understand what the number means. The user clicks a card and nothing happens.

### Solution

Make each metric card **clickable**. Clicking opens an **expandable detail panel** showing:

1. **Historical trend** — a small sparkline chart of that metric over time
2. **Min / Max / Avg** — summary stats across all measurements
3. **Current value + change** — value now and delta from first measurement
4. **Explanation text** — 1-2 sentences about what the metric means and what's healthy

### Component: `MetricCard`

Extract the metric card into a reusable `MetricCard` component (currently they're hardcoded `<div className="glass-panel p-4 text-center">` blocks repeated 8 times).

```typescript
interface MetricCardProps {
  label: string;           // e.g., "Basal Metabolism"
  value: string;           // e.g., "1850"
  unit: string;            // e.g., "kcal/day"
  color: string;           // tailwind color class (e.g., 'text-teal-400')
  trend: number[];         // historical values for sparkline
  trendDelta: number;      // change from first measurement
  explanation: string;     // 1-2 sentence description
  detailUnit: string;      // unit for trend values
}
```

### Metric detail panel

When a `MetricCard` is clicked, it expands inline (or opens a modal) showing:

```
┌──────────────────────────────────────────────────────────────┐
│  Basal Metabolism                       ▲ 12 kcal since start│
│  1850 kcal/day                            (was 1838)         │
│                                                              │
│  ▓▂▃▄▅▆▇█▇▆▅▄▃   ← sparkline of BMR over time              │
│  Min: 1825  Max: 1868  Avg: 1847                             │
│                                                              │
│  ℹ️ Basal Metabolic Rate (BMR) measures how many calories    │
│  your body burns at complete rest. A higher BMR means a      │
│  faster metabolism, which helps with weight management.      │
│  Normal range for your profile: 1500–2200 kcal/day.          │
│                                                              │
│                                              [Close detail]  │
└──────────────────────────────────────────────────────────────┘
```

### Sparkline chart

Use Recharts' minimalist `<LineChart>` without axes for the sparkline (80px tall, no grid, no labels, just the trend line). Reuse the `measurements` array already in store — slice the relevant field from each measurement.

### Click behavior

- Click a card → it expands inline below the card grid (accordion style)
- Click the same card again → collapses
- Click a different card → switches the expanded panel (only one open at a time)
- State managed with `useState<MetricKey | null>` in `AnalyticsDashboard.tsx`

### Metric explanation library

Define explanations statically (no AI needed — these are well-known health metrics):

```typescript
const metricExplanations: Record<string, { text: string; normal: string }> = {
  bmr: { text: 'Basal Metabolic Rate (BMR) measures...', normal: '1500–2200 kcal/day' },
  visceralFat: { text: 'Visceral fat is stored around internal organs...', normal: '<10 (healthy)' },
  bodyWater: { text: 'Total body water percentage reflects hydration...', normal: '45–65%' },
  boneMass: { text: 'Bone mass is the total weight of your skeleton...', normal: '2.5–4.0 kg' },
  protein: { text: 'Protein percentage reflects muscle-building...', normal: '14–18%' },
  metabolicAge: { text: 'Metabolic age compares your BMR to the average...', normal: '±5 years of actual age' },
  bmi: { text: 'Body Mass Index is a ratio of weight to height...', normal: '18.5–24.9' },
  idealWeight: { text: 'Ideal weight is height-based using the Devine formula...', normal: '±5 kg range' },
};
```

### Files touched

| File | Change |
|------|--------|
| `src/presentation/components/MetricCard.tsx` | **New** — reusable card with click handler and sparkline |
| `src/presentation/components/MetricDetailPanel.tsx` | **New** — expanded detail panel with trend, stats, explanation |
| `src/presentation/components/AnalyticsDashboard.tsx` | Replace hardcoded card divs with `<MetricCard>`, add detail panel rendering |
| `src/index.css` | Add `.metric-card-expanded` animation class |

---

## Updated Implementation Order

### Phase 1: UI Layout (1-2 sessions)

1. Add grid CSS classes to `index.css`
2. Refactor `App.tsx` layout — full-width main, responsive grid
3. Split `DailyLog.tsx` into two-column form+list
4. Add context sidebar to `CoachChat.tsx`

### Phase 2: Scroll Header & Floating Tabs (1 session)

1. Add scroll listener + `header-compact` CSS to `App.tsx`
2. Test scroll behavior on dashboard (longest page)

### Phase 3: Workout Tab (2-3 sessions)

1. Create `WorkoutLog.ts` entity enhancements
2. Add `getRange()` to database repositories
3. Add workout query actions to store
4. Build `WorkoutTab.tsx` with sub-components (stats, charts, history)
5. Wire tab into `App.tsx` navigation
6. Remove workout form from `DailyLog.tsx`

### Phase 4: Click-to-Expand Metric Cards (2 sessions)

1. Build `MetricCard` component (clickable card with sparkline)
2. Build `MetricDetailPanel` component (trend, stats, explanation)
3. Define metric explanations library
4. Replace hardcoded cards in `AnalyticsDashboard.tsx`
5. Add `.metric-card-expanded` CSS animation

### Phase 5: Progress Timeline Labels (1 session)

1. Add chart title, description, color legend
2. Add Y-axis labels
3. Add empty-state message for single measurement
4. Test with 1, 3, and many measurements

### Phase 6: Samsung Health / Mobile App (3-4 sessions)

1. Install Capacitor, init project, add Android platform
2. Install `capacitor-health` plugin
3. Create `IHealthProvider` + `CapacitorHealthProvider` + `WebHealthProvider`
4. Build `HealthConnectButton.tsx` component
5. Add `importWorkouts()` action to store
6. Submit Health Connect declaration to Google
7. Test import flow on Android device
8. Build and sign APK/AAB for distribution

### Phase 7: iOS (optional, 1-2 sessions)

1. Add iOS platform to Capacitor
2. Test HealthKit integration
3. Build and submit to App Store

1. Add grid CSS classes to `index.css`
2. Refactor `App.tsx` layout — full-width main, responsive grid
3. Split `DailyLog.tsx` into two-column form+list
4. Add context sidebar to `CoachChat.tsx`

### Phase 2: Workout Tab (2-3 sessions)

1. Create `WorkoutLog.ts` entity enhancements
2. Add `getRange()` to database repositories
3. Add workout query actions to store
4. Build `WorkoutTab.tsx` with sub-components (stats, charts, history)
5. Wire tab into `App.tsx` navigation
6. Remove workout form from `DailyLog.tsx`

### Phase 3: Samsung Health / Mobile App (3-4 sessions)

1. Install Capacitor, init project, add Android platform
2. Install `capacitor-health` plugin
3. Create `IHealthProvider` + `CapacitorHealthProvider` + `WebHealthProvider`
4. Build `HealthConnectButton.tsx` component
5. Add `importWorkouts()` action to store
6. Submit Health Connect declaration to Google
7. Test import flow on Android device
8. Build and sign APK/AAB for distribution

### Phase 4: iOS (optional, 1-2 sessions)

1. Add iOS platform to Capacitor
2. Test HealthKit integration
3. Build and submit to App Store

---

## Dependencies to add

### `package.json`

```json
{
  "dependencies": {
    "@capacitor/core": "^6.x",
    "@capacitor/android": "^6.x"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.x",
    "capacitor-health": "^8.x"
  }
}
```

---

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Health Connect approval rejected | Provide clear privacy policy; explain data stays on-device |
| `capacitor-health` API changes | Pin version; plugin is actively maintained |
| Browser vs Capacitor code divergence | Use `IHealthProvider` interface to abstract away platform differences |
| 30-day historical data limit (Health Connect) | First import covers 30 days; subsequent syncs keep data current |
| Samsung Health may not write all data types to Health Connect | Test on real device; fall back to manual logging for missing data |
| Layout breaks on narrow mobile screens | Responsive grid with single-column fallback at `sm:` breakpoint |

---

## Success criteria

1. Dashboard fills the screen horizontally at all viewport widths
2. Workout tab shows complete workout history with charts
3. User can import workouts from Samsung Health via one tap
4. Imported workouts appear alongside manually logged entries, with source label
5. No data loss — existing food logging, scale integration, and AI coach remain unchanged
