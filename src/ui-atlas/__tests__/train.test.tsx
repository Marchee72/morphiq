import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { useRestTimer } from '../state/restTimer';
import { useSessionSummary } from '../state/sessionSummary';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();

/** The log button, whatever set number it currently names. */
const logButton = () => screen.getAllByRole('button', { name: /complete set|^log /i })[0];
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

describe('Train', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
  });

  it('shows the gym hub when nothing is running', () => {
    renderScreen('train', { data: 'rich' });
    expect(screen.getAllByRole('button', { name: /start an empty session/i }).length).toBeGreaterThan(0);
  });

  it('shows the live session once one is running', () => {
    renderScreen('train', { data: 'rich', session: {} });
    expect(text()).toContain('Barbell Bench Press');
  });

  it('opens on the first exercise, not a hardcoded one', () => {
    // The concepts opened on `sessionExercises[1]` with `useState(2)` baked in.
    renderScreen('train', { data: 'rich', session: {} });
    expect(text()).toMatch(/1 (of|de) 2/);
  });

  it('writes a completed set to the store when logged', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(logButton());

    await waitFor(() => {
      const sets = useStore.getState().activeSession?.sets ?? [];
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({
        exerciseName: 'Barbell Bench Press',
        setNumber: 1,
        isCompleted: true,
      });
    });
  });

  it('starts the rest clock after logging', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    expect(useRestTimer.getState().endsAt).toBeNull();

    fireEvent.click(logButton());
    await waitFor(() => expect(useRestTimer.getState().endsAt).not.toBeNull());
  });

  it('falls back to the default rest until the catalogue resolves', async () => {
    // Rest length comes from the exercise's equipment, which lives in the lazily
    // loaded catalogue chunk. Before it arrives the default has to be sane rather
    // than zero. Equipment-specific windows are covered in derive/session.test.
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(logButton());
    await waitFor(() => expect(useRestTimer.getState().endsAt).not.toBeNull());
    expect(useRestTimer.getState().totalSec).toBeGreaterThan(0);
  });

  it('advances past the set it just logged', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(logButton());
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 3|Complete set 2/i));
  });

  it('resumes on the first outstanding set, not back at the top', async () => {
    renderScreen('train', {
      data: 'rich',
      session: { sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }] },
    });
    // Set 1 is already done, so reopening the session lands on set 2.
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 3|Complete set 2/i));
  });

  it('invites adding an exercise when the session is empty', () => {
    renderScreen('train', { data: 'empty', session: { exercises: [] } });
    expect(screen.getAllByRole('button', { name: /add exercise/i }).length).toBeGreaterThan(0);
  });

  it('keeps finishing out of the set-logging path, but one tap away', async () => {
    // Finish used to sit in the body of the screen, next to the button you press
    // forty times an hour. It now lives in the session list, and takes the
    // primary action only once there is nothing left to log.
    renderScreen('train', { data: 'rich', session: {} });
    expect(screen.queryAllByRole('button', { name: /finish session/i })).toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /finish session/i }).length).toBeGreaterThan(0),
    );
  });

  it('promotes finishing to the primary action once every set is logged', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    await waitFor(() =>
      expect(document.querySelector('.at-train-actions')?.textContent).toMatch(/finish session/i),
    );
  });

  it('offers discarding the session, which had no surface at all before', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /discard session/i }).length).toBeGreaterThan(0),
    );
  });
});

describe('Train — finishing', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
    useSessionSummary.setState({ summary: null });
  });

  const finishedSession = {
    exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
    sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
  };

  it('asks before ending the session', async () => {
    renderScreen('train', { data: 'rich', session: finishedSession });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    // Nothing is written until it is confirmed.
    expect(useStore.getState().activeSession).not.toBeNull();
  });

  it('warns about sets that will not be saved', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/2 sets are still unlogged/i));
  });

  it('snapshots the summary before the session is torn down', async () => {
    // `finishActiveSession` nulls `activeSession`; a summary derived after that
    // call would describe nothing at all.
    renderScreen('train', { data: 'rich', session: finishedSession });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    fireEvent.click(screen.getByRole('button', { name: /finish and save/i }));

    await waitFor(() => {
      const summary = useSessionSummary.getState().summary;
      expect(summary).not.toBeNull();
      expect(summary?.setsDone).toBe(1);
      expect(summary?.volumeKg).toBe(640);
      expect(summary?.exercises.map(e => e.name)).toEqual(['Barbell Bench Press']);
    });
  });

  it('records how the session felt at the point you can answer it', async () => {
    renderScreen('train', { data: 'rich', session: finishedSession });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    fireEvent.click(screen.getAllByRole('button', { pressed: false, name: /sore/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /finish and save/i }));

    await waitFor(() => expect(useSessionSummary.getState().summary?.feeling).toBe('sore'));
  });
});

/** A pointer gesture across the disc, in one go. */
function swipe(dx: number, dy = 0) {
  const stage = document.querySelector('.at-stage') as HTMLElement;
  fireEvent.pointerDown(stage, { pointerId: 1, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200 + dx / 2, clientY: 300 + dy / 2 });
  fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy });
  fireEvent.pointerUp(stage, { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy });
}

describe('Train — moving between exercises', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
  });

  it('swipes left to the next exercise', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    expect(text()).toMatch(/1 (of|de) 2/);

    swipe(-120);
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));
  });

  it('swipes right back to the previous one', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    swipe(-120);
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));

    swipe(120);
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 2/));
  });

  it('ignores a mostly-vertical drag', async () => {
    // Everything under the disc scrolls vertically. A scroll that drifts sideways
    // must not be stolen and turned into an exercise change.
    renderScreen('train', { data: 'rich', session: {} });
    swipe(-70, -200);
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 2/));
  });

  it('ignores a drag too short to be deliberate', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    swipe(-20);
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 2/));
  });

  it('offers a new exercise when swiped past the last one', async () => {
    renderScreen('train', {
      data: 'rich',
      session: { exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }] },
    });

    swipe(-120);
    await waitFor(() => expect(document.querySelector('.at-picker')).toBeTruthy());
  });

  it('jumps straight to an exercise from the progress dots', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(screen.getByRole('button', { name: /go to barbell row/i }));
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));
  });
});

describe('Train — signature controls', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
  });

  it('renders the circular disc, the rest arc and both number dials', () => {
    const { container } = renderScreen('train', { session: {} });
    expect(container.querySelector('.at-disc-wrap')).toBeTruthy();
    expect(container.querySelector('.at-rest-arc')).toBeTruthy();
    // Weight and reps, each a scroll wheel with keyboard entry.
    expect(container.querySelectorAll('.at-dial')).toHaveLength(2);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('keeps reorder and swap reachable, which the concept never had', () => {
    renderScreen('train', { session: {} });
    expect(screen.getAllByRole('button', { name: /edit session/i }).length).toBeGreaterThan(0);
  });

  it('runs the session clock on the screen you are actually looking at', () => {
    renderScreen('train', {
      session: { startedAt: new Date(Date.now() - 95_000) },
    });
    // Elapsed time lived only on Today's hero; mid-session it was invisible.
    expect(document.querySelector('.at-train-clock')?.textContent).toMatch(/1:3\d/);
  });
});

describe('Train — what the lift is worth to you', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
  });

  it('shows your all-time best on the current exercise', () => {
    // The rich fixture logs Barbell Bench Press at 82.5 x 8.
    renderScreen('train', { data: 'rich', session: {} });
    const facts = document.querySelector('.at-facts')?.textContent ?? '';
    expect(facts).toMatch(/82[.,]5/);
  });

  it('says so plainly when there is no record rather than showing a zero', () => {
    renderScreen('train', {
      data: 'empty',
      session: { exercises: [{ id: 'e1', exerciseName: 'Zercher Squat', targetSets: 3 }] },
    });
    expect(document.querySelector('.at-facts')?.textContent).toMatch(/no record yet/i);
  });

  it('marks a set that beat the previous best', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        // 100 x 5 beats the fixture's 82.5 x 8 on estimated 1RM.
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 100, reps: 5, isCompleted: true }],
      },
    });
    // `isPr` has been derived since the beginning and had nowhere to render.
    await waitFor(() => expect(document.querySelector('.at-setpill[data-pr="true"]')).toBeTruthy());
  });
});

describe('Train — the exercise list', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useRestTimer.setState({ endsAt: null });
  });

  const openList = () => fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);

  it('opens the picker when add exercise is pressed from the list', async () => {
    // This is the one that looked broken: the picker did open, but behind the
    // opaque list panel, so pressing the button appeared to do nothing. The
    // stacking fix itself lives in CSS, which jsdom does not apply — what is
    // asserted here is that the button reaches the picker at all.
    renderScreen('train', { data: 'rich', session: {} });
    openList();

    fireEvent.click(screen.getAllByRole('button', { name: /add exercise/i })[0]);
    await waitFor(() => expect(document.querySelector('.at-picker')).toBeTruthy());
  });

  it('replaces an exercise when swapping, rather than appending one', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    openList();

    fireEvent.click(screen.getAllByRole('button', { name: /^swap$/i })[0]);
    await waitFor(() => expect(document.querySelector('.at-picker')).toBeTruthy());
    await waitFor(
      () => expect(document.querySelectorAll('.at-ex-tap').length).toBeGreaterThan(0),
      { timeout: 20000 },
    );
    fireEvent.click(document.querySelectorAll('.at-ex-tap')[0] as HTMLElement);

    await waitFor(() => {
      const list = useStore.getState().activeSession?.routineExercises ?? [];
      expect(list).toHaveLength(2);
      expect(list[0].exerciseName).not.toBe('Barbell Bench Press');
    });
  });

  it('jumps to an exercise when its row is tapped', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    openList();

    // Scoped to the list: the header dots carry the same label, which is the
    // point — both are ways to reach the same exercise.
    const row = within(document.querySelector('.at-editor') as HTMLElement)
      .getByRole('button', { name: /go to barbell row/i });
    fireEvent.click(row);

    await waitFor(() => expect(document.querySelector('.at-editor')).toBeNull());
    expect(text()).toMatch(/2 (of|de) 2/);
  });
});
