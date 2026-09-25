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

/** The four questions inside the open sheet, one radiogroup each. */
const scales = () => within(screen.getByRole('dialog')).getAllByRole('radiogroup');
/** A choice's name: the number, then its word ("4Charged"). */
const choice = (n: number) => new RegExp(`^${n}\\D`);
/** Picks `n` in a question. */
const pick = (group: HTMLElement, n: number) =>
  fireEvent.click(within(group).getByRole('radio', { name: choice(n) }));

/**
 * Opens the check-in on a day that is already answered. The Energy cell is the
 * way in when there is no Energy Score; waiting for its prompt to go first makes
 * sure the seeded day has loaded, or the sheet would open on an empty one.
 */
async function openAnswered() {
  await waitFor(() => expect(text()).not.toMatch(/how are you today/i));
  fireEvent.click(screen.getByRole('button', { name: /^energy/i }));
}

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
    // One at a time: each answer moves the sheet on, the last to the summary.
    for (const [i, group] of scales().entries()) {
      pick(group, 4);
      if (i < 3) await waitFor(() => expect(screen.getByText(new RegExp(`question ${i + 2} of 4`, 'i'))).toBeInTheDocument());
    }
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));

    await waitFor(async () => {
      const rows = await db.wellnessLogs.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ day: today, energy: 4, soreness: 4, stress: 4, mood: 4 });
    });
  });

  it('answers the same day twice as a correction, not a second row', async () => {
    await seedDay({ energy: 2, soreness: 2, stress: 2, mood: 2 });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    await openAnswered();
    // An answered day opens on its summary; a row there reopens its question,
    // and answering it goes straight back to the summary.
    fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: /^energy/i }));
    pick(scales()[0], 5);
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }));

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
      await openAnswered();
      await waitFor(() => expect(scales().length).toBe(4));
    };

    await open();
    pick(scales()[0], 1);
    // Dismissed without saving.
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await open();
    expect(within(scales()[0]).getByRole('radio', { name: choice(5) })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows what the watch filled in as a reading, not as a question', async () => {
    await seedDay({ energy: 4, sleepMinutes: 450, restingHr: 52, sleepSource: 'health-connect' });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    await openAnswered();
    await waitFor(() => expect(text()).toMatch(/read from your watch/i));
    // Read, so it is not offered as an editable field.
    expect(screen.queryByLabelText(/hours slept/i)).toBeNull();
  });

  it('offers sleep by hand when nothing read it', async () => {
    await seedDay({ energy: 4 });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    await openAnswered();
    await waitFor(() => expect(scales().length).toBe(4));
    expect(text()).toMatch(/hours slept last night/i);
    expect(text()).not.toMatch(/read from your watch/i);
  });

  it('shows the Samsung Energy Score in the Energy cell and opens its sheet', async () => {
    await seedDay({ energyScore: 76, sleepMinutes: 418, sleepSource: 'health-connect' });
    renderScreen('today', { data: 'rich', now: TEST_NOW });

    // The cell is Samsung's number as it comes, and opens its sheet.
    fireEvent.click(await screen.findByRole('button', { name: /energy\s*76/i }));
    await waitFor(() => expect(text()).toMatch(/what it is/i));
    // The check-in is reached from there now.
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /how are you today/i })).toBeInTheDocument();
  });
});
