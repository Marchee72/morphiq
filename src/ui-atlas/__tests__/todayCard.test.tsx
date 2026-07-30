import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

/**
 * The first thing Today has to answer: have I trained, and what was it.
 *
 * Sessions are seeded in the database rather than the store, because
 * `AppDataProvider` calls `loadWorkoutHistory` and `loadAllSets` on mount and
 * replaces whatever a store fixture put there — the same reason `history.test`
 * seeds through Dexie.
 */

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';
const card = () => document.querySelector('.at-todaytrain') as HTMLElement | null;

const DAY = 86_400_000;

async function seedSession(at: Date, type: string, exercises: { name: string; weight: number }[]) {
  const logId = await db.workoutLogs.add({
    profileId: 'p1',
    timestamp: at,
    type,
    duration: 45,
    description: '',
    feelingTag: 'good',
  } as never);

  for (const [i, exercise] of exercises.entries()) {
    for (let n = 0; n < 3; n++) {
      await db.workoutSets.add({
        workoutLogId: String(logId),
        profileId: 'p1',
        exerciseName: exercise.name,
        setNumber: i * 3 + n + 1,
        weight: exercise.weight,
        reps: 8,
        isCompleted: true,
        timestamp: at,
      } as never);
    }
  }
}

/** Real clock, so "today" means the same thing whenever the suite runs. */
function render() {
  return renderScreen('today', { data: 'empty', now: new Date() });
}

describe("Today — what you have trained", () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('says plainly when nothing has been trained yet today', async () => {
    await seedSession(new Date(Date.now() - 2 * DAY), 'Pull B', [{ name: 'Barbell Row', weight: 70 }]);
    render();

    await waitFor(() => expect(card()).toBeTruthy());
    await waitFor(() => expect(card()?.textContent).toMatch(/Not trained yet|Aun sin entrenar/i));
    expect(card()?.getAttribute('data-trained')).toBe('false');
  });

  it('carries the last session, so the screen answers "what is due"', async () => {
    await seedSession(new Date(Date.now() - 2 * DAY), 'Pull B', [{ name: 'Barbell Row', weight: 70 }]);
    render();

    // The name, the date, and — the point of it — what that session contained.
    await waitFor(() => expect(card()?.textContent).toMatch(/Pull B/));
    expect(card()?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(card()?.textContent).toMatch(/Barbell Row/);
  });

  it('names what today held once a session has been logged', async () => {
    await seedSession(new Date(), 'Push A', [
      { name: 'Barbell Bench Press', weight: 80 },
      { name: 'Overhead Press', weight: 45 },
    ]);
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    const shown = card()?.textContent ?? '';
    expect(shown).toMatch(/Push A/);
    expect(shown).toMatch(/Barbell Bench Press/);
    expect(shown).toMatch(/Overhead Press/);
    // Six sets across the two lifts, and the volume they came to.
    expect(shown).toMatch(/6 sets|6 series/i);
  });

  it('opens the session it is describing', async () => {
    await seedSession(new Date(), 'Push A', [{ name: 'Barbell Bench Press', weight: 80 }]);
    render();

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: /see what you did|ver lo que hiciste/i }));

    await waitFor(() => expect(document.querySelector('.at-sheet')).toBeTruthy());
    expect(document.querySelector('.at-sheet')?.textContent?.toLowerCase())
      .toContain('barbell bench press');
  });

  it('stays out of the way of a live session that has logged nothing yet', async () => {
    // The hero already says a session is running; this card saying "not trained
    // yet" over the top of it is the one reading that would be wrong.
    renderScreen('today', { data: 'empty', now: new Date(), session: {} });
    await waitFor(() => expect(document.querySelector('.at-hero')).toBeTruthy());
    expect(card()).toBeNull();
  });

  it('still reports a finished session while a second one is running', async () => {
    await seedSession(new Date(), 'Push A', [{ name: 'Barbell Bench Press', weight: 80 }]);
    renderScreen('today', { data: 'empty', now: new Date(), session: {} });

    await waitFor(() => expect(card()?.getAttribute('data-trained')).toBe('true'));
    expect(card()?.textContent).toMatch(/Push A/);
  });

  it('shows the goal nudge instead of a furthest-behind suggestion', async () => {
    await seedSession(new Date(Date.now() - DAY), 'Push A', [
      { name: 'Barbell Bench Press', weight: 80 },
    ]);
    render();

    // The old "Furthest behind" text is gone — replaced by the heat map card's goal nudge.
    await waitFor(() => expect(card()).toBeTruthy());
    expect(card()?.textContent).not.toMatch(/Furthest behind|Lo mas atrasado/i);
  });
});

describe('Today — steps', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  /** `YYYY-MM-DD` in local time, the shape the health source reports. */
  const dayString = (date: Date) =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

  it('shows an em-dash, not a zero, when the phone has reported nothing', () => {
    render();
    const steps = screen.getByRole('button', { name: /steps this week|pasos de la semana/i });
    expect(steps.querySelector('b')?.textContent).toMatch(/^—/);
  });

  it("shows today's steps once the health source has answered", async () => {
    renderScreen('today', {
      data: 'empty',
      now: new Date(),
      overrides: {
        dailySteps: [
          { date: dayString(new Date()), steps: 8420 },
          { date: dayString(new Date(Date.now() - DAY)), steps: 10580 },
        ],
      },
    });

    await waitFor(() => expect(text()).toMatch(/8,420|8\.420/));
    // And the average across the days that reported, not across seven.
    expect(text()).toMatch(/9,500|9\.500/);
  });

  it('opens the week behind the number', async () => {
    renderScreen('today', {
      data: 'empty',
      now: new Date(),
      overrides: { dailySteps: [{ date: dayString(new Date()), steps: 8420 }] },
    });

    fireEvent.click(screen.getByRole('button', { name: /steps this week|pasos de la semana/i }));
    await waitFor(() => expect(document.querySelector('.at-sheet')).toBeTruthy());
    // Dated dd/mm/yyyy, like every other history surface.
    expect(document.querySelector('.at-sheet')?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
