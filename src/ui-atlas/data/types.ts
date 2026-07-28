import type { Exercise } from '../../core/entities/Exercise';
import type { Message } from '../../core/entities/Message';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { ExerciseFilters, FacetCounts } from '../../data/exercises/ExerciseCatalog';
import type { WeeklyStatsVM } from '../derive/history';
import type {
  BodyVM, CatalogItemVM, HistoryEntryVM, MuscleLoadVM, NutritionVM, PrRecordVM,
  ProfileVM, ScreenId, SessionCursor, SessionExerciseVM, SessionTotalsVM, SessionVM, StreakVM,
} from '../types';

export interface CatalogSlice {
  ready: boolean;
  total: number;
  facets: FacetCounts;
  search(query: string, filters?: ExerciseFilters): Exercise[];
  byId(id: string): Exercise | undefined;
  toItem(exercise: Exercise): CatalogItemVM;
}

/**
 * Everything both skins read, derived once per mount.
 *
 * No field holds a pre-formatted human string — dates stay `Date`, numbers stay
 * numbers. Formatting happens at the render edge through `useT().fmt`, which is
 * what makes the in-app language switch possible at all.
 */
export interface AppData {
  ready: boolean;
  profile: ProfileVM;
  body: BodyVM;
  session: SessionVM | null;
  sessionExercises: SessionExerciseVM[];
  sessionTotals: SessionTotalsVM;
  cursor: SessionCursor;
  training: {
    history: HistoryEntryVM[];
    records: PrRecordVM[];
    muscleLoad: MuscleLoadVM;
    streak: StreakVM;
    weeklyVolumeKg: number[];
    weeklyStats: WeeklyStatsVM;
    routines: RoutineTemplate[];
  };
  nutrition: NutritionVM;
  catalog: CatalogSlice;
  coach: { thread: Message[]; isLoading: boolean };
}

/** Overlays the shell can open. Any screen can request one. */
export type OverlayId =
  | 'settings' | 'logWeight' | 'addFood' | 'exercisePicker'
  | 'dayNote' | 'sessionEditor' | 'quickAdd';

/**
 * What an overlay is being opened *for*.
 *
 * The exercise picker serves two intents — add to the session, or replace the
 * exercise at a given index — and the picker itself sits in the shell, far from
 * the row whose swap button was pressed. Without this the shell can only guess,
 * which is why swapping used to append instead.
 */
export interface OverlayPayload {
  swapIndex?: number;
}

export interface AppActions {
  navigate(screen: ScreenId): void;
  openOverlay(id: OverlayId, payload?: OverlayPayload): void;
  closeOverlay(): void;

  startSession(type?: string): void;
  startRoutine(routine: RoutineTemplate): void;
  finishSession(): Promise<void>;
  discardSession(): void;

  logWeight(kg: number): Promise<void>;
  toggleFavorite(exerciseId: string): Promise<void>;
  sendCoachMessage(text: string): Promise<void>;
}

export interface AppUiState {
  overlay: OverlayId | null;
  payload: OverlayPayload;
}
