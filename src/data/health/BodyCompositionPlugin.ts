import { registerPlugin } from '@capacitor/core';

export interface BodyCompositionRecord {
  timestamp: string;
  weight: number;
  bodyFat: number;
  leanMass: number;
  boneMass: number;
  bodyWaterMass: number;
}

export interface PermissionStatus {
  permissions: {
    [key: string]: boolean;
  };
}

export interface BodyCompositionPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  queryBodyComposition(options: {
    startDate: string;
    endDate: string;
  }): Promise<{ records: BodyCompositionRecord[] }>;
  saveBodyComposition(record: {
    timestamp: string;
    weight: number;
    bodyFat?: number;
    leanMass?: number;
    boneMass?: number;
    bodyWaterMass?: number;
  }): Promise<void>;
  /** Health Connect's separate consent for reading while the app is closed. */
  requestBackgroundPermission(): Promise<PermissionStatus>;
  enableBackgroundSync(): Promise<void>;
  disableBackgroundSync(): Promise<void>;
}

export const BodyComposition = registerPlugin<BodyCompositionPluginInterface>('BodyComposition');

export const BACKGROUND_READ_PERMISSION = 'android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND';

/** Mirrors the toggle in Settings; read on launch to re-assert the schedule. */
const BACKGROUND_SYNC_KEY = 'morphiq_background_health_sync';

export function isBackgroundSyncOn(): boolean {
  return localStorage.getItem(BACKGROUND_SYNC_KEY) === 'true';
}

/**
 * Turn the periodic background check on, asking for background read access
 * first.
 *
 * Returns whether it is actually running, which is not the same as what the
 * user asked for: Health Connect can refuse, and a worker without that
 * permission would wake every 15 minutes to be told no.
 */
export async function setBackgroundSync(on: boolean): Promise<boolean> {
  if (!on) {
    localStorage.setItem(BACKGROUND_SYNC_KEY, 'false');
    await BodyComposition.disableBackgroundSync();
    return false;
  }

  const status = await BodyComposition.requestBackgroundPermission();
  if (!status?.permissions?.[BACKGROUND_READ_PERMISSION]) {
    localStorage.setItem(BACKGROUND_SYNC_KEY, 'false');
    return false;
  }

  await BodyComposition.enableBackgroundSync();
  localStorage.setItem(BACKGROUND_SYNC_KEY, 'true');
  return true;
}
