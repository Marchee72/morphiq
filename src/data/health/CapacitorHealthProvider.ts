import type { IHealthProvider, WellnessSignals } from '../../core/interfaces/IHealthProvider';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { Workout, HeartRateSample } from 'capacitor-health';
import { getAge } from '../../core/entities/UserProfile';
import { BodyComposition } from './BodyCompositionPlugin';
import { Wellness, SLEEP_READ_PERMISSIONS, type DailyBpm, type DailyRmssd } from './WellnessPlugin';
import { BiaCalculator, NEUTRAL_IMPEDANCE } from '../calculation/BiaCalculator';
import { Capacitor } from '@capacitor/core';

/**
 * Health Connect's permission dialog does not always answer.
 *
 * The native side resolves the call it saved before launching the dialog, and
 * an activity recreated while that dialog is up loses the call — the promise
 * then never settles, in either direction, so a `catch` never runs either.
 * Awaiting it directly wedged the entire sync: `requestPermissions` never
 * returned, and every import sits behind its answer.
 *
 * Long enough for someone to actually read a Health Connect dialog, short
 * enough that a dropped reply costs one sync instead of every sync.
 */
const PERMISSION_DIALOG_TIMEOUT_MS = 60_000;

function settleWithin<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Either of these means Health Connect will hand over a weigh-in. */
const BODY_READ_PERMISSIONS = [
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_BODY_FAT',
];

/** `YYYY-MM-DD` in the phone's own timezone — the day a user would call it. */
export function localDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export class CapacitorHealthProvider implements IHealthProvider {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && (
      Capacitor.isPluginAvailable('Health') || 
      Capacitor.isPluginAvailable('CapacitorHealth') ||
      Capacitor.isPluginAvailable('HealthPlugin')
    );
  }

  /** What Health Connect says is granted right now, not what a dialog returned. */
  private async hasBodyReadAccess(): Promise<boolean> {
    const status = await settleWithin(BodyComposition.checkPermissions(), PERMISSION_DIALOG_TIMEOUT_MS);
    return BODY_READ_PERMISSIONS.some(p => status?.permissions?.[p] === true);
  }

  /** Either read is enough to be worth calling the wellness import at all. */
  private async hasWellnessAccess(): Promise<boolean> {
    const status = await settleWithin(Wellness.checkPermissions(), PERMISSION_DIALOG_TIMEOUT_MS);
    return SLEEP_READ_PERMISSIONS.some(p => status?.permissions?.[p] === true);
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      // Dynamic import to prevent bundler errors on the web
      const { Health } = await import('capacitor-health');
      const result = await Health.requestHealthPermissions({
        permissions: ['READ_WORKOUTS', 'READ_STEPS', 'READ_DISTANCE', 'READ_ACTIVE_CALORIES', 'READ_HEART_RATE']
      });

      // Request BodyComposition permissions if native
      let bodyGranted = false;
      if (Capacitor.isNativePlatform()) {
        try {
          if (!(await this.hasBodyReadAccess())) {
            // Delay to avoid Android activity transition intent clashing
            await new Promise(resolve => setTimeout(resolve, 800));
            await settleWithin(BodyComposition.requestPermissions(), PERMISSION_DIALOG_TIMEOUT_MS);
          }
          // Re-read rather than trust the dialog's own reply: it is the one
          // thing that is still right when the reply went missing.
          bodyGranted = await this.hasBodyReadAccess();
        } catch (e) {
          console.warn('MorphIQ: BodyComposition permissions request warning:', e);
        }
      }

      /**
       * Sleep and heart signals, asked for after body composition and behind
       * their own `hasWellnessAccess` check for the same reason: Health Connect
       * only lets an app ask a couple of times before sending the user to its
       * settings, so a dialog for something already granted is a wasted one.
       *
       * Never fatal. The questionnaire's four scales are answered by hand and
       * cannot come from here at all, so refusing this leaves it fully usable.
       */
      let wellnessGranted = false;
      if (Capacitor.isNativePlatform()) {
        try {
          if (!(await this.hasWellnessAccess())) {
            await new Promise(resolve => setTimeout(resolve, 800));
            await settleWithin(Wellness.requestPermissions(), PERMISSION_DIALOG_TIMEOUT_MS);
          }
          wellnessGranted = await this.hasWellnessAccess();
        } catch (e) {
          console.warn('MorphIQ: Wellness permissions request warning:', e);
        }
      }

      const permissionsMap: Record<string, boolean> = {};
      if (Array.isArray(result?.permissions)) {
        result.permissions.forEach(p => {
          const key = Object.keys(p)[0];
          if (key) {
            permissionsMap[key] = p[key];
          }
        });
      } else if (result?.permissions) {
        Object.assign(permissionsMap, result.permissions);
      }

      /**
       * Any granted read is enough to call the sync on.
       *
       * This asked for `READ_WORKOUTS` alone, and both callers gate all three
       * imports on the answer — so granting weight but refusing exercise synced
       * nothing at all, weigh-ins included, which have nothing to do with
       * exercise permission. Each import already checks what it needs and
       * returns an empty list when it is missing, so a false negative here is
       * the only way to lose data that Health Connect was willing to give.
       */
      return bodyGranted || wellnessGranted || Object.values(permissionsMap).some(Boolean);
    } catch (e) {
      console.error('Failed to request health permissions:', e);
      return false;
    }
  }

  async importWorkouts(since: Date): Promise<Omit<WorkoutLog, 'profileId'>[]> {
    if (!this.isAvailable()) return [];
    try {
      const { Health } = await import('capacitor-health');
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 1);
      console.log('MorphIQ Capacitor: Querying Health Connect workouts range:', since.toISOString(), 'to', futureEnd.toISOString());
      const result = await Health.queryWorkouts({
        startDate: since.toISOString(),
        endDate: futureEnd.toISOString(),
        includeSteps: true,
        includeHeartRate: true,
        includeRoute: false,
      });
      console.log('MorphIQ Capacitor: Raw Health Connect response:', result);

      return (result.workouts || []).map((w: Workout) => {
        let avgHeartRate: number | undefined;
        let maxHeartRate: number | undefined;
        
        if (w.heartRate && w.heartRate.length > 0) {
          const bpms = w.heartRate.map((h: HeartRateSample) => h.bpm).filter(Boolean);
          if (bpms.length > 0) {
            maxHeartRate = Math.max(...bpms);
            avgHeartRate = bpms.reduce((a: number, b: number) => a + b, 0) / bpms.length;
          }
        }

        return {
          timestamp: new Date(w.startDate),
          type: w.workoutType || 'Workout',
          duration: Math.round((w.duration || 0) / 60),
          description: w.sourceName ? `${w.workoutType || 'Workout'} via ${w.sourceName}` : 'Synced Activity',
          caloriesBurned: Math.round(w.calories || 0),
          distanceKm: w.distance ? parseFloat((w.distance / 1000).toFixed(2)) : undefined,
          // Already requested via `includeSteps` above; it was being dropped here.
          steps: w.steps || undefined,
          avgHeartRate,
          maxHeartRate,
          source: 'health-connect',
          externalId: w.id || (w.startDate + '_' + w.workoutType),
        };
      });
    } catch (e) {
      console.error('Failed to query workouts from Capacitor:', e);
      return [];
    }
  }

  /**
   * Steps per calendar day, newest day last, keyed `YYYY-MM-DD` in local time.
   *
   * The interface has declared this since the health layer was written and no
   * provider ever implemented it, so "steps today" could not be shown at all.
   * Health Connect aggregates day buckets itself; the only work here is turning
   * a bucket's start instant into the local day it belongs to — `toISOString`
   * would put an evening walk on the following day for anyone east of UTC.
   */
  async getDailySteps(since: Date): Promise<{ date: string; steps: number }[]> {
    if (!this.isAvailable()) return [];
    try {
      const { Health } = await import('capacitor-health');
      const result = await Health.queryAggregated({
        startDate: since.toISOString(),
        endDate: new Date().toISOString(),
        dataType: 'steps',
        bucket: 'day',
      });

      // Buckets can repeat a day when several sources report it, so they are
      // summed per day rather than trusted one-to-one.
      const byDay = new Map<string, number>();
      for (const sample of result.aggregatedData ?? []) {
        const at = new Date(sample.startDate);
        if (Number.isNaN(at.getTime())) continue;
        const key = localDayKey(at);
        byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, Math.round(sample.value || 0)));
      }

      return [...byDay.entries()]
        .map(([date, steps]) => ({ date, steps }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      console.error('Failed to query steps from Capacitor:', e);
      return [];
    }
  }

  /**
   * Sleep and heart signals, folded into one row per day.
   *
   * Nap-and-night days do happen, so sessions are summed per day rather than
   * the last one winning. Resting heart rate and HRV are averaged when a day
   * carries several readings — a watch can write more than one.
   *
   * Failures are swallowed to an empty list, like the other imports here: the
   * questionnaire is answerable by hand and must not be blocked by a device
   * that has nothing to contribute.
   */
  async importWellnessSignals(since: Date): Promise<WellnessSignals[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
      const { available } = await Wellness.isAvailable();
      if (!available) return [];

      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 1);
      const range = { startDate: since.toISOString(), endDate: futureEnd.toISOString() };

      const byDay = new Map<string, WellnessSignals>();
      const dayOf = (day: string): WellnessSignals => {
        const existing = byDay.get(day);
        if (existing) return existing;
        const created: WellnessSignals = { day };
        byDay.set(day, created);
        return created;
      };

      const { sessions } = await Wellness.querySleep(range);
      for (const session of sessions) {
        if (!(session.totalMinutes > 0)) continue;
        const entry = dayOf(session.day);
        entry.sleepMinutes = (entry.sleepMinutes ?? 0) + session.totalMinutes;
        entry.sleepDeepMinutes = (entry.sleepDeepMinutes ?? 0) + session.deepMinutes;
        entry.sleepRemMinutes = (entry.sleepRemMinutes ?? 0) + session.remMinutes;
      }

      // Its own try/catch: a device that reports sleep but refuses heart-rate
      // reads should still contribute the sleep.
      try {
        const { restingHeartRate, hrv } = await Wellness.queryHeartSignals(range);
        const average = (
          rows: { day: string }[],
          read: (row: never) => number,
          write: (entry: WellnessSignals, value: number) => void,
        ) => {
          const sums = new Map<string, { total: number; count: number }>();
          for (const row of rows) {
            const value = read(row as never);
            if (!Number.isFinite(value) || value <= 0) continue;
            const acc = sums.get(row.day) ?? { total: 0, count: 0 };
            sums.set(row.day, { total: acc.total + value, count: acc.count + 1 });
          }
          for (const [day, acc] of sums) write(dayOf(day), Math.round(acc.total / acc.count));
        };

        average(restingHeartRate, (r: DailyBpm) => r.bpm, (entry, value) => { entry.restingHr = value; });
        average(hrv, (r: DailyRmssd) => r.rmssd, (entry, value) => { entry.hrvMs = value; });
      } catch (e) {
        console.warn('MorphIQ: heart signals unavailable:', e);
      }

      return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    } catch (e) {
      console.error('Failed to import wellness signals from Health Connect:', e);
      return [];
    }
  }

  async importBodyComposition(since: Date, profile: UserProfile): Promise<Omit<Measurement, 'profileId'>[]> {
    if (!Capacitor.isNativePlatform()) return [];
    try {
      const isAvailableResult = await BodyComposition.isAvailable();
      if (!isAvailableResult.available) {
        console.log('MorphIQ Capacitor: BodyComposition is not available on this device');
        return [];
      }

      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 1);

      console.log('MorphIQ Capacitor: Querying Health Connect BodyComposition range:', since.toISOString(), 'to', futureEnd.toISOString());
      const response = await BodyComposition.queryBodyComposition({
        startDate: since.toISOString(),
        endDate: futureEnd.toISOString(),
      });

      const age = getAge(profile.birthDate);
      const gender = profile.gender;
      const height = profile.height;

      return (response.records || [])
        .filter((r) => r.weight > 0)
        .map((r) => {
          const weight = r.weight;
          const bodyFat = r.bodyFat;
          
          const hasBia = bodyFat && bodyFat > 0;
          
          // Derived body metrics calculations matching watch inputs
          const leanMass = hasBia ? (r.leanMass || (weight - (weight * bodyFat / 100))) : 0;
          const boneMass = hasBia ? (r.boneMass || BiaCalculator.getBoneMass(weight, height, age, gender, NEUTRAL_IMPEDANCE)) : 0;

          const bodyWater = hasBia
            ? (r.bodyWaterMass
              ? (r.bodyWaterMass / weight) * 100
              : BiaCalculator.getWaterPercentage(weight, height, age, gender, NEUTRAL_IMPEDANCE))
            : 0;

          const muscleMass = hasBia ? Math.max(10, Math.min(120, leanMass - boneMass)) : 0;

          return {
            timestamp: new Date(r.timestamp),
            weight,
            impedance: hasBia ? NEUTRAL_IMPEDANCE : 0,
            bmi: BiaCalculator.getBMI(weight, height),
            bmr: BiaCalculator.getBMR(weight, height, age, gender),
            bodyFat,
            bodyWater,
            boneMass,
            muscleMass,
          };
        });
    } catch (e) {
      console.error('Failed to import body composition from Health Connect:', e);
      return [];
    }
  }

  async exportBodyComposition(measurement: Measurement): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const isAvailableResult = await BodyComposition.isAvailable();
      if (!isAvailableResult.available) {
        console.log('MorphIQ Health Connect: BodyComposition is not available on this device');
        return false;
      }

      console.log('MorphIQ Health Connect: Exporting body composition to Health Connect', measurement);
      await BodyComposition.saveBodyComposition({
        timestamp: measurement.timestamp instanceof Date ? measurement.timestamp.toISOString() : new Date(measurement.timestamp).toISOString(),
        weight: measurement.weight,
        bodyFat: measurement.bodyFat > 0 ? measurement.bodyFat : undefined,
        leanMass: measurement.bodyFat > 0 ? (measurement.weight - (measurement.weight * measurement.bodyFat / 100)) : undefined,
        boneMass: measurement.boneMass > 0 ? measurement.boneMass : undefined,
        bodyWaterMass: measurement.bodyWater > 0 ? (measurement.bodyWater * measurement.weight / 100) : undefined,
      });
      return true;
    } catch (e) {
      console.error('Failed to export body composition to Health Connect:', e);
      return false;
    }
  }
}
