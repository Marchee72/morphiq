import type { WorkoutLog } from '../entities/WorkoutLog';
import type { Measurement } from '../entities/Measurement';
import type { UserProfile } from '../entities/UserProfile';

/**
 * What a phone can answer of the wellness questionnaire on your behalf.
 *
 * Keyed by local `YYYY-MM-DD`, because the questionnaire is. Every field is
 * optional: a watch that reports sleep but no HRV is the common case, not a
 * degraded one, and stress, mood and soreness can never appear here at all —
 * Health Connect has no record type for any of them.
 */
export interface WellnessSignals {
  day: string;
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  restingHr?: number;
  hrvMs?: number;
}

export interface IHealthProvider {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  importWorkouts(since: Date): Promise<Omit<WorkoutLog, 'profileId'>[]>;
  importBodyComposition?(since: Date, profile: UserProfile): Promise<Omit<Measurement, 'profileId'>[]>;
  exportBodyComposition?(measurement: Measurement): Promise<boolean>;
  getDailySteps?(since: Date): Promise<{ date: string; steps: number }[]>;
  /** One entry per day that has anything to say. Absent on web, where nothing does. */
  importWellnessSignals?(since: Date): Promise<WellnessSignals[]>;
  getStepStreak?(stepGoal?: number): Promise<{ currentSteps: number; targetGoal: number; streakDays: number; daysMetThisMonth: number; totalDaysInMonth: number }>;
}
