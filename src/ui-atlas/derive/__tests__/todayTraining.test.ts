import { describe, expect, it } from 'vitest';
import { buildTodayTraining, freshGroups, goalNudge, nextMuscleFocus } from '../todayTraining';
import type { HistoryEntryVM, MuscleLoadRow } from '../../types';

const NOW = new Date(2026, 6, 29, 18, 0);
const DAY = 86_400_000;

function entry(id: string, hoursOrDaysAgo: number, over: Partial<HistoryEntryVM> = {}): HistoryEntryVM {
  return {
    id,
    at: new Date(NOW.getTime() - hoursOrDaysAgo),
    title: 'Push A',
    durationMin: 60,
    volumeKg: 5000,
    sets: 12,
    prs: 0,
    exercises: ['Barbell Bench Press'],
    ...over,
  };
}

/** Newest first, the order `buildHistory` produces. */
function history(...entries: HistoryEntryVM[]): HistoryEntryVM[] {
  return [...entries].sort((a, b) => b.at.getTime() - a.at.getTime());
}

describe('buildTodayTraining', () => {
  it('reports nothing trained on a day with no sessions', () => {
    const today = buildTodayTraining(history(entry('w1', 2 * DAY)), NOW);
    expect(today.sessions).toHaveLength(0);
    expect(today.sets).toBe(0);
    expect(today.volumeKg).toBe(0);
  });

  it('totals every session logged today', () => {
    const today = buildTodayTraining(
      history(
        entry('w1', 3 * 3_600_000, { sets: 10, volumeKg: 4000, durationMin: 45, prs: 1 }),
        entry('w2', 8 * 3_600_000, { sets: 6, volumeKg: 2000, durationMin: 30, prs: 2, title: 'Cardio' }),
        entry('w3', 2 * DAY),
      ),
      NOW,
    );

    expect(today.sessions.map(s => s.id)).toEqual(['w1', 'w2']);
    expect(today.sets).toBe(16);
    expect(today.volumeKg).toBe(6000);
    expect(today.minutes).toBe(75);
    expect(today.prs).toBe(3);
  });

  it('merges the exercises of the day, without repeating one', () => {
    const today = buildTodayTraining(
      history(
        entry('w1', 3_600_000, { exercises: ['Barbell Bench Press', 'Barbell Row'] }),
        entry('w2', 7_200_000, { exercises: ['barbell bench press', 'Back Squat'] }),
      ),
      NOW,
    );
    expect(today.exercises).toEqual(['Barbell Bench Press', 'Barbell Row', 'Back Squat']);
  });

  it('carries the last session before today, so the screen can say what is due', () => {
    const today = buildTodayTraining(
      history(entry('w1', 3 * DAY, { title: 'Legs' }), entry('w2', 9 * DAY)),
      NOW,
    );
    expect(today.previous?.title).toBe('Legs');
    expect(today.daysSincePrevious).toBe(3);
  });

  it('does not mistake a session earlier today for the previous one', () => {
    // Both fields would otherwise point at the same session on a day you trained.
    const today = buildTodayTraining(
      history(entry('w1', 3_600_000), entry('w2', 2 * DAY, { title: 'Pull B' })),
      NOW,
    );
    expect(today.sessions).toHaveLength(1);
    expect(today.previous?.title).toBe('Pull B');
  });

  it('has no previous session at all on day one', () => {
    const today = buildTodayTraining([], NOW);
    expect(today.previous).toBeNull();
    expect(today.daysSincePrevious).toBeNull();
  });
});

function row(over: Partial<MuscleLoadRow>): MuscleLoadRow {
  return {
    group: 'chest',
    labelKey: 'muscle.chest',
    sets: 8,
    target: 16,
    recoveredPct: 100,
    lastHitAt: null,
    exercises: [],
    ...over,
  };
}

describe('nextMuscleFocus', () => {
  it('picks the group furthest behind its weekly target', () => {
    const focus = nextMuscleFocus([
      row({ group: 'chest', sets: 14, target: 16 }),
      row({ group: 'legs', labelKey: 'muscle.legs', sets: 2, target: 16 }),
      row({ group: 'arms', labelKey: 'muscle.arms', sets: 9, target: 12 }),
    ]);
    expect(focus?.group).toBe('legs');
  });

  it('measures the gap in proportion, not in raw sets', () => {
    // 2/8 is further behind than 6/16 even though the raw shortfall is smaller.
    const focus = nextMuscleFocus([
      row({ group: 'back', labelKey: 'muscle.back', sets: 6, target: 16 }),
      row({ group: 'core', labelKey: 'muscle.core', sets: 2, target: 8 }),
    ]);
    expect(focus?.group).toBe('core');
  });

  it('breaks a tie towards the more recovered group', () => {
    const focus = nextMuscleFocus([
      row({ group: 'chest', sets: 4, target: 16, recoveredPct: 30 }),
      row({ group: 'back', labelKey: 'muscle.back', sets: 4, target: 16, recoveredPct: 100 }),
    ]);
    expect(focus?.group).toBe('back');
  });

  it('suggests nothing when every group is at target', () => {
    // Anything else dresses a lowest-of-six pick up as advice.
    expect(nextMuscleFocus([
      row({ group: 'chest', sets: 16, target: 16 }),
      row({ group: 'legs', labelKey: 'muscle.legs', sets: 20, target: 16 }),
    ])).toBeNull();
  });
});

describe('freshGroups', () => {
  const HOUR = 3_600_000;

  function freshRow(group: string, hoursAgo: number | null): MuscleLoadRow {
    return {
      group: group as MuscleLoadRow['group'],
      labelKey: `muscle.${group}` as MuscleLoadRow['labelKey'],
      sets: 0, target: 16, recoveredPct: 100,
      lastHitAt: hoursAgo == null ? null : new Date(NOW.getTime() - hoursAgo * HOUR),
      exercises: [],
    };
  }

  it('returns groups that have never been trained', () => {
    const fresh = freshGroups([
      freshRow('chest', 2),
      freshRow('legs', null),
      freshRow('back', null),
    ], NOW);
    expect(fresh.map(f => f.group)).toEqual(['legs', 'back']);
  });

  it('returns groups past their recovery window', () => {
    // Chest recovers over 48h; 50h ago is past it.
    const fresh = freshGroups([
      freshRow('chest', 50),
      freshRow('back', 80), // back recovers over 72h; 80h is past
    ], NOW);
    expect(fresh.map(f => f.group)).toEqual(['back', 'chest']);
  });

  it('excludes groups still within their recovery window', () => {
    const fresh = freshGroups([
      freshRow('chest', 24), // 48h window, only halfway
    ], NOW);
    expect(fresh).toHaveLength(0);
  });

  it('sorts by longest rest first', () => {
    const fresh = freshGroups([
      freshRow('chest', 50),
      freshRow('legs', 200), // legs have a 72h window, 200h is way past
    ], NOW);
    expect(fresh[0].group).toBe('legs');
  });

  it('returns at most two groups', () => {
    const fresh = freshGroups([
      freshRow('chest', null),
      freshRow('back', null),
      freshRow('legs', null),
    ], NOW);
    expect(fresh).toHaveLength(2);
  });
});

describe('goalNudge', () => {
  const baseState = { weekDone: 3, weekGoal: 4, trainedToday: false };

  it('returns "goalFresh" when not trained and goal not met', () => {
    const state = goalNudge(baseState, []);
    expect(state.kind).toBe('goalFresh');
  });

  it('returns "goalMetFresh" when not trained but goal is met', () => {
    const state = goalNudge({ ...baseState, weekDone: 4 }, []);
    expect(state.kind).toBe('goalMetFresh');
  });

  it('returns "goalHit" when trained and goal met', () => {
    const state = goalNudge({ ...baseState, trainedToday: true, weekDone: 4 }, []);
    expect(state.kind).toBe('goalHit');
  });

  it('returns "goalRemaining" when trained but goal not met', () => {
    const state = goalNudge({ ...baseState, trainedToday: true }, []);
    expect(state.kind).toBe('goalRemaining');
    if (state.kind === 'goalRemaining') expect(state.remaining).toBe(1);
  });
});
