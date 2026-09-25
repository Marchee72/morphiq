import type { IHealthProvider, WellnessSignals } from '../../core/interfaces/IHealthProvider';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { Workout, HeartRateSample, HealthPermission, PermissionResponse } from 'capacitor-health';
import { getAge } from '../../core/entities/UserProfile';
import { BodyComposition, type BodyCompositionRecord } from './BodyCompositionPlugin';
import { SamsungHealth, isSamsungHealthBuilt, withSamsungReadings, type SamsungBodyRecord, type SamsungWorkout } from './SamsungHealthPlugin';
import { Wellness, SLEEP_READ_PERMISSIONS, type DailyBpm, type DailyRmssd, type SleepSessionRecord } from './WellnessPlugin';
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

/**
 * `{ READ_WORKOUTS: true, … }` out of whichever shape the plugin answered in.
 *
 * Typed as an array of one-key objects, but the Android side sends one object
 * keyed by every permission — so both are read. `null` is a call that timed out.
 */
function grantedIn(response: PermissionResponse | null): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  const permissions: unknown = response?.permissions;
  if (Array.isArray(permissions)) {
    for (const p of permissions as Record<string, boolean>[]) Object.assign(map, p);
  } else if (permissions && typeof permissions === 'object') {
    Object.assign(map, permissions);
  }
  return map;
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

/**
 * A Samsung session as a synced workout.
 *
 * `source` stays `'health-connect'`: across the app it means "recorded by a
 * device, timestamped at its start" (see `logInterval`), which is just as true
 * of a session read from Samsung Health directly.
 */
export function fromSamsungWorkout(w: SamsungWorkout): Omit<WorkoutLog, 'profileId'> {
  const type = w.type || 'OTHER';
  return {
    timestamp: new Date(w.startDate),
    type,
    duration: Math.round(w.durationMinutes),
    description: w.title ? `${w.title} via Samsung Health` : `${type} via Samsung Health`,
    caloriesBurned: Math.round(w.calories || 0),
    distanceKm: w.distanceMeters > 0 ? parseFloat((w.distanceMeters / 1000).toFixed(2)) : undefined,
    steps: w.steps > 0 ? w.steps : undefined,
    avgHeartRate: w.meanHeartRate > 0 ? w.meanHeartRate : undefined,
    maxHeartRate: w.maxHeartRate > 0 ? w.maxHeartRate : undefined,
    source: 'health-connect',
    externalId: `samsung:${w.id}`,
  };
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
      const permissions: HealthPermission[] = ['READ_WORKOUTS', 'READ_STEPS', 'READ_DISTANCE', 'READ_ACTIVE_CALORIES', 'READ_HEART_RATE'];

      /**
       * Asked only when something is missing, and never without a deadline.
       *
       * `requestHealthPermissions` launches Health Connect's permission activity
       * every time, granted or not, and keeps a single pending call: a second
       * request replaces the first, which then never settles. The launch itself
       * pauses and resumes the app, which fires the resume listener in `App.tsx`,
       * which can ask again — so a pull-to-sync waited on a reply that had been
       * overwritten, and its spinner turned forever.
       */
      // A failed check only means "ask", never "refused".
      const checked = await settleWithin(
        Health.checkHealthPermissions({ permissions }).catch(() => null), PERMISSION_DIALOG_TIMEOUT_MS);
      const allGranted = permissions.every(p => grantedIn(checked)[p] === true);
      const result = allGranted
        ? checked
        : await settleWithin(Health.requestHealthPermissions({ permissions }), PERMISSION_DIALOG_TIMEOUT_MS);

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

      /**
       * Samsung Health's own read permission, for the skeletal muscle Health
       * Connect never receives. Only on a build that bundled its SDK, and never
       * fatal: everything else still comes through Health Connect.
       */
      if (isSamsungHealthBuilt()) {
        try {
          const { granted } = await SamsungHealth.hasPermission();
          if (!granted) await settleWithin(SamsungHealth.requestPermission(), PERMISSION_DIALOG_TIMEOUT_MS);
        } catch (e) {
          console.warn('MorphIQ: Samsung Health permission request warning:', e);
        }
      }

      const permissionsMap = grantedIn(result);

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
    // Samsung first: the watch's sessions reach it before Health Connect. Its
    // failure (developer mode off, permission refused) falls through to the
    // Health Connect read below; an empty answer is a real "no workouts".
    if (isSamsungHealthBuilt()) {
      try {
        const futureEnd = new Date();
        futureEnd.setDate(futureEnd.getDate() + 1);
        const { workouts } = await SamsungHealth.queryWorkouts({
          startDate: since.toISOString(), endDate: futureEnd.toISOString(),
        });
        return workouts.map(fromSamsungWorkout);
      } catch (e) {
        console.warn('MorphIQ: Samsung Health workouts unavailable, using Health Connect:', e);
      }
    }
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
    const days = await this.dailyTotals(since, 'steps');
    return days.map(([date, steps]) => ({ date, steps }));
  }

  /** Same buckets as steps; `READ_ACTIVE_CALORIES` is already in the permission request. */
  async getDailyActiveCalories(since: Date): Promise<{ date: string; kcal: number }[]> {
    const days = await this.dailyTotals(since, 'active-calories');
    return days.map(([date, kcal]) => ({ date, kcal }));
  }

  private async dailyTotals(since: Date, dataType: 'steps' | 'active-calories'): Promise<[string, number][]> {
    if (!this.isAvailable()) return [];
    if (isSamsungHealthBuilt()) {
      try {
        const { days } = await SamsungHealth.queryDailyTotals({
          startDate: since.toISOString(), endDate: new Date().toISOString(), dataType,
        });
        return days.map(d => [d.date, Math.max(0, Math.round(d.value))] as [string, number]);
      } catch (e) {
        console.warn(`MorphIQ: Samsung Health ${dataType} unavailable, using Health Connect:`, e);
      }
    }
    try {
      const { Health } = await import('capacitor-health');
      const result = await Health.queryAggregated({
        startDate: since.toISOString(),
        endDate: new Date().toISOString(),
        dataType,
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

      return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    } catch (e) {
      console.error(`Failed to query ${dataType} from Capacitor:`, e);
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
  /**
   * Samsung Health's sleep where the build can read it, Health Connect's
   * otherwise. Samsung's is the one the watch shows; Health Connect's copy of
   * the same nights did not add up to it. Never both — the same night from two
   * sources would be summed as two.
   */
  private async sleepSessions(range: { startDate: string; endDate: string }): Promise<SleepSessionRecord[]> {
    if (isSamsungHealthBuilt()) {
      try {
        const { sessions } = await SamsungHealth.querySleep(range);
        if (sessions.length > 0) return sessions;
      } catch (e) {
        console.warn('MorphIQ: Samsung Health sleep unavailable, using Health Connect:', e);
      }
    }
    return (await Wellness.querySleep(range)).sessions;
  }

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

      // The night's times and score come from its longest session, so a nap
      // adds its minutes without moving when you went to bed.
      const longest = new Map<string, number>();
      for (const session of await this.sleepSessions(range)) {
        if (!(session.totalMinutes > 0)) continue;
        const entry = dayOf(session.day);
        entry.sleepMinutes = (entry.sleepMinutes ?? 0) + session.totalMinutes;
        entry.sleepDeepMinutes = (entry.sleepDeepMinutes ?? 0) + session.deepMinutes;
        entry.sleepRemMinutes = (entry.sleepRemMinutes ?? 0) + session.remMinutes;
        if (session.totalMinutes > (longest.get(session.day) ?? 0)) {
          longest.set(session.day, session.totalMinutes);
          entry.sleepStart = session.startDate;
          entry.sleepEnd = session.endDate;
          entry.sleepScore = session.score && session.score > 0 ? session.score : undefined;
        }
      }

      // Samsung only, and never fatal: without it readiness falls back to
      // sleep and resting heart rate.
      if (isSamsungHealthBuilt()) {
        try {
          const { days } = await SamsungHealth.queryEnergyScore(range);
          for (const { day, score } of days) {
            if (score > 0) dayOf(day).energyScore = Math.round(score);
          }
        } catch (e) {
          console.warn('MorphIQ: Samsung Health energy score unavailable:', e);
        }
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
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 1);
      const range = { startDate: since.toISOString(), endDate: futureEnd.toISOString() };

      let hcRecords: BodyCompositionRecord[] = [];
      if ((await BodyComposition.isAvailable()).available) {
        console.log('MorphIQ Capacitor: Querying Health Connect BodyComposition range:', range.startDate, 'to', range.endDate);
        hcRecords = (await BodyComposition.queryBodyComposition(range)).records || [];
      }

      // Its own catch: Samsung failing (developer mode off, permission refused)
      // must not cost the Health Connect readings.
      let samsungRecords: SamsungBodyRecord[] = [];
      if (isSamsungHealthBuilt()) {
        try {
          samsungRecords = (await SamsungHealth.queryBodyComposition(range)).records || [];
        } catch (e) {
          console.warn('MorphIQ: Samsung Health body composition unavailable:', e);
        }
      }

      const age = getAge(profile.birthDate);
      const gender = profile.gender;
      const height = profile.height;

      return withSamsungReadings(hcRecords, samsungRecords)
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
            skeletalMuscle: r.skeletalMuscle,
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
