import { describe, expect, it, beforeEach } from 'vitest';
import { MAX_CATCH_UP_DAYS, markSyncOk, syncSince } from '../syncWindow';

const DAY = 86_400_000;
const NOW = new Date('2026-09-24T12:00:00Z');
const daysBack = (since: Date) => Math.round((NOW.getTime() - since.getTime()) / DAY);

beforeEach(() => localStorage.clear());

describe('syncSince', () => {
  it('reads the plain window when nothing has synced yet', () => {
    expect(daysBack(syncSince('1', 30, NOW))).toBe(30);
  });

  it('never shrinks below the window after a recent sync', () => {
    // Late-written records land inside the window; a checkpoint must not skip them.
    markSyncOk('1', new Date(NOW.getTime() - 2 * DAY));
    expect(daysBack(syncSince('1', 30, NOW))).toBe(30);
  });

  it('stretches back to the last clean sync after a long gap', () => {
    markSyncOk('1', new Date(NOW.getTime() - 60 * DAY));
    expect(daysBack(syncSince('1', 30, NOW))).toBe(61);
  });

  it('stops at the catch-up cap', () => {
    markSyncOk('1', new Date(NOW.getTime() - 2 * 365 * DAY));
    expect(daysBack(syncSince('1', 30, NOW))).toBe(MAX_CATCH_UP_DAYS);
  });

  it('keeps each profile to its own checkpoint', () => {
    markSyncOk('1', new Date(NOW.getTime() - 60 * DAY));
    expect(daysBack(syncSince('2', 30, NOW))).toBe(30);
  });
});
