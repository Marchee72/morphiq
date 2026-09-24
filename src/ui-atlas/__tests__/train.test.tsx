import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { useSessionSummary } from '../state/sessionSummary';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';

const initialState = useStore.getState();

/** The log button, whatever set number it currently names. */
const logButton = () => screen.getAllByRole('button', { name: /complete set|^log /i })[0];
/** The action bar's primary — the one action that is not a ghost. */
const primaryAction = () =>
  document.querySelector('.at-train-actions .at-btn:not([data-ghost])')?.textContent ?? '';
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

  it('promotes finishing to the primary action once every exercise is logged', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [
          { id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 },
          { id: 'e2', exerciseName: 'Barbell Row', targetSets: 1 },
        ],
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });

    await waitFor(() => expect(primaryAction()).toMatch(/finish session/i));
  });

  /**
   * `sessionComplete` is true the moment one exercise's sets are all in, so the
   * bar used to offer Finish after a single lift — the accident its own comment
   * says it exists to prevent. It offers the picker instead, which is also why
   * the completion card holds its own button back here: the card's copy asks
   * you to pick what is next or finish, and the bar below is both.
   */
  describe('when the one exercise you have done is finished', () => {
    const soloDone = () => renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
      },
    });

    it('keeps adding an exercise as the primary action, not finishing', async () => {
      soloDone();
      await waitFor(() => expect(primaryAction()).toMatch(/add exercise/i));
      expect(primaryAction()).not.toMatch(/finish session/i);
    });

    it('leaves finishing one tap away, as a ghost under it', async () => {
      soloDone();
      await waitFor(() => expect(primaryAction()).toMatch(/add exercise/i));
      const ghost = document.querySelector('.at-train-actions .at-btn[data-ghost]');
      expect(ghost?.textContent).toMatch(/finish session/i);
    });

    it('does not repeat on the card the picker the bar is already offering', async () => {
      // The card's own button was un-guarded to fix the case below, which left
      // it showing here too — where the bar under it is already "add exercise"
      // and a third route to the same picker sits further down the scroll.
      soloDone();
      await waitFor(() => expect(document.querySelector('.at-done')).toBeTruthy());
      expect(within(document.querySelector('.at-done') as HTMLElement)
        .queryByRole('button', { name: /pick the next exercise/i })).toBeNull();
    });
  });

  it('offers discarding the session, which had no surface at all before', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /discard session/i }).length).toBeGreaterThan(0),
    );
  });

  /**
   * Removing an exercise takes its logged sets with it (`dropSetsFor`), which
   * is the one thing in this list that cannot be undone. It has to ask — but
   * only when there is something to lose.
   */
  describe('removing an exercise', () => {
    const twoExercises = {
      exercises: [
        { id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 },
        { id: 'e2', exerciseName: 'Barbell Row', targetSets: 3 },
      ],
      sets: [
        { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
        { exerciseName: 'Barbell Bench Press', setNumber: 2, weight: 80, reps: 8, isCompleted: true },
      ],
    };

    /** The trash icons, one per row, in row order. */
    const trashButtons = () => screen.getAllByRole('button', { name: /^(remove|quitar)$/i });

    const openList = async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /edit session/i })[0]);
      await waitFor(() => expect(trashButtons().length).toBe(2));
    };

    const names = () =>
      (useStore.getState().activeSession?.routineExercises ?? []).map(e => e.exerciseName);

    it('asks before dropping an exercise that has sets logged against it', async () => {
      renderScreen('train', { data: 'rich', session: twoExercises });
      await openList();

      fireEvent.click(trashButtons()[0]);

      // The count is the point: the confirmation has to name what goes.
      await waitFor(() => expect(text()).toMatch(/2 logged sets|2 series hechas/i));
      expect(names()).toContain('Barbell Bench Press');
    });

    it('keeps the exercise, and its sets, when the question is declined', async () => {
      renderScreen('train', { data: 'rich', session: twoExercises });
      await openList();

      fireEvent.click(trashButtons()[0]);
      await waitFor(() => expect(screen.getByRole('button', { name: /^(cancel|cancelar)$/i })).toBeTruthy());
      fireEvent.click(screen.getByRole('button', { name: /^(cancel|cancelar)$/i }));

      await waitFor(() => expect(trashButtons().length).toBe(2));
      expect(names()).toContain('Barbell Bench Press');
      expect(useStore.getState().activeSession?.sets).toHaveLength(2);
    });

    it('drops it once the question is answered', async () => {
      renderScreen('train', { data: 'rich', session: twoExercises });
      await openList();

      fireEvent.click(trashButtons()[0]);
      // Only the confirm button carries the label now — the icon it replaced is gone.
      await waitFor(() => expect(screen.getAllByRole('button', { name: /^(remove|quitar)$/i })).toHaveLength(2));
      fireEvent.click(screen.getAllByRole('button', { name: /^(remove|quitar)$/i })[0]);

      await waitFor(() => expect(names()).toEqual(['Barbell Row']));
    });

    it('does not ask about an exercise with nothing logged against it', async () => {
      // Friction over nothing is friction paid for nothing: the row goes on the tap.
      renderScreen('train', { data: 'rich', session: twoExercises });
      await openList();

      fireEvent.click(trashButtons()[1]);

      await waitFor(() => expect(names()).toEqual(['Barbell Bench Press']));
      expect(text()).not.toMatch(/logged sets? go|series hechas|serie hecha/i);
    });

    it('forgets the question when the panel is closed', async () => {
      // Closing with the X reads as "cancel". The panel used to stay mounted
      // behind an `if (!open) return null`, so the answer stayed armed and
      // reopening the list put an exercise and its sets one tap from gone.
      renderScreen('train', { data: 'rich', session: twoExercises });
      await openList();

      fireEvent.click(trashButtons()[0]);
      await waitFor(() => expect(text()).toMatch(/2 logged sets|2 series hechas/i));

      fireEvent.click(screen.getByRole('button', { name: /^(close|cerrar)$/i }));
      await waitFor(() => expect(document.querySelector('.at-editor')).toBeNull());
      await openList();

      expect(document.querySelector('.at-confirm')).toBeNull();
      expect(text()).not.toMatch(/2 logged sets|2 series hechas/i);
      expect(names()).toContain('Barbell Bench Press');
    });

    /**
     * Sets are keyed by exercise *name* everywhere — `dropSetsFor` and
     * `buildSessionExercises` both — so with the same lift on two rows,
     * removing one used to empty the other.
     */
    describe('with the same exercise on two rows', () => {
      const twinRows = {
        exercises: [
          { id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 },
          { id: 'e2', exerciseName: 'Barbell Bench Press', targetSets: 3 },
        ],
        sets: twoExercises.sets,
      };

      it('leaves the sets with the row that stays', async () => {
        renderScreen('train', { data: 'rich', session: twinRows });
        await openList();

        fireEvent.click(trashButtons()[0]);

        await waitFor(() => expect(names()).toEqual(['Barbell Bench Press']));
        expect(useStore.getState().activeSession?.sets).toHaveLength(2);
      });

      it('does not warn about sets that are not going anywhere', async () => {
        renderScreen('train', { data: 'rich', session: twinRows });
        await openList();

        fireEvent.click(trashButtons()[0]);

        await waitFor(() => expect(names()).toHaveLength(1));
        expect(text()).not.toMatch(/2 logged sets|2 series hechas/i);
      });
    });
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

/**
 * An exercise with no history opens on 0 kg (`useSetDraft`), and the generic
 * label meant "Complete set 1" quietly wrote `0 kg × 10`: the pill went green,
 * the volume added nothing, and nothing on screen had said so. 0 kg is a real
 * answer — it is most of calisthenics — so the button names it instead of
 * refusing it.
 */
describe('Train — logging a set with no weight on the bar', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  it('says what it is about to write when the weight is zero', () => {
    renderScreen('train', {
      data: 'empty',
      session: { exercises: [{ id: 'e1', exerciseName: 'Pull Up', targetSets: 3 }] },
    });

    expect(logButton().textContent).toMatch(/log without weight/i);
  });

  it('still writes the set, rather than blocking it', async () => {
    renderScreen('train', {
      data: 'empty',
      session: { exercises: [{ id: 'e1', exerciseName: 'Pull Up', targetSets: 3 }] },
    });

    fireEvent.click(logButton());
    await waitFor(() => {
      const sets = useStore.getState().activeSession?.sets ?? [];
      expect(sets).toHaveLength(1);
      expect(sets[0]).toMatchObject({ weight: 0, isCompleted: true });
    });
  });

  it('goes back to the ordinary label as soon as there is weight on it', () => {
    // The rich fixture's bench press has history, so the draft opens on it.
    renderScreen('train', { data: 'rich', session: {} });
    expect(logButton().textContent).toMatch(/complete set/i);
    expect(logButton().textContent).not.toMatch(/without weight/i);
  });
});

/**
 * The rest between sets was the one number the screen could not answer: the
 * header's clock times the whole session, so anyone resting to a schedule was
 * doing it in another app.
 */
describe('Train — rest between sets', () => {
  const rest = () => document.querySelector('.at-rest')?.textContent ?? '';

  beforeEach(() => {
    useStore.setState(initialState, true);
    // Installed before the render: `useTicker`'s interval has to be the faked
    // one, or advancing the clock never reaches it.
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drain first: the screen's data layer reads IndexedDB, and fake-indexeddb
    // schedules its callbacks on timers. Dropping the fake clock with those
    // still queued leaves the connection mid-transaction, and the next test's
    // `db.clear()` waits on it forever.
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('says nothing until there is a set to rest from', () => {
    renderScreen('train', { data: 'rich', session: {} });
    expect(document.querySelector('.at-rest')).toBeNull();
  });

  it('counts up from the set just logged, and starts over on the next one', async () => {
    renderScreen('train', { data: 'rich', session: {} });
    // No `waitFor` here: the moment is local state set by the click, so it is
    // on screen in the same commit — and a poll would never resolve against a
    // clock this test owns.
    fireEvent.click(logButton());
    expect(rest()).toMatch(/0:00/);

    await act(async () => { vi.advanceTimersByTime(65_000); });
    expect(rest()).toMatch(/1:05/);

    // The rest is from the *last* set, so logging the next one starts it again.
    fireEvent.click(logButton());
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(rest()).toMatch(/0:01/);
  });

  it('does not carry the rest into the next session', async () => {
    // Train never unmounts between sessions, so the moment has to be cleared by
    // the session changing — otherwise tomorrow's workout opens with a rest
    // already running from yesterday's last set.
    renderScreen('train', { data: 'rich', session: {} });
    fireEvent.click(logButton());
    expect(rest()).toMatch(/0:00/);

    await act(async () => {
      useStore.setState({
        activeSession: {
          startTime: new Date(2030, 0, 1, 9, 0),
          workoutType: 'Pull A',
          routineSource: 'manual',
          routineExercises: [{ id: 'n1', exerciseName: 'Barbell Row', targetSets: 3 }],
          sets: [],
        },
      });
    });

    expect(document.querySelector('.at-rest')).toBeNull();
  });
});

/**
 * The completion card's "pick the next exercise" and the action bar's "add
 * exercise" open the same picker, and the screen already carries a third route
 * to it further down. The card's button exists for the one moment the bar is
 * not offering it: a session with everything logged, where the bar is Finish.
 * The solo case — where the bar offers the picker itself — is above.
 */
describe('Train — the picker on the completion card', () => {
  beforeEach(() => {
    useStore.setState(initialState, true);
  });

  const card = () => document.querySelector('.at-done') as HTMLElement;
  const bar = () => document.querySelector('.at-train-actions')?.textContent ?? '';

  it('appears when the bar has become Finish, which offers no way to pick', async () => {
    renderScreen('train', {
      data: 'rich',
      session: {
        exercises: [
          { id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 1 },
          { id: 'e2', exerciseName: 'Barbell Row', targetSets: 1 },
        ],
        sets: [
          { exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
          { exerciseName: 'Barbell Row', setNumber: 1, weight: 60, reps: 10, isCompleted: true },
        ],
      },
    });

    await waitFor(() => expect(card()).toBeTruthy());
    expect(bar()).toMatch(/finish/i);
    expect(within(card()).getByRole('button', { name: /pick the next|elegir el siguiente/i })).toBeTruthy();
  });
});
