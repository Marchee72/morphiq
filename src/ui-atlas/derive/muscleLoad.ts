import type { Exercise } from '../../core/entities/Exercise';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { StaticKey } from '../../i18n/types';
import type { MuscleGroupId, MuscleLoadRow, MuscleLoadVM } from '../types';
import { clamp, hoursBetween } from './buckets';

/** Fixed render order, so the UI never reflows as data arrives. */
export const MUSCLE_GROUPS: readonly MuscleGroupId[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupId, StaticKey> = {
  chest: 'muscle.chest',
  back: 'muscle.back',
  legs: 'muscle.legs',
  shoulders: 'muscle.shoulders',
  arms: 'muscle.arms',
  core: 'muscle.core',
};

/** Weekly set targets — the middle of the commonly cited 10–20 hypertrophy range. */
export const MUSCLE_GROUP_TARGETS: Record<MuscleGroupId, number> = {
  chest: 16, back: 16, legs: 16, shoulders: 12, arms: 12, core: 8,
};

/** Rough time-to-recovered, used for the "how fresh is this muscle" read. */
export const RECOVERY_HOURS: Record<MuscleGroupId, number> = {
  chest: 48, back: 72, legs: 72, shoulders: 48, arms: 48, core: 24,
};

/**
 * The bundled dataset's `category` values, mapped onto the six groups the designs use.
 * `cardio` and `neck` map to nothing on purpose — they are real exercises but they
 * are not a strength group, and folding them in would distort the balance read.
 */
export const CATEGORY_TO_GROUP: Record<string, MuscleGroupId> = {
  chest: 'chest',
  back: 'back',
  'upper legs': 'legs',
  'lower legs': 'legs',
  shoulders: 'shoulders',
  'upper arms': 'arms',
  'lower arms': 'arms',
  waist: 'core',
};

/** Inverse map — drives the body map and the filter chips straight into a catalogue query. */
export const GROUP_TO_CATEGORIES: Record<MuscleGroupId, string[]> = {
  chest: ['chest'],
  back: ['back'],
  legs: ['upper legs', 'lower legs'],
  shoulders: ['shoulders'],
  arms: ['upper arms', 'lower arms'],
  core: ['waist'],
};

/** `target` is finer-grained than `category` and survives when only the muscle is known. */
export const TARGET_TO_GROUP: Record<string, MuscleGroupId> = {
  pectorals: 'chest', serratus: 'chest',
  // `levator scapulae` is deliberately absent: the only two exercises targeting it
  // are neck stretches, which are not a back training set.
  lats: 'back', 'upper back': 'back', traps: 'back', spine: 'back',
  quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  delts: 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abs: 'core',
};

/**
 * Keyword fallback for free-text set names. Much of the existing history was typed
 * by hand and carries no `exerciseId`, so without this the balance read shows zeros.
 *
 * Matching is in three priority tiers because the naive single-tier version gets
 * "Back Squat" wrong — the body-part word "back" beats the movement word "squat".
 * Specific phrases win over movements, and movements win over bare body parts.
 */
const NAME_KEYWORDS: [RegExp, MuscleGroupId][] = [
  // 1. Phrases whose meaning is not the sum of their words. Every rule here was
  //    added because the tier below got a real catalogue entry wrong — see
  //    `attribution.coverage.test.ts`, which measures both paths against the dataset.
  // "close-grip bench press" is a triceps lift, but "close-grip pulldown" is still back,
  // so the grip only reassigns the movement when it is a press.
  [/\btriceps?\b/i, 'arms'],
  [/\bclose[- ]?grip\b.*\b(bench|press|push)/i, 'arms'],
  [/\bpull ?over\b/i, 'back'],
  [/\b(leg raise|knee raise|toes to bar|hanging|v-?up|sit[- ]?up|situp|pallof|roll ?out|rollerout|side bend|twist|bicycle|air bike|mountain climber|dead ?bug|bird ?dog|hollow)\b/i, 'core'],
  [/\b(calf raise|leg curl|leg extension|leg press|hip thrust|hip extension|glute bridge|good morning|step[- ]?up|rack pull|deadlift|peso muerto)\b/i, 'legs'],
  [/\b(lateral raise|front raise|rear delt|reverse fly|face pull|upright row|overhead press|military press|arnold press|shoulder press|y-?raise|thruster|snatch)\b/i, 'shoulders'],
  [/\b(skull ?crusher|preacher|pushdown|push down|kick ?back)\b/i, 'arms'],
  [/\b(chest press|chest fly|pec deck|cross ?over|press de banca)\b/i, 'chest'],

  // 2. Movement names, which identify a lift more reliably than a body part does.
  [/\b(squat|lunge|sentadilla|zancada|prensa)\b/i, 'legs'],
  [/\b(row|pull[- ]?up|pullup|chin[- ]?up|pulldown|pull down|shrug|remo|dominadas?|jal[oó]n)\b/i, 'back'],
  [/\b(bench|fly|flye|dip|push[- ]?up|pushup|fondos)\b/i, 'chest'],
  [/\b(curl)\b/i, 'arms'],
  [/\b(crunch|plank|plancha|abdominales?)\b/i, 'core'],

  // 3. Bare body-part words, last because they appear inside other lifts' names.
  [/\b(chest|pec|pectorals?|pecho)\b/i, 'chest'],
  [/\b(back|lats?|traps?|espalda|dorsal)\b/i, 'back'],
  [/\b(legs?|quads?|hamstrings?|glutes?|calf|calves|pierna|cu[aá]driceps?|femoral|gemelos?|gl[uú]teos?)\b/i, 'legs'],
  [/\b(shoulders?|delts?|deltoids?|hombros?|deltoides?)\b/i, 'shoulders'],
  [/\b(biceps?|forearms?|antebrazo|b[ií]ceps?|tr[ií]ceps?)\b/i, 'arms'],
  [/\b(abs?|core|obliques?|abdominal|oblicuos?|waist)\b/i, 'core'],
];

export function groupFromExercise(exercise: Exercise | undefined): MuscleGroupId | null {
  if (!exercise) return null;
  return (
    CATEGORY_TO_GROUP[exercise.category?.toLowerCase()] ??
    TARGET_TO_GROUP[exercise.target?.toLowerCase()] ??
    null
  );
}

export function groupFromName(name: string): MuscleGroupId | null {
  if (!name) return null;
  for (const [pattern, group] of NAME_KEYWORDS) {
    if (pattern.test(name)) return group;
  }
  return null;
}

/** Catalogue first, name second. Returns null when neither can attribute the set. */
export function resolveGroup(set: WorkoutSet, exercise: Exercise | undefined): MuscleGroupId | null {
  return groupFromExercise(exercise) ?? groupFromName(set.exerciseName);
}

/** A set counts toward load only if it was actually performed. */
export function isCountedSet(set: WorkoutSet): boolean {
  return set.isCompleted !== false && (set.reps ?? 0) > 0;
}

export const LOAD_WINDOW_HOURS = 168; // 7 days

export function buildMuscleLoad(
  sets: WorkoutSet[],
  resolveExercise: (set: WorkoutSet) => Exercise | undefined,
  now: Date,
): MuscleLoadVM {
  interface GroupTally {
    sets: number;
    lastHitAt: Date | null;
    /** Keyed by display name — what the detail sheet lists under the group. */
    exercises: Map<string, {
      name: string;
      sets: number;
      volumeKg: number;
      lastHitAt: Date | null;
      bestWeightKg: number;
      bestReps: number;
    }>;
  }

  const counts = new Map<MuscleGroupId, GroupTally>();
  let unmappedSets = 0;

  for (const set of sets) {
    if (!isCountedSet(set)) continue;
    const at = new Date(set.timestamp);
    if (hoursBetween(at, now) > LOAD_WINDOW_HOURS || at > now) continue;

    const group = resolveGroup(set, resolveExercise(set));
    if (!group) { unmappedSets++; continue; }

    const entry = counts.get(group) ?? { sets: 0, lastHitAt: null, exercises: new Map() };
    entry.sets++;
    if (!entry.lastHitAt || at > entry.lastHitAt) entry.lastHitAt = at;

    const name = set.exerciseName.trim();
    const key = name.toLowerCase();
    const tally = entry.exercises.get(key) ?? {
      name, sets: 0, volumeKg: 0,
      lastHitAt: null as Date | null,
      bestWeightKg: 0, bestReps: 0,
    };
    tally.sets++;
    tally.volumeKg += (set.weight ?? 0) * (set.reps ?? 0);
    if (!tally.lastHitAt || at > tally.lastHitAt) tally.lastHitAt = at;
    // Best set = heaviest load on the bar; volume breaks ties at equal weight.
    const setWeight = set.weight ?? 0;
    const setReps = set.reps ?? 0;
    const setVolume = setWeight * setReps;
    const bestVolume = tally.bestWeightKg * tally.bestReps;
    if (setWeight > tally.bestWeightKg || (setWeight === tally.bestWeightKg && setVolume > bestVolume)) {
      tally.bestWeightKg = setWeight;
      tally.bestReps = setReps;
    }
    entry.exercises.set(key, tally);

    counts.set(group, entry);
  }

  const rows: MuscleLoadRow[] = MUSCLE_GROUPS.map(group => {
    const entry = counts.get(group);
    const lastHitAt = entry?.lastHitAt ?? null;
    return {
      group,
      labelKey: MUSCLE_GROUP_LABELS[group],
      sets: entry?.sets ?? 0,
      target: MUSCLE_GROUP_TARGETS[group],
      // Never hit in the window reads as fully recovered, which is true.
      recoveredPct: lastHitAt
        ? clamp(Math.round((hoursBetween(lastHitAt, now) / RECOVERY_HOURS[group]) * 100), 0, 100)
        : 100,
      lastHitAt,
      exercises: [...(entry?.exercises.values() ?? [])]
        .map(ex => ({
          ...ex,
          volumeKg: Math.round(ex.volumeKg),
          lastHitAt: ex.lastHitAt,
          bestSet: ex.bestWeightKg > 0 ? { weightKg: ex.bestWeightKg, reps: ex.bestReps } : null,
        }))
        .sort((a, b) => (b.lastHitAt?.getTime() ?? 0) - (a.lastHitAt?.getTime() ?? 0)),
    };
  });

  return { rows, unmappedSets };
}
