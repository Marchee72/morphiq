import { describe, expect, it } from 'vitest';
import catalogJson from '../../../data/exercises/exercises.json';
import type { Exercise } from '../../../core/entities/Exercise';
import { groupFromExercise, groupFromName } from '../muscleLoad';

/**
 * Coverage guard for muscle attribution, measured against the real 1,324-exercise dataset.
 *
 * `muscleLoad` is the headline derived feature on Today, Train, Body and Coach in
 * both skins, but `WorkoutSet.exerciseId` is optional and much of the existing
 * history is hand-typed free text. When attribution fails, the balance rows show
 * zeros with no explanation — which reads as a broken screen rather than as
 * missing data. So both paths are measured here rather than assumed.
 */
const catalog = catalogJson as Exercise[];

/** Real categories that are exercises but not strength groups. Folding them in would skew every share. */
const NON_STRENGTH = new Set(['cardio', 'neck']);
const strength = catalog.filter(e => !NON_STRENGTH.has(e.category));

/**
 * What people actually type when they log without the picker. The full-catalogue
 * number below is dragged down by entries like "assisted prone rectus femoris
 * stretch" that nobody types by hand; this list is the case that has to work.
 */
const COMMON_LIFTS: [string, string][] = [
  ['Bench Press', 'chest'], ['Incline Bench Press', 'chest'], ['Dumbbell Fly', 'chest'],
  ['Push-up', 'chest'], ['Cable Crossover', 'chest'], ['Press de banca', 'chest'],
  ['Deadlift', 'legs'], ['Romanian Deadlift', 'legs'], ['Back Squat', 'legs'],
  ['Front Squat', 'legs'], ['Leg Press', 'legs'], ['Leg Curl', 'legs'],
  ['Leg Extension', 'legs'], ['Calf Raise', 'legs'], ['Bulgarian Split Squat', 'legs'],
  ['Hip Thrust', 'legs'], ['Sentadilla', 'legs'], ['Peso muerto', 'legs'],
  ['Barbell Row', 'back'], ['Pull-up', 'back'], ['Chin-up', 'back'],
  ['Lat Pulldown', 'back'], ['Seated Cable Row', 'back'], ['Shrug', 'back'],
  ['Dominadas', 'back'], ['Remo con barra', 'back'],
  ['Overhead Press', 'shoulders'], ['Lateral Raise', 'shoulders'],
  ['Front Raise', 'shoulders'], ['Face Pull', 'shoulders'], ['Arnold Press', 'shoulders'],
  ['Barbell Curl', 'arms'], ['Hammer Curl', 'arms'], ['Triceps Pushdown', 'arms'],
  ['Skull Crusher', 'arms'], ['Preacher Curl', 'arms'], ['Close-Grip Bench Press', 'arms'],
  ['Plank', 'core'], ['Crunch', 'core'], ['Hanging Leg Raise', 'core'],
  ['Russian Twist', 'core'], ['Cable Crunch', 'core'], ['Plancha', 'core'],
];

describe('attribution coverage', () => {
  it('resolves every strength exercise in the catalogue by category', () => {
    // The primary path. Any gap here is a straightforward mapping bug.
    const unresolved = strength.filter(e => groupFromExercise(e) === null);
    expect(unresolved.map(e => `${e.name} (${e.category}/${e.target})`)).toEqual([]);
  });

  it('leaves cardio and neck unattributed on purpose', () => {
    const excluded = catalog.filter(e => NON_STRENGTH.has(e.category));
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.filter(e => groupFromExercise(e) !== null).map(e => e.name)).toEqual([]);
  });

  it('resolves every lift a user would plausibly type by hand', () => {
    const wrong = COMMON_LIFTS
      .map(([name, expected]) => ({ name, expected, got: groupFromName(name) }))
      .filter(r => r.got !== r.expected);
    expect(wrong).toEqual([]);
  });

  it('holds the line on free-text coverage across the whole catalogue', () => {
    // Measured, not aspirational: 80% of the full dataset, the shortfall being
    // stretches and exotic variations. Below the plan's 85% bar, which is why the
    // exerciseId backfill stays scheduled — this is the number that decided it.
    const resolved = strength.filter(e => groupFromName(e.name) !== null);
    const coverage = resolved.length / strength.length;

    expect(
      coverage,
      `name-only coverage is ${(coverage * 100).toFixed(1)}% of ${strength.length} strength exercises`,
    ).toBeGreaterThan(0.78);
  });

  it('keeps confidently-wrong answers rare', () => {
    // A keyword that returns the *wrong* group is worse than one that returns null:
    // the balance read looks plausible and is silently untrue.
    const disagreements = strength.filter(e => {
      const byName = groupFromName(e.name);
      return byName !== null && byName !== groupFromExercise(e);
    });

    const rate = disagreements.length / strength.length;
    expect(
      rate,
      `${disagreements.length} disagreements, e.g. ${disagreements
        .slice(0, 6)
        .map(e => `"${e.name}" name→${groupFromName(e.name)} cat→${groupFromExercise(e)}`)
        .join('; ')}`,
    ).toBeLessThan(0.08);
  });
});
