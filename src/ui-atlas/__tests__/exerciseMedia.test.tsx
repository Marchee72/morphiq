import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from '../../test/renderScreen';
import { useStore } from '../../presentation/state/store';

/**
 * The Train disc shows a catalogue row's gif, and it only has a row to show if
 * the session's exercise resolved to one. Sets that arrive without an
 * `exerciseId` — from the coach, from a freestyle session, from history — have
 * only their name to be found by, so the name index is the whole of whether the
 * animation appears.
 */

/** Real catalogue entry 0025, in both languages. */
const EN = 'barbell bench press';
const ES = 'press de banca con barra';
const GIF = 'videos/0025-EIeI8Vf.gif';

/** No `exerciseId`: name resolution is the only route to the catalogue row. */
const sessionNamed = (name: string) => ({
  exercises: [{ id: 'e1', exerciseName: name, targetSets: 3 }],
  sets: [{ exerciseName: name, setNumber: 1, weight: 60, reps: 8, isCompleted: false }],
});

const gifOnScreen = async () =>
  waitFor(
    () => {
      const sources = screen.getAllByRole('img').map(img => img.getAttribute('src') ?? '');
      expect(sources.some(src => src.includes(GIF))).toBe(true);
    },
    // The catalogue is a 1 MB lazy chunk and nothing renders a gif until it
    // lands. The default second is enough for this file alone and not enough
    // with the rest of the suite running beside it.
    { timeout: 10_000 },
  );

describe('exercise media resolution', () => {
  beforeEach(() => {
    useStore.setState({ language: 'en' });
  });

  it('shows the gif for an exercise stored under its English name', async () => {
    renderScreen('train', { data: 'rich', session: sessionNamed(EN) });
    await gifOnScreen();
  });

  it('shows the gif for an exercise stored under its Spanish name', async () => {
    // The regression: the name index held English only, so a session logged in
    // Spanish resolved to nothing and the disc fell back to two initials.
    useStore.setState({ language: 'es' });
    renderScreen('train', { data: 'rich', session: sessionNamed(ES) });
    await gifOnScreen();
  });

  it('still finds the gif when the language and the stored name disagree', async () => {
    // Switching language does not rewrite history, so English sets have to keep
    // resolving in a Spanish app and the other way round.
    useStore.setState({ language: 'es' });
    renderScreen('train', { data: 'rich', session: sessionNamed(EN) });
    await gifOnScreen();
  });
});
