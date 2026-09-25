import { localDayKey } from '../../data/health/CapacitorHealthProvider';

export type SyncStatus = 'unavailable' | 'syncing' | 'idle' | 'denied';

/** What the strip under Body's title says. Null says nothing at all. */
export type SyncStrip =
  | { kind: 'syncing' }
  | { kind: 'denied' }
  /** Today's weigh-in is in. */
  | { kind: 'fresh'; at: Date }
  /** Someone who weighs in most mornings, this morning, and nothing has arrived. */
  | { kind: 'waiting'; lastAt: Date; checkedAt: Date | null }
  | { kind: 'last'; at: Date }
  | null;

/** Days out of the last week (today not counted) that make weighing in a habit. */
const HABIT_DAYS = 4;
/** After this, a missing weigh-in is more likely skipped than late. */
const MORNING_ENDS_AT = 12;

export function syncStrip(
  readings: Date[],
  status: SyncStatus,
  checkedAt: Date | null,
  now = new Date(),
): SyncStrip {
  if (status === 'syncing') return { kind: 'syncing' };
  if (status === 'denied') return { kind: 'denied' };

  const lastAt = readings.reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);
  if (!lastAt) return null;

  const today = localDayKey(now);
  if (localDayKey(lastAt) === today) return { kind: 'fresh', at: lastAt };

  // Only where a sync exists to be waiting on — the web build has none.
  if (status === 'idle' && now.getHours() < MORNING_ENDS_AT) {
    const weekAgo = now.getTime() - 7 * 86_400_000;
    const days = new Set(readings.filter(d => d.getTime() >= weekAgo).map(localDayKey));
    days.delete(today);
    if (days.size >= HABIT_DAYS) return { kind: 'waiting', lastAt, checkedAt };
  }
  return { kind: 'last', at: lastAt };
}
