import { registerPlugin } from '@capacitor/core';

/**
 * The native side of the wellness signals — see `WellnessPlugin.kt`.
 *
 * Separate from `BodyComposition` because sleep is not body composition, and
 * separate from `capacitor-health` because that package cannot read sleep at
 * all: its `HealthPermission` union has no sleep entry and `queryAggregated`
 * buckets only steps, active calories and mindfulness.
 */

export interface SleepSessionRecord {
  startDate: string;
  endDate: string;
  /**
   * Local `YYYY-MM-DD` of the moment you **woke up**.
   *
   * Computed natively rather than here: a night starting at 23:40 belongs to the
   * morning it ended in, and deriving that from `startDate` in JS would need the
   * same timezone reasoning done twice.
   */
  day: string;
  totalMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
}

export interface DailyBpm { day: string; bpm: number }
export interface DailyRmssd { day: string; rmssd: number }

export interface PermissionStatus {
  permissions: { [key: string]: boolean };
}

export interface WellnessPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  querySleep(options: { startDate: string; endDate: string }): Promise<{ sessions: SleepSessionRecord[] }>;
  /** Both signals in one call: same window, same reason, and HRV is optional. */
  queryHeartSignals(options: { startDate: string; endDate: string }): Promise<{
    restingHeartRate: DailyBpm[];
    hrv: DailyRmssd[];
  }>;
}

export const Wellness = registerPlugin<WellnessPluginInterface>('Wellness');

export const SLEEP_READ_PERMISSIONS = [
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_RESTING_HEART_RATE',
];
