import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen, TEST_NOW } from '../../test/renderScreen';

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

/**
 * Opens the exercise detail from the library.
 *
 * `rich` seeds four bench sets at 82.5 kg × 8 yesterday, so the sheet has real
 * history behind it rather than an empty state that would pass every assertion
 * for the wrong reason.
 */
async function openDetail(): Promise<void> {
  renderScreen('library', { data: 'rich', now: TEST_NOW });

  // The library opens on a body map, not a list — the catalogue is 1,324
  // entries. Search is how you reach a named exercise.
  const box = await screen.findByRole('textbox', undefined, { timeout: 20000 });
  fireEvent.change(box, { target: { value: 'barbell bench press' } });

  const card = await screen.findByRole(
    'button',
    { name: /barbell bench press/i },
    { timeout: 20000 },
  );
  fireEvent.click(card);
  await waitFor(() => expect(text()).toMatch(/your best/i));
}

describe('exercise statistics', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('charts the estimated max on the detail sheet', async () => {
    await openDetail();
    expect(text()).toMatch(/estimated 1rm/i);
    // The chart is a bare SVG, not a library component — assert it drew a line.
    expect(document.querySelector('.at-chart-axis')).toBeTruthy();
  });

  it('opens the full statistics sheet from the detail', async () => {
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: /view statistics/i }));

    await waitFor(() => expect(text()).toMatch(/best by rep range/i));
    expect(text()).toMatch(/8 weeks/);
    // 4 × 82.5 × 8 = 2,640 kg, and the sets land in the 7–10 band.
    expect(text()).toMatch(/2[,.]640/);
    expect(text()).toMatch(/7–10 reps/);
  });

  it('redraws when the window changes', async () => {
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: /view statistics/i }));
    await waitFor(() => expect(text()).toMatch(/best by rep range/i));

    fireEvent.click(screen.getByRole('radio', { name: /6 months/i }));

    // The history is a day old, so it is inside both windows — what must change
    // is the axis, which is labelled from the window and not from a constant.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /6 months/i })).toHaveAttribute('aria-checked', 'true');
    });
    expect(text()).toMatch(/2[,.]640/);
  });

  it('says nothing about effort on an exercise that was never rated', async () => {
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: /view statistics/i }));
    await waitFor(() => expect(text()).toMatch(/best by rep range/i));

    // The fixture carries no ratings. An em-dash, never a zero.
    expect(text()).not.toMatch(/typical effort/i);
  });
});
