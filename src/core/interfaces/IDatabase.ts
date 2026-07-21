import type { UserProfile } from '../entities/UserProfile';
import type { Measurement } from '../entities/Measurement';
import type { FoodLog } from '../entities/FoodLog';
import type { WorkoutLog } from '../entities/WorkoutLog';
import type { Message } from '../entities/Message';
import type { WorkoutSet } from '../entities/WorkoutSet';

export interface IUserProfileRepository {
  create(profile: UserProfile): Promise<string>;
  update(profile: UserProfile): Promise<void>;
  get(id: string): Promise<UserProfile | undefined>;
  getAll(): Promise<UserProfile[]>;
  delete(id: string): Promise<void>;
}

export interface IMeasurementRepository {
  save(measurement: Measurement): Promise<string>;
  getAll(profileId: string): Promise<Measurement[]>;
  getLatest(profileId: string): Promise<Measurement | undefined>;
  delete(id: string): Promise<void>;
}

export interface IFoodLogRepository {
  add(log: FoodLog): Promise<string>;
  getAll(profileId: string, date?: Date): Promise<FoodLog[]>;
  delete(id: string): Promise<void>;
}

export interface IWorkoutLogRepository {
  add(log: WorkoutLog): Promise<string>;
  getAll(profileId: string, date?: Date): Promise<WorkoutLog[]>;
  getRange(profileId: string, startDate: Date, endDate: Date): Promise<WorkoutLog[]>;
  delete(id: string): Promise<void>;
  update(log: WorkoutLog): Promise<void>;
}

export interface IMessageRepository {
  add(message: Message): Promise<string>;
  getAll(profileId: string): Promise<Message[]>;
  clear(profileId: string): Promise<void>;
}

export interface IWorkoutSetRepository {
  add(set: WorkoutSet): Promise<string>;
  delete(id: string): Promise<void>;
  getForWorkout(workoutLogId: string): Promise<WorkoutSet[]>;
  getForExercise(profileId: string, exerciseName: string): Promise<WorkoutSet[]>;
  deleteForWorkout(workoutLogId: string): Promise<void>;
}

import type { FavoriteExercise } from '../entities/FavoriteExercise';

export interface IFavoriteExerciseRepository {
  add(favorite: FavoriteExercise): Promise<string>;
  remove(profileId: string, exerciseId: string): Promise<void>;
  getAll(profileId: string): Promise<FavoriteExercise[]>;
}

