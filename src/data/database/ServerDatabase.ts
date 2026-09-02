import type { UserProfile } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Message } from '../../core/entities/Message';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { FavoriteExercise } from '../../core/entities/FavoriteExercise';
import { api } from './apiClient';
// Re-exported so the name keeps its old home: callers catching a dead session
// import it from here, and the move should not be their problem.
export { UnauthorizedError } from './apiClient';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type {
  IUserProfileRepository,
  IMeasurementRepository,
  IFoodLogRepository,
  IWorkoutLogRepository,
  IMessageRepository,
  IWorkoutSetRepository,
  IFavoriteExerciseRepository,
  IRoutineTemplateRepository,
} from '../../core/interfaces/IDatabase';

// Helpers to cast date strings from JSON responses back to Date objects
function parseProfile(raw: Record<string, unknown>): UserProfile {
  return {
    ...raw,
    birthDate: new Date(raw.birthDate as string),
    createdAt: new Date(raw.createdAt as string),
  } as UserProfile;
}

function parseMeasurement(raw: Record<string, unknown>): Measurement {
  return { ...raw, timestamp: new Date(raw.timestamp as string) } as Measurement;
}

function parseFoodLog(raw: Record<string, unknown>): FoodLog {
  return { ...raw, timestamp: new Date(raw.timestamp as string) } as FoodLog;
}

function parseWorkoutLog(raw: Record<string, unknown>): WorkoutLog {
  return { ...raw, timestamp: new Date(raw.timestamp as string) } as WorkoutLog;
}

function parseMessage(raw: Record<string, unknown>): Message {
  return { ...raw, timestamp: new Date(raw.timestamp as string) } as Message;
}

function parseWorkoutSet(raw: Record<string, unknown>): WorkoutSet {
  return {
    ...raw,
    timestamp: new Date(raw.timestamp as string),
    reps: raw.reps != null ? Number(raw.reps) : undefined,
    weight: raw.weight != null ? Number(raw.weight) : undefined,
    distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : undefined,
    duration: raw.duration != null ? Number(raw.duration) : undefined,
    speed: raw.speed != null ? Number(raw.speed) : undefined,
    rpe: raw.rpe != null ? Number(raw.rpe) : undefined,
  } as WorkoutSet;
}

// ─── User Profile Repository ──────────────────────────────────────────────────
export class ServerUserProfileRepository implements IUserProfileRepository {
  async create(profile: UserProfile): Promise<string> {
    const result = await api<{ id: string }>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
    return result.id;
  }

  async update(profile: UserProfile): Promise<void> {
    await api(`/api/profiles/${profile.id}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async get(id: string): Promise<UserProfile | undefined> {
    try {
      const raw = await api<Record<string, unknown>>(`/api/profiles/${id}`);
      return parseProfile(raw);
    } catch {
      return undefined;
    }
  }

  async getAll(): Promise<UserProfile[]> {
    const rows = await api<Record<string, unknown>[]>('/api/profiles');
    return rows.map(parseProfile);
  }

  async delete(id: string): Promise<void> {
    await api(`/api/profiles/${id}`, { method: 'DELETE' });
  }
}

// ─── Measurement Repository ───────────────────────────────────────────────────
export class ServerMeasurementRepository implements IMeasurementRepository {
  async save(measurement: Measurement): Promise<string> {
    const result = await api<{ id: string }>('/api/measurements', {
      method: 'POST',
      body: JSON.stringify(measurement),
    });
    return result.id;
  }

  async getAll(profileId: string): Promise<Measurement[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/measurements`
    );
    return rows.map(parseMeasurement);
  }

  async getLatest(profileId: string): Promise<Measurement | undefined> {
    const all = await this.getAll(profileId);
    return all.length > 0 ? all[all.length - 1] : undefined;
  }

  async delete(id: string): Promise<void> {
    await api(`/api/measurements/${id}`, { method: 'DELETE' });
  }
}

// ─── Food Log Repository ──────────────────────────────────────────────────────
export class ServerFoodLogRepository implements IFoodLogRepository {
  async add(log: FoodLog): Promise<string> {
    const result = await api<{ id: string }>('/api/food-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
    return result.id;
  }

  async getAll(profileId: string, date?: Date): Promise<FoodLog[]> {
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      const rows = await api<Record<string, unknown>[]>(
        `/api/profiles/${profileId}/food-logs${query}`
      );
      return rows.map(parseFoodLog);
    } else {
      const rows = await api<Record<string, unknown>[]>(
        `/api/profiles/${profileId}/food-logs`
      );
      return rows.map(parseFoodLog);
    }
  }

  async delete(id: string): Promise<void> {
    await api(`/api/food-logs/${id}`, { method: 'DELETE' });
  }
}

// ─── Workout Log Repository ───────────────────────────────────────────────────
export class ServerWorkoutLogRepository implements IWorkoutLogRepository {
  async add(log: WorkoutLog): Promise<string> {
    const result = await api<{ id: string }>('/api/workout-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
    return result.id;
  }

  async getAll(profileId: string, date?: Date): Promise<WorkoutLog[]> {
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      const rows = await api<Record<string, unknown>[]>(
        `/api/profiles/${profileId}/workout-logs${query}`
      );
      return rows.map(parseWorkoutLog);
    } else {
      const rows = await api<Record<string, unknown>[]>(
        `/api/profiles/${profileId}/workout-logs`
      );
      return rows.map(parseWorkoutLog);
    }
  }

  async getRange(profileId: string, startDate: Date, endDate: Date): Promise<WorkoutLog[]> {
    const query = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/workout-logs${query}`
    );
    const logs = rows.map(parseWorkoutLog);
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return logs;
  }

  async delete(id: string): Promise<void> {
    await api(`/api/workout-logs/${id}`, { method: 'DELETE' });
  }

  async update(log: WorkoutLog): Promise<void> {
    if (!log.id) throw new Error('Cannot update workout log without an ID');
    await api(`/api/workout-logs/${log.id}`, {
      method: 'PUT',
      body: JSON.stringify(log),
    });
  }
}

// ─── Message Repository ───────────────────────────────────────────────────────
export class ServerMessageRepository implements IMessageRepository {
  async add(message: Message): Promise<string> {
    const result = await api<{ id: string }>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
    return result.id;
  }

  async getAll(profileId: string): Promise<Message[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/messages`
    );
    return rows.map(parseMessage);
  }

  async clear(profileId: string): Promise<void> {
    await api(`/api/profiles/${profileId}/messages`, { method: 'DELETE' });
  }
}

// ─── Workout Set Repository ───────────────────────────────────────────────────
export class ServerWorkoutSetRepository implements IWorkoutSetRepository {
  async add(set: WorkoutSet): Promise<string> {
    const result = await api<{ id: string }>('/api/workout-sets', {
      method: 'POST',
      body: JSON.stringify(set),
    });
    return result.id;
  }

  async delete(id: string): Promise<void> {
    await api(`/api/workout-sets/${id}`, { method: 'DELETE' });
  }

  async getForWorkout(workoutLogId: string): Promise<WorkoutSet[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/workouts/${workoutLogId}/sets`
    );
    return rows.map(parseWorkoutSet);
  }

  async getForExercise(profileId: string, exerciseName: string): Promise<WorkoutSet[]> {
    const query = `?name=${encodeURIComponent(exerciseName)}`;
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/exercises/sets${query}`
    );
    return rows.map(parseWorkoutSet);
  }

  async getAllForProfile(profileId: string): Promise<WorkoutSet[]> {
    const rows = await api<Record<string, unknown>[]>(`/api/profiles/${profileId}/sets`);
    return rows.map(parseWorkoutSet).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async deleteForWorkout(workoutLogId: string): Promise<void> {
    await api(`/api/workouts/${workoutLogId}/sets`, { method: 'DELETE' });
  }
}

function parseFavoriteExercise(raw: Record<string, unknown>): FavoriteExercise {
  return { ...raw, id: String(raw.id), addedAt: new Date(raw.addedAt as string) } as FavoriteExercise;
}

// ─── Favorite Exercise Repository ─────────────────────────────────────────────
export class ServerFavoriteExerciseRepository implements IFavoriteExerciseRepository {
  async add(favorite: FavoriteExercise): Promise<string> {
    const result = await api<{ id: string }>('/api/exercise-favorites', {
      method: 'POST',
      body: JSON.stringify(favorite),
    });
    return result.id;
  }

  async remove(profileId: string, exerciseId: string): Promise<void> {
    await api(
      `/api/exercise-favorites?profileId=${encodeURIComponent(profileId)}&exerciseId=${encodeURIComponent(exerciseId)}`,
      { method: 'DELETE' }
    );
  }

  async getAll(profileId: string): Promise<FavoriteExercise[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/profiles/${profileId}/exercise-favorites`
    );
    return rows.map(parseFavoriteExercise);
  }
}

function parseRoutineTemplate(raw: Record<string, unknown>): RoutineTemplate {
  return {
    ...raw,
    id: String(raw.id),
    createdAt: new Date(raw.createdAt as string),
    exercises: typeof raw.exercises === 'string' ? JSON.parse(raw.exercises) : (raw.exercises || []),
    targetMuscles: typeof raw.targetMuscles === 'string' ? JSON.parse(raw.targetMuscles) : (raw.targetMuscles || []),
  } as RoutineTemplate;
}

export class ServerRoutineTemplateRepository implements IRoutineTemplateRepository {
  async save(routine: RoutineTemplate): Promise<string> {
    const result = await api<{ id: string }>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(routine),
    });
    return result.id;
  }

  async getAll(profileId: string): Promise<RoutineTemplate[]> {
    const rows = await api<Record<string, unknown>[]>(`/api/profiles/${profileId}/routines`);
    return rows.map(parseRoutineTemplate);
  }

  async get(id: string): Promise<RoutineTemplate | undefined> {
    const raw = await api<Record<string, unknown>>(`/api/routines/${id}`);
    if (!raw) return undefined;
    return parseRoutineTemplate(raw);
  }

  async delete(id: string): Promise<void> {
    await api(`/api/routines/${id}`, { method: 'DELETE' });
  }
}


