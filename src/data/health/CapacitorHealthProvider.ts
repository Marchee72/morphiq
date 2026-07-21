import type { IHealthProvider } from '../../core/interfaces/IHealthProvider';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { Workout, HeartRateSample } from 'capacitor-health';
import { getAge } from '../../core/entities/UserProfile';
import { BodyComposition } from './BodyCompositionPlugin';
import { BiaCalculator } from '../calculation/BiaCalculator';
import { Capacitor } from '@capacitor/core';

export class CapacitorHealthProvider implements IHealthProvider {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && (
      Capacitor.isPluginAvailable('Health') || 
      Capacitor.isPluginAvailable('CapacitorHealth') ||
      Capacitor.isPluginAvailable('HealthPlugin')
    );
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
      if (Capacitor.isNativePlatform()) {
        try {
          const perms = await BodyComposition.checkPermissions();
          const hasWeight = perms?.permissions?.['android.permission.health.READ_WEIGHT'] === true;
          const hasFat = perms?.permissions?.['android.permission.health.READ_BODY_FAT'] === true;
          
          if (!hasWeight || !hasFat) {
            // Delay to avoid Android activity transition intent clashing
            await new Promise(resolve => setTimeout(resolve, 800));
            await BodyComposition.requestPermissions();
          }
        } catch (e) {
          console.warn('MorphIQ: BodyComposition permissions request warning:', e);
        }
      }

      if (!result || !result.permissions) return false;
      
      const permissionsMap: Record<string, boolean> = {};
      if (Array.isArray(result.permissions)) {
        result.permissions.forEach(p => {
          const key = Object.keys(p)[0];
          if (key) {
            permissionsMap[key] = p[key];
          }
        });
      } else {
        Object.assign(permissionsMap, result.permissions);
      }

      return permissionsMap['READ_WORKOUTS'] === true;
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
          const boneMass = hasBia ? (r.boneMass || BiaCalculator.getBoneMass(weight, height, age, gender, 500)) : 0;
          
          const bodyWater = hasBia 
            ? (r.bodyWaterMass 
              ? (r.bodyWaterMass / weight) * 100 
              : BiaCalculator.getWaterPercentage(weight, height, age, gender, 500))
            : 0;

          const muscleMass = hasBia ? Math.max(10, Math.min(120, leanMass - boneMass)) : 0;

          const bmi = BiaCalculator.getBMI(weight, height);
          const bmr = BiaCalculator.getBMR(weight, height, age, gender);
          const visceralFat = hasBia ? BiaCalculator.getVisceralFat(weight, height, age, gender) : 0;
          const protein = hasBia ? Math.max(5, Math.min(32, (muscleMass / weight) * 100 - bodyWater)) : 0;

          const metabolicAge = hasBia ? BiaCalculator.getMetabolicAge(weight, height, age, gender, 500) : 0;
          const bodyType = hasBia ? BiaCalculator.getBodyType(weight, height, age, gender, 500) : 4;

          return {
            timestamp: new Date(r.timestamp),
            weight,
            impedance: hasBia ? 500 : 0, // Sync neutral fallback impedance
            bmi,
            bmr,
            bodyFat,
            bodyWater,
            boneMass,
            muscleMass,
            visceralFat,
            metabolicAge,
            protein,
            bodyType,
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
