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
  /**
   * Every set the profile has ever logged, oldest first.
   *
   * Personal records and the "was this a PR at the time" walk are only honest
   * over the whole history — scoping them to a recent window would silently
   * demote a lift the user hit last year. `profileId` is indexed, so this is one
   * query rather than the N+1 that fetching per workout would cost.
   */
  getAllForProfile(profileId: string): Promise<WorkoutSet[]>;
  deleteForWorkout(workoutLogId: string): Promise<void>;
}

import type { FavoriteExercise } from '../entities/FavoriteExercise';
import type { RoutineTemplate } from '../entities/RoutineTemplate';

export interface IFavoriteExerciseRepository {
  add(favorite: FavoriteExercise): Promise<string>;
  remove(profileId: string, exerciseId: string): Promise<void>;
  getAll(profileId: string): Promise<FavoriteExercise[]>;
}

export interface IRoutineTemplateRepository {
  save(routine: RoutineTemplate): Promise<string>;
  getAll(profileId: string): Promise<RoutineTemplate[]>;
  get(id: string): Promise<RoutineTemplate | undefined>;
  delete(id: string): Promise<void>;
}

import type { WellnessLog } from '../entities/WellnessLog';

export interface IWellnessLogRepository {
  /**
   * Writes the day, replacing whatever was there.
   *
   * An upsert rather than an add: the day is the identity, so answering it
   * twice is a correction, not a second entry. Enforced in the repository
   * rather than left to callers — one duplicate row and every read has to pick
   * a winner.
   */
  save(log: WellnessLog): Promise<string>;
  getForDay(profileId: string, day: string): Promise<WellnessLog | undefined>;
  /** Days from `sinceDay` (inclusive) to now, oldest first. */
  getRange(profileId: string, sinceDay: string): Promise<WellnessLog[]>;
  delete(id: string): Promise<void>;
}


