import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { StaticKey } from '../../i18n/types';
import type { ExerciseBestVM } from '../types';
import { sessionRpe } from './borg';
import { fillGaps, MS_PER_WEEK, weeklyBuckets } from './buckets';
import { isCountedSet } from './muscleLoad';
import { e1rm, isPrEligible, normalizeName } from './records';

/**
 * One exercise, measured rather than listed.
 *
 * `buildExerciseHistory` already answers "what did I do, session by session",
 * which is a list you read. This answers the questions you would otherwise have
 * to work out from that list in your head: is the estimated max going up, how
 * much work am I actually putting in, what are my best sets at each rep range,
 * and how long have I been sitting on the same number.
 */

export type StatWindow = '8w' | '6m' | 'all';

/** Weeks each window covers. `all` is resolved from the history itself. */
const WINDOW_WEEKS: Record<Exclude<StatWindow, 'all'>, number> = { '8w': 8, '6m': 26 };

/**
 * Ceiling on the `all` window.
 *
 * A chart of three hundred weekly points on a 300px-wide SVG is a smear. Two
 * years is more history than anyone reads a trend off anyway.
 */
const MAX_WEEKS = 104;

export interface RepRangeBestVM {
  rangeKey: StaticKey;
  weightKg: number;
  reps: number;
  e1rm: number;
  at: Date;
}

/**
 * Rep ranges, heaviest first. The boundaries are the conventional strength /
 * hypertrophy / endurance split, and `min` is inclusive.
 */
const REP_RANGES: readonly { rangeKey: StaticKey; min: number; max: number }[] = [
  { rangeKey: 'stats.reps1to3', min: 1, max: 3 },
  { rangeKey: 'stats.reps4to6', min: 4, max: 6 },
  { rangeKey: 'stats.reps7to10', min: 7, max: 10 },
  { rangeKey: 'stats.reps11to15', min: 11, max: 15 },
  { rangeKey: 'stats.reps16plus', min: 16, max: Infinity },
];

export interface ExerciseStatsVM {
  name: string;
  window: StatWindow;
  /** How many weeks the two series span, so the chart can label its own axis. */
  weeks: number;
  sessions: number;
  totalSets: number;
  totalVolumeKg: number;
  /** Best scoreable set in the window. Null when nothing in it scores. */
  best: ExerciseBestVM | null;
  /** Estimated max from the most recent session that had a scoreable set. */
  currentE1rm: number | null;
  /** Current against the first session of the window. Null without two points. */
  e1rmDelta: number | null;
  e1rmSeries: number[] | null;
  volumeSeries: number[] | null;
  avgRpe: number | null;
  repRangeBests: RepRangeBestVM[];
  sessionsPerWeek: number | null;
  lastAt: Date | null;
  /**
   * Weeks since the estimated max last improved. Null when fewer than two
   * sessions have a scoreable set — one session is a baseline, not a plateau.
   */
  stalledWeeks: number | null;
}

/** Sets of one exercise that were actually performed, oldest first. */
function setsFor(sets: readonly WorkoutSet[], exerciseName: string): WorkoutSet[] {
  const key = normalizeName(exerciseName);
  if (!key) return [];
  return sets
    .filter(set => isCountedSet(set) && normalizeName(set.exerciseName) === key)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * How many weeks the window spans.
 *
 * `all` measures from the first set rather than using a constant, so someone
 * three weeks into an exercise gets three weeks of chart instead of two years of
 * `fillGaps` drawing a flat line over history that does not exist.
 */
export function windowWeeks(window: StatWindow, sets: readonly WorkoutSet[], now: Date): number {
  if (window !== 'all') return WINDOW_WEEKS[window];
  const first = sets[0];
  if (!first) return WINDOW_WEEKS['8w'];
  const span = (now.getTime() - new Date(first.timestamp).getTime()) / MS_PER_WEEK;
  return Math.max(2, Math.min(MAX_WEEKS, Math.ceil(span)));
}

/** Sets grouped by the session they belong to, chronological. */
function bySession(sets: readonly WorkoutSet[]): { at: Date; sets: WorkoutSet[] }[] {
  const groups = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const id = set.workoutLogId || new Date(set.timestamp).toDateString();
    groups.set(id, [...(groups.get(id) ?? []), set]);
  }
  return [...groups.values()].map(group => ({ at: new Date(group[0].timestamp), sets: group }));
}

/** Best estimated max among a session's sets, or 0 when none of them score. */
function sessionE1rm(sets: readonly WorkoutSet[]): number {
  let best = 0;
  for (const set of sets) {
    if (!isPrEligible(set)) continue;
    best = Math.max(best, e1rm(set.weight ?? 0, set.reps ?? 0));
  }
  return best;
}

/**
 * Weeks since the estimated max last went up.
 *
 * Measured from the session that set the standing best to `now`, over real
 * sessions only — reading it off the filled series would count a fortnight away
 * from the gym as a fortnight of stalling, which is a different thing entirely.
 */
function stallOf(sessions: readonly { at: Date; sets: WorkoutSet[] }[], now: Date): number | null {
  const scoreable = sessions
    .map(session => ({ at: session.at, score: sessionE1rm(session.sets) }))
    .filter(session => session.score > 0);
  if (scoreable.length < 2) return null;

  let best = 0;
  let bestAt = scoreable[0].at;
  for (const session of scoreable) {
    if (session.score > best) { best = session.score; bestAt = session.at; }
  }
  return Math.max(0, Math.floor((now.getTime() - bestAt.getTime()) / MS_PER_WEEK));
}

function bestSetIn(sets: readonly WorkoutSet[]): ExerciseBestVM | null {
  let best: ExerciseBestVM | null = null;
  for (const set of sets) {
    if (!isPrEligible(set)) continue;
    const score = e1rm(set.weight ?? 0, set.reps ?? 0);
    if (best && score <= best.e1rm) continue;
    best = {
      weightKg: set.weight ?? 0,
      reps: set.reps ?? 0,
      e1rm: +score.toFixed(1),
      at: new Date(set.timestamp),
    };
  }
  return best;
}

/**
 * The heaviest set at each rep range.
 *
 * Ranked by weight rather than by estimated max: within a band the rep count
 * barely moves, and "my best triple" means the heaviest one, not the one an
 * Epley extrapolation happens to score highest. Ranges with nothing in them are
 * left out rather than shown empty.
 */
function repRangeBests(sets: readonly WorkoutSet[]): RepRangeBestVM[] {
  const bests: RepRangeBestVM[] = [];

  for (const range of REP_RANGES) {
    let best: RepRangeBestVM | null = null;
    for (const set of sets) {
      const reps = set.reps ?? 0;
      const weight = set.weight ?? 0;
      if (weight <= 0 || reps < range.min || reps > range.max) continue;
      if (best && weight <= best.weightKg) continue;
      best = {
        rangeKey: range.rangeKey,
        weightKg: weight,
        reps,
        e1rm: +e1rm(weight, reps).toFixed(1),
        at: new Date(set.timestamp),
      };
    }
    if (best) bests.push(best);
  }

  return bests;
}

export function buildExerciseStats(
  allSets: readonly WorkoutSet[],
  exerciseName: string,
  window: StatWindow,
  now: Date,
): ExerciseStatsVM | null {
  const mine = setsFor(allSets, exerciseName);
  if (mine.length === 0) return null;

  const weeks = windowWeeks(window, mine, now);
  const since = now.getTime() - weeks * MS_PER_WEEK;
  const inWindow = mine.filter(set => new Date(set.timestamp).getTime() > since);
  if (inWindow.length === 0) {
    // Every set is older than the window. The exercise still exists, so report
    // it as empty rather than as unknown — `null` here would render "no such
    // exercise" over an exercise with real history behind it.
    return {
      name: exerciseName, window, weeks,
      sessions: 0, totalSets: 0, totalVolumeKg: 0,
      best: null, currentE1rm: null, e1rmDelta: null,
      e1rmSeries: null, volumeSeries: null, avgRpe: null,
      repRangeBests: [], sessionsPerWeek: null,
      lastAt: new Date(mine[mine.length - 1].timestamp),
      stalledWeeks: null,
    };
  }

  const sessions = bySession(inWindow);

  /**
   * The weekly point is the **best** set of the week, not the mean.
   *
   * This is the opposite choice to `bodyMetrics.buildSeries`, which averages
   * because BIA scales are noisy enough that one reading swings body fat by a
   * point. Here the spread within a week is not noise, it is warm-ups: averaging
   * a top single with three back-off sets buries the number the chart exists to
   * show.
   */
  const e1rmBuckets = weeklyBuckets(sessions, session => session.at, now, weeks);
  const e1rmSeries = fillGaps(e1rmBuckets.map(bucket => {
    const scores = bucket.items.map(session => sessionE1rm(session.sets)).filter(score => score > 0);
    return scores.length > 0 ? +Math.max(...scores).toFixed(1) : null;
  }));

  // Volume sums rather than peaks: a week is the unit training is planned in,
  // and two sessions of 4,000 kg is a heavier week than one of 6,000.
  const volumeBuckets = weeklyBuckets(inWindow, set => new Date(set.timestamp), now, weeks);
  const volumeSeries = fillGaps(volumeBuckets.map(bucket => (
    bucket.items.length === 0
      ? null
      : Math.round(bucket.items.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0))
  )));

  const scored = sessions.map(session => sessionE1rm(session.sets)).filter(score => score > 0);
  const currentE1rm = [...sessions].reverse().map(s => sessionE1rm(s.sets)).find(score => score > 0) ?? null;

  return {
    name: exerciseName,
    window,
    weeks,
    sessions: sessions.length,
    totalSets: inWindow.length,
    totalVolumeKg: Math.round(
      inWindow.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0),
    ),
    best: bestSetIn(inWindow),
    currentE1rm: currentE1rm === null ? null : +currentE1rm.toFixed(1),
    // Two scoreable sessions or it is a starting point, not a change.
    e1rmDelta: scored.length >= 2 && currentE1rm !== null
      ? +(currentE1rm - scored[0]).toFixed(1)
      : null,
    e1rmSeries,
    volumeSeries,
    avgRpe: sessionRpe(inWindow).avg,
    repRangeBests: repRangeBests(inWindow),
    sessionsPerWeek: +(sessions.length / weeks).toFixed(1),
    lastAt: new Date(inWindow[inWindow.length - 1].timestamp),
    stalledWeeks: stallOf(sessions, now),
  };
}
