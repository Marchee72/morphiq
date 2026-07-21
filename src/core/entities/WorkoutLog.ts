export interface WorkoutLog {
  id?: string;
  profileId: string;
  timestamp: Date;
  type: string;        // e.g., "Strength Training", "Running", "Yoga"
  duration: number;    // in minutes
  description: string; // details of the workout
  caloriesBurned?: number;
  
  // New fields for Health Connect / Samsung Health integration
  distanceKm?: number;    // for running/cycling/walking
  avgHeartRate?: number;  // from Health Connect
  maxHeartRate?: number;
  source?: 'manual' | 'health-connect';  // track origin
  externalId?: string;    // Health Connect record ID (for dedup)
}

export function formatWorkoutDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

