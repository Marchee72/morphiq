# Slice 4 — Coach AI, Settings & System Polish Design Specification

**Date:** 2026-07-22  
**Status:** Approved  
**Target:** MorphIQ (One UI Redesign - Final Slice)

---

## 1. Overview & Objectives

Slice 4 is the final phase of the MorphIQ One UI redesign. It replaces remaining placeholder screens with production-ready One UI components for the **AI Coach** and **Settings**, introduces complete data management capabilities, implements appearance theme controls, and performs final codebase cleanup.

---

## 2. Architecture & File Structure

```
src/
├── features/
│   ├── coach/
│   │   ├── CoachScreen.tsx           # One UI Coach AI interface with CollapsingAppBar & message list
│   │   ├── CoachContextBuilder.ts    # Comprehensive payload engine (Profile, BIA, Food, Workouts, Sets)
│   │   └── __tests__/
│   │       └── CoachContextBuilder.test.ts
│   └── settings/
│       ├── SettingsScreen.tsx        # One UI Settings HUB (Profile, Health Sync, Theme, Backup/Restore)
│       ├── ProfileEditSheet.tsx      # Modal sheet to update height, target weight, calorie/protein targets
│       ├── DataBackupSheet.tsx       # Export/Import JSON dialogs & DB reset confirmation
│       └── __tests__/
│           └── SettingsScreen.test.tsx
└── presentation/
    └── state/
        └── store.ts                  # Add theme preference state ('system' | 'dark' | 'light') + export/import actions
```

---

## 3. Component Details

### 3.1 Coach AI (`src/features/coach/`)

1. **`CoachContextBuilder.ts`**:
   - Compiles full user context into a structured prompt header for `GeminiCoach`.
   - Included Data:
     - **Profile**: Name, Age, Sex, Height, Target Weight, Daily Calorie Goal, Daily Protein Goal.
     - **BIA & Body Composition**: Recent measurements (last 30 days) including weight, body fat %, muscle mass %, water %, visceral fat, visceral rating.
     - **Nutrition Logs**: Today's food entries + 7-day average calorie/protein/carbs/fat intake vs target goals.
     - **Workout History**: Workouts performed in the last 14 days, including exercise names, set details (weight, reps, volume), and personal records.
   - Standardizes system prompts in Spanish so the coach delivers concise, actionable coaching advice.

2. **`CoachScreen.tsx`**:
   - `CollapsingAppBar` with title "Coach AI" and a subtitle context pill: `Context: Profile, 30d BIA, 7d Nutrition & Workout History active`.
   - **Quick Prompt Chips**: Horizontal scrollable chips for 1-click prompts:
     - *"Analizar mi entrenamiento esta semana"*
     - *"Evaluar mi progreso de peso y grasa"*
     - *"Ajustar mi meta de macronutrientes"*
     - *"Recomendar rutina para hoy"*
   - **Message Stream**: Displays chat history (`chatHistory` from Zustand store). User messages render in primary accent bubbles (right); AI responses render in surface card bubbles (left) with markdown formatting.
   - **Input Section**: Sticky bottom input with auto-growing textarea, clear/send buttons, and animated typing loading indicator while `isAiLoading`.

### 3.2 Settings (`src/features/settings/`)

1. **`SettingsScreen.tsx`**:
   - `CollapsingAppBar` with title "Configuración".
   - Organized into 4 One UI Card sections:
     - **Perfil de Usuario**: Display active profile summary + "Editar perfil" button + Profile switcher selector.
     - **Sincronización de Salud**: Status badge for `CapacitorHealthProvider` / `WebHealthProvider`, last sync timestamp, and "Sincronizar ahora" manual trigger button.
     - **Apariencia**: Theme selector chips (`Sistema (Auto)`, `Oscuro Cinema`, `Claro`). Changes apply `data-theme` attribute to root element and persist in `localStorage`.
     - **Datos y Respaldos**:
       - **Exportar datos (JSON)**: Serializes profiles, measurements, food logs, workout logs, sets, and favorite exercises into a downloadable `.json` file.
       - **Importar datos (JSON)**: Restores data from a backup `.json` file into the database (IndexedDB or Server).
       - **Restablecer datos**: Danger button requiring user confirmation.

2. **`ProfileEditSheet.tsx`**:
   - Bottom sheet modal for updating profile fields: Name, Age, Sex, Height, Target Weight, Daily Calories Target, Daily Protein Target.

3. **`DataBackupSheet.tsx`**:
   - Import/Export dialog with file picker and status notification toast.

---

## 4. State Management Updates (`src/presentation/state/store.ts`)

- **Theme State**:
  - `theme: 'system' | 'dark' | 'light'`
  - `setTheme: (theme: 'system' | 'dark' | 'light') => void`
- **Data Export & Import Actions**:
  - `exportBackupData: () => Promise<string>` (JSON string)
  - `importBackupData: (jsonContent: string) => Promise<boolean>`
- **Profile Edit Action**:
  - `updateProfile: (profile: UserProfile) => Promise<void>` (already exists, verify integration)

---

## 5. Error Handling & Edge Cases

- **AI Timeout / API Error**: If Gemini/DeepSeek API call fails or returns empty response, display an inline retry chip on the message bubble instead of breaking UI.
- **Malformed JSON Import**: Validate backup JSON schema before attempting database insertion; alert user on invalid schema without mutating existing state.
- **Health Sync Unavailable**: Show clear status badge ("Sin permisos / No disponible en web") and handle permission requests gracefully.

---

## 6. Testing Strategy

- `CoachContextBuilder.test.ts`: Verify context payload correctly formats user profile, BIA measurements, nutrition, and workout history.
- `SettingsScreen.test.tsx`: Test profile switching, theme changes, and backup JSON export/import functions.
- **Build & Lint Gates**: Pass `npm run test`, `npm run lint`, and `npm run build`.
