import type { FoodLog } from '../../core/entities/FoodLog';
import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { NutritionVM } from '../types';
import { dayKey } from './buckets';

/**
 * Fallbacks used only when the user has not set an explicit target.
 * `activityFactor` is the light-to-moderate multiplier on BMR; `proteinPerKg`
 * sits in the middle of the 1.6–2.2 g/kg range cited for hypertrophy.
 */
export const NUTRITION_DEFAULTS = {
  activityFactor: 1.45,
  proteinPerKg: 1.9,
  fatPctOfCalories: 0.27,
  fallbackCalories: 2200,
  fallbackProteinG: 140,
} as const;

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** `UserProfile.targetCalories` exists but nothing has ever read it. This is where it starts mattering. */
export function calorieTarget(profile: UserProfile | null, latest: Measurement | null): number {
  if (profile?.targetCalories && profile.targetCalories > 0) return Math.round(profile.targetCalories);
  if (latest?.bmr && latest.bmr > 0) return Math.round(latest.bmr * NUTRITION_DEFAULTS.activityFactor);
  return NUTRITION_DEFAULTS.fallbackCalories;
}

export function proteinTarget(profile: UserProfile | null, latest: Measurement | null): number {
  if (profile?.targetProtein && profile.targetProtein > 0) return Math.round(profile.targetProtein);
  if (latest?.weight && latest.weight > 0) return Math.round(latest.weight * NUTRITION_DEFAULTS.proteinPerKg);
  return NUTRITION_DEFAULTS.fallbackProteinG;
}

/** Fat takes a fixed share of calories; carbs absorb whatever is left. */
export function macroTargets(calories: number, proteinG: number): { carbs: number; fat: number } {
  const fat = Math.round((calories * NUTRITION_DEFAULTS.fatPctOfCalories) / KCAL_PER_G.fat);
  const remaining = calories - proteinG * KCAL_PER_G.protein - fat * KCAL_PER_G.fat;
  return { carbs: Math.max(0, Math.round(remaining / KCAL_PER_G.carbs)), fat };
}

export function buildNutrition(
  foodLogs: FoodLog[],
  workoutLogs: WorkoutLog[],
  profile: UserProfile | null,
  latest: Measurement | null,
  day: Date,
): NutritionVM {
  const key = dayKey(day);
  const todaysFood = foodLogs.filter(f => dayKey(new Date(f.timestamp)) === key);

  const sum = (pick: (f: FoodLog) => number) =>
    Math.round(todaysFood.reduce((total, f) => total + (pick(f) || 0), 0));

  const calories = calorieTarget(profile, latest);
  const protein = proteinTarget(profile, latest);
  const { carbs, fat } = macroTargets(calories, protein);

  return {
    calories: { eaten: sum(f => f.calories), target: calories },
    protein: { eaten: sum(f => f.protein), target: protein },
    carbs: { eaten: sum(f => f.carbs), target: carbs },
    fat: { eaten: sum(f => f.fat), target: fat },
    burned: Math.round(
      workoutLogs
        .filter(w => dayKey(new Date(w.timestamp)) === key)
        .reduce((total, w) => total + (w.caloriesBurned || 0), 0),
    ),
    meals: todaysFood
      .map(f => ({
        mealType: f.mealType,
        at: new Date(f.timestamp),
        description: f.description,
        calories: f.calories || 0,
        protein: f.protein || 0,
      }))
      .sort((a, b) => a.at.getTime() - b.at.getTime()),
    targetsExplicit: Boolean(profile?.targetCalories && profile?.targetProtein),
  };
}
