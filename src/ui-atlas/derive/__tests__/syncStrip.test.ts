import { describe, expect, it } from 'vitest';
import { syncStrip } from '../syncStrip';

const now = new Date(2026, 8, 25, 8, 14);
const day = (d: number, h = 7) => new Date(2026, 8, d, h, 45);
const habit = [day(19), day(20), day(22), day(23), day(24)];

describe('syncStrip', () => {
  it('says today\'s weigh-in is in', () => {
    expect(syncStrip([...habit, day(25)], 'idle', now, now)).toEqual({ kind: 'fresh', at: day(25) });
  });

  it('waits for this morning\'s weigh-in from someone who weighs in most days', () => {
    expect(syncStrip(habit, 'idle', now, now)).toEqual({ kind: 'waiting', lastAt: day(24), checkedAt: now });
  });

  it('does not wait in the afternoon, or for an occasional weigher', () => {
    const afternoon = new Date(2026, 8, 25, 15);
    expect(syncStrip(habit, 'idle', afternoon, afternoon)?.kind).toBe('last');
    expect(syncStrip([day(20), day(24)], 'idle', now, now)?.kind).toBe('last');
  });

  it('does not wait where there is no sync to wait on', () => {
    expect(syncStrip(habit, 'unavailable', null, now)?.kind).toBe('last');
  });

  it('puts an ongoing sync and a refused permission first', () => {
    expect(syncStrip(habit, 'syncing', null, now)).toEqual({ kind: 'syncing' });
    expect(syncStrip([], 'denied', null, now)).toEqual({ kind: 'denied' });
  });

  it('says nothing with no readings', () => {
    expect(syncStrip([], 'idle', now, now)).toBeNull();
  });
});
