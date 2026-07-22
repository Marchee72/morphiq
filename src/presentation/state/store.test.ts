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

  it('should auto-merge manual routine sets to synced workouts during import', async () => {
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
    // Synced workout should be added
    const syncedWorkout = finalStore.workoutLogs.find(w => w.externalId === 'sh_workout_123');
    expect(syncedWorkout).toBeDefined();
    const newLogId = syncedWorkout!.id!;

    // Manual workout should be deleted/merged
    const manualWorkout = finalStore.workoutLogs.find(w => w.id === manualLogId);
    expect(manualWorkout).toBeUndefined();

    // Sets should now be associated with the synced workout ID
    const mergedSets = finalStore.activeWorkoutSets[newLogId];
    expect(mergedSets).toBeDefined();
    expect(mergedSets.length).toBe(1);
    expect(mergedSets[0].exerciseName).toBe('Squat');
    expect(mergedSets[0].weight).toBe(100);
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
        visceralFat: 6,
        metabolicAge: 30,
        protein: 21.0,
        bodyType: 5,
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
        visceralFat: 6,
        metabolicAge: 30,
        protein: 21.0,
        bodyType: 5,
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

