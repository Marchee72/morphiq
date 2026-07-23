export interface RoutineExerciseItem {
  exerciseId: string;       // Strict catalog ID (e.g. "0025")
  exerciseName: string;     // Catalog exercise name
  targetSets: number;       // Target set count (e.g. 4)
  targetReps?: number;      // Target reps per set (e.g. 10)
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
