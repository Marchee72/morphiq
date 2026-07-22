# Slice 4 (Coach AI, Settings & System Polish) Implementation Plan

> **For agentic workers:** Use task-by-task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Slice 4 of the MorphIQ One UI redesign by delivering a rich-context AI Coach screen, a full Settings hub (Profile Editor, Health Sync, Theme Switcher, Data Backup/Restore), and performing final codebase polish.

**Architecture Spec:** `docs/superpowers/specs/2026-07-22-oneui-slice4-coach-settings-design.md`

**Tech Stack:** React 19, TypeScript 6 (`verbatimModuleSyntax`, `erasableSyntaxOnly`), Zustand 5, Dexie 4 (+fake-indexeddb), Vitest 4 + jsdom + `@testing-library/react`.

---

## File Structure

**Created:**
- `src/features/coach/CoachContextBuilder.ts`
- `src/features/coach/CoachScreen.tsx`
- `src/features/coach/__tests__/CoachContextBuilder.test.ts`
- `src/features/coach/__tests__/CoachScreen.test.tsx`
- `src/features/settings/ProfileEditSheet.tsx`
- `src/features/settings/DataBackupSheet.tsx`
- `src/features/settings/__tests__/SettingsScreen.test.tsx`

**Modified:**
- `src/presentation/state/store.ts` (Theme state, exportBackupData, importBackupData actions)
- `src/presentation/state/store.test.ts` (Tests for theme & backup actions)
- `src/App.tsx` (Rewire Coach tab from ComingSoonScreen to CoachScreen)
- `src/features/settings/SettingsScreen.tsx` (Expand from basic switcher to full 4-section Settings hub)

---

## Tasks

### Task 1: Add Theme State & Application to Store

**Files to touch:**
- `src/presentation/state/store.ts`
- `src/presentation/state/store.test.ts`
- `src/main.tsx`

- [ ] **Step 1: Add theme state to `StoreState`**
  Add `theme: 'system' | 'dark' | 'light'` and `setTheme: (theme: 'system' | 'dark' | 'light') => void`.
  Persist theme preference in `localStorage` under `morphiq_theme`.
  Apply `document.documentElement.setAttribute('data-theme', theme)` when changed.

- [ ] **Step 2: Add store tests for theme**
  Verify `setTheme` updates state and calls `setAttribute` on document element.

- [ ] **Step 3: Run store tests**
  Run `npx vitest run src/presentation/state/store.test.ts`

---

### Task 2: Implement Data Backup Export/Import in Store

**Files to touch:**
- `src/presentation/state/store.ts`
- `src/presentation/state/store.test.ts`

- [ ] **Step 1: Implement `exportBackupData` and `importBackupData` actions**
  `exportBackupData` serializes: profiles, measurements, foodLogs, workoutLogs, activeWorkoutSets, favoriteExerciseIds.
  `importBackupData` validates schema, persists into DB repositories, and reloads active profile state.

- [ ] **Step 2: Add unit tests for backup/restore**
  Test exporting JSON state and importing it back into store/database.

- [ ] **Step 3: Run store tests**
  Run `npx vitest run src/presentation/state/store.test.ts`

---

### Task 3: Build `CoachContextBuilder` Engine

**Files to touch:**
- `src/features/coach/CoachContextBuilder.ts`
- `src/features/coach/__tests__/CoachContextBuilder.test.ts`

- [ ] **Step 1: Write `CoachContextBuilder.ts`**
  Formats user profile (name, age, sex, height, target weight, calorie/protein goals), last 30-day BIA metrics, today's + 7-day nutrition summary, and last 14-day workout history + set details into markdown prompt context.

- [ ] **Step 2: Write tests for `CoachContextBuilder`**
  Test formatting with full data vs empty history.

- [ ] **Step 3: Run tests**
  Run `npx vitest run src/features/coach/__tests__/CoachContextBuilder.test.ts`

---

### Task 4: Build One UI `CoachScreen` Component

**Files to touch:**
- `src/features/coach/CoachScreen.tsx`
- `src/features/coach/__tests__/CoachScreen.test.tsx`

- [ ] **Step 1: Implement `CoachScreen.tsx`**
  Use One UI `CollapsingAppBar`, context indicator pill, horizontal prompt chips (*"Analizar mi semana"*, *"Evaluar mi peso"*, *"Ajustar macros"*, *"Recomendar rutina"*), message list with primary accent & surface card bubbles, and sticky input bar.

- [ ] **Step 2: Write component tests for `CoachScreen`**
  Test rendering, prompt chip selection, and sending messages.

- [ ] **Step 3: Run tests**
  Run `npx vitest run src/features/coach/__tests__/CoachScreen.test.tsx`

---

### Task 5: Build `ProfileEditSheet` & `DataBackupSheet`

**Files to touch:**
- `src/features/settings/ProfileEditSheet.tsx`
- `src/features/settings/DataBackupSheet.tsx`

- [ ] **Step 1: Implement `ProfileEditSheet.tsx`**
  Form with height, weight goal, calorie target, protein target with validation and submit handler.

- [ ] **Step 2: Implement `DataBackupSheet.tsx`**
  JSON export download trigger, JSON file upload reader, and database clear confirmation dialog.

---

### Task 6: Rebuild `SettingsScreen`

**Files to touch:**
- `src/features/settings/SettingsScreen.tsx`
- `src/features/settings/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: Implement `SettingsScreen.tsx`**
  Card sections for: Profile (view/switch/edit), Health Sync (status, timestamp, sync button), Theme (system/dark/light chips), and Data Management (export, import, clear DB).

- [ ] **Step 2: Write component tests for `SettingsScreen`**
  Test profile switching modal, theme toggles, and opening sheets.

- [ ] **Step 3: Run tests**
  Run `npx vitest run src/features/settings/__tests__/SettingsScreen.test.tsx`

---

### Task 7: Rewire `App.tsx` & Remove Placeholders

**Files to touch:**
- `src/App.tsx`
- `src/App.test.tsx`

- [ ] **Step 1: Replace `ComingSoonScreen` for coach tab with `<CoachScreen />`**
  Verify all 4 tabs (Home, Gym, Exercises, Coach) and Settings render production components.

- [ ] **Step 2: Run `App.test.tsx`**
  Run `npx vitest run src/App.test.tsx`

---

### Task 8: Full Quality & Verification Gate

- [ ] **Step 1: Run all unit tests**
  Run `npm run test`
- [ ] **Step 2: Run linter**
  Run `npm run lint`
- [ ] **Step 3: Run project build**
  Run `npm run build`
