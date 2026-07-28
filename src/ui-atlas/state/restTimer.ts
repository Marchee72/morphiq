import { create } from 'zustand';
import { DEFAULT_REST_SEC } from '../derive/session';

/**
 * The rest countdown — ephemeral UI state, not derived data, so it lives outside
 * `AppDataProvider` where a per-second tick would re-render every screen.
 *
 * Stored as an absolute end time rather than a decrementing counter: a counter
 * drifts whenever the WebView is backgrounded mid-set, which on a phone in a gym
 * is most of the time.
 */
interface RestTimerState {
  endsAt: number | null;
  totalSec: number;
  start: (seconds?: number) => void;
  extend: (seconds: number) => void;
  stop: () => void;
}

export const useRestTimer = create<RestTimerState>((set, get) => ({
  endsAt: null,
  totalSec: DEFAULT_REST_SEC,

  start: (seconds = DEFAULT_REST_SEC) =>
    set({ endsAt: Date.now() + seconds * 1000, totalSec: seconds }),

  extend: seconds => {
    const { endsAt, totalSec } = get();
    if (!endsAt) return;
    // Clamp at zero so "-30s" past the end can't leave the timer in the past.
    const next = Math.max(Date.now(), endsAt + seconds * 1000);
    set({ endsAt: next, totalSec: Math.max(1, totalSec + seconds) });
  },

  stop: () => set({ endsAt: null }),
}));

/** Seconds left, floored at zero. Read through `useTicker` to animate it. */
export function remainingSec(endsAt: number | null, now: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
