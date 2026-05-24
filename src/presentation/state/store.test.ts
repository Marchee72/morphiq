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

    // Reset store state
    useStore.setState({
      profiles: [],
      activeProfile: null,
      measurements: [],
      foodLogs: [],
      workoutLogs: [],
      chatHistory: [],
      isScanning: false,
      scaleWeight: 0,
      scaleImpedance: 0,
      scaleStabilized: false,
      scaleImpedancePresent: false,
      isSimulator: true,
      apiKey: '',
      isAiLoading: false,
    });
  });

  it('should manage profile creation and selection', async () => {
    const store = useStore.getState();
    const id = await store.createProfile({
      name: 'Bruce Wayne',
      gender: 'male',
      age: 35,
      height: 188,
    });

    expect(id).toBeDefined();
    
    const updatedStore = useStore.getState();
    expect(updatedStore.profiles.length).toBe(1);
    expect(updatedStore.activeProfile).not.toBeNull();
    expect(updatedStore.activeProfile!.name).toBe('Bruce Wayne');
  });

  it('should save scale measurements and calculate BIA report', async () => {
    // 1. Create a profile
    const store = useStore.getState();
    const pId = await store.createProfile({
      name: 'Clark Kent',
      gender: 'male',
      age: 30,
      height: 190,
    });

    // 2. Set mock scale variables
    useStore.setState({
      scaleWeight: 100, // 100 kg
      scaleImpedance: 450, // 450 ohms
      scaleStabilized: true,
      scaleImpedancePresent: true,
    });

    // 3. Save measurement
    await useStore.getState().addMeasurementFromScale();

    const updatedStore = useStore.getState();
    expect(updatedStore.measurements.length).toBe(1);
    
    const measurement = updatedStore.measurements[0];
    expect(measurement.weight).toBe(100);
    expect(measurement.impedance).toBe(450);
    expect(measurement.bmi).toBeCloseTo(27.7, 1);
    expect(measurement.bodyFat).toBeGreaterThan(5);
    expect(measurement.muscleMass).toBeGreaterThan(40);
    expect(measurement.bmr).toBeGreaterThan(1200);
  });

  it('should log food and workouts', async () => {
    const store = useStore.getState();
    await store.createProfile({
      name: 'Diana Prince',
      gender: 'female',
      age: 28,
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
});
