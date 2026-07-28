import { create } from 'zustand';
import type { SessionSummaryVM } from '../derive/summary';

/**
 * The recap of the session that just ended.
 *
 * Lives outside `AppDataProvider` for the same reason the rest timer does: it is
 * ephemeral UI state, not derived data. More importantly it has to *outlive* its
 * source — `finishActiveSession` nulls `activeSession`, so anything derived from
 * the provider is gone by the time there is something to show.
 */
interface SessionSummaryState {
  summary: SessionSummaryVM | null;
  show: (summary: SessionSummaryVM) => void;
  dismiss: () => void;
}

export const useSessionSummary = create<SessionSummaryState>(set => ({
  summary: null,
  show: summary => set({ summary }),
  dismiss: () => set({ summary: null }),
}));
