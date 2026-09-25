import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BodyCompositionRecord } from './BodyCompositionPlugin';
import type { SleepSessionRecord } from './WellnessPlugin';

/** One Galaxy Watch (or Samsung-paired scale) body composition reading. */
export interface SamsungBodyRecord {
  timestamp: string;
  weight: number;
  bodyFat: number;
  /** kg. Zero when the reading has none. */
  skeletalMuscleMass: number;
  /** Litres, which for water is kilos. */
  totalBodyWater: number;
}

/** One exercise session, as the native side flattens it. */
export interface SamsungWorkout {
  id: string;
  /** Samsung's exercise type name, e.g. `WEIGHT_MACHINE`, `RUNNING`. */
  type: string;
  title: string;
  startDate: string;
  durationMinutes: number;
  calories: number;
  distanceMeters: number;
  meanHeartRate: number;
  maxHeartRate: number;
  steps: number;
}

interface SamsungHealthPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  hasPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  queryBodyComposition(options: { startDate: string; endDate: string }): Promise<{ records: SamsungBodyRecord[] }>;
  /** Samsung's own sleep, in the shape `Wellness.querySleep` answers with. */
  querySleep(options: { startDate: string; endDate: string }): Promise<{ sessions: SleepSessionRecord[] }>;
  queryWorkouts(options: { startDate: string; endDate: string }): Promise<{ workouts: SamsungWorkout[] }>;
  /** Samsung's Energy Score per local day. */
  queryEnergyScore(options: { startDate: string; endDate: string }): Promise<{ days: { day: string; score: number }[] }>;
  queryDailyTotals(options: {
    startDate: string;
    endDate: string;
    dataType: 'steps' | 'active-calories';
  }): Promise<{ days: { date: string; value: number }[] }>;
}

/**
 * Only registered on a build that bundled the Samsung Health Data SDK (see
 * `SamsungHealthPlugin.kt`); everywhere else `isSamsungHealthBuilt` is false
 * and nothing here is called.
 */
export const SamsungHealth = registerPlugin<SamsungHealthPluginInterface>('SamsungHealth');

export const isSamsungHealthBuilt = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SamsungHealth');

/** The same tolerance the native side pairs Health Connect's records with. */
const SAME_READING_MS = 5 * 60_000;

export type MergedBodyRecord = BodyCompositionRecord & { skeletalMuscle?: number };

/**
 * Samsung's readings folded into Health Connect's.
 *
 * A reading both hold gains the skeletal muscle only Samsung has. A reading
 * only Samsung holds is added whole: Samsung Health hands the watch's data to
 * Health Connect late, sometimes hours late, and reading Samsung directly is
 * what lets a morning weigh-in show up before that.
 */
export function withSamsungReadings(hc: BodyCompositionRecord[], samsung: SamsungBodyRecord[]): MergedBodyRecord[] {
  const merged: MergedBodyRecord[] = hc.map(r => ({ ...r }));
  for (const s of samsung) {
    const at = new Date(s.timestamp).getTime();
    if (!(s.weight > 0) || Number.isNaN(at)) continue;
    const skeletalMuscle = s.skeletalMuscleMass > 0 ? s.skeletalMuscleMass : undefined;
    const twin = merged.find(r => Math.abs(new Date(r.timestamp).getTime() - at) <= SAME_READING_MS);
    if (twin) {
      twin.skeletalMuscle ??= skeletalMuscle;
      if (!(twin.bodyFat > 0) && s.bodyFat > 0) twin.bodyFat = s.bodyFat;
      if (!(twin.bodyWaterMass > 0) && s.totalBodyWater > 0) twin.bodyWaterMass = s.totalBodyWater;
      continue;
    }
    merged.push({
      timestamp: s.timestamp,
      weight: s.weight,
      bodyFat: s.bodyFat,
      leanMass: 0,
      boneMass: 0,
      bodyWaterMass: s.totalBodyWater,
      skeletalMuscle,
    });
  }
  return merged;
}
