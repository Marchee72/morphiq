import { getAge, type UserProfile } from '../../core/entities/UserProfile';
import type { ProfileVM } from '../types';
import { DEFAULT_WEEKLY_GOAL_DAYS } from './streak';

export function buildProfile(profile: UserProfile | null): ProfileVM {
  return {
    name: profile?.name?.trim() || '',
    age: profile?.birthDate ? getAge(profile.birthDate) : 0,
    heightCm: profile?.height ?? 0,
    targetWeightKg: profile?.targetWeight ?? null,
    targetBodyFat: profile?.targetBodyFat ?? null,
    weeklyGoalDays: profile?.weeklyWorkoutGoalDays ?? DEFAULT_WEEKLY_GOAL_DAYS,
  };
}

export type Daypart = 'morning' | 'afternoon' | 'evening';

/** Drives the Today greeting. Replaces the showcase's hardcoded "Good evening". */
export function daypart(now: Date): Daypart {
  const hour = now.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** Progress from the first recorded weight toward the target, 0–100. */
export function goalProgress(
  startWeightKg: number | null,
  currentKg: number,
  targetKg: number | null,
): number | null {
  if (targetKg === null || startWeightKg === null) return null;
  const total = startWeightKg - targetKg;
  if (Math.abs(total) < 0.05) return 100; // already there, or started there
  const done = startWeightKg - currentKg;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}
