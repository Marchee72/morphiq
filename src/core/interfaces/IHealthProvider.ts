import type { WorkoutLog } from '../entities/WorkoutLog';
import type { Measurement } from '../entities/Measurement';
import type { UserProfile } from '../entities/UserProfile';

export interface IHealthProvider {
  isAvailable(): boolean;
  requestPermissions(): Promise<boolean>;
  importWorkouts(since: Date): Promise<Omit<WorkoutLog, 'profileId'>[]>;
  importBodyComposition?(since: Date, profile: UserProfile): Promise<Omit<Measurement, 'profileId'>[]>;
  exportBodyComposition?(measurement: Measurement): Promise<boolean>;
}
