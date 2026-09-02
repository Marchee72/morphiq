import type { StaticKey } from '../i18n/types';

export type { Lang, Mode } from '../presentation/state/preferences';

export type ScreenId = 'today' | 'train' | 'library' | 'body' | 'coach' | 'buddies';

export const SCREENS: { id: ScreenId; labelKey: StaticKey }[] = [
  { id: 'today', labelKey: 'nav.today' },
  { id: 'train', labelKey: 'nav.train' },
  { id: 'library', labelKey: 'nav.library' },
  { id: 'body', labelKey: 'nav.body' },
  { id: 'coach', labelKey: 'nav.coach' },
  { id: 'buddies', labelKey: 'nav.buddies' },
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
  | 'weight' | 'bodyFat' | 'muscleMass' | 'muscleMassPct' | 'bmi' | 'bodyWater' | 'bmr';

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
  /** What actually produced those sets, latest first. */
  exercises: { name: string; sets: number; volumeKg: number; lastHitAt: Date | null; bestSet: { weightKg: number; reps: number } | null }[];
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
  /**
   * Perceived exertion for the whole exercise, Borg 6-20. Undefined until asked.
   *
   * On the exercise rather than on `SessionSetVM` because that is the grain the
   * question is asked at — a single set has no answer of its own to show, and
   * putting the field there would invite a per-set UI that does not exist.
   */
  rpe?: number;
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
  /** Borg 6-20 across the rated exercises. Null when nothing was rated. */
  avgRpe: number | null;
  maxRpe: number | null;
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

/**
 * The numbers that describe a session you did not log set by set.
 *
 * A run recorded by the watch has no weight and no reps, and rendering it with
 * the strength tiles produced "0 sets · 0.0 t" — which reads as a session you
 * failed to log rather than one that was never about sets. These fields already
 * existed on `WorkoutLog`; they simply had nowhere to go.
 *
 * Every field is optional because sources disagree about what they record: a
 * treadmill run has no distance, a yoga session has neither distance nor steps.
 * The render shows the tiles it has and omits the rest.
 */
export interface CardioVM {
  /** How to read the distance — min/km, km/h, or null when there is none. */
  readout: 'pace' | 'speed' | null;
  distanceKm?: number;
  calories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
}

export interface HistoryEntryVM {
  id: string;
  at: Date;
  title: string;
  durationMin: number;
  volumeKg: number;
  sets: number;
  feeling?: FeelingId;
  prs: number;
  /**
   * Present only when the session carried no logged sets but did carry activity
   * numbers — i.e. it came from the watch rather than from the set logger.
   * Its absence is what every strength path already assumes, so the branch is
   * simply `entry.cardio ? … : …`.
   */
  cardio?: CardioVM;
  /**
   * Distinct exercises the session contained, in the order they were performed.
   *
   * A session row used to carry only its title — which is "Strength Training"
   * for most of them — so neither the eye nor a search box could tell one from
   * another. This is what the history filter matches on.
   */
  exercises: string[];
}

export interface DailyStepsVM {
  date: Date;
  steps: number;
}

export interface StepsVM {
  /** Null when the health source has not answered — never rendered as a zero. */
  today: number | null;
  /** Days that reported anything, newest first. */
  recent: DailyStepsVM[];
  /** Mean over the days that reported, or null when none did. */
  weeklyAvg: number | null;
}

/**
 * What today actually contained, training-wise.
 *
 * Today's screen could say what week you were having and what was running right
 * now, but not the one thing you open the app to check: whether you have
 * trained yet, and what it was.
 */
export interface TodayTrainingVM {
  /** Sessions finished today, newest first. Excludes the live one. */
  sessions: HistoryEntryVM[];
  /** Distinct exercises across those sessions, in the order performed. */
  exercises: string[];
  sets: number;
  volumeKg: number;
  minutes: number;
  prs: number;
  /**
   * The day's activity sessions — runs, rides, walks — and their totals.
   *
   * Kept apart from `sets`/`volumeKg` rather than folded in, because a day can
   * hold both a gym session and a run and the two do not add up to anything.
   */
  cardioSessions: HistoryEntryVM[];
  cardioDistanceKm: number;
  cardioCalories: number;
  cardioMinutes: number;
  /** The most recent finished session before today, for the "last trained" read. */
  previous: HistoryEntryVM | null;
  /** Days since `previous`, or null when there is no earlier session at all. */
  daysSincePrevious: number | null;
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
