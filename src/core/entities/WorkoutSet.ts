export interface WorkoutSet {
  id?: string;
  workoutLogId: string; // Foreign key linking to a specific WorkoutLog
  profileId: string;
  exerciseName: string; // e.g. "Bench Press"
  exerciseId?: string; // Optional catalog exercise ID for linking to exercise library
  setNumber: number;    // 1-indexed set number
  weight?: number;       // Weight in kg/lbs
  reps?: number;         // Repetitions performed
  distanceKm?: number;   // Distance in km
  duration?: number;     // Duration in minutes
  speed?: number;        // Speed in km/h or mph
  timestamp: Date;      // Timestamp of log
  notes?: string;
  biserieGroupId?: string; // Group ID if performed in a superset/biserie
  isCompleted?: boolean;   // Completion status checkmark
}
