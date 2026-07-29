import type { BuddyInvite, BuddyLink } from '../../core/entities/Buddy';
import type { Exercise } from '../../core/entities/Exercise';
import type { Message } from '../../core/entities/Message';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { BuddyRowVM } from '../derive/social';
import type { ExerciseFilters, FacetCounts } from '../../data/exercises/ExerciseCatalog';
import type { WeeklyStatsVM } from '../derive/history';
import type { ExerciseSessionVM } from '../derive/exerciseHistory';
import type { SessionDetailVM } from '../derive/sessionDetail';
import type {
  BodyVM, CatalogItemVM, HistoryEntryVM, MuscleLoadVM, NutritionVM, PrRecordVM,
  ProfileVM, ScreenId, SessionCursor, SessionExerciseVM, SessionTotalsVM, SessionVM,
  StepsVM, StreakVM, TodayTrainingVM,
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
    /** What today has contained so far, and what the last session was if nothing has. */
    today: TodayTrainingVM;
    records: PrRecordVM[];
    muscleLoad: MuscleLoadVM;
    streak: StreakVM;
    weeklyVolumeKg: number[];
    weeklyStats: WeeklyStatsVM;
    routines: RoutineTemplate[];
  };
  nutrition: NutritionVM;
  /** Steps from the phone's health source. Empty on the web, which has none. */
  steps: StepsVM;
  catalog: CatalogSlice;
  coach: { thread: Message[]; isLoading: boolean };
  /**
   * Past sessions for one exercise, newest first. A function rather than a field
   * because it is asked for one exercise at a time, on demand — deriving it for
   * all 1,324 up front would be absurd.
   */
  exerciseHistory(exerciseName: string): ExerciseSessionVM[];
  /**
   * One past session opened up — every exercise and every set. Null when the id
   * falls outside the loaded window. A function for the same reason
   * `exerciseHistory` is: only ever asked for one session at a time.
   */
  sessionDetail(workoutLogId: string): SessionDetailVM | null;
}

/**
 * Training partners.
 *
 * Its own context rather than a slice of `AppData`: everything above is derived
 * once per mount, and this is the one part of the app that changes on its own
 * while nobody touches the screen.
 *
 * `available` is false whenever a friendship cannot exist — local mode has no
 * server to be social against, and a signed-out session gets 401 from every
 * social route. Entry points render nothing rather than offering a dead control.
 */
export interface SocialState {
  available: boolean;
  ready: boolean;
  links: BuddyLink[];
  invite: BuddyInvite | null;
  error: string | null;
  /** The partner list as rows, buddies first and blocked ones last. */
  rows: BuddyRowVM[];

  refresh(): Promise<void>;
  createInvite(): Promise<void>;
  revokeInvite(): Promise<void>;
  redeemInvite(code: string): Promise<void>;
  removeBuddy(linkId: string): Promise<void>;
  setBlocked(linkId: string, blocked: boolean): Promise<void>;
}

/** Overlays the shell can open. Any screen can request one. */
export type OverlayId =
  | 'settings' | 'logWeight' | 'addFood' | 'exercisePicker'
  | 'dayNote' | 'sessionEditor' | 'quickAdd' | 'history'
  | 'startSession' | 'routineMerge' | 'buddies';

/**
 * What an overlay is being opened *for*.
 *
 * The exercise picker serves two intents — add to the session, or replace the
 * exercise at a given index — and the picker itself sits in the shell, far from
 * the row whose swap button was pressed. Without this the shell can only guess,
 * which is why swapping used to append instead.
 *
 * `routine` travels the same way and for the same reason: the merge sheet is
 * mounted in the shell, and the routine that raised it was tapped on the Coach
 * screen or inside another sheet.
 */
export interface OverlayPayload {
  swapIndex?: number;
  routine?: RoutineTemplate;
  /** Opens the partners overlay straight onto one friendship. */
  buddyLinkId?: string;
  /** A code arriving from an invite link, so redeeming needs no typing. */
  buddyCode?: string;
}

export interface AppActions {
  navigate(screen: ScreenId): void;
  openOverlay(id: OverlayId, payload?: OverlayPayload): void;
  closeOverlay(): void;

  startSession(type?: string): void;
  /**
   * The front door to training: offers the saved routines when there are any,
   * and otherwise starts empty rather than making you dismiss a sheet with one
   * option in it.
   */
  beginSession(): void;
  /**
   * Starts the routine — or, when a session is already running, opens the merge
   * sheet instead of overwriting it. Every "start this routine" button in the app
   * goes through here, which is what makes that guard universal.
   */
  startRoutine(routine: RoutineTemplate): void;
  /** Folds a routine into the running session. Returns what changed. */
  applyRoutine(routine: RoutineTemplate, mode: 'append' | 'replacePending'): { added: number; skipped: number };
  finishSession(): Promise<void>;
  discardSession(): void;

  logWeight(kg: number): Promise<void>;
  toggleFavorite(exerciseId: string): Promise<void>;
  sendCoachMessage(text: string): Promise<void>;

  /**
   * Pull in workouts older than the year the provider loads at mount, for when
   * the history date picker reaches past it.
   */
  loadOlderHistory(from: Date, to: Date): Promise<void>;
}

export interface AppUiState {
  overlay: OverlayId | null;
  payload: OverlayPayload;
}
