import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { useSessionSummary } from '../state/sessionSummary';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();

/** The log button, whatever set number it currently names. */
const logButton = () => screen.getAllByRole('button', { name: /complete set|^log /i })[0];
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

// The summary outlives the session it describes by design, so it also outlives
// the test that produced it unless it is cleared for every one of them.
beforeEach(async () => {
  useSessionSummary.setState({ summary: null });
  // Finishing a session writes to the database and reloads from it. Left in
  // place, those rows show up as another test's history.
  await Promise.all(db.tables.map(t => t.clear()));
});

describe('Train', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('shows the gym hub when nothing is running', () => {
    renderScreen('train', { data: 'rich' });
    // The hero used to promise an empty session. It now opens the routine
    // chooser when there is one to choose from, so the label is just "start".
    expect(screen.getAllByRole('button', { name: /^(start|empezar|iniciar)$/i }).length).toBeGreaterThan(0);
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

  it('names where the next-exercise button actually goes', async () => {
    // "Next exercise" jumped to the first unfinished one, which is usually
    // *behind* you — you land on whatever you added last. The label said next
    // and the button went back.
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 2, weight: 60, reps: 10, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 3, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /go to barbell row/i }));
    await waitFor(() =>
      expect(document.querySelector('.at-train-actions')?.textContent)
        .toMatch(/next: barbell bench press/i),
    );
  });

  it('does not offer the same decision twice when an exercise is done', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 2, weight: 60, reps: 10, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 3, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /go to barbell row/i }));
    // The sticky bar already points at the next exercise, so the completion card
    // must not repeat the offer.
    await waitFor(() => expect(document.querySelector('.at-done')).toBeTruthy());
    expect(within(document.querySelector('.at-done') as HTMLElement)
      .queryByRole('button', { name: /pick the next exercise/i })).toBeNull();
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
    // Let the write settle inside the test that caused it, or it lands in the
    // middle of a later one and nulls that test's session.
    await waitFor(() => expect(useStore.getState().activeSession).toBeNull());
  });

  /**
   * Finishing a session you logged nothing into used to file a "0 sets
   * completed" workout and recap it. Both halves are wrong: the workout never
   * happened, and the recap describes a record that no longer exists.
   *
   * The routine here plans three sets deliberately — `sessionTotals.setsPlanned`
   * reports three for it, so a guard reading that would still show the summary.
   */
  it('files nothing and shows no recap for a session with nothing logged', async () => {
    renderScreen('train', {
      data: 'rich',
      session: { exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }], sets: [] },
    });

    // With nothing logged the stage has no Finish of its own; it lives in the
    // session editor, the same route the unlogged-sets warning test takes.
    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    fireEvent.click(screen.getByRole('button', { name: /finish and save/i }));

    // The session still ends — Finish was pressed and the user expects out.
    await waitFor(() => expect(useStore.getState().activeSession).toBeNull());
    expect(useSessionSummary.getState().summary).toBeNull();
    expect(await db.workoutLogs.count()).toBe(0);
  });

  it('records how the session felt at the point you can answer it', async () => {
    renderScreen('train', { data: 'rich', session: finishedSession });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    fireEvent.click(screen.getAllByRole('button', { pressed: false, name: /sore/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /finish and save/i }));

    await waitFor(() => expect(useSessionSummary.getState().summary?.feeling).toBe('sore'));
    await waitFor(() => expect(useStore.getState().activeSession).toBeNull());
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

describe('Train — perceived exertion', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
    useSessionSummary.setState({ summary: null });
  });

  const setsOf = (name: string) =>
    (useStore.getState().activeSession?.sets ?? []).filter(s => s.exerciseName === name);

  /** Two exercises, the first one part-done — the shape "finish exercise" needs. */
  const partway = {
    exercises: [
      { id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 },
      { id: 'e2', exerciseName: 'Barbell Squat', targetSets: 3 },
    ],
    sets: [
      { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
      { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: true },
      { exerciseName: 'Barbell Squat', setNumber: 1, weight: 100, reps: 5, isCompleted: true },
    ],
  };

  it('asks how hard it was instead of ending the exercise outright', async () => {
    renderScreen('train', { data: 'rich', session: partway });

    fireEvent.click(await screen.findByRole('button', { name: /finish exercise/i }));
    await waitFor(() => expect(text()).toMatch(/how hard was that/i));
    // The exercise is still open: the question and the ending are one decision.
    expect(setsOf('Barbell Bench Press')).toHaveLength(2);
  });

  it('writes the rating to every set of that exercise and no other', async () => {
    renderScreen('train', { data: 'rich', session: partway });

    fireEvent.click(await screen.findByRole('button', { name: /finish exercise/i }));
    fireEvent.click(await screen.findByRole('button', { name: /15/ }));

    await waitFor(() => {
      expect(setsOf('Barbell Bench Press').map(s => s.rpe)).toEqual([15, 15]);
    });
    // The rating belongs to the exercise that was rated, not to the session.
    expect(setsOf('Barbell Squat').every(s => s.rpe === undefined)).toBe(true);
  });

  it('still renumbers the surviving sets when a rating is given', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: false },
          { exerciseName: 'Barbell Bench Press', setNumber: 3, weight: 80, reps: 6, isCompleted: true },
        ],
      },
    });

    fireEvent.click(await screen.findByRole('button', { name: /finish exercise/i }));
    fireEvent.click(await screen.findByRole('button', { name: /17/ }));

    await waitFor(() => {
      const kept = setsOf('Barbell Bench Press');
      // The unlogged set 2 is dropped and set 3 becomes set 2 — a gap here and
      // the next write to this exercise lands in it.
      expect(kept.map(s => s.setNumber)).toEqual([1, 2]);
      expect(kept.map(s => s.reps)).toEqual([8, 6]);
      expect(kept.map(s => s.rpe)).toEqual([17, 17]);
    });
  });

  it('ends the exercise anyway when the question is skipped', async () => {
    renderScreen('train', { data: 'rich', session: partway });

    fireEvent.click(await screen.findByRole('button', { name: /finish exercise/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^skip$/i }));

    await waitFor(() => {
      const kept = setsOf('Barbell Bench Press');
      expect(kept).toHaveLength(2);
      expect(kept.every(s => s.rpe === undefined)).toBe(true);
    });
  });

  it('asks on the exercise that completed itself, which is how most of them end', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    // Nobody presses "finish exercise" here — the last set finished it.
    await waitFor(() => expect(text()).toMatch(/how hard was that/i));
    fireEvent.click(await screen.findByRole('button', { name: /19/ }));
    await waitFor(() => expect(setsOf('Barbell Bench Press')[0].rpe).toBe(19));
  });

  it('offers the exercise you were still on when finishing the session', async () => {
    renderScreen('train', { data: 'rich', session: partway });

    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));

    // Neither exercise was ever closed, so both are still unrated and both are
    // offered — the last one especially, whose effort is freshest.
    await waitFor(() => expect(text()).toMatch(/how hard was Barbell Bench Press/i));
    expect(text()).toMatch(/how hard was Barbell Squat/i);
  });

  it('reports the session average once something has been rated', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{
          exerciseName: 'Barbell Bench Press', setNumber: 1,
          weight: 80, reps: 8, isCompleted: true, rpe: 15,
        }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/avg effort/i));
    // Already rated, so it is not asked again.
    expect(text()).not.toMatch(/how hard was Barbell Bench Press/i);
  });

  it('says nothing about effort when nothing was rated', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    // An em-dash here would be answering a question nobody was asked.
    expect(text()).not.toMatch(/avg effort/i);
  });

  it('carries the rating through to the saved sets', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{
          exerciseName: 'Barbell Bench Press', setNumber: 1,
          weight: 80, reps: 8, isCompleted: true, rpe: 13,
        }],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /finish session/i }));
    await waitFor(() => expect(text()).toMatch(/finish this session/i));
    fireEvent.click(screen.getByRole('button', { name: /finish and save/i }));

    // `finishActiveSession` enumerates the columns it writes by hand, so a new
    // field reaches the database only if it was added to that list.
    await waitFor(async () => {
      const written = await db.workoutSets.toArray();
      expect(written).toHaveLength(1);
      expect(written[0].rpe).toBe(13);
    });
    await waitFor(() => expect(useStore.getState().activeSession).toBeNull());
  });
});

describe('Train — moving between exercises', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
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
  });

  it('renders the circular disc and both number dials', () => {
    const { container } = renderScreen('train', { session: {} });
    expect(container.querySelector('.at-disc-wrap')).toBeTruthy();
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
  });

  it('shows your all-time best on the current exercise', () => {
    // The rich fixture logs Barbell Bench Press at 82.5 x 8.
    renderScreen('train', { data: 'rich', session: {} });
    const facts = document.querySelector('.at-facts')?.textContent ?? '';
    expect(facts).toMatch(/82[.,]5/);
  });

  it('estimates the one-rep max from the best set, for a lift with history', () => {
    // The rich fixture logs Barbell Bench Press at 82.5 × 8. Epley puts the
    // single at 82.5 × (1 + 8/30) = 104.5, and that number — derived since the
    // beginning — had nowhere to render until now.
    renderScreen('train', { data: 'rich', session: {} });
    const facts = document.querySelector('.at-facts')?.textContent ?? '';
    expect(facts).toMatch(/≈\s*104[.,]5 kg 1RM/);
  });

  it('offers no estimate for a lift never done before', () => {
    renderScreen('train', {
      data: 'empty',
      session: { exercises: [{ id: 'e1', exerciseName: 'Zercher Squat', targetSets: 3 }] },
    });
    expect(document.querySelector('.at-fact-sub')).toBeNull();
  });

  it('does not restate a true single as its own estimate', () => {
    // Best set of one rep means the estimate *is* the weight; printing
    // "100 kg × 1" above "≈100 kg 1RM" is the same fact twice.
    renderScreen('train', {
      data: 'empty',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Deadlift', targetSets: 3 }],
        sets: [],
      },
      overrides: {
        allSets: [{
          id: 's1', workoutLogId: 'w9', profileId: 'p1', exerciseName: 'Deadlift',
          setNumber: 1, weight: 100, reps: 1, isCompleted: true,
          timestamp: new Date(Date.now() - 86_400_000),
        }],
      },
    });

    expect(document.querySelector('.at-facts')?.textContent).toMatch(/100 kg × 1/);
    expect(document.querySelector('.at-fact-sub')).toBeNull();
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

describe('Train — the set list', () => {
  beforeEach(() => useStore.setState(initialState, true));

  const rows = () => document.querySelectorAll('.at-setrow');

  it('lists every set of the exercise, logged or not', () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    expect(rows()).toHaveLength(4);
    expect(rows()[0].textContent).toMatch(/80 kg/);
    // Sets not yet done read as blank rather than as a fake zero.
    expect(rows()[1].textContent).toContain('—');
  });

  it('corrects a set without dragging the cursor back to it', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: true },
        ],
      },
    });
    // The cursor sits on set 3, the first outstanding one.
    expect(text()).toMatch(/Complete set 3/i);

    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: /edit set 1/i }));
    const weight = screen.getByLabelText('Weight 1');
    fireEvent.change(weight, { target: { value: '85' } });
    fireEvent.keyDown(weight, { key: 'Enter' });

    await waitFor(() => {
      const sets = useStore.getState().activeSession?.sets ?? [];
      expect(sets.find(s => s.setNumber === 1)?.weight).toBe(85);
    });
    // And the cursor stayed where it was.
    expect(text()).toMatch(/Complete set 3/i);
  });

  it('moves the primary action on when the cursor set is filled from its row', async () => {
    renderScreen('train', {
      data: 'rich',
      session: { exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }], sets: [] },
    });
    expect(text()).toMatch(/Complete set 1/i);

    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: /edit set 1/i }));
    fireEvent.change(screen.getByLabelText('Weight 1'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Reps 1'), { target: { value: '8' } });
    fireEvent.keyDown(screen.getByLabelText('Reps 1'), { key: 'Enter' });

    // Otherwise the sticky bar keeps offering to complete a set already done.
    await waitFor(() => expect(text()).toMatch(/Complete set 2/i));
  });

  it('marks a logged set undone from its row', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    fireEvent.click(within(rows()[0] as HTMLElement).getByRole('button', { name: /mark set 1 done/i }));
    await waitFor(() => {
      const sets = useStore.getState().activeSession?.sets ?? [];
      expect(sets.find(s => s.setNumber === 1)?.isCompleted).toBe(false);
    });
  });

  it('asks for numbers rather than recording an empty set as 0 x 0', async () => {
    renderScreen('train', {
      data: 'rich',
      session: { exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }], sets: [] },
    });

    fireEvent.click(within(rows()[2] as HTMLElement).getByRole('button', { name: /mark set 3 done/i }));
    // Opens the editor instead of writing a meaningless set.
    await waitFor(() => expect(screen.getByLabelText('Weight 3')).toBeInTheDocument());
    expect(useStore.getState().activeSession?.sets ?? []).toHaveLength(0);
  });

  it('stays visible once the exercise is finished, for checking it over', () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    expect(text()).toMatch(/exercise complete/i);
    expect(rows()).toHaveLength(1);
  });
});

/**
 * Where the cursor lands, which is what the set pills are describing.
 *
 * Every case here was reported off the gym floor: the pills and the button
 * underneath them disagreed about which set you were on, and the disagreement
 * always resolved in favour of a set already logged.
 */
describe('Train — where the cursor lands', () => {
  beforeEach(() => useStore.setState(initialState, true));

  /** The dot rail in the header — one per exercise, each a way to that exercise. */
  const goTo = (name: RegExp) => fireEvent.click(screen.getAllByRole('button', { name })[0]);

  it('returns to the set still to log, not to the top of the exercise', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });
    expect(text()).toMatch(/Complete set 2/i);

    goTo(/go to barbell row/i);
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));

    // Leaving an exercise half done and coming back used to offer set 1 again.
    goTo(/go to barbell bench press/i);
    await waitFor(() => expect(text()).toMatch(/Complete set 2/i));
  });

  it('moves on to the exercise with work left when this one is finished', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: true },
        ],
      },
    });
    expect(text()).toMatch(/Complete set 3/i);

    fireEvent.click(logButton());
    // The last set of the bench went in, so the screen belongs to the row now.
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));
    expect(text()).toContain('Barbell Row');
  });

  it('goes back to an unfinished exercise rather than stopping at the last one', async () => {
    // "Next" is a position in a list, not a direction of travel: finish the last
    // exercise with the first still outstanding and the only useful move is back.
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 2, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });

    goTo(/go to barbell row/i);
    await waitFor(() => expect(text()).toMatch(/Complete set 3/i));

    fireEvent.click(logButton());
    await waitFor(() => expect(text()).toMatch(/1 (of|de) 2/));
    expect(text()).toContain('Barbell Bench Press');
  });

  it('opens the next set on the weight just lifted, not on last month\'s', async () => {
    // No history at all for this lift, so nothing but the set before it can be
    // the source of the number.
    renderScreen('train', {
      data: 'empty',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Zercher Squat', targetSets: 3 }],
        sets: [{ exerciseName: 'Zercher Squat', setNumber: 1, weight: 62.5, reps: 6, isCompleted: true }],
      },
    });

    expect(text()).toMatch(/Complete set 2/i);
    const dials = document.querySelectorAll('.at-dial');
    expect(dials[0].querySelector('.at-dial-value')?.textContent).toMatch(/62[.,]5/);
    expect(dials[1].querySelector('.at-dial-value')?.textContent).toMatch(/^6$/);
  });

  it('shows a finished set back read-only, with no way to type into it', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    const pills = document.querySelector('.at-setpills') as HTMLElement;
    fireEvent.click(within(pills).getByRole('button', { name: /see set 1/i }));

    // The numbers come back...
    const view = await waitFor(() => document.querySelector('.at-setview') as HTMLElement);
    expect(view.textContent).toMatch(/80 kg/);
    // ...with nothing to type into, and the wheels gone rather than pointed at
    // a set that is already in the book.
    expect(within(view).queryAllByRole('textbox')).toHaveLength(0);
    expect(document.querySelectorAll('.at-dial')).toHaveLength(0);
    expect(screen.queryByLabelText('Weight 1')).toBeNull();
  });

  it('leaves the set list as the one place a logged set is corrected', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    // Same set, reached from the list rather than the pill: still editable.
    const row = document.querySelectorAll('.at-setrow')[0] as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /edit set 1/i }));

    const weight = await waitFor(() => screen.getByLabelText('Weight 1'));
    fireEvent.change(weight, { target: { value: '85' } });
    fireEvent.keyDown(weight, { key: 'Enter' });

    await waitFor(() => {
      const sets = useStore.getState().activeSession?.sets ?? [];
      expect(sets.find(s => s.setNumber === 1)?.weight).toBe(85);
    });
  });

  it('goes back to the set you were on when the read-only view is dismissed', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    const pills = document.querySelector('.at-setpills') as HTMLElement;
    fireEvent.click(within(pills).getByRole('button', { name: /see set 1/i }));
    await waitFor(() => expect(document.querySelector('.at-setview')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /back to set 2/i }));
    await waitFor(() => expect(document.querySelector('.at-setview')).toBeNull());
    expect(text()).toMatch(/Complete set 2/i);
  });

  it('locks a set further ahead than the next one still to log', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    const pills = document.querySelector('.at-setpills') as HTMLElement;
    // Set 2 is next, so 3 and 4 cannot be jumped to — logging set 4 with 2 and 3
    // empty writes a session that never happened.
    const locked = within(pills).getAllByRole('button', { name: /is locked/i });
    expect(locked).toHaveLength(2);
    for (const pill of locked) expect(pill).toBeDisabled();

    fireEvent.click(locked[0]);
    // The cursor did not move.
    expect(text()).toMatch(/Complete set 2/i);
  });

  it('unlocks the next set as soon as the one before it goes in', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 4 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    const pills = () => document.querySelector('.at-setpills') as HTMLElement;
    expect(within(pills()).getAllByRole('button', { name: /is locked/i })).toHaveLength(2);

    fireEvent.click(logButton());
    // Set 2 logged, so 3 is now the next one and only 4 stays locked.
    await waitFor(() =>
      expect(within(pills()).getAllByRole('button', { name: /is locked/i })).toHaveLength(1));
  });
});

describe('Train — the exercise list', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
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

  it('keeps training after the exercise you were standing on is removed', async () => {
    // The cursor is the screen's own state; the exercise list is not. Removing
    // the last exercise left the cursor pointing past the end, which resolved to
    // `undefined` and rendered "No exercises yet" over a session that still had
    // one — a dead screen with no way to log anything.
    renderScreen('train', { data: 'rich', session: {} });

    fireEvent.click(screen.getByRole('button', { name: /go to barbell row/i }));
    await waitFor(() => expect(text()).toMatch(/2 (of|de) 2/));

    openList();
    const rows = within(document.querySelector('.at-editor') as HTMLElement)
      .getAllByRole('button', { name: /^remove$/i });
    fireEvent.click(rows[rows.length - 1]);

    await waitFor(() => expect(text()).toMatch(/1 (of|de) 1/));
    expect(text()).not.toMatch(/no exercises yet/i);
    expect(document.querySelector('.at-train-actions')).toBeTruthy();
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
