import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Message } from '../../core/entities/Message';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { FavoriteExercise } from '../../core/entities/FavoriteExercise';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { WellnessLog } from '../../core/entities/WellnessLog';
import type {
  IUserProfileRepository,
  IMeasurementRepository,
  IFoodLogRepository,
  IWorkoutLogRepository,
  IMessageRepository,
  IWorkoutSetRepository,
  IFavoriteExerciseRepository,
  IRoutineTemplateRepository,
  IWellnessLogRepository,
} from '../../core/interfaces/IDatabase';


export class DexieDatabase extends Dexie {
  userProfiles!: Table<UserProfile, number>;
  measurements!: Table<Measurement, number>;
  foodLogs!: Table<FoodLog, number>;
  workoutLogs!: Table<WorkoutLog, number>;
  messages!: Table<Message, number>;
  workoutSets!: Table<WorkoutSet, number>;
  favoriteExercises!: Table<FavoriteExercise, number>;
  routineTemplates!: Table<RoutineTemplate, number>;
  wellnessLogs!: Table<WellnessLog, number>;

  constructor() {
    super('MorphIQDatabase');
    this.version(1).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
    });
    this.version(2).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, timestamp',
    });
    this.version(3).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, timestamp',
      userExercises: '++id, profileId, name',
    });
    this.version(4).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: '++id, profileId, name',
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
    });
    this.version(5).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: null,
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
    });
    this.version(6).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: null,
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
      routineTemplates: '++id, profileId, title, createdAt',
    });
    // `[profileId+day]` is the compound index the upsert reads: one row per
    // profile per day is the whole shape of the table, and finding the existing
    // row by scanning would get slower with every day the app is used.
    this.version(7).stores({
      userProfiles: '++id, name, gender, birthDate, height, createdAt',
      measurements: '++id, profileId, timestamp, weight, impedance',
      foodLogs: '++id, profileId, timestamp, mealType',
      workoutLogs: '++id, profileId, timestamp, type',
      messages: '++id, profileId, timestamp, sender',
      workoutSets: '++id, workoutLogId, profileId, exerciseName, exerciseId, timestamp',
      userExercises: null,
      favoriteExercises: '++id, profileId, exerciseId, addedAt',
      routineTemplates: '++id, profileId, title, createdAt',
      wellnessLogs: '++id, profileId, day, [profileId+day]',
    });
  }
}

export const db = new DexieDatabase();

// Repository Implementations

export class UserProfileRepository implements IUserProfileRepository {
  async create(profile: UserProfile): Promise<string> {
    const id = await db.userProfiles.add({
      ...profile,
      createdAt: profile.createdAt || new Date(),
    });
    return id.toString();
  }

  async update(profile: UserProfile): Promise<void> {
    if (!profile.id) throw new Error('Cannot update profile without an ID');
    const { id, ...changes } = profile;
    await db.userProfiles.update(Number(id), changes);
  }

  async get(id: string): Promise<UserProfile | undefined> {
    const profile = await db.userProfiles.get(Number(id));
    if (profile) {
      return { ...profile, id: profile.id?.toString() };
    }
    return undefined;
  }

  async getAll(): Promise<UserProfile[]> {
    const profiles = await db.userProfiles.toArray();
    return profiles.map(p => ({ ...p, id: p.id?.toString() }));
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.userProfiles, db.measurements, db.foodLogs, db.workoutLogs, db.messages, db.workoutSets, db.favoriteExercises], async () => {
      await db.userProfiles.delete(Number(id));
      await db.measurements.where('profileId').equals(id).delete();
      await db.foodLogs.where('profileId').equals(id).delete();
      await db.workoutLogs.where('profileId').equals(id).delete();
      await db.messages.where('profileId').equals(id).delete();
      await db.workoutSets.where('profileId').equals(id).delete();
      await db.favoriteExercises.where('profileId').equals(id).delete();
    });
  }
}

export class MeasurementRepository implements IMeasurementRepository {
  async save(measurement: Measurement): Promise<string> {
    const id = await db.measurements.add({
      ...measurement,
      timestamp: measurement.timestamp || new Date(),
    });
    return id.toString();
  }

  async getAll(profileId: string): Promise<Measurement[]> {
    const records = await db.measurements
      .where('profileId')
      .equals(profileId)
      .sortBy('timestamp');
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }

  async getLatest(profileId: string): Promise<Measurement | undefined> {
    const records = await db.measurements
      .where('profileId')
      .equals(profileId)
      .reverse()
      .sortBy('timestamp');
    if (records.length > 0) {
      return { ...records[0], id: records[0].id?.toString() };
    }
    return undefined;
  }

  async delete(id: string): Promise<void> {
    await db.measurements.delete(Number(id));
  }
}

export class FoodLogRepository implements IFoodLogRepository {
  async add(log: FoodLog): Promise<string> {
    const id = await db.foodLogs.add({
      ...log,
      timestamp: log.timestamp || new Date(),
    });
    return id.toString();
  }

  async getAll(profileId: string, date?: Date): Promise<FoodLog[]> {
    const query = db.foodLogs.where('profileId').equals(profileId);
    let logs = await query.toArray();

    if (date) {
      const searchDateStr = date.toDateString();
      logs = logs.filter(l => l.timestamp.toDateString() === searchDateStr);
    }
    
    // Sort logs by timestamp ascending
    logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return logs.map(l => ({ ...l, id: l.id?.toString() }));
  }

  async delete(id: string): Promise<void> {
    await db.foodLogs.delete(Number(id));
  }
}

export class WorkoutLogRepository implements IWorkoutLogRepository {
  async add(log: WorkoutLog): Promise<string> {
    const id = await db.workoutLogs.add({
      ...log,
      timestamp: log.timestamp || new Date(),
    });
    return id.toString();
  }

  async getAll(profileId: string, date?: Date): Promise<WorkoutLog[]> {
    const query = db.workoutLogs.where('profileId').equals(profileId);
    let logs = await query.toArray();

    if (date) {
      const searchDateStr = date.toDateString();
      logs = logs.filter(l => l.timestamp.toDateString() === searchDateStr);
    }

    logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return logs.map(l => ({ ...l, id: l.id?.toString() }));
  }

  async getRange(profileId: string, startDate: Date, endDate: Date): Promise<WorkoutLog[]> {
    const all = await db.workoutLogs.where('profileId').equals(profileId).toArray();
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const filtered = all.filter(l => {
      const t = l.timestamp.getTime();
      return t >= startMs && t <= endMs;
    });
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return filtered.map(l => ({ ...l, id: l.id?.toString() }));
  }

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.workoutLogs, db.workoutSets], async () => {
      await db.workoutLogs.delete(Number(id));
      await db.workoutSets.where('workoutLogId').equals(id).delete();
    });
  }

  async update(log: WorkoutLog): Promise<void> {
    if (!log.id) throw new Error('Cannot update workout log without an ID');
    const { id, ...changes } = log;
    await db.workoutLogs.update(Number(id), changes);
  }
}

export class WorkoutSetRepository implements IWorkoutSetRepository {
  async add(set: WorkoutSet): Promise<string> {
    const id = await db.workoutSets.add({
      ...set,
      timestamp: set.timestamp || new Date(),
    });
    return id.toString();
  }

  async delete(id: string): Promise<void> {
    await db.workoutSets.delete(Number(id));
  }

  async getForWorkout(workoutLogId: string): Promise<WorkoutSet[]> {
    const records = await db.workoutSets
      .where('workoutLogId')
      .equals(workoutLogId)
      .toArray();
    records.sort((a, b) => a.setNumber - b.setNumber);
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }

  async getForExercise(profileId: string, exerciseName: string): Promise<WorkoutSet[]> {
    const records = await db.workoutSets
      .where('profileId')
      .equals(profileId)
      .filter(r => r.exerciseName.toLowerCase() === exerciseName.toLowerCase())
      .toArray();
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // newest first
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }

  async getAllForProfile(profileId: string): Promise<WorkoutSet[]> {
    const records = await db.workoutSets
      .where('profileId')
      .equals(profileId)
      .toArray();
    records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // oldest first
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }

  async deleteForWorkout(workoutLogId: string): Promise<void> {
    await db.workoutSets
      .where('workoutLogId')
      .equals(workoutLogId)
      .delete();
  }
}

export class MessageRepository implements IMessageRepository {
  async add(message: Message): Promise<string> {
    const id = await db.messages.add({
      ...message,
      timestamp: message.timestamp || new Date(),
    });
    return id.toString();
  }

  async getAll(profileId: string): Promise<Message[]> {
    const logs = await db.messages
      .where('profileId')
      .equals(profileId)
      .sortBy('timestamp');
    return logs.map(m => ({ ...m, id: m.id?.toString() }));
  }

  async clear(profileId: string): Promise<void> {
    await db.messages.where('profileId').equals(profileId).delete();
  }
}

export class FavoriteExerciseRepository implements IFavoriteExerciseRepository {
  async add(favorite: FavoriteExercise): Promise<string> {
    const id = await db.favoriteExercises.add({
      ...favorite,
      addedAt: favorite.addedAt || new Date(),
    });
    return id.toString();
  }

  async remove(profileId: string, exerciseId: string): Promise<void> {
    await db.favoriteExercises
      .where('profileId')
      .equals(profileId)
      .and(f => f.exerciseId === exerciseId)
      .delete();
  }

  async getAll(profileId: string): Promise<FavoriteExercise[]> {
    const records = await db.favoriteExercises
      .where('profileId')
      .equals(profileId)
      .toArray();
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }
}

export class RoutineTemplateRepository implements IRoutineTemplateRepository {
  async save(routine: RoutineTemplate): Promise<string> {
    const id = await db.routineTemplates.add({
      ...routine,
      createdAt: routine.createdAt || new Date(),
    });
    return id.toString();
  }

  async getAll(profileId: string): Promise<RoutineTemplate[]> {
    const records = await db.routineTemplates
      .where('profileId')
      .equals(profileId)
      .reverse()
      .sortBy('createdAt');
    return records.map(r => ({ ...r, id: r.id?.toString() }));
  }

  async get(id: string): Promise<RoutineTemplate | undefined> {
    const record = await db.routineTemplates.get(Number(id));
    if (!record) return undefined;
    return { ...record, id: record.id?.toString() };
  }

  async delete(id: string): Promise<void> {
    await db.routineTemplates.delete(Number(id));
  }
}

export class WellnessLogRepository implements IWellnessLogRepository {
  /**
   * Upsert on `[profileId+day]`.
   *
   * The row is merged rather than replaced, because two different writers reach
   * it: the sheet, which knows the four answers, and the Health Connect import,
   * which knows sleep and resting heart rate. Replacing would mean whichever ran
   * last wiped the other's fields.
   */
  async save(log: WellnessLog): Promise<string> {
    const existing = await db.wellnessLogs
      .where('[profileId+day]')
      .equals([log.profileId, log.day])
      .first();

    if (existing?.id !== undefined) {
      const { id: _incoming, ...incoming } = log;
      await db.wellnessLogs.update(existing.id as unknown as number, incoming);
      return existing.id.toString();
    }

    const id = await db.wellnessLogs.add({ ...log, timestamp: log.timestamp || new Date() });
    return id.toString();
  }

  async getForDay(profileId: string, day: string): Promise<WellnessLog | undefined> {
    const record = await db.wellnessLogs
      .where('[profileId+day]')
      .equals([profileId, day])
      .first();
    return record && { ...record, id: record.id?.toString() };
  }

  async getRange(profileId: string, sinceDay: string): Promise<WellnessLog[]> {
    const records = await db.wellnessLogs
      .where('profileId')
      .equals(profileId)
      .toArray();
    // `day` is zero-padded precisely so this comparison is a string compare.
    return records
      .filter(r => r.day >= sinceDay)
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(r => ({ ...r, id: r.id?.toString() }));
  }

  async delete(id: string): Promise<void> {
    await db.wellnessLogs.delete(Number(id));
  }
}


