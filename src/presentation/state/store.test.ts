import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

describe('Zustand store state management', () => {
  beforeEach(async () => {
    // Reset database
    await db.userProfiles.clear();
    await db.measurements.clear();
    await db.foodLogs.clear();
    await db.workoutLogs.clear();
    await db.messages.clear();
    await db.workoutSets.clear();

    // Reset store state
    useStore.setState({
      profiles: [],
      activeProfile: null,
      measurements: [],
      foodLogs: [],
      workoutLogs: [],
      chatHistory: [],
      activeWorkoutSets: {},
      exerciseStats: {},
      apiKey: '',
      isAiLoading: false,
      theme: 'system',
    });
  });

  it('should toggle theme and store preference', () => {
    const store = useStore.getState();
    expect(store.theme).toBe('system');

    store.setTheme('dark');
    expect(useStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('morphiq_theme')).toBe('dark');
  });

  it('should export and import backup data correctly', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Clark Kent',
      gender: 'male',
      birthDate: new Date('1990-06-18'),
      height: 190,
    });

    await useStore.getState().addFoodLog({
      mealType: 'lunch',
      description: 'Chicken Salad',
      calories: 450,
      protein: 40,
      carbs: 20,
      fat: 15,
    });

    const jsonBackup = await useStore.getState().exportBackupData();
    expect(jsonBackup).toContain('Clark Kent');
    expect(jsonBackup).toContain('Chicken Salad');

    // Reset state & DB
    await db.userProfiles.clear();
    await db.foodLogs.clear();
    useStore.setState({ profiles: [], activeProfile: null, foodLogs: [] });

    // Import backup
    const success = await useStore.getState().importBackupData(jsonBackup);
    expect(success).toBe(true);
    expect(useStore.getState().profiles.length).toBe(1);
    expect(useStore.getState().profiles[0].name).toBe('Clark Kent');
  });

  it('should manage profile creation and selection', async () => {
    const store = useStore.getState();
    const id = await store.createProfile({
      name: 'Bruce Wayne',
      gender: 'male',
      birthDate: new Date('1991-05-24'),
      height: 188,
    });

    expect(id).toBeDefined();
    
    const updatedStore = useStore.getState();
    expect(updatedStore.profiles.length).toBe(1);
    expect(updatedStore.activeProfile).not.toBeNull();
    expect(updatedStore.activeProfile!.name).toBe('Bruce Wayne');
  });

  it('should log food and workouts', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Diana Prince',
      gender: 'female',
      birthDate: new Date('1998-05-24'),
      height: 178,
    });

    // Add food log
    await useStore.getState().addFoodLog({
      mealType: 'breakfast',
      description: 'Greek Yogurt',
      calories: 200,
      protein: 20,
      carbs: 10,
      fat: 2,
    });

    // Add workout log
    await useStore.getState().addWorkoutLog({
      type: 'Yoga',
      duration: 30,
      description: 'Morning stretches',
      caloriesBurned: 120,
    });

    const updatedStore = useStore.getState();
    expect(updatedStore.foodLogs.length).toBe(1);
    expect(updatedStore.foodLogs[0].description).toBe('Greek Yogurt');
    expect(updatedStore.workoutLogs.length).toBe(1);
    expect(updatedStore.workoutLogs[0].type).toBe('Yoga');

    // Delete logs
    await useStore.getState().deleteFoodLog(updatedStore.foodLogs[0].id!);
    await useStore.getState().deleteWorkoutLog(updatedStore.workoutLogs[0].id!);

    const emptyStore = useStore.getState();
    expect(emptyStore.foodLogs.length).toBe(0);
    expect(emptyStore.workoutLogs.length).toBe(0);
  });

  it('should track workout routine sets and calculate exercise stats in state', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Diana Prince',
      gender: 'female',
      birthDate: new Date('1998-05-24'),
      height: 178,
    });

    // Add workout log
    await useStore.getState().addWorkoutLog({
      type: 'Strength Training',
      duration: 45,
      description: 'Powerlifting focus',
    });

    const updatedStore = useStore.getState();
    const workoutLogId = updatedStore.workoutLogs[0].id!;

    // Add sets
    await useStore.getState().addWorkoutSet({
      workoutLogId,
      exerciseName: 'Bench Press',
      setNumber: 1,
      weight: 60,
      reps: 8,
    });

    await useStore.getState().addWorkoutSet({
      workoutLogId,
      exerciseName: 'Bench Press',
      setNumber: 2,
      weight: 65,
      reps: 6,
    });

    const storeAfterSets = useStore.getState();
    const sets = storeAfterSets.activeWorkoutSets[workoutLogId];
    expect(sets).toBeDefined();
    expect(sets.length).toBe(2);
    expect(sets[0].weight).toBe(60);
    expect(sets[1].weight).toBe(65);

    // Check stats
    const stats = storeAfterSets.exerciseStats['Bench Press'];
    expect(stats).not.toBeNull();
    expect(stats?.maxWeight).toBe(65);
    expect(stats?.avgWeight).toBe(62.5);
    expect(stats?.avgReps).toBe(7);

    // Delete set
    await useStore.getState().deleteWorkoutSet(sets[0].id!, workoutLogId);
    
    const storeAfterDelete = useStore.getState();
    expect(storeAfterDelete.activeWorkoutSets[workoutLogId].length).toBe(1);
    expect(storeAfterDelete.exerciseStats['Bench Press']?.maxWeight).toBe(65);
    expect(storeAfterDelete.exerciseStats['Bench Press']?.avgWeight).toBe(65);
    expect(storeAfterDelete.exerciseStats['Bench Press']?.avgReps).toBe(6);
  });

  it('folds a synced strength activity into the session you logged, keeping the session', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Diana Prince',
      gender: 'female',
      birthDate: new Date('1998-05-24'),
      height: 178,
    });

    const manualLogId = await useStore.getState().addWorkoutLog({
      type: 'Strength Training',
      duration: 0,
      description: 'Active Gym Session',
      source: 'manual',
    });

    // Add sets to the manual workout
    await useStore.getState().addWorkoutSet({
      workoutLogId: manualLogId,
      exerciseName: 'Squat',
      setNumber: 1,
      weight: 100,
      reps: 5,
    });

    // Verify sets are registered under the manual workout
    const storeAfterSets = useStore.getState();
    expect(storeAfterSets.activeWorkoutSets[manualLogId].length).toBe(1);

    // Import synced Samsung Health workout logged at the same time
    await useStore.getState().importWorkouts([
      {
        type: 'Strength Training',
        duration: 50,
        description: 'Samsung Health workout details',
        caloriesBurned: 400,
        source: 'health-connect',
        externalId: 'sh_workout_123',
        timestamp: new Date(),
      }
    ]);

    const finalStore = useStore.getState();

    /**
     * The session survives, not the synced record. It used to be the other way
     * round, which threw away the session's name, feeling and notes and left the
     * watch's duration standing in front of the work that was actually done.
     */
    const manualWorkout = finalStore.workoutLogs.find(w => w.id === manualLogId);
    expect(manualWorkout).toBeDefined();
    expect(manualWorkout!.description).toBe('Active Gym Session');

    // Only the watch's own contribution is taken across.
    expect(manualWorkout!.caloriesBurned).toBe(400);
    // And the synced id, so the next sync dedupes instead of re-importing.
    expect(manualWorkout!.externalId).toBe('sh_workout_123');

    // The duplicate synced row is gone.
    expect(finalStore.workoutLogs.find(w => w.id !== manualLogId && w.externalId === 'sh_workout_123'))
      .toBeUndefined();

    // The sets never move, so they cannot land on the wrong log.
    const sets = finalStore.activeWorkoutSets[manualLogId];
    expect(sets).toHaveLength(1);
    expect(sets[0].exerciseName).toBe('Squat');
    expect(sets[0].weight).toBe(100);
  });

  it('never merges a session into a walk, however close in time', async () => {
    await useStore.getState().createProfile({
      name: 'Barry Allen',
      gender: 'male',
      birthDate: new Date('1995-03-14'),
      height: 180,
    });

    const manualLogId = await useStore.getState().addWorkoutLog({
      type: 'Chest & Triceps',
      duration: 52,
      description: 'Real session',
      source: 'manual',
    });
    await useStore.getState().addWorkoutSet({
      workoutLogId: manualLogId,
      exerciseName: 'Barbell Bench Press',
      setNumber: 1,
      weight: 82.5,
      reps: 8,
    });

    // The exact shape that swallowed a gym session: a short walk logged minutes
    // away, which the old ±4-hour type-blind filter accepted as the same event.
    await useStore.getState().importWorkouts([
      {
        type: 'WALKING',
        duration: 14,
        description: 'WALKING via Health Connect',
        caloriesBurned: 60,
        source: 'health-connect',
        externalId: 'hc_walk_1',
        timestamp: new Date(),
      },
      {
        type: 'OTHER',
        duration: 83,
        description: 'OTHER via Health Connect',
        source: 'health-connect',
        externalId: 'hc_other_1',
        timestamp: new Date(),
      },
    ]);

    const store = useStore.getState();

    // Both stay as their own records...
    expect(store.workoutLogs.find(w => w.externalId === 'hc_walk_1')).toBeDefined();
    expect(store.workoutLogs.find(w => w.externalId === 'hc_other_1')).toBeDefined();
    // ...and the session is untouched, sets included.
    const session = store.workoutLogs.find(w => w.id === manualLogId);
    expect(session).toBeDefined();
    expect(session!.type).toBe('Chest & Triceps');
    expect(store.activeWorkoutSets[manualLogId]).toHaveLength(1);

    // Nothing was re-pointed onto the walk.
    const walkId = store.workoutLogs.find(w => w.externalId === 'hc_walk_1')!.id!;
    expect(await useStore.getState().getSetsForExercise('Barbell Bench Press'))
      .toEqual([expect.objectContaining({ workoutLogId: manualLogId })]);
    expect(store.activeWorkoutSets[walkId] ?? []).toHaveLength(0);
  });

  it('leaves a synced strength activity alone when no session overlaps it', async () => {
    await useStore.getState().createProfile({
      name: 'Kara Danvers',
      gender: 'female',
      birthDate: new Date('1994-09-22'),
      height: 170,
    });

    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    await useStore.getState().importWorkouts([
      {
        type: 'STRENGTH_TRAINING',
        duration: 45,
        description: 'Gym via watch',
        caloriesBurned: 320,
        source: 'health-connect',
        externalId: 'hc_strength_1',
        timestamp: twoDaysAgo,
      },
    ]);

    const synced = useStore.getState().workoutHistory.find(w => w.externalId === 'hc_strength_1');
    expect(synced).toBeDefined();
    expect(synced!.caloriesBurned).toBe(320);
  });

  it('should import body composition measurements and filter out duplicate entries', async () => {
    // 1. Create a profile
    const store = useStore.getState();
    await store.createProfile({
      name: 'Oliver Queen',
      gender: 'male',
      birthDate: new Date('1990-05-24'),
      height: 185,
    });

    const testTime = new Date('2026-05-28T12:00:00Z');

    // 2. Import a new measurement
    await useStore.getState().importMeasurements([
      {
        timestamp: testTime,
        weight: 85.2,
        impedance: 500,
        bmi: 24.9,
        bmr: 1850,
        bodyFat: 16.5,
        bodyWater: 58.0,
        boneMass: 3.5,
        muscleMass: 67.5,
        }
    ]);

    const afterImportStore = useStore.getState();
    expect(afterImportStore.measurements.length).toBe(1);
    expect(afterImportStore.measurements[0].weight).toBe(85.2);

    // 3. Try to import the same measurement or one with overlapping timestamp (within the same minute)
    await useStore.getState().importMeasurements([
      {
        timestamp: new Date(testTime.getTime() + 20 * 1000), // 20 seconds later
        weight: 85.2,
        impedance: 500,
        bmi: 24.9,
        bmr: 1850,
        bodyFat: 16.5,
        bodyWater: 58.0,
        boneMass: 3.5,
        muscleMass: 67.5,
        }
    ]);

    const finalStore = useStore.getState();
    // Length should still be 1 (duplicate skipped)
    expect(finalStore.measurements.length).toBe(1);
  });

  it('should format workout history details for periodic coach analysis', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Diana Prince',
      gender: 'female',
      birthDate: new Date('1990-01-01'),
      height: 180,
    });

    // Add a synced workout log in store state
    const workoutId = await store.addWorkoutLog({
      type: 'Strength Training',
      duration: 60,
      description: 'Leg Day Volume',
      caloriesBurned: 450,
      source: 'health-connect',
    });

    // Add set details
    await store.addWorkoutSet({
      workoutLogId: workoutId,
      exerciseName: 'Deadlift',
      weight: 120,
      reps: 5,
      setNumber: 1,
    });

    // Run history analysis
    // (This will test formatting summary, although actual LLM call will return warning string if no API key is in test environment)
    const result = await store.analyzeWorkoutHistoryPeriod('week');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should toggle local notification monthly reminders and update local storage state', async () => {
    const store = useStore.getState();
    
    // Schedule
    await store.scheduleMonthlyReminder();
    expect(localStorage.getItem('morphiq_monthly_reminder')).toBe('true');

    // Cancel
    await store.cancelMonthlyReminder();
    expect(localStorage.getItem('morphiq_monthly_reminder')).toBe('false');
  });

  it('should support updating workout logs and run the seconds-to-minutes migration in setActiveProfile', async () => {
    const store = useStore.getState();
    const profileId = await store.createProfile({
      name: 'Migration Test User',
      gender: 'male',
      birthDate: new Date('1995-05-15'),
      height: 175,
    });

    // Directly insert an unmigrated synced workout with duration in seconds (e.g. 3600 seconds = 60 mins)
    const numericId = await db.workoutLogs.add({
      profileId,
      timestamp: new Date(),
      type: 'Running',
      duration: 3600, // stored in seconds
      description: 'Samsung Health Synced Workout',
      source: 'health-connect',
      externalId: 'test_sec_migration_123',
    });
    const logId = numericId.toString();

    // Verify it is initially in seconds in the database
    const savedLog = await db.workoutLogs.get(numericId);
    expect(savedLog).toBeDefined();
    expect(savedLog!.duration).toBe(3600);

    // Call setActiveProfile to trigger the migration
    await store.setActiveProfile(profileId);

    // Verify the duration has been migrated to minutes (3600 / 60 = 60)
    const migratedLog = await db.workoutLogs.get(numericId);
    expect(migratedLog).toBeDefined();
    expect(migratedLog!.duration).toBe(60);

    // Verify store state has the migrated value
    const finalStore = useStore.getState();
    const storeLog = finalStore.workoutLogs.find(w => w.id === logId);
    expect(storeLog).toBeDefined();
    expect(storeLog!.duration).toBe(60);
  });

  it('should link pending routine sets to a new workout and clear pending sets from store', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Test Profile',
      gender: 'male',
      birthDate: new Date('1990-01-01'),
      height: 180,
    });

    // Add pending sets
    await useStore.getState().addWorkoutSet({
      workoutLogId: 'pending',
      exerciseName: 'Squat',
      setNumber: 1,
      weight: 100,
      reps: 5,
    });

    // Verify it is in pending
    let currentStore = useStore.getState();
    expect(currentStore.activeWorkoutSets['pending']).toBeDefined();
    expect(currentStore.activeWorkoutSets['pending'].length).toBe(1);

    // Save workout log
    const logId = await useStore.getState().addWorkoutLog({
      type: 'Strength Training',
      duration: 60,
      description: 'Squat day',
    });

    // Link pending sets to this workout
    await useStore.getState().linkPendingRoutineToWorkout(logId);

    // Verify it is moved
    currentStore = useStore.getState();
    expect(currentStore.activeWorkoutSets['pending']).toBeDefined();
    expect(currentStore.activeWorkoutSets['pending'].length).toBe(0);

    expect(currentStore.activeWorkoutSets[logId]).toBeDefined();
    expect(currentStore.activeWorkoutSets[logId].length).toBe(1);
    expect(currentStore.activeWorkoutSets[logId][0].exerciseName).toBe('Squat');
  });
});

/**
 * Sets key on exercise name, and the exercise list is a separate array. Changing
 * one without the other leaves sets in the session that no exercise owns — they
 * vanish from the screen but are still written to history when the session ends.
 */
describe('active session — exercise list and sets stay in step', () => {
  beforeEach(() => {
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Push A',
        routineExercises: [
          { id: 'e1', exerciseName: 'Bench Press', targetSets: 2 },
          { id: 'e2', exerciseName: 'Barbell Row', targetSets: 2 },
        ],
        sets: [
          { exerciseName: 'Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });
  });

  it('drops an exercise together with its logged sets', () => {
    useStore.getState().removeActiveSessionExercise(0);

    const session = useStore.getState().activeSession;
    expect(session?.routineExercises?.map(e => e.exerciseName)).toEqual(['Barbell Row']);
    expect(session?.sets.map(s => s.exerciseName)).toEqual(['Barbell Row']);
  });

  it('drops the outgoing exercise sets when one is swapped out', () => {
    useStore.getState().swapActiveSessionExercise(0, { id: '0025', name: 'Incline Press' });

    const session = useStore.getState().activeSession;
    expect(session?.routineExercises?.[0]).toMatchObject({
      exerciseId: '0025',
      exerciseName: 'Incline Press',
    });
    // The replaced lift's sets must not be inherited by the one that took its place.
    expect(session?.sets.map(s => s.exerciseName)).toEqual(['Barbell Row']);
  });

  it('matches names the way the derive layer does, ignoring case and spacing', () => {
    useStore.setState({
      activeSession: {
        ...useStore.getState().activeSession!,
        sets: [{ exerciseName: '  bench   press ', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    useStore.getState().removeActiveSessionExercise(0);
    expect(useStore.getState().activeSession?.sets).toHaveLength(0);
  });

  it('keeps freestyle exercises visible when the first one is added by hand', () => {
    // A freestyle session has no `routineExercises` — the list is implied by the
    // sets. Appending used to start from an empty array and hide everything.
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Freestyle',
        sets: [
          { exerciseName: 'Deadlift', setNumber: 1, weight: 140, reps: 5, isCompleted: true },
          { exerciseName: 'Deadlift', setNumber: 2, weight: 140, reps: 5, isCompleted: true },
        ],
      },
    });

    useStore.getState().addActiveSessionExercise({ id: '0025', name: 'Bench Press' });

    const list = useStore.getState().activeSession?.routineExercises ?? [];
    expect(list.map(e => e.exerciseName)).toEqual(['Deadlift', 'Bench Press']);
    expect(list[0].targetSets).toBe(2);
  });
});

/**
 * Finishing is the one action in the app that can lose or duplicate a whole
 * session, and it had been doing the second: the writes ran set by set with a
 * read-back after each, and `activeSession` was only released once every one of
 * them had landed. Over a phone connection that gap is long enough to press
 * finish again, and pressing it again filed the workout a second time. Real
 * sessions in the database are recorded three times over.
 */
describe('finishing an exercise short of its planned sets', () => {
  const session = (over = {}) => ({
    startTime: new Date(),
    workoutType: 'Push A',
    routineExercises: [
      { id: 'e1', exerciseName: 'Bench Press', targetSets: 4 },
      { id: 'e2', exerciseName: 'Barbell Row', targetSets: 4 },
    ],
    sets: [
      { exerciseName: 'Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
      { exerciseName: 'Bench Press', setNumber: 2, weight: 80, reps: 7, isCompleted: true },
      { exerciseName: 'Bench Press', setNumber: 3, weight: 0, reps: 0, isCompleted: false },
      { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
    ],
    ...over,
  });

  beforeEach(() => useStore.setState({ activeSession: session() }));

  it('lowers the plan to the sets actually completed', () => {
    useStore.getState().finishActiveSessionExercise(0);

    const active = useStore.getState().activeSession;
    // 2 of 4 done, so the exercise now plans 2 — which is what makes
    // `buildSessionExercises` (max(targetSets, logged)) call it complete.
    expect(active?.routineExercises?.[0].targetSets).toBe(2);
    // The other exercise is untouched.
    expect(active?.routineExercises?.[1].targetSets).toBe(4);
  });

  it('keeps every completed set and drops only the unlogged ones', () => {
    useStore.getState().finishActiveSessionExercise(0);

    const bench = useStore.getState().activeSession!.sets
      .filter(s => s.exerciseName === 'Bench Press');
    expect(bench).toHaveLength(2);
    expect(bench.map(s => s.reps)).toEqual([8, 7]);
    // Set numbers stay contiguous, or the next write to this exercise lands
    // in the gap the removed set left.
    expect(bench.map(s => s.setNumber)).toEqual([1, 2]);
  });

  it('leaves the sets of other exercises alone', () => {
    useStore.getState().finishActiveSessionExercise(0);

    const rows = useStore.getState().activeSession!.sets
      .filter(s => s.exerciseName === 'Barbell Row');
    expect(rows).toHaveLength(1);
  });

  it('does nothing when no set was completed — that is removal, not finishing', () => {
    useStore.setState({
      activeSession: session({
        sets: [{ exerciseName: 'Bench Press', setNumber: 1, weight: 0, reps: 0, isCompleted: false }],
      }),
    });
    useStore.getState().finishActiveSessionExercise(0);

    const active = useStore.getState().activeSession;
    expect(active?.routineExercises?.[0].targetSets).toBe(4);
    expect(active?.sets).toHaveLength(1);
  });

  it('materialises the list for a freestyle session that has no plan', () => {
    useStore.setState({
      activeSession: session({
        routineExercises: undefined,
        sets: [
          { exerciseName: 'Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Bench Press', setNumber: 2, weight: 0, reps: 0, isCompleted: false },
        ],
      }),
    });
    useStore.getState().finishActiveSessionExercise(0);

    const active = useStore.getState().activeSession;
    expect(active?.routineExercises?.[0]).toMatchObject({ exerciseName: 'Bench Press', targetSets: 1 });
    expect(active?.sets).toHaveLength(1);
  });

  it('ignores an index that is not there', () => {
    useStore.getState().finishActiveSessionExercise(9);
    expect(useStore.getState().activeSession?.sets).toHaveLength(4);
  });
});

describe('finishing the active session', () => {
  const profile = {
    id: 'p1',
    name: 'Marche',
    gender: 'male' as const,
    birthDate: new Date(1990, 0, 1),
    height: 178,
    createdAt: new Date(2024, 0, 1),
  };

  beforeEach(async () => {
    await Promise.all([db.workoutLogs.clear(), db.workoutSets.clear()]);
    useStore.setState({
      activeProfile: profile,
      profiles: [profile],
      workoutLogs: [],
      workoutHistory: [],
      activeWorkoutSets: {},
      isFinishingSession: false,
      activeSession: {
        startTime: new Date(Date.now() - 40 * 60_000),
        workoutType: 'Push A',
        routineExercises: [{ id: 'e1', exerciseName: 'Bench Press', targetSets: 2 }],
        sets: [
          { exerciseName: 'Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Bench Press', setNumber: 2, weight: 82.5, reps: 6, isCompleted: true },
        ],
      },
    });
  });

  /**
   * Finishing used to file the log whatever was in it, so opening the gym and
   * backing out through Finish left a "0 sets completed" workout in history,
   * counting toward the streak. Three of them reached production.
   */
  it('discards a session with nothing logged instead of filing it', async () => {
    useStore.setState({
      activeSession: {
        startTime: new Date(Date.now() - 5 * 60_000),
        workoutType: 'Push A',
        routineExercises: [{ id: 'e1', exerciseName: 'Bench Press', targetSets: 2 }],
        sets: [],
      },
    });

    await useStore.getState().finishActiveSession();

    expect(await db.workoutLogs.count()).toBe(0);
    expect(await db.workoutSets.count()).toBe(0);
    // Still ends the session — the user pressed Finish and expects to be out.
    expect(useStore.getState().activeSession).toBeNull();
    expect(useStore.getState().isGymModeOpen).toBe(false);
    // The guard returns before the flag is raised, so nothing is left latched.
    expect(useStore.getState().isFinishingSession).toBe(false);
  });

  it('writes the workout and every set of it', async () => {
    await useStore.getState().finishActiveSession();

    const logs = await db.workoutLogs.toArray();
    expect(logs).toHaveLength(1);

    const written = await db.workoutSets.toArray();
    expect(written.map(s => s.setNumber).sort()).toEqual([1, 2]);
    // Written in parallel, so they must still all be filed under the one log.
    // Dexie hands back a numeric key and the repository stringifies it.
    expect(new Set(written.map(s => String(s.workoutLogId)))).toEqual(new Set([String(logs[0].id)]));
    expect(useStore.getState().activeSession).toBeNull();
  });

  it('files one workout however many times finish is pressed', async () => {
    // Both calls start before either finishes — exactly the double-tap that
    // produced the duplicates.
    await Promise.all([
      useStore.getState().finishActiveSession(),
      useStore.getState().finishActiveSession(),
    ]);

    expect(await db.workoutLogs.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(2);
  });

  it('has nothing left to duplicate once the writes have landed', async () => {
    await useStore.getState().finishActiveSession();
    await useStore.getState().finishActiveSession();

    expect(await db.workoutLogs.count()).toBe(1);
    expect(useStore.getState().isFinishingSession).toBe(false);
  });

  it('lets go of the session before reading anything back', async () => {
    // The refresh is the slow part and the user is waiting on it for no reason:
    // the data is safe the moment the sets are written.
    let clearedBeforeRefresh = false;
    const realLoad = useStore.getState().loadWorkoutHistory;
    useStore.setState({
      loadWorkoutHistory: async (days?: number) => {
        clearedBeforeRefresh = useStore.getState().activeSession === null;
        await realLoad(days);
      },
    });

    await useStore.getState().finishActiveSession();
    useStore.setState({ loadWorkoutHistory: realLoad });

    expect(clearedBeforeRefresh).toBe(true);
  });
});

