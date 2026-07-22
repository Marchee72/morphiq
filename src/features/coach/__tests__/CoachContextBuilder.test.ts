import { describe, it, expect } from 'vitest';
import { buildFullCoachContext } from '../CoachContextBuilder';
import type { UserProfile } from '../../../core/entities/UserProfile';
import type { Measurement } from '../../../core/entities/Measurement';
import type { FoodLog } from '../../../core/entities/FoodLog';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';

describe('CoachContextBuilder', () => {
  it('should format empty context gracefully', () => {
    const contextStr = buildFullCoachContext({
      profile: null,
      measurements: [],
      foodLogs: [],
      workoutLogs: [],
      activeWorkoutSets: {},
    });

    expect(contextStr).toContain('HISTORIAL Y CONTEXTO DEL USUARIO');
    expect(contextStr).toContain('Sin perfil activo');
    expect(contextStr).toContain('Sin registros de peso o BIA');
    expect(contextStr).toContain('Sin registros de nutrición');
    expect(contextStr).toContain('Sin entrenamientos');
  });

  it('should build full context with profile, measurements, food, and workouts', () => {
    const mockProfile: UserProfile = {
      id: 'p1',
      name: 'Bruce Wayne',
      gender: 'male',
      birthDate: new Date('1990-05-15'),
      height: 188,
      targetWeight: 85,
      targetCalories: 2500,
      targetProtein: 180,
      createdAt: new Date(),
    };

    const mockMeasurements: Measurement[] = [
      {
        id: 'm1',
        profileId: 'p1',
        timestamp: new Date('2026-07-20'),
        weight: 88,
        impedance: 500,
        bmi: 24.9,
        bmr: 1850,
        bodyFat: 16.5,
        bodyWater: 58.0,
        boneMass: 3.5,
        muscleMass: 70,
        visceralFat: 4,
        metabolicAge: 30,
        protein: 19.5,
        bodyType: 2,
      },
    ];

    const mockFoodLogs: FoodLog[] = [
      {
        id: 'f1',
        profileId: 'p1',
        timestamp: new Date('2026-07-22'),
        mealType: 'lunch',
        description: 'Chicken Breast & Rice',
        calories: 600,
        protein: 50,
        carbs: 60,
        fat: 10,
      },
    ];

    const mockWorkoutLogs: WorkoutLog[] = [
      {
        id: 'w1',
        profileId: 'p1',
        timestamp: new Date('2026-07-21'),
        type: 'Strength Training',
        duration: 45,
        description: 'Chest workout',
      },
    ];

    const mockSets: Record<string, WorkoutSet[]> = {
      w1: [
        {
          id: 's1',
          profileId: 'p1',
          workoutLogId: 'w1',
          timestamp: new Date('2026-07-21'),
          exerciseName: 'Bench Press',
          setNumber: 1,
          weight: 80,
          reps: 8,
        },
      ],
    };

    const contextStr = buildFullCoachContext({
      profile: mockProfile,
      measurements: mockMeasurements,
      foodLogs: mockFoodLogs,
      workoutLogs: mockWorkoutLogs,
      activeWorkoutSets: mockSets,
    });

    expect(contextStr).toContain('Bruce Wayne');
    expect(contextStr).toContain('88 kg');
    expect(contextStr).toContain('16.5%');
    expect(contextStr).toContain('Chicken Breast & Rice');
    expect(contextStr).toContain('Strength Training');
    expect(contextStr).toContain('Bench Press');
  });
});
