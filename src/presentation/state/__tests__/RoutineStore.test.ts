import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';
import { db } from '../../../data/database/LocalDatabase';

describe('Zustand Store — Routine Integration', () => {
  beforeEach(async () => {
    await db.userProfiles.clear();
    await db.routineTemplates.clear();
    useStore.setState({
      profiles: [],
      activeProfile: null,
      savedRoutines: [],
      activeSession: null,
      isGymModeOpen: false,
    });

    // Create active profile
    const profileId = await useStore.getState().createProfile({
      name: 'Test Athlete',
      gender: 'male',
      birthDate: new Date('1995-05-15'),
      height: 180,
    });
    await useStore.getState().setActiveProfile(profileId);
  });

  it('should start an active session pre-loaded with routine exercises', () => {
    const routine = {
      title: 'Torso Fuerza',
      description: 'Rutina recomendada por Coach',
      targetMuscles: ['Chest', 'Triceps'],
      exercises: [
        { exerciseId: '0025', exerciseName: 'Bench Press', targetSets: 4, targetReps: 10 },
        { exerciseId: '0239', exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: 12 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    const state = useStore.getState();
    expect(state.isGymModeOpen).toBe(true);
    expect(state.activeTab).toBe('train');
    expect(state.activeSession).not.toBeNull();
    expect(state.activeSession?.workoutType).toBe('Torso Fuerza');
    expect(state.activeSession?.routineExercises).toHaveLength(2);
    expect(state.activeSession?.routineExercises?.[0].exerciseName).toBe('Bench Press');
  });

  it('should reorder routine exercises in active session', () => {
    const routine = {
      title: 'Routine Reorder Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Exercise 1', targetSets: 3 },
        { exerciseId: '0002', exerciseName: 'Exercise 2', targetSets: 3 },
        { exerciseId: '0003', exerciseName: 'Exercise 3', targetSets: 3 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    // Reorder Exercise 1 (from index 0 to index 2)
    useStore.getState().reorderActiveSessionExercises(0, 2);

    const exercises = useStore.getState().activeSession?.routineExercises;
    expect(exercises?.[0].exerciseName).toBe('Exercise 2');
    expect(exercises?.[1].exerciseName).toBe('Exercise 3');
    expect(exercises?.[2].exerciseName).toBe('Exercise 1');
  });

  it('should swap a routine exercise while preserving target sets and reps', () => {
    const routine = {
      title: 'Routine Swap Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 10 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    // Swap exercise 0 with Dumbbell Flyes
    useStore.getState().swapActiveSessionExercise(0, { id: '0099', name: 'Dumbbell Flyes' });

    const ex = useStore.getState().activeSession?.routineExercises?.[0];
    expect(ex?.exerciseId).toBe('0099');
    expect(ex?.exerciseName).toBe('Dumbbell Flyes');
    expect(ex?.targetSets).toBe(4);
    expect(ex?.targetReps).toBe(10);
  });

  it('should remove a routine exercise from active session', () => {
    const routine = {
      title: 'Routine Delete Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Exercise 1', targetSets: 3 },
        { exerciseId: '0002', exerciseName: 'Exercise 2', targetSets: 3 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    useStore.getState().removeActiveSessionExercise(0);

    const exercises = useStore.getState().activeSession?.routineExercises;
    expect(exercises).toHaveLength(1);
    expect(exercises?.[0].exerciseName).toBe('Exercise 2');
  });

  it('should save and delete routine templates in database', async () => {
    const routineData = {
      title: 'Saved Hypertrophy Routine',
      description: 'Test Description',
      targetMuscles: ['Back', 'Biceps'],
      exercises: [
        { exerciseId: '0005', exerciseName: 'Lat Pulldown', targetSets: 4, targetReps: 12 },
      ],
    };

    const id = await useStore.getState().saveRoutineTemplate(routineData);
    expect(id).toBeDefined();

    let saved = useStore.getState().savedRoutines;
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('Saved Hypertrophy Routine');

    await useStore.getState().deleteRoutineTemplate(id);
    saved = useStore.getState().savedRoutines;
    expect(saved).toHaveLength(0);
  });
});

describe('mergeRoutineIntoActiveSession', () => {
  const routine = {
    title: 'Empuje',
    exercises: [
      { exerciseId: '0025', exerciseName: 'Bench Press', targetSets: 4, targetReps: 10 },
      { exerciseId: '0300', exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8, notes: 'Slow' },
    ],
  };

  beforeEach(() => {
    useStore.setState({ activeSession: null });
  });

  const sessionWith = (
    exercises: { exerciseName: string; targetSets: number }[],
    sets: { exerciseName: string; setNumber: number; isCompleted: boolean }[] = [],
  ) => {
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Strength Training',
        routineExercises: exercises.map((ex, i) => ({ id: `e${i}`, ...ex })),
        sets: sets.map(s => ({ ...s, weight: 60, reps: 8 })),
      },
    });
  };

  it('does nothing without a session — that case belongs to startActiveSessionWithRoutine', () => {
    expect(useStore.getState().mergeRoutineIntoActiveSession(routine, 'append')).toEqual({ added: 0, skipped: 0 });
    expect(useStore.getState().activeSession).toBeNull();
  });

  it('appends without touching a single logged set', () => {
    // The whole reason this action exists: starting a routine mid-session used to
    // replace `activeSession` outright and take every logged set with it.
    sessionWith([{ exerciseName: 'Squat', targetSets: 3 }], [
      { exerciseName: 'Squat', setNumber: 1, isCompleted: true },
    ]);

    const result = useStore.getState().mergeRoutineIntoActiveSession(routine, 'append');

    expect(result).toEqual({ added: 2, skipped: 0 });
    const session = useStore.getState().activeSession;
    expect(session?.routineExercises?.map(e => e.exerciseName))
      .toEqual(['Squat', 'Bench Press', 'Overhead Press']);
    expect(session?.sets).toHaveLength(1);
    expect(session?.workoutType).toBe('Strength Training');
  });

  it('carries the routine\'s reps and notes across, which addActiveSessionExercise cannot', () => {
    sessionWith([{ exerciseName: 'Squat', targetSets: 3 }]);
    useStore.getState().mergeRoutineIntoActiveSession(routine, 'append');

    const added = useStore.getState().activeSession?.routineExercises?.[2];
    expect(added).toMatchObject({ exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8, notes: 'Slow' });
  });

  it('skips exercises already in the session rather than duplicating them', () => {
    // Sets are keyed by exercise name, so two rows sharing a name share their sets.
    sessionWith([{ exerciseName: '  bench   press ', targetSets: 3 }]);

    const result = useStore.getState().mergeRoutineIntoActiveSession(routine, 'append');

    expect(result).toEqual({ added: 1, skipped: 1 });
    expect(useStore.getState().activeSession?.routineExercises).toHaveLength(2);
  });

  it('replacePending keeps what was logged and drops the untouched plan', () => {
    sessionWith(
      [
        { exerciseName: 'Squat', targetSets: 3 },
        { exerciseName: 'Leg Curl', targetSets: 3 },
      ],
      [
        { exerciseName: 'Squat', setNumber: 1, isCompleted: true },
        // Nudging the dial writes a row without completing it. No work, no reason to keep it.
        { exerciseName: 'Leg Curl', setNumber: 1, isCompleted: false },
      ],
    );

    const result = useStore.getState().mergeRoutineIntoActiveSession(routine, 'replacePending');

    expect(result).toEqual({ added: 2, skipped: 0 });
    const session = useStore.getState().activeSession;
    expect(session?.routineExercises?.map(e => e.exerciseName))
      .toEqual(['Squat', 'Bench Press', 'Overhead Press']);
    expect(session?.sets.map(s => s.exerciseName)).toEqual(['Squat']);
  });

  it('takes the routine\'s name once nothing of the old session survives', () => {
    sessionWith([{ exerciseName: 'Squat', targetSets: 3 }]);

    useStore.getState().mergeRoutineIntoActiveSession(routine, 'replacePending');

    expect(useStore.getState().activeSession?.workoutType).toBe('Empuje');
    expect(useStore.getState().activeSession?.routineExercises).toHaveLength(2);
  });

  it('materialises a freestyle session\'s list before appending to it', () => {
    // A freestyle session has no `routineExercises` — the list is implied by the
    // logged sets. Skipping that step would wipe everything already logged.
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Strength Training',
        sets: [{ exerciseName: 'Deadlift', setNumber: 1, weight: 100, reps: 5, isCompleted: true }],
      },
    });

    useStore.getState().mergeRoutineIntoActiveSession(routine, 'append');

    expect(useStore.getState().activeSession?.routineExercises?.map(e => e.exerciseName))
      .toEqual(['Deadlift', 'Bench Press', 'Overhead Press']);
  });
});
