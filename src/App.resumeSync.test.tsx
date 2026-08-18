import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useStore } from './presentation/state/store';
import { db } from './data/database/LocalDatabase';

/**
 * Health Connect gives no push, so everything the app knows it had to ask for.
 * These cover *when* it asks: the resume listener is the whole of "you do not
 * have to press Sync", and a data type missing from it is a data type you have
 * to fetch by hand.
 */

const importWorkouts = vi.fn(async () => []);
const importBodyComposition = vi.fn(async () => []);
const getDailySteps = vi.fn(async () => []);

vi.mock('./data/health/CapacitorHealthProvider', () => ({
  CapacitorHealthProvider: class {
    isAvailable() { return true; }
    async requestPermissions() { return true; }
    importWorkouts = importWorkouts;
    importBodyComposition = importBodyComposition;
    getDailySteps = getDailySteps;
  },
}));

/** Captures the `resume` handler the app registers so a test can fire it. */
const resumeHandlers: (() => void)[] = [];
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (event: string, handler: () => void) => {
      if (event === 'resume') resumeHandlers.push(handler);
      return { remove: vi.fn() };
    }),
    minimizeApp: vi.fn(),
  },
}));

const { default: App } = await import('./App');
const initialState = useStore.getState();

describe('health sync on resume', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    resumeHandlers.length = 0;
    vi.clearAllMocks();
    await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'),
      height: 180, createdAt: new Date(),
    });
  });

  it('re-reads every health source when the app comes back to the foreground', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Today' });
    await waitFor(() => expect(resumeHandlers.length).toBeGreaterThan(0));
    await waitFor(() => expect(importWorkouts).toHaveBeenCalled());

    const callsAtLaunch = {
      workouts: importWorkouts.mock.calls.length,
      body: importBodyComposition.mock.calls.length,
      steps: getDailySteps.mock.calls.length,
    };

    resumeHandlers.forEach(handler => handler());

    // Workouts were the gap: they used to be read once per launch, so a session
    // finished on the watch stayed invisible until the app was killed.
    await waitFor(() => {
      expect(importWorkouts.mock.calls.length).toBe(callsAtLaunch.workouts + 1);
      expect(importBodyComposition.mock.calls.length).toBe(callsAtLaunch.body + 1);
      expect(getDailySteps.mock.calls.length).toBe(callsAtLaunch.steps + 1);
    });
  });
});
