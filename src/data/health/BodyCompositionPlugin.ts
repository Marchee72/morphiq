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
}

export const BodyComposition = registerPlugin<BodyCompositionPluginInterface>('BodyComposition');
