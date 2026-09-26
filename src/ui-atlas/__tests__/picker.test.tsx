import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore, DEFAULT_TARGET_SETS } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

/**
 * Favourites have to be seeded in the database, not the store: the provider
 * calls `loadFavorites()` on mount and would overwrite a store-only fixture.
 * '0025' is the barbell bench press in the bundled dataset.
 */
async function seedFavourite(exerciseId = '0025') {
  await db.favoriteExercises.add({ profileId: 'p1', exerciseId, addedAt: new Date() });
}

/** Opens the picker from a running session. */
const openPicker = async (overrides = {}) => {
  const result = renderScreen('train', { session: { exercises: [] }, ...overrides });
  fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0]);
  await waitFor(
    () => expect(document.querySelector('.at-picker, .st-picker')).toBeTruthy(),
    { timeout: 20000 },
  );
  return result;
};

describe('exercise picker', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('opens from the live session', async () => {
    await openPicker();
    expect(text()).toMatch(/Add an exercise/i);
  });

  it('offers a body-part filter with real counts', async () => {
    await openPicker();
    // Waits on the count itself rather than on the button: the chips render
    // before the catalogue resolves, so asserting presence alone races.
    await waitFor(() => expect(text()).toContain('163'), { timeout: 30000 });
    expect(screen.getAllByRole('button', { name: /Chest/ }).length).toBeGreaterThan(0);
  });

  it('offers an equipment filter', async () => {
    await openPicker();
    await waitFor(() => expect(text().toLowerCase()).toContain('barbell'), { timeout: 20000 });
  });

  it('narrows results when a body part is chosen', async () => {
    await openPicker();
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5),
      { timeout: 20000 },
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Chest/ })[0]);
    await waitFor(() => {
      const rows = document.querySelectorAll('.at-pickrow');
      expect(rows.length).toBeGreaterThan(0);
    });
    // Everything visible should now be a chest exercise.
    expect(text().toLowerCase()).not.toContain('ankle circles');
  });

  it('surfaces favourites above the catalogue while no filter is set', async () => {
    await seedFavourite();
    await openPicker();
    await waitFor(() => expect(text()).toMatch(/Favourites/i), { timeout: 20000 });
    expect(text().toLowerCase()).toContain('barbell bench press');
  });

  it('adds the chosen exercise to the running session', async () => {
    await openPicker();
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow-tap').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );

    const first = document.querySelectorAll('.at-pickrow-tap')[0] as HTMLElement;
    const chosen = first.textContent ?? '';
    fireEvent.click(first);

    await waitFor(() => {
      const exercises = useStore.getState().activeSession?.routineExercises ?? [];
      expect(exercises).toHaveLength(1);
      expect(chosen.toLowerCase()).toContain(exercises[0].exerciseName.toLowerCase());
    });
  });

  it('hands you back to the session rather than to the list you searched in', async () => {
    // Closing the picker only uncovers what was underneath it. Opened from the
    // session's exercise list, that meant searching for a lift, picking it, and
    // landing back in a list instead of in front of the lift.
    await openPicker();
    useStore.setState({ activeTab: 'library' });
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow-tap').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );

    fireEvent.click(document.querySelectorAll('.at-pickrow-tap')[0] as HTMLElement);
    await waitFor(() => expect(useStore.getState().activeTab).toBe('train'));
  });

  it('filters by equipment from its sheet, and the chip takes it off again', async () => {
    await openPicker();
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5), { timeout: 20000 });

    fireEvent.click(document.querySelector('.at-picker-filters .at-chip') as HTMLElement);
    const option = await waitFor(() => screen.getByRole('button', { name: /^Barbell/ }));
    fireEvent.click(option);

    const chip = await waitFor(() => screen.getByRole('button', { name: /remove filter barbell/i }));
    expect(text()).toMatch(/\d+ results?/);
    fireEvent.click(chip);
    await waitFor(() => expect(screen.queryByRole('button', { name: /remove filter/i })).toBeNull());
  });

  it('puts the chosen body part first, where it can be seen and taken off', async () => {
    await openPicker();
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5), { timeout: 20000 });
    const firstGroup = () => document.querySelector('.at-picker-filters .at-chiprail .at-chip')?.textContent ?? '';
    expect(firstGroup()).toMatch(/^Chest/);

    fireEvent.click(screen.getAllByRole('button', { name: /^Core/ })[0]);
    await waitFor(() => expect(firstGroup()).toMatch(/^Core/));
    // Equipment sits outside the rail, so scrolling the body parts leaves it put.
    expect(document.querySelector('.at-picker-filters .at-chiprail')?.textContent).not.toMatch(/Equipment/);
  });

  it('offers to drop the filters when a search under them finds nothing', async () => {
    await openPicker();
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5), { timeout: 20000 });

    fireEvent.click(screen.getAllByRole('button', { name: /Chest/ })[0]);
    fireEvent.change(screen.getByLabelText(/search by name/i), { target: { value: 'squat' } });
    await waitFor(() => expect(text()).toMatch(/Nothing for “squat”/));

    fireEvent.click(screen.getByRole('button', { name: /search without filters/i }));
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(0));
  });

  it('can favourite straight from the picker', async () => {
    await openPicker();
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow-fav').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );
    const before = useStore.getState().favoriteExerciseIds.length;
    fireEvent.click(document.querySelectorAll('.at-pickrow-fav')[0] as HTMLElement);
    await waitFor(() => expect(useStore.getState().favoriteExerciseIds.length).not.toBe(before));
  });
});

describe('Library search parity', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('offers an equipment filter, as the picker does', async () => {
    const { container } = renderScreen('library');
    await waitFor(
      () => expect(container.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5),
      { timeout: 20000 },
    );
    // Equipment facets are rendered as their raw dataset names.
    expect(text().toLowerCase()).toContain('barbell');
  });

  it('shows favourites when nothing is filtered', async () => {
    await seedFavourite();
    renderScreen('library');
    await waitFor(() => expect(text()).toMatch(/Favourites/i), { timeout: 20000 });
    expect(text().toLowerCase()).toContain('barbell bench press');
  });
});

describe('Library — body-part filtering', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('filters by body part with the same chips as the picker', async () => {
    renderScreen('library');
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow').length).toBeGreaterThan(5), { timeout: 20000 });
    fireEvent.click(screen.getAllByRole('button', { name: /Chest/ })[0]);
    await waitFor(() => expect(text()).toMatch(/163 results/));
    expect(text().toLowerCase()).not.toContain('ankle circles');
  });

});

/**
 * The flow this feature exists for: choose an exercise, load it set by set, and
 * when it is done choose the next one — all inside one session.
 */
describe('— full session flow', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('picks an exercise, logs every set, then offers the next one', async () => {
    await openPicker();
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow-tap').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );

    // 1. Choose an exercise.
    fireEvent.click(document.querySelectorAll('.at-pickrow-tap')[0] as HTMLElement);
    await waitFor(() => {
      expect(useStore.getState().activeSession?.routineExercises ?? []).toHaveLength(1);
    });

    // 2. It becomes the exercise on screen, not the one we came from.
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 1/));

    // 3. Log every set it was added with.
    for (let i = 0; i < DEFAULT_TARGET_SETS; i++) {
      const log = screen.getAllByRole('button', { name: /complete set|^log /i })[0];
      fireEvent.click(log);
      await waitFor(() => {
        const done = (useStore.getState().activeSession?.sets ?? []).filter(s => s.isCompleted).length;
        expect(done).toBe(i + 1);
      });
    }

    // 4. The exercise reads as complete and offers the next set on demand; the
    //    bar asks to finish the exercise, and once that is answered, finishing
    //    the session is one tap away.
    await waitFor(() => expect(text()).toMatch(/Exercise complete/i));
    expect(screen.getByRole('button', { name: /add set 2/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /finish exercise/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^skip$/i }));
    await waitFor(() =>
      expect(document.querySelector('.at-train-actions')?.textContent).toMatch(/finish session/i));
    // Adding another exercise stays available in the body of the screen.
    expect(screen.getAllByRole('button', { name: /add exercise/i }).length).toBeGreaterThan(0);
  });

  it('adding from the Library mid-session lands on that exercise in the session', async () => {
    const session = {
      exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }],
      sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
    };
    // Each tab is its own mount, as it is in the shell.
    const train = renderScreen('train', { session });
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 1/));
    train.unmount();

    // Off to search, the way a lifter does between sets.
    const library = renderScreen('library', { session });
    await waitFor(() => expect(document.querySelectorAll('.at-pickrow-tap').length).toBeGreaterThan(0), { timeout: 20000 });
    fireEvent.click(document.querySelectorAll('.at-pickrow-tap')[0] as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: /add to session/i }));
    await waitFor(() => expect(useStore.getState().activeTab).toBe('train'));
    library.unmount();

    renderScreen('train', { session, overrides: { activeSession: useStore.getState().activeSession } });
    // On the exercise just added, not back on the unfinished bench press.
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));
  });

  it('adding a second exercise moves focus onto it', async () => {
    await openPicker();
    await waitFor(
      () => expect(document.querySelectorAll('.at-pickrow-tap').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );
    fireEvent.click(document.querySelectorAll('.at-pickrow-tap')[0] as HTMLElement);
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 1/));

    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0]);
    await waitFor(() => expect(document.querySelector('.at-picker, .st-picker')).toBeTruthy());
    fireEvent.click(document.querySelectorAll('.at-pickrow-tap')[1] as HTMLElement);

    // Focus follows the new exercise rather than staying on the finished one.
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));
  });
});
