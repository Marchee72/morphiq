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
const rail = () => document.querySelector('.at-moments') as HTMLElement | null;
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

describe('Today — your day is always laid out', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('keeps the rings and the weight strip on a day with nothing logged', async () => {
    render();
    // An empty ring is the goal still ahead, and an empty weight strip is where
    // the first weigh-in goes — both stay, rather than the section vanishing.
    await waitFor(() => expect(rail()?.querySelector('.at-rings-card')).toBeTruthy());
    expect(rail()!.querySelectorAll('.at-rings-legend button')).toHaveLength(3);
    expect(rail()!.querySelector('.at-weightstrip')?.textContent).toMatch(/log weight|registrar peso/i);
  });

  it('asks how the day is going among the tiles, and never shows a bare zero for food', async () => {
    await seedRun(new Date());
    render();
    await waitFor(() => expect(rail()?.querySelectorAll('.at-tile').length).toBeGreaterThan(0));
    const tiles = [...rail()!.querySelectorAll('.at-tile')].map(el => el.textContent ?? '').join(' ');
    expect(tiles).toMatch(/how are you today|cómo estás hoy/i);
    // Protein and calories live in the rings, against their target.
    expect(tiles).not.toMatch(/\b0 g\b/);
  });
});
