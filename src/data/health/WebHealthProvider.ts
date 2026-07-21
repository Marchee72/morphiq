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
}
