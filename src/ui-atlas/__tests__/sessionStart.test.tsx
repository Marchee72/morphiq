import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from '../../test/renderScreen';
import { useStore } from '../../presentation/state/store';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';

/**
 * A session that is running but still empty. The clock is going, so the screen's
 * job is to end that state in one tap — from the library, from a saved routine,
 * or from what was done last time.
 */

const PUSH_DAY: RoutineTemplate = {
  id: 'r1',
  profileId: 'p1',
  title: 'Push Day',
  description: '',
  targetMuscles: ['chest'],
  exercises: [
    { exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 8 },
    { exerciseId: '0334', exerciseName: 'Dumbbell Lateral Raise', targetSets: 3, targetReps: 12 },
  ],
  createdAt: new Date(),
};

/** A live session with nothing in it — what `beginSession` leaves behind. */
const emptySession = { exercises: [], sets: [] };

const sessionExercises = () =>
  useStore.getState().activeSession?.routineExercises ?? [];

/**
 * The provider pulls a 1 MB catalogue chunk on mount. The default second is
 * enough for this file alone and not enough with the rest of the suite running
 * beside it, which shows up as an intermittent failure rather than a real one.
 */
const SLOW = { timeout: 10_000 };

describe('empty session launchpad', () => {
  it('offers the library, not just an apology', () => {
    renderScreen('train', { data: 'rich', session: emptySession });
    expect(screen.getByText(/what are we training/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add exercise/i }).length).toBeGreaterThan(0);
  });

  it('fills the session from a saved routine in one tap', async () => {
    renderScreen('train', {
      data: 'rich',
      session: emptySession,
      overrides: { savedRoutines: [PUSH_DAY] },
    });

    fireEvent.click(screen.getByRole('button', { name: /push day/i }));

    // Straight in, with no merge sheet: append and replace-pending are the same
    // thing in a session that holds nothing, so there is no question to ask.
    await waitFor(() => {
      expect(sessionExercises().map(ex => ex.exerciseName)).toEqual([
        'Barbell Bench Press',
        'Dumbbell Lateral Raise',
      ]);
    }, SLOW);
  });

  it('repeats the last session with the sets that were actually performed', async () => {
    // The `rich` fixture's most recent session is bench × 4 and row × 3.
    renderScreen('train', { data: 'rich', session: emptySession });

    await waitFor(
      () => expect(screen.getByText(/Barbell Bench Press · Barbell Row/)).toBeInTheDocument(),
      SLOW,
    );
    fireEvent.click(screen.getByRole('button', { name: /repeat this session/i }));

    await waitFor(() => {
      expect(sessionExercises().map(ex => [ex.exerciseName, ex.targetSets])).toEqual([
        ['Barbell Bench Press', 4],
        ['Barbell Row', 3],
      ]);
    }, SLOW);
  });

  it('shows nothing to repeat or run when there is no history', () => {
    renderScreen('train', { data: 'empty', session: emptySession });
    expect(screen.getByText(/what are we training/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /repeat this session/i })).toBeNull();
  });

  describe('on Today', () => {
    it('drops the photo disc rather than framing two initials', () => {
      // The disc is a picture of the lift. With no lift it showed the session
      // title's initials in a circle cropped off the edge of the hero.
      renderScreen('today', { data: 'rich', session: emptySession });

      expect(screen.getByText(/nothing added yet/i)).toBeInTheDocument();
      expect(document.querySelector('.at-hero-disc')).toBeNull();
      expect(document.querySelector('.at-hero')?.getAttribute('data-nodisc')).toBe('true');
    });

    it('keeps the disc once the session has a lift with a picture', async () => {
      renderScreen('today', { data: 'rich', session: {} });
      // The picture comes off the catalogue, which is a lazy chunk — so the disc
      // arrives a beat after the hero does.
      await waitFor(() => expect(document.querySelector('.at-hero-disc')).not.toBeNull(), SLOW);
    });

    it('does not claim zero sets are left in an empty session', () => {
      renderScreen('today', { data: 'rich', session: emptySession });
      expect(screen.queryByText(/0 sets left/i)).toBeNull();
      expect(screen.getByRole('button', { name: /pick your first exercise/i })).toBeInTheDocument();
    });
  });
});
