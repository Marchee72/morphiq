import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStoredSession, writeStoredSession, clearStoredSession,
} from '../sessionPersistence';
import { useStore } from '../store';
import type { ActiveSession } from '../store';

const KEY = 'morphiq_active_session';

const session = (over: Partial<ActiveSession> = {}): ActiveSession => ({
  startTime: new Date('2026-08-19T10:00:00Z'),
  workoutType: 'Push Day',
  sets: [
    { exerciseName: 'Bench Press', setNumber: 1, weight: 80.125, reps: 8, isCompleted: true },
  ],
  ...over,
});

describe('sessionPersistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a session with startTime as a real Date', () => {
    writeStoredSession('p1', session());
    const stored = readStoredSession();

    expect(stored?.profileId).toBe('p1');
    // The whole point of the revive step: JSON gives back a string here.
    expect(stored?.session.startTime).toBeInstanceOf(Date);
    expect(stored?.session.startTime.toISOString()).toBe('2026-08-19T10:00:00.000Z');
    expect(stored?.savedAt).toBeInstanceOf(Date);
    expect(stored?.session.sets[0].weight).toBe(80.125);
  });

  it('reads null when nothing was ever stored', () => {
    expect(readStoredSession()).toBeNull();
  });

  it('drops a session with no sets — there is nothing to resume', () => {
    writeStoredSession('p1', session({ sets: [] }));
    expect(readStoredSession()).toBeNull();
  });

  it('survives corrupt JSON instead of throwing on every launch', () => {
    localStorage.setItem(KEY, '{not json at all');
    expect(readStoredSession()).toBeNull();
    // And clears it, so the next launch does not re-parse the same rubbish.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('refuses a payload that lost its startTime', () => {
    localStorage.setItem(KEY, JSON.stringify({
      profileId: 'p1',
      session: { workoutType: 'Push', sets: [{ setNumber: 1 }] },
    }));
    expect(readStoredSession()).toBeNull();
  });

  it('refuses a payload whose sets are not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({
      profileId: 'p1',
      session: { startTime: new Date().toISOString(), sets: 'nope' },
    }));
    expect(readStoredSession()).toBeNull();
  });

  it('clears on request', () => {
    writeStoredSession('p1', session());
    clearStoredSession();
    expect(readStoredSession()).toBeNull();
  });

  it('keeps the profile it belonged to, so another account is not offered it', () => {
    writeStoredSession('someone-else', session());
    expect(readStoredSession()?.profileId).toBe('someone-else');
  });
});

/**
 * The store side of the same contract.
 *
 * The module above is only useful if something calls it, and that something is
 * a single `useStore.subscribe` — one subscription standing in for a write at
 * every one of the dozen actions that touch `activeSession`. If it stops
 * firing, sessions silently stop surviving and nothing else fails.
 */
describe('the store mirrors its session into storage', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ activeSession: null, activeProfile: { id: 'p1', name: 'X' } as never });
  });

  it('writes the session as sets are logged', () => {
    useStore.getState().startActiveSession('Push');
    useStore.getState().updateActiveSessionSets([
      { exerciseName: 'Bench', setNumber: 1, weight: 80.125, reps: 8, isCompleted: true },
    ]);

    expect(readStoredSession()?.session.sets[0].weight).toBe(80.125);
  });

  it('clears storage when the session is discarded', () => {
    useStore.getState().startActiveSession('Push');
    useStore.getState().updateActiveSessionSets([
      { exerciseName: 'Bench', setNumber: 1, weight: 80, reps: 8, isCompleted: true },
    ]);
    useStore.getState().dismissActiveSession();

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('stores nothing while there is no profile to own it', () => {
    useStore.setState({ activeProfile: null });
    useStore.getState().startActiveSession('Push');

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('hands a pending session over to become the live one', () => {
    writeStoredSession('p1', session());
    useStore.setState({ pendingResume: readStoredSession() });

    useStore.getState().resumePendingSession();

    const active = useStore.getState().activeSession;
    expect(active?.workoutType).toBe('Push Day');
    expect(active?.sets).toHaveLength(1);
    expect(useStore.getState().pendingResume).toBeNull();
  });

  it('discarding a pending session leaves nothing behind', () => {
    writeStoredSession('p1', session());
    useStore.setState({ pendingResume: readStoredSession() });

    useStore.getState().discardPendingSession();

    expect(useStore.getState().pendingResume).toBeNull();
    expect(useStore.getState().activeSession).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
