import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { wellnessDayKey } from '../../core/entities/WellnessLog';
import { renderScreen, TEST_NOW } from '../../test/renderScreen';

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

/**
 * The day the harness thinks it is. `AppDataProvider` derives "today" from the
 * injected `now`, so seeding against the real clock would file the row under a
 * day the screen is not looking at.
 */
const today = wellnessDayKey(TEST_NOW);

/** The scales inside the open sheet — Today has radiogroups of its own. */
const scales = () => within(screen.getByRole('dialog')).getAllByRole('radiogroup');

/**
 * Seeded through Dexie rather than the store: `AppDataProvider` calls
 * `loadWellnessLogs()` on mount and would overwrite a store-only fixture. Same
 * reason `todayCard.test.tsx` seeds favourites that way.
 */
async function seedDay(patch: Record<string, unknown> = {}) {
  await db.wellnessLogs.add({
    profileId: 'p1',
    day: today,
    timestamp: new Date(),
    ...patch,
  });
}

describe('the wellness questionnaire', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('asks on Today when the day has not been answered', async () => {
    renderScreen('today', { data: 'rich', now: TEST_NOW });
    // The one rail entry that appears whether or not there is data behind it:
    // an unanswered day is the thing you can still do something about.
    await waitFor(() => expect(text()).toMatch(/how are you today/i));
  });

  it('saves the four answers against the day', async () => {
    renderScreen('today', { data: 'rich', now: TEST_NOW });
    fireEvent.click(await screen.findByRole('button', { name: /how are you today/i }));

    await waitFor(() => expect(scales().length).toBe(4));
    for (const group of scales()) {
      fireEvent.click(within(group).getByRole('radio', { name: '4' }));
    }
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(async () => {
      const rows = await db.wellnessLogs.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ day: today, energy: 4, soreness: 4, stress: 4, mood: 4 });
    });
  });

  it('answers the same day twice as a correction, not a second row', async () => {
    await seedDay({ energy: 2, soreness: 2, stress: 2, mood: 2 });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    fireEvent.click(await screen.findByRole('button', { name: /readiness/i }));
    await waitFor(() => expect(scales().length).toBe(4));
    fireEvent.click(within(scales()[0]).getByRole('radio', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(async () => {
      const rows = await db.wellnessLogs.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0].energy).toBe(5);
      // The answers that were not touched survive the write.
      expect(rows[0].soreness).toBe(2);
    });
  });

  it('re-seeds from what is stored rather than from an abandoned draft', async () => {
    await seedDay({ energy: 5, soreness: 5, stress: 5, mood: 5 });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    const open = async () => {
      fireEvent.click(await screen.findByRole('button', { name: /readiness/i }));
      await waitFor(() => expect(scales().length).toBe(4));
    };

    await open();
    fireEvent.click(within(scales()[0]).getByRole('radio', { name: '1' }));
    // Dismissed without saving.
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await open();
    expect(within(scales()[0]).getByRole('radio', { name: '5' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('shows what the watch filled in as a reading, not as a question', async () => {
    await seedDay({ energy: 4, sleepMinutes: 450, restingHr: 52, sleepSource: 'health-connect' });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    fireEvent.click(await screen.findByRole('button', { name: /readiness/i }));
    await waitFor(() => expect(text()).toMatch(/read from health connect/i));
    // Read, so it is not offered as an editable field.
    expect(screen.queryByLabelText(/hours slept/i)).toBeNull();
  });

  it('offers sleep by hand when nothing read it', async () => {
    await seedDay({ energy: 4 });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    fireEvent.click(await screen.findByRole('button', { name: /readiness/i }));
    await waitFor(() => expect(scales().length).toBe(4));
    expect(text()).toMatch(/hours slept last night/i);
    expect(text()).not.toMatch(/read from health connect/i);
  });
});
