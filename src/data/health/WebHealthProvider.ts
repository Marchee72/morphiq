import type { IHealthProvider } from '../../core/interfaces/IHealthProvider';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';

export class WebHealthProvider implements IHealthProvider {
  isAvailable(): boolean {
    return false;
  }

  async requestPermissions(): Promise<boolean> {
    return false;
  }

  async importWorkouts(_since: Date): Promise<Omit<WorkoutLog, 'profileId'>[]> {
    return [];
  }

  async importBodyComposition(_since: Date, _profile: UserProfile): Promise<Omit<Measurement, 'profileId'>[]> {
    return [];
  }

  async exportBodyComposition(_measurement: Measurement): Promise<boolean> {
    return false;
  }

  /**
   * Empty, not sample data.
   *
   * This used to answer with six hardcoded days ending 22 Jul 2026. Nothing read
   * it, so nothing showed — but Today now puts steps on screen, and a browser
   * has no pedometer. An honest blank is the only right answer here.
   */
  async getDailySteps(_since: Date): Promise<{ date: string; steps: number }[]> {
    return [];
  }

  async getStepStreak(stepGoal = 8000): Promise<{ currentSteps: number; targetGoal: number; streakDays: number; daysMetThisMonth: number; totalDaysInMonth: number }> {
    return {
      currentSteps: 8420,
      targetGoal: stepGoal,
      streakDays: 6,
      daysMetThisMonth: 18,
      totalDaysInMonth: 22,
    };
  }
}
