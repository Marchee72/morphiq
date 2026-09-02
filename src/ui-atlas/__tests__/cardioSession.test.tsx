import { describe, expect, it, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

/**
 * A session recorded by the watch is not a session of sets.
 *
 * A run synced from Health Connect arrives with a distance, a heart rate and no
 * sets at all. Today rendered it through the strength path anyway, so a real
 * 6.4 km run displayed as `0 sets · 0.0 t` — which reads as a workout you failed
 * to log rather than one that was never about weight. These tests pin the
 * distinction on the screens that show it.
 *
 * Seeded through Dexie rather than the store, because `AppDataProvider` loads
 * history on mount and replaces whatever a store fixture put there.
 */

const initialState = useStore.getState();
const card = () => document.querySelector('.at-todaytrain') as HTMLElement | null;
const rail = () => document.querySelector('.at-rail') as HTMLElement | null;
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

/** A synced activity: numbers on the log, no sets anywhere. */
async function seedRun(at: Date, over: Record<string, unknown> = {}) {
  return db.workoutLogs.add({
    profileId: 'p1',
    timestamp: at,
    type: 'Running',
    duration: 32,
    description: 'Morning run',
    caloriesBurned: 410,
    distanceKm: 6.4,
    avgHeartRate: 152,
    maxHeartRate: 171,
    steps: 5840,
    source: 'health-connect',
    ...over,
  } as never);
}

async function seedLift(at: Date) {
  const logId = await db.workoutLogs.add({
    profileId: 'p1', timestamp: at, type: 'Push A', duration: 45, description: '',
  } as never);
  for (let n = 1; n <= 6; n++) {
    await db.workoutSets.add({
      workoutLogId: String(logId), profileId: 'p1', exerciseName: 'Barbell Bench Press',
      setNumber: n, weight: 80, reps: 8, isCompleted: true, timestamp: at,
    } as never);
  }
}

const render = () => renderScreen('today', { data: 'empty', now: new Date() });

describe('Today — a session the watch recorded', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('never shows a run as sets and tonnage', async () => {
    await seedRun(new Date());
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    const shown = text();
    expect(shown).toMatch(/Running/);
    // The two readings that made a real run look like a failure to log one.
    expect(shown).not.toMatch(/0 sets|0 series/i);
    expect(shown).not.toMatch(/0[.,]0 t\b/);
  });

  it('shows the distance the run actually covered', async () => {
    await seedRun(new Date());
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    expect(text()).toMatch(/6[.,]4/);
  });

  it('puts the day\'s activity in the rail, where the screen answers "how is today"', async () => {
    await seedRun(new Date());
    render();

    await waitFor(() => expect(rail()).toBeTruthy());
    // Distance and pace: 6.4 km in 32 min is exactly 5:00 /km.
    await waitFor(() => expect(rail()?.textContent ?? '').toMatch(/6[.,]4/));
    expect(rail()?.textContent ?? '').toMatch(/5:00 \/km/);
  });

  it('keeps sets and volume on a day that also held a gym session', async () => {
    await seedRun(new Date());
    await seedLift(new Date());
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    const shown = card()?.textContent ?? '';
    // A mixed day is still a lifting day: the run must not erase the sets.
    expect(shown).toMatch(/6 sets|6 series/i);
    expect(shown).toMatch(/Push A/);
    expect(shown).toMatch(/Running/);
  });

  it('renames the rail from the old "Today so far"', async () => {
    await seedRun(new Date());
    render();
    await waitFor(() => expect(rail()).toBeTruthy());
    expect(text()).toMatch(/Your day|Tu día/);
    expect(text()).not.toMatch(/Today so far|Hoy hasta ahora/);
  });

  it('drops a calorie tile the source never filled', async () => {
    // A real 6.56 km run arrived with no calories, and the import stores
    // `w.calories || 0` — which rendered as a "0 kcal" tile in the sheet.
    await seedRun(new Date(), { caloriesBurned: 0 });
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    expect(text()).not.toMatch(/0 kcal/);
    expect(text()).toMatch(/6[.,]4/);
  });
});

describe('Today — the rail shows only what has data', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('omits a chip whose number was never logged', async () => {
    // Nothing eaten, nothing weighed, nothing lifted — only the run happened.
    await seedRun(new Date());
    render();

    await waitFor(() => expect(rail()).toBeTruthy());
    const chips = rail()?.querySelectorAll('.at-moment') ?? [];
    const shown = rail()?.textContent ?? '';

    expect(chips.length).toBeGreaterThan(0);
    // The readings that used to render as a dash or a bare zero.
    expect(shown).not.toMatch(/—/);
    expect(shown).not.toMatch(/\b0 g\b/);
    expect(shown).not.toMatch(/0[.,]0 t\b/);
  });

  it('carries only the wellness question on a day with nothing in it', async () => {
    render();
    // The rail used to disappear entirely here, because every chip was a reading
    // and a heading above nothing is worse than no heading. It now keeps exactly
    // one: the question, which is not a reading and cannot be waiting on data —
    // a day nobody has answered is precisely the day worth asking about, and a
    // chip that appears only once you have answered would never be tapped.
    await waitFor(() => expect(card()).toBeTruthy());
    const chips = rail()?.querySelectorAll('.at-moment') ?? [];
    expect(chips).toHaveLength(1);
    expect(rail()?.textContent).toMatch(/how are you today|cómo estás hoy/i);
    // Still no dashes or bare zeros: nothing else crept in with it.
    expect(rail()?.textContent).not.toMatch(/—/);
  });
});
