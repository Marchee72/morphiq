import { describe, expect, it } from 'vitest';
import type { FoodLog } from '../../../core/entities/FoodLog';
import type { Measurement } from '../../../core/entities/Measurement';
import type { UserProfile } from '../../../core/entities/UserProfile';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import { buildNutrition, calorieTarget, macroTargets, proteinTarget, NUTRITION_DEFAULTS } from '../nutrition';

const NOW = new Date(2026, 6, 27, 12);
const DAY = 86_400_000;

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Marc', gender: 'male', birthDate: new Date(1990, 0, 1), height: 178,
  createdAt: new Date(2020, 0, 1), ...over,
});

const latest = (over: Partial<Measurement> = {}): Measurement => ({
  profileId: 'p1', timestamp: NOW, weight: 80, impedance: 500, bmi: 24, bmr: 1700,
  bodyFat: 20, bodyWater: 55, boneMass: 3, muscleMass: 60, ...over,
});

const food = (over: Partial<FoodLog> = {}): FoodLog => ({
  profileId: 'p1', timestamp: NOW, mealType: 'lunch', description: 'Chicken and rice',
  calories: 600, protein: 45, carbs: 60, fat: 15, ...over,
});

const workout = (over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  profileId: 'p1', timestamp: NOW, type: 'Strength Training', duration: 60,
  description: '', caloriesBurned: 350, ...over,
});

describe('calorieTarget', () => {
  it('honours an explicit profile target', () => {
    expect(calorieTarget(profile({ targetCalories: 2400 }), latest())).toBe(2400);
  });

  it('derives from BMR when the user has set nothing', () => {
    // UserProfile.targetCalories has existed all along and been read by nothing.
    expect(calorieTarget(profile(), latest({ bmr: 1700 }))).toBe(Math.round(1700 * NUTRITION_DEFAULTS.activityFactor));
  });

  it('falls back to a sane constant with no data at all', () => {
    expect(calorieTarget(null, null)).toBe(NUTRITION_DEFAULTS.fallbackCalories);
  });
});

describe('proteinTarget', () => {
  it('scales with bodyweight when no target is set', () => {
    expect(proteinTarget(profile(), latest({ weight: 80 }))).toBe(152);
  });

  it('honours an explicit target', () => {
    expect(proteinTarget(profile({ targetProtein: 165 }), latest())).toBe(165);
  });
});

describe('macroTargets', () => {
  it('splits the remaining calories into carbs after protein and fat', () => {
    const { carbs, fat } = macroTargets(2400, 160);
    expect(fat).toBe(72);
    expect(carbs).toBe(278);
    // Sanity: the macros should reconstruct roughly the calorie target.
    expect(160 * 4 + carbs * 4 + fat * 9).toBeCloseTo(2400, -1);
  });

  it('never returns negative carbs on an extreme protein target', () => {
    expect(macroTargets(1200, 400).carbs).toBe(0);
  });
});

describe('buildNutrition', () => {
  it('sums only today, not yesterday', () => {
    const logs = [food(), food({ timestamp: new Date(NOW.getTime() - DAY), calories: 999 })];
    expect(buildNutrition(logs, [], profile(), latest(), NOW).calories.eaten).toBe(600);
  });

  it('sums calories burned from workouts', () => {
    expect(buildNutrition([], [workout()], profile(), latest(), NOW).burned).toBe(350);
  });

  it('orders meals by time', () => {
    const logs = [
      food({ mealType: 'dinner', timestamp: new Date(2026, 6, 27, 20) }),
      food({ mealType: 'breakfast', timestamp: new Date(2026, 6, 27, 8) }),
    ];
    expect(buildNutrition(logs, [], profile(), latest(), NOW).meals.map(m => m.mealType))
      .toEqual(['breakfast', 'dinner']);
  });

  it('flags whether targets are the user’s own or inferred', () => {
    expect(buildNutrition([], [], profile(), latest(), NOW).targetsExplicit).toBe(false);
    expect(
      buildNutrition([], [], profile({ targetCalories: 2400, targetProtein: 165 }), latest(), NOW).targetsExplicit,
    ).toBe(true);
  });

  it('returns zeroed intake against real targets on a blank day', () => {
    const vm = buildNutrition([], [], profile({ targetCalories: 2400 }), latest(), NOW);
    expect(vm.calories.eaten).toBe(0);
    expect(vm.calories.target).toBe(2400);
    expect(vm.meals).toEqual([]);
  });
});
