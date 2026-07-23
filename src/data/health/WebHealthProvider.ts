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

  async getDailySteps(_since: Date): Promise<{ date: string; steps: number }[]> {
    return [
      { date: '2026-07-22', steps: 8420 },
      { date: '2026-07-21', steps: 10150 },
      { date: '2026-07-20', steps: 9430 },
      { date: '2026-07-19', steps: 11200 },
      { date: '2026-07-18', steps: 8800 },
      { date: '2026-07-17', steps: 10500 },
    ];
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
