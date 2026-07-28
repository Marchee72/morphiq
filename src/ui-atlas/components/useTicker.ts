import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component on an interval.
 *
 * Deliberately not in `AppDataProvider`: a ticking value there would re-render
 * every screen once a second. Only `<Elapsed>` and `<RestTimer>` subscribe.
 */
export function useTicker(intervalMs = 1000, enabled = true): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);

  return tick;
}

/** Seconds since `startedAt`, ticking. Never negative, so a clock skew can't show a countdown. */
export function useElapsedSeconds(startedAt: Date | null | undefined): number {
  const tick = useTicker(1000, Boolean(startedAt));
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((tick - new Date(startedAt).getTime()) / 1000));
}
