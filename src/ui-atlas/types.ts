import type { StaticKey } from '../i18n/types';

export type { Lang, Mode } from '../presentation/state/preferences';

export type ScreenId = 'today' | 'train' | 'library' | 'body' | 'coach';

export const SCREENS: { id: ScreenId; labelKey: StaticKey }[] = [
  { id: 'today', labelKey: 'nav.today' },
  { id: 'train', labelKey: 'nav.train' },
  { id: 'library', labelKey: 'nav.library' },
  { id: 'body', labelKey: 'nav.body' },
  { id: 'coach', labelKey: 'nav.coach' },
];

/* ------------------------------------------------------------------ *
 * View models
 *
 * These deliberately diverge from the showcase's mock shapes in one way:
 * no field holds a pre-formatted human string. The showcase shipped
 * `lastUsed: '5d ago'`, `elapsed: '34:07'`, `value: '92.5 kg × 3'` — English
 * baked into a non-React module. Every one of those is a real value here,
 * formatted at the render edge by `useT().fmt`. That is what makes the
 * in-app language switch possible.
 * ------------------------------------------------------------------ */

export interface ProfileVM {
  name: string;
  age: number;
  heightCm: number;
  targetWeightKg: number | null;
  targetBodyFat: number | null;
  weeklyGoalDays: number;
}

export type MetricKey =
  | 'weight' | 'bodyFat' | 'muscleMass' | 'bodyWater'
  | 'visceralFat' | 'bmr' | 'metabolicAge' | 'protein';

export interface MetricPointVM {
  key: MetricKey;
  labelKey: StaticKey;
  value: number;
  unitKey: StaticKey;
  decimals: number;
  /** Null when no reading falls in the comparison window — renders as an em-dash, never a fake zero. */
  delta30d: number | null;
  /** The same comparison over shorter and longer windows, for the detail sheet. */
  delta7d: number | null;
  delta90d: number | null;
  lowerIsBetter: boolean;
  /** Always 12 points, oldest → newest. Null when there is nothing to plot. */
  series: number[] | null;
}

export interface BodyVM {
  metrics: MetricPointVM[];
  latestAt: Date | null;
  readingCount: number;
  hasData: boolean;
}

export type MuscleGroupId = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

export interface MuscleLoadRow {
  group: MuscleGroupId;
  labelKey: StaticKey;
  sets: number;
  target: number;
  recoveredPct: number;
  lastHitAt: Date | null;
  /** What actually produced those sets, heaviest contributor first. */
  exercises: { name: string; sets: number; volumeKg: number }[];
}

export interface MuscleLoadVM {
  /** All six groups, fixed order, so the UI never reflows as data arrives. */
  rows: MuscleLoadRow[];
  /** Sets that resolved to no group — surfaced so the UI can say so honestly. */
  unmappedSets: number;
}

export interface SessionSetVM {
  setNum: number;
  weightKg: number;
  reps: number;
  done: boolean;
  lastWeightKg?: number;
  lastReps?: number;
  isPr?: boolean;
}

/** The user's all-time best on one exercise, as the Train screen shows it. */
export interface ExerciseBestVM {
  weightKg: number;
  reps: number;
  e1rm: number;
  at: Date;
}

export interface SessionExerciseVM {
  key: string;
  exerciseId?: string;
  name: string;
  target: string;
  equipment: string;
  /** Repo-relative catalogue path, or '' when the exercise is free-text. */
  image: string;
  /** Repo-relative animated path, or '' — the still `image` is the fallback. */
  gif: string;
  sets: SessionSetVM[];
  note?: string;
  /** Null until this exercise has been logged at least once with a scoreable set. */
  best: ExerciseBestVM | null;
}

export interface SessionVM {
  title: string;
  startedAt: Date;
  routineSource?: 'coach' | 'manual' | 'template';
  feelingTag?: string;
  bodyNotes?: string;
}

export interface SessionTotalsVM {
  volumeKg: number;
  setsDone: number;
  setsPlanned: number;
  prs: number;
}

export interface SessionCursor {
  exerciseIdx: number;
  setIdx: number;
}

export interface PrRecordVM {
  exerciseName: string;
  exerciseId?: string;
  weightKg: number;
  reps: number;
  e1rm: number;
  at: Date;
}

export interface DayCell {
  date: Date;
  done: boolean;
  isToday: boolean;
}

export interface StreakVM {
  current: number;
  best: number;
  weekDone: number;
  weekGoal: number;
  /** Seven cells, Monday-start — replaces the showcase's positional `i < 3` rings. */
  week: DayCell[];
}

export type FeelingId = 'feeling_100' | 'good' | 'sore' | 'pain' | 'low_energy';

export interface HistoryEntryVM {
  id: string;
  at: Date;
  title: string;
  durationMin: number;
  volumeKg: number;
  sets: number;
  feeling?: FeelingId;
  prs: number;
}

export interface MacroVM {
  eaten: number;
  target: number;
}

export interface MealVM {
  mealType: string;
  at: Date;
  description: string;
  calories: number;
  protein: number;
}

export interface NutritionVM {
  calories: MacroVM;
  protein: MacroVM;
  carbs: MacroVM;
  fat: MacroVM;
  burned: number;
  meals: MealVM[];
  /** False when the targets are inferred rather than set by the user. */
  targetsExplicit: boolean;
}

export interface CatalogItemVM {
  id: string;
  name: string;
  category: string;
  equipment: string;
  target: string;
  image: string;
  favorite: boolean;
  lastUsedAt: Date | null;
  bestKg: number | null;
}

export interface FacetBucket {
  id: string;
  count: number;
}
