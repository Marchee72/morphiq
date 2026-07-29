import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

const sessionRows = () => document.querySelectorAll('.at-picker .at-routine-item');
const dayHeads = () => document.querySelectorAll('.at-history-dayhead');

const DAY = 86_400_000;

/**
 * History has to be seeded in the database, not the store.
 *
 * `AppDataProvider` calls `loadWorkoutHistory` and `loadAllSets` on mount, which
 * replace whatever the store fixture put there — the same reason `picker.test`
 * seeds favourites through Dexie.
 *
 * Offsets are from the real clock rather than a fixed date, so the seven-day
 * window means the same thing whenever the suite runs.
 */
const OFFSETS_DAYS = [1, 3, 6, 20];

async function seedHistory() {
  const now = new Date();
  const dates = OFFSETS_DAYS.map(days => new Date(now.getTime() - days * DAY));

  for (const [i, at] of dates.entries()) {
    const logId = await db.workoutLogs.add({
      profileId: 'p1',
      timestamp: at,
      type: i === 1 ? 'Pull B' : 'Push A',
      duration: 62,
      description: '',
      feelingTag: 'good',
    } as never);

    const sets = [
      { name: 'Barbell Bench Press', weight: 82.5, count: 4 },
      { name: 'Barbell Row', weight: 70, count: 3 },
    ];
    for (const exercise of sets) {
      for (let n = 0; n < exercise.count; n++) {
        await db.workoutSets.add({
          workoutLogId: String(logId),
          profileId: 'p1',
          exerciseName: exercise.name,
          setNumber: n + 1,
          weight: exercise.weight,
          reps: 8,
          isCompleted: true,
          timestamp: at,
        } as never);
      }
    }
  }

  return dates;
}

/** `<input type="date">` speaks local `YYYY-MM-DD`. */
function dateInputValue(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function openHistory() {
  renderScreen('train', { data: 'empty' });
  // The button only exists once the seeded history has loaded.
  const seeAll = await waitFor(
    () => screen.getAllByRole('button', { name: /see all/i })[0],
    { timeout: 20000 },
  );
  fireEvent.click(seeAll);
  await waitFor(() => expect(document.querySelector('.at-picker')).toBeTruthy());
}

describe('history panel', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    await seedHistory();
  });

  it('opens from the Train hub', async () => {
    await openHistory();
    expect(text()).toMatch(/Your history|Tu historial/i);
  });

  it('shows the last seven days by default, not everything', async () => {
    await openHistory();
    // Three of the four seeded sessions fall inside seven days.
    await waitFor(() => expect(sessionRows()).toHaveLength(3));
  });

  it('widens to thirty days on request', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: /Last 30 days|Ultimos 30 dias/i }));
    await waitFor(() => expect(sessionRows()).toHaveLength(4));
  });

  it('groups sessions under the day they happened', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));
    // Each seeded session sits on its own day.
    expect(dayHeads()).toHaveLength(3);
  });

  it('narrows to a single day when a date is picked', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    const newest = new Date(Date.now() - OFFSETS_DAYS[0] * DAY);
    fireEvent.change(screen.getByLabelText(/Jump to a date|Ir a una fecha/i), {
      target: { value: dateInputValue(newest) },
    });

    await waitFor(() => expect(sessionRows()).toHaveLength(1));
    expect(dayHeads()).toHaveLength(1);
  });

  it('says so when the picked day holds nothing', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    // Two days ago is a rest day between the seeded sessions.
    fireEvent.change(screen.getByLabelText(/Jump to a date|Ir a una fecha/i), {
      target: { value: dateInputValue(new Date(Date.now() - 2 * DAY)) },
    });

    await waitFor(() => expect(text()).toMatch(/Nothing in this range|Nada en este rango/i));
  });

  it('restores the range when the date is cleared', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    const newest = new Date(Date.now() - OFFSETS_DAYS[0] * DAY);
    fireEvent.change(screen.getByLabelText(/Jump to a date|Ir a una fecha/i), {
      target: { value: dateInputValue(newest) },
    });
    await waitFor(() => expect(sessionRows()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: /Clear date|Quitar fecha/i }));
    await waitFor(() => expect(sessionRows()).toHaveLength(3));
  });

  it('reports a real volume for every session, not just the most recent', async () => {
    // Regression: history volume came from `activeWorkoutSets`, which is filled by
    // an N+1 over the loaded window. Grouping `allSets` is what gives an older
    // session a number instead of 0.0 t.
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    const volumes = [...sessionRows()].map(row => row.querySelector('b')?.textContent ?? '');
    expect(volumes).toHaveLength(3);
    for (const volume of volumes) expect(volume).not.toMatch(/^0(\.0)?\s*t/);
  });

  it('opens a session to show every exercise and set it contained', async () => {
    await openHistory();
    await waitFor(() => expect(sessionRows()).toHaveLength(3));

    fireEvent.click(sessionRows()[0]);
    await waitFor(() => expect(document.querySelector('.at-sheet')).toBeTruthy());

    const sheet = document.querySelector('.at-sheet')!.textContent ?? '';
    expect(sheet.toLowerCase()).toContain('barbell bench press');
    expect(sheet.toLowerCase()).toContain('barbell row');
    expect(sheet).toContain('82.5');
  });
});

describe('history entry points', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    await seedHistory();
  });

  it('opens a past session straight from Today', async () => {
    renderScreen('today', { data: 'empty' });

    // By label rather than by position: the muscle-load rows share the row class.
    const row = await waitFor(
      () => screen.getAllByRole('button', { name: /open push a/i })[0],
      { timeout: 20000 },
    );

    fireEvent.click(row);
    await waitFor(() => expect(document.querySelector('.at-sheet')).toBeTruthy());
    expect(document.querySelector('.at-sheet')!.textContent?.toLowerCase())
      .toContain('barbell bench press');
  });

  it('reaches the panel from Today as well', async () => {
    renderScreen('today', { data: 'empty' });
    await waitFor(
      () => expect(screen.getAllByRole('button', { name: /see all/i }).length).toBeGreaterThan(1),
      { timeout: 20000 },
    );

    const buttons = screen.getAllByRole('button', { name: /see all/i });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(text()).toMatch(/Your history|Tu historial/i));
  });
});
