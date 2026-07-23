import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';

export function generateMockMeasurements(profileId: string): Measurement[] {
  const measurements: Measurement[] = [];
  const baseWeight = 79.2;
  const now = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(8, 15, 0, 0);

    const weightDrop = (13 - i) * 0.18 + (Math.sin(i) * 0.15);
    const weight = Number((baseWeight - weightDrop).toFixed(1));

    const bodyFat = Number((20.8 - (13 - i) * 0.12).toFixed(1));
    const muscleMass = Number((36.2 + (13 - i) * 0.05).toFixed(1));
    const bodyWater = Number((55.8 + (13 - i) * 0.08).toFixed(1));

    const heightM = 1.78;
    const bmi = Number((weight / (heightM * heightM)).toFixed(1));
    const bmr = Math.round(66.47 + (13.75 * weight) + (5.003 * 178) - (6.755 * 28));

    measurements.push({
      profileId,
      timestamp: d,
      weight,
      impedance: 495 - (i * 2),
      bmi,
      bmr,
      bodyFat,
      bodyWater,
      boneMass: 3.4,
      muscleMass,
      visceralFat: 6,
      metabolicAge: 27,
      protein: 18.2,
      bodyType: 4,
    });
  }

  return measurements;
}

export function generateMockFoodLogs(profileId: string): Omit<FoodLog, 'id'>[] {
  const logs: Omit<FoodLog, 'id'>[] = [];
  const now = new Date();

  const meals = [
    { name: 'Oatmeal & Protein Shake', mealType: 'breakfast', calories: 450, protein: 35, carbs: 55, fat: 8 },
    { name: 'Grilled Chicken & Quinoa Salad', mealType: 'lunch', calories: 620, protein: 48, carbs: 60, fat: 16 },
    { name: 'Greek Yogurt & Almonds', mealType: 'snack', calories: 240, protein: 20, carbs: 15, fat: 10 },
    { name: 'Salmon & Roasted Vegetables', mealType: 'dinner', calories: 580, protein: 42, carbs: 30, fat: 22 },
  ];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    for (const item of meals) {
      const logDate = new Date(d);
      if (item.mealType === 'breakfast') logDate.setHours(8, 30, 0);
      else if (item.mealType === 'lunch') logDate.setHours(13, 0, 0);
      else if (item.mealType === 'snack') logDate.setHours(16, 45, 0);
      else logDate.setHours(20, 15, 0);

      logs.push({
        profileId,
        timestamp: logDate,
        description: item.name,
        mealType: item.mealType as FoodLog['mealType'],
        calories: item.calories + Math.floor(Math.sin(i * 3) * 30),
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      });
    }
  }

  return logs;
}

export function generateMockWorkouts(profileId: string): {
  workouts: Omit<WorkoutLog, 'id'>[];
  setsByWorkoutIndex: Record<number, Omit<WorkoutSet, 'id' | 'workoutLogId'>[]>;
} {
  const now = new Date();
  const workouts: Omit<WorkoutLog, 'id'>[] = [];
  const setsByWorkoutIndex: Record<number, Omit<WorkoutSet, 'id' | 'workoutLogId'>[]> = {};

  const templates = [
    {
      type: 'Chest & Triceps',
      duration: 52,
      caloriesBurned: 410,
      description: 'Barbell Bench Press, Incline DB Flyes, Overhead Cable Extensions',
      source: 'manual' as const,
      daysAgo: 1,
      sets: [
        { exerciseName: 'Bench Press', exerciseId: 'bench-press', setNumber: 1, weight: 70, reps: 10, notes: 'Warmup set' },
        { exerciseName: 'Bench Press', exerciseId: 'bench-press', setNumber: 2, weight: 82.5, reps: 8, notes: 'Good RPE 8' },
        { exerciseName: 'Bench Press', exerciseId: 'bench-press', setNumber: 3, weight: 85, reps: 6, notes: 'New PR attempt' },
        { exerciseName: 'Incline Dumbbell Press', exerciseId: 'incline-db-press', setNumber: 1, weight: 28, reps: 10 },
        { exerciseName: 'Incline Dumbbell Press', exerciseId: 'incline-db-press', setNumber: 2, weight: 30, reps: 8 },
        { exerciseName: 'Triceps Pushdown', exerciseId: 'triceps-pushdown', setNumber: 1, weight: 35, reps: 12 },
        { exerciseName: 'Triceps Pushdown', exerciseId: 'triceps-pushdown', setNumber: 2, weight: 40, reps: 10 },
      ],
    },
    {
      type: 'Back & Biceps',
      duration: 48,
      caloriesBurned: 380,
      description: 'Lat Pulldowns, Barbell Rows, Hammer Curls',
      source: 'health-connect' as const,
      daysAgo: 3,
      sets: [
        { exerciseName: 'Lat Pulldown', exerciseId: 'lat-pulldown', setNumber: 1, weight: 60, reps: 12 },
        { exerciseName: 'Lat Pulldown', exerciseId: 'lat-pulldown', setNumber: 2, weight: 67.5, reps: 10 },
        { exerciseName: 'Lat Pulldown', exerciseId: 'lat-pulldown', setNumber: 3, weight: 72.5, reps: 8 },
        { exerciseName: 'Barbell Row', exerciseId: 'barbell-row', setNumber: 1, weight: 60, reps: 10 },
        { exerciseName: 'Barbell Row', exerciseId: 'barbell-row', setNumber: 2, weight: 65, reps: 8 },
        { exerciseName: 'Biceps Curl', exerciseId: 'biceps-curl', setNumber: 1, weight: 16, reps: 12 },
        { exerciseName: 'Biceps Curl', exerciseId: 'biceps-curl', setNumber: 2, weight: 18, reps: 10 },
      ],
    },
    {
      type: 'Leg Day & Core',
      duration: 65,
      caloriesBurned: 530,
      description: 'Barbell Squats, Romanian Deadlifts, Leg Extensions',
      source: 'manual' as const,
      daysAgo: 5,
      sets: [
        { exerciseName: 'Barbell Squat', exerciseId: 'barbell-squat', setNumber: 1, weight: 90, reps: 10 },
        { exerciseName: 'Barbell Squat', exerciseId: 'barbell-squat', setNumber: 2, weight: 100, reps: 8 },
        { exerciseName: 'Barbell Squat', exerciseId: 'barbell-squat', setNumber: 3, weight: 105, reps: 6 },
        { exerciseName: 'Romanian Deadlift', exerciseId: 'rdl', setNumber: 1, weight: 80, reps: 10 },
        { exerciseName: 'Romanian Deadlift', exerciseId: 'rdl', setNumber: 2, weight: 85, reps: 8 },
      ],
    },
    {
      type: 'Outdoor Running',
      duration: 35,
      caloriesBurned: 340,
      description: 'Morning tempo run along the park route',
      source: 'health-connect' as const,
      daysAgo: 7,
      sets: [
        { exerciseName: 'Running', exerciseId: 'running', setNumber: 1, distanceKm: 5.2, duration: 35, speed: 8.9 },
      ],
    },
  ];

  templates.forEach((t, idx) => {
    const d = new Date(now);
    d.setDate(d.getDate() - t.daysAgo);
    d.setHours(17, 30, 0);

    workouts.push({
      profileId,
      timestamp: d,
      type: t.type,
      duration: t.duration,
      caloriesBurned: t.caloriesBurned,
      description: t.description,
      source: t.source,
    });

    setsByWorkoutIndex[idx] = t.sets.map(s => ({
      profileId,
      timestamp: d,
      ...s,
    }));
  });

  return { workouts, setsByWorkoutIndex };
}
