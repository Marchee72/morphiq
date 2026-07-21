export interface FavoriteExercise {
  id?: string;
  profileId: string;
  exerciseId: string;   // catalog Exercise.id, e.g. "0025"
  addedAt: Date;
}
