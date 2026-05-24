export interface WorkoutLog {
  id?: string;
  profileId: string;
  timestamp: Date;
  type: string;        // e.g., "Strength Training", "Running", "Yoga"
  duration: number;    // in minutes
  description: string; // details of the workout
  caloriesBurned?: number;
}
