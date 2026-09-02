export interface RoutineExerciseItem {
  exerciseId: string;       // Strict catalog ID (e.g. "0025")
  exerciseName: string;     // Catalog exercise name
  targetSets: number;       // Target set count (e.g. 4)
  targetReps?: number;      // Target reps per set (e.g. 10)
  /**
   * Suggested load in kg, when the routine has an opinion about one.
   *
   * Optional and only ever a suggestion: it pre-fills the dial on the first set
   * and is overwritten the moment the lifter turns it. A routine shared with a
   * friend carries the sender's numbers, which are theirs, not a prescription.
   */
  targetWeight?: number;
  notes?: string;           // Form cues / rest advice
}

export interface RoutineTemplate {
  id?: string;
  profileId: string;
  title: string;
  description: string;
  targetMuscles: string[];
  exercises: RoutineExerciseItem[];
  createdAt: Date;
}
