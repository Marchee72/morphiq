import type { Measurement } from '../../core/entities/Measurement';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import { buildExerciseHistory } from '../../ui-atlas/derive/exerciseHistory';
import { buildPersonalRecords } from '../../ui-atlas/derive/records';
import { buildSessionDetail } from '../../ui-atlas/derive/sessionDetail';
import { annotatePrs } from '../../ui-atlas/derive/records';
import { startOfDay, MS_PER_DAY } from '../../ui-atlas/derive/buckets';

/**
 * What the coach can look up for itself.
 *
 * The prompt used to carry a fixed dump — ten workout lines, sets for five of
 * them, no date anchor and no sight of the session you were in the middle of.
 * Asked "how was my routine today" the model had nothing to answer from, and
 * said so. These let it go and get what the question actually needs.
 *
 * The executor takes a `CoachDataSource` rather than reading the store directly,
 * so it stays a pure function of its inputs and can be tested with a fake.
 */

/** A live session, as the store holds it. Structurally typed to avoid a store import. */
export interface ActiveSessionSnapshot {
  startTime: Date;
  workoutType: string;
  routineSource?: string;
  routineExercises?: { exerciseName: string; targetSets: number; targetReps?: number; notes?: string }[];
  sets: { exerciseName: string; setNumber: number; weight?: number; reps?: number; isCompleted?: boolean }[];
  feelingTag?: string;
  bodyNotes?: string;
}

export interface CoachDataSource {
  now(): Date;
  workoutLogs(): WorkoutLog[];
  /** Every set ever logged, for the profile. */
  allSets(): WorkoutSet[];
  activeSession(): ActiveSessionSnapshot | null;
  routines(): RoutineTemplate[];
  measurements(): Measurement[];
}

export interface CoachToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const noParams = { type: 'object', properties: {}, required: [] as string[] };

export const COACH_TOOLS: CoachToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'get_sessions',
      description:
        'The user\'s completed training sessions in a date range, each with every exercise and set. '
        + 'Defaults to the last 7 days. Use this for any question about what they trained, including "today".',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Inclusive start date, YYYY-MM-DD. Defaults to 7 days ago.' },
          to: { type: 'string', description: 'Inclusive end date, YYYY-MM-DD. Defaults to today.' },
          limit: { type: 'number', description: 'Maximum sessions to return, newest first. Defaults to 20.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_session',
      description:
        'The session the user is in the middle of right now, if any — planned exercises, which sets are '
        + 'already logged, and how long it has been running. A session in progress is not in get_sessions yet.',
      parameters: noParams,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exercise_history',
      description:
        'Every past session for one exercise, newest first, with each set and whether it was a record at '
        + 'the time. Use this for progression and plateau questions about a specific lift.',
      parameters: {
        type: 'object',
        properties: {
          exerciseName: { type: 'string', description: 'Exercise name, as the user logs it.' },
          limit: { type: 'number', description: 'Maximum sessions. Defaults to 12.' },
        },
        required: ['exerciseName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_records',
      description: 'The user\'s best estimated one-rep max per exercise, strongest first.',
      parameters: noParams,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_routines',
      description: 'Routine templates the user has saved and can start with one tap.',
      parameters: noParams,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_body_metrics',
      description: 'Scale readings (weight, body fat, muscle mass) over a window, oldest first.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'How far back to look. Defaults to 90.' },
        },
        required: [],
      },
    },
  },
];

/** `YYYY-MM-DD` in local time — matching how the model is told to phrase dates. */
function isoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function setsForLog(all: WorkoutSet[], logId: string): WorkoutSet[] {
  return all.filter(set => set.workoutLogId === logId);
}

type Args = Record<string, unknown>;

export function runCoachTool(name: string, args: Args, source: CoachDataSource): unknown {
  const now = source.now();

  switch (name) {
    case 'get_sessions': {
      const to = parseDay(args.to) ?? now;
      const from = parseDay(args.from) ?? new Date(startOfDay(now).getTime() - 6 * MS_PER_DAY);
      const limit = typeof args.limit === 'number' ? args.limit : 20;

      const fromMs = startOfDay(from).getTime();
      // End of the `to` day, so "to: today" includes a session logged an hour ago.
      const toMs = startOfDay(to).getTime() + MS_PER_DAY;

      const all = source.allSets();
      const prSetIds = annotatePrs(all);

      const sessions = source
        .workoutLogs()
        .filter(log => {
          const at = new Date(log.timestamp).getTime();
          return at >= fromMs && at < toMs;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .map(log => {
          const detail = buildSessionDetail(log, setsForLog(all, log.id ?? ''), prSetIds);
          return {
            date: isoDay(detail.at),
            time: detail.at.toTimeString().slice(0, 5),
            type: detail.title,
            durationMin: detail.durationMin,
            totalVolumeKg: detail.volumeKg,
            totalSets: detail.setsDone,
            feeling: detail.feeling,
            note: detail.notes,
            exercises: detail.exercises.map(ex => ({
              name: ex.name,
              volumeKg: ex.volumeKg,
              sets: ex.sets.map(s => ({ set: s.setNum, weightKg: s.weightKg, reps: s.reps, personalRecord: s.isPr })),
            })),
          };
        });

      return { from: isoDay(from), to: isoDay(to), count: sessions.length, sessions };
    }

    case 'get_active_session': {
      const session = source.activeSession();
      if (!session) return { inProgress: false };

      const start = new Date(session.startTime);
      const logged = session.sets.filter(s => s.isCompleted !== false && (s.reps ?? 0) > 0);

      return {
        inProgress: true,
        startedAt: start.toISOString(),
        elapsedMin: Math.max(0, Math.round((now.getTime() - start.getTime()) / 60_000)),
        type: session.workoutType,
        source: session.routineSource,
        feeling: session.feelingTag,
        note: session.bodyNotes,
        plannedSets: session.routineExercises?.reduce((n, ex) => n + ex.targetSets, 0) ?? 0,
        loggedSets: logged.length,
        volumeKgSoFar: Math.round(logged.reduce((total, s) => total + (s.weight ?? 0) * (s.reps ?? 0), 0)),
        exercises: (session.routineExercises ?? []).map(ex => ({
          name: ex.exerciseName,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          note: ex.notes,
          sets: session.sets
            .filter(s => s.exerciseName === ex.exerciseName)
            .sort((a, b) => a.setNumber - b.setNumber)
            .map(s => ({
              set: s.setNumber,
              weightKg: s.weight,
              reps: s.reps,
              done: s.isCompleted !== false && (s.reps ?? 0) > 0,
            })),
        })),
      };
    }

    case 'get_exercise_history': {
      const exerciseName = typeof args.exerciseName === 'string' ? args.exerciseName : '';
      if (!exerciseName) return { error: 'exerciseName is required' };
      const limit = typeof args.limit === 'number' ? args.limit : 12;

      const sessions = buildExerciseHistory(source.allSets(), exerciseName, limit);
      return {
        exerciseName,
        count: sessions.length,
        sessions: sessions.map(entry => ({
          date: isoDay(entry.at),
          volumeKg: entry.volumeKg,
          bestE1rm: entry.bestE1rm,
          topSet: entry.topSet,
          sets: entry.sets.map(s => ({ set: s.setNum, weightKg: s.weightKg, reps: s.reps, personalRecord: s.isPr })),
        })),
      };
    }

    case 'get_records':
      return {
        records: buildPersonalRecords(source.allSets(), 20).map(record => ({
          exerciseName: record.exerciseName,
          weightKg: record.weightKg,
          reps: record.reps,
          estimated1rmKg: record.e1rm,
          date: isoDay(record.at),
        })),
      };

    case 'get_routines':
      return {
        routines: source.routines().map(routine => ({
          title: routine.title,
          description: routine.description,
          targetMuscles: routine.targetMuscles,
          exercises: routine.exercises.map(ex => ({
            name: ex.exerciseName,
            sets: ex.targetSets,
            reps: ex.targetReps,
            note: ex.notes,
          })),
        })),
      };

    case 'get_body_metrics': {
      const days = typeof args.days === 'number' ? args.days : 90;
      const since = now.getTime() - days * MS_PER_DAY;

      const readings = source
        .measurements()
        .filter(m => new Date(m.timestamp).getTime() >= since)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(m => ({
          date: isoDay(new Date(m.timestamp)),
          weightKg: m.weight,
          bodyFatPct: m.bodyFat,
          muscleMassKg: m.muscleMass,
          bmr: m.bmr,
        }));

      return { days, count: readings.length, readings };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
