import { describe, expect, it } from 'vitest';
import { buildSessionSummary } from '../summary';
import type { SessionExerciseVM, SessionSetVM, SessionTotalsVM, SessionVM } from '../../types';

const STARTED = new Date(2026, 6, 27, 18, 0, 0);
const ENDED = new Date(2026, 6, 27, 19, 2, 30);

function set(partial: Partial<SessionSetVM> & { setNum: number }): SessionSetVM {
  return { weightKg: 0, reps: 0, done: false, ...partial };
}

function exercise(
  name: string,
  sets: SessionSetVM[],
  extra: Partial<SessionExerciseVM> = {},
): SessionExerciseVM {
  return {
    key: name,
    name,
    target: '',
    equipment: '',
    image: '',
    gif: '',
    best: null,
    sets,
    ...extra,
  };
}

const session: SessionVM = { title: 'Push A', startedAt: STARTED };

const totals: SessionTotalsVM = { volumeKg: 2000, setsDone: 4, setsPlanned: 6, prs: 1 };

describe('buildSessionSummary', () => {
  it('measures the session from its own start and end, not the clock', () => {
    const summary = buildSessionSummary(session, [], totals, ENDED);
    expect(summary.durationSec).toBe(62 * 60 + 30);
    expect(summary.startedAt).toBe(STARTED);
    expect(summary.endedAt).toBe(ENDED);
  });

  it('carries the totals through rather than recomputing them differently', () => {
    const summary = buildSessionSummary(session, [], totals, ENDED);
    expect(summary.volumeKg).toBe(2000);
    expect(summary.setsDone).toBe(4);
    expect(summary.setsPlanned).toBe(6);
  });

  it('reports the heaviest completed set as the top set', () => {
    const summary = buildSessionSummary(
      session,
      [exercise('Bench', [
        set({ setNum: 1, weightKg: 80, reps: 8, done: true }),
        set({ setNum: 2, weightKg: 92.5, reps: 3, done: true }),
        set({ setNum: 3, weightKg: 85, reps: 5, done: true }),
      ])],
      totals,
      ENDED,
    );
    expect(summary.exercises[0].topSet).toEqual({ weightKg: 92.5, reps: 3 });
  });

  it('counts only completed sets toward volume', () => {
    const summary = buildSessionSummary(
      session,
      [exercise('Bench', [
        set({ setNum: 1, weightKg: 100, reps: 10, done: true }),
        // Planned but never logged: it must not inflate the recap.
        set({ setNum: 2, weightKg: 100, reps: 10, done: false }),
      ])],
      totals,
      ENDED,
    );
    expect(summary.exercises[0].volumeKg).toBe(1000);
    expect(summary.exercises[0].setsDone).toBe(1);
    expect(summary.exercises[0].setsPlanned).toBe(2);
  });

  it('collects records across exercises', () => {
    const summary = buildSessionSummary(
      session,
      [
        exercise('Bench', [set({ setNum: 1, weightKg: 92.5, reps: 3, done: true, isPr: true })]),
        exercise('Row', [set({ setNum: 1, weightKg: 70, reps: 8, done: true })]),
      ],
      totals,
      ENDED,
    );
    expect(summary.prs).toEqual([{ exerciseName: 'Bench', weightKg: 92.5, reps: 3 }]);
    expect(summary.exercises[0].prCount).toBe(1);
    expect(summary.exercises[1].prCount).toBe(0);
  });

  it('leaves out exercises that were never touched', () => {
    // A session often carries exercises you planned and skipped. A recap of what
    // you did should not list what you did not.
    const summary = buildSessionSummary(
      session,
      [
        exercise('Bench', [set({ setNum: 1, weightKg: 80, reps: 8, done: true })]),
        exercise('Skipped', [set({ setNum: 1 }), set({ setNum: 2 })]),
      ],
      totals,
      ENDED,
    );
    expect(summary.exercises.map(e => e.name)).toEqual(['Bench']);
    expect(summary.exercisesDone).toBe(1);
  });

  it('never reports a negative duration when the clocks disagree', () => {
    const summary = buildSessionSummary(session, [], totals, new Date(STARTED.getTime() - 60_000));
    expect(summary.durationSec).toBe(0);
  });
});
