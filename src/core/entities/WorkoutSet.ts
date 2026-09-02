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
  /**
   * Perceived exertion, Borg 6-20. Absent means it was never asked or answered.
   *
   * Asked once per exercise and written identically to every completed set of
   * it. It lives on the set and not on a row of its own because there is no row
   * of its own — what gets persisted is the session and its sets, nothing in
   * between. Storing it per set also leaves the door open to asking per set
   * later without a migration.
   */
  rpe?: number;
}
