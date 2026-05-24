import { UserProfile } from '../entities/UserProfile';
import { Measurement } from '../entities/Measurement';
import { FoodLog } from '../entities/FoodLog';
import { WorkoutLog } from '../entities/WorkoutLog';
import { Message } from '../entities/Message';

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
  delete(id: string): Promise<void>;
}

export interface IMessageRepository {
  add(message: Message): Promise<string>;
  getAll(profileId: string): Promise<Message[]>;
  clear(profileId: string): Promise<void>;
}
