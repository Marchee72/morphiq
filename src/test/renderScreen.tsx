/* eslint-disable react-refresh/only-export-components -- test helper, not a component module */
import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import type { Measurement } from '../core/entities/Measurement';
import type { WorkoutLog } from '../core/entities/WorkoutLog';
import type { WorkoutSet } from '../core/entities/WorkoutSet';
import type { FoodLog } from '../core/entities/FoodLog';
import type { UserProfile } from '../core/entities/UserProfile';
import { useStore } from '../presentation/state/store';
import { AppDataProvider } from '../ui-atlas/data/AppDataProvider';
import { AppActionsProvider } from '../ui-atlas/data/AppActionsProvider';
import { useAppActions } from '../ui-atlas/data/useAppData';
import { SocialProvider } from '../ui-atlas/data/SocialProvider';
import { AppOverlays } from '../ui-atlas/shell/AppOverlays';
import { AtlasToday } from '../ui-atlas/atlas/AtlasToday';
import { AtlasTrain } from '../ui-atlas/atlas/AtlasTrain';
import { AtlasLibrary } from '../ui-atlas/atlas/AtlasLibrary';
import { AtlasBody } from '../ui-atlas/atlas/AtlasBody';
import { AtlasCoach } from '../ui-atlas/atlas/AtlasCoach';
import { AtlasBuddies } from '../ui-atlas/atlas/AtlasBuddies';
import type { ScreenId } from '../ui-atlas/types';

/**
 * The overlays, wired to dismiss the way the real shell wires them.
 *
 * `AppShell` passes `actions.closeOverlay`; this used to pass a no-op with a
 * comment saying the provider owned dismissal — which it does, and it was never
 * told. Nothing could be closed under test, so every "open it, dismiss it,
 * reopen it" flow silently exercised a sheet that had never gone away.
 *
 * A component rather than an inline prop because `useAppActions` has to be
 * called beneath `AppActionsProvider`, not beside it.
 */
const Overlays: React.FC = () => {
  const actions = useAppActions();
  return <AppOverlays onClose={actions.closeOverlay} />;
};

const SCREENS: Record<ScreenId, React.FC> = {
  today: AtlasToday,
  train: AtlasTrain,
  library: AtlasLibrary,
  body: AtlasBody,
  coach: AtlasCoach,
  buddies: AtlasBuddies,
};

/**
 * Renders one screen against a controlled data level.
 *
 * The three levels exist because the concepts were designed around a user
 * mid-session with twelve weeks of history, and most real users are not that.
 * `empty` is day one, `sparse` is a fortnight in, `rich` is the designed case.
 */
export type DataLevel = 'empty' | 'sparse' | 'rich';

const NOW = new Date(2026, 6, 27, 18, 30);
const DAY = 86_400_000;

export const testProfile: UserProfile = {
  id: 'p1',
  name: 'Marche',
  gender: 'male',
  birthDate: new Date(1990, 0, 1),
  height: 178,
  targetWeight: 74,
  weeklyWorkoutGoalDays: 4,
  createdAt: new Date(2024, 0, 1),
};

function measurement(daysAgo: number, weight: number): Measurement {
  return {
    id: `m${daysAgo}`,
    profileId: 'p1',
    timestamp: new Date(NOW.getTime() - daysAgo * DAY),
    weight,
    impedance: 500,
    bmi: 24.5,
    bmr: 1740,
    bodyFat: 18 + daysAgo * 0.02,
    bodyWater: 55,
    boneMass: 3.2,
    muscleMass: 62,
    };
}

function workout(id: string, daysAgo: number): WorkoutLog {
  return {
    id,
    profileId: 'p1',
    timestamp: new Date(NOW.getTime() - daysAgo * DAY),
    type: 'Push A',
    duration: 62,
    description: '',
    caloriesBurned: 430,
    feelingTag: 'good',
  };
}

function sets(logId: string, name: string, count: number, weight: number): WorkoutSet[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${logId}-${i}`,
    workoutLogId: logId,
    profileId: 'p1',
    exerciseName: name,
    setNumber: i + 1,
    weight,
    reps: 8,
    isCompleted: true,
    timestamp: new Date(NOW.getTime() - DAY),
  }));
}

interface Fixture {
  measurements: Measurement[];
  workoutHistory: WorkoutLog[];
  activeWorkoutSets: Record<string, WorkoutSet[]>;
  allSets: WorkoutSet[];
  foodLogs: FoodLog[];
}

function fixture(level: DataLevel): Fixture {
  if (level === 'empty') {
    return { measurements: [], workoutHistory: [], activeWorkoutSets: {}, allSets: [], foodLogs: [] };
  }

  const benchSets = sets('w1', 'Barbell Bench Press', 4, 82.5);
  const rowSets = sets('w1', 'Barbell Row', 3, 70);
  const squatSets = sets('w2', 'Back Squat', 4, 110);

  if (level === 'sparse') {
    return {
      measurements: [measurement(20, 80.4), measurement(2, 79.8)],
      workoutHistory: [workout('w1', 1)],
      activeWorkoutSets: { w1: benchSets },
      allSets: benchSets,
      foodLogs: [],
    };
  }

  const history = [workout('w1', 1), workout('w2', 3), workout('w3', 6), workout('w4', 9)];
  const all = [...benchSets, ...rowSets, ...squatSets];
  return {
    measurements: Array.from({ length: 12 }, (_, i) => measurement(80 - i * 7, 82 - i * 0.3)),
    workoutHistory: history,
    activeWorkoutSets: { w1: [...benchSets, ...rowSets], w2: squatSets },
    allSets: all,
    foodLogs: [{
      id: 'f1', profileId: 'p1', timestamp: NOW, mealType: 'lunch',
      description: 'Chicken and rice', calories: 720, protein: 52, carbs: 80, fat: 18,
    }],
  };
}

/** A live session to render Train against. `renderSkin` owns store state, so a
 *  session has to be passed in rather than set beforehand — setting it first
 *  would be overwritten. */
export interface SessionFixture {
  workoutType?: string;
  startedAt?: Date;
  exercises?: { id: string; exerciseId?: string; exerciseName: string; targetSets: number; targetReps?: number }[];
  sets?: {
    exerciseName: string; setNumber: number;
    weight?: number; reps?: number; isCompleted?: boolean;
    /** Borg 6-20, for fixtures that start from an already-rated exercise. */
    rpe?: number;
  }[];
}

export interface RenderSkinOptions {
  data?: DataLevel;
  now?: Date;
  session?: SessionFixture | null;
  /** Anything else the screen under test needs — chat history, routines, favourites.
   *  Applied last, because `renderSkin` owns store state and would otherwise
   *  overwrite whatever the test set beforehand. */
  overrides?: Partial<ReturnType<typeof useStore.getState>>;
}

const DEFAULT_SESSION_EXERCISES = [
  { id: 'e1', exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 3, targetReps: 8 },
  { id: 'e2', exerciseName: 'Barbell Row', targetSets: 3, targetReps: 10 },
];

export function renderScreen(
  screen: ScreenId,
  { data = 'rich', now = NOW, session = null, overrides }: RenderSkinOptions = {},
): RenderResult {
  const f = fixture(data);
  useStore.setState({
    activeProfile: testProfile,
    profiles: [testProfile],
    activeTab: screen,
    activeSession: session
      ? {
          startTime: session.startedAt ?? new Date(NOW.getTime() - 35 * 60_000),
          workoutType: session.workoutType ?? 'Push A',
          routineSource: 'manual',
          routineExercises: session.exercises ?? DEFAULT_SESSION_EXERCISES,
          sets: session.sets ?? [],
        }
      : null,
    savedRoutines: [],
    favoriteExerciseIds: [],
    chatHistory: [],
    workoutLogs: f.workoutHistory,
    ...f,
    ...overrides,
  });

  const Screen = SCREENS[screen];

  return render(
    <AppDataProvider now={now}>
      <AppActionsProvider>
        {/* Mounted for the same reason `AppOverlays` is: it is part of the shell
            every screen actually runs inside. Under test `VITE_DB_TYPE` is
            `local`, so it reports itself unavailable and does no work — which is
            also the honest default for a screen that has no partners. */}
        <SocialProvider>
          <div className="app at">
            <Screen />
            {/* Overlays are part of the shell, and flows like "add an exercise"
                cross that boundary — a screen alone cannot be exercised. */}
            <Overlays />
          </div>
        </SocialProvider>
      </AppActionsProvider>
    </AppDataProvider>,
  );
}

export { NOW as TEST_NOW };
