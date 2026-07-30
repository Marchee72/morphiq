import { useEffect, useMemo } from 'react';
import { useStore } from '../../presentation/state/store';
import { useSocialStore } from '../../presentation/state/socialStore';
import type { LiveSessionSnapshot } from '../../core/entities/Buddy';
import { useAppData } from './useAppData';

/**
 * A heartbeat even when nothing changes.
 *
 * Presence expires on the server after three minutes of silence. Resting
 * between heavy sets is longer than nothing happening looks like from here, so
 * without this a partner would drop off mid-workout and reappear on the next
 * set.
 */
const HEARTBEAT_MS = 60_000;

/**
 * Publishes this device's live session so partners can see it.
 *
 * Deliberately declarative. The obvious implementation is a `publish()` call in
 * each of the ten mutators in `useLiveSession`, and the obvious failure of that
 * implementation is the eleventh one somebody adds later. Instead this watches
 * a derived tuple: every mutation goes through the store and therefore lands in
 * `sessionExercises` and `cursor`, so nothing can change without arriving here.
 *
 * What it emits is only ever the exercise, the position in it and the counts —
 * never a weight, never a rep. That is enforced by the server's table shape as
 * well; this is the near end of the same guarantee.
 *
 * The two ends of a session — finishing and discarding — are *not* handled
 * here, because they have to run as the component unmounts. `useLiveSession`
 * calls `endPresence` for both.
 */
export function usePresencePublisher(): void {
  const { session, sessionExercises, cursor, sessionTotals } = useAppData();
  const profileId = useStore(state => state.activeProfile?.id);
  const available = useSocialStore(state => state.available);
  const sharedSessionId = useSocialStore(state => state.shared?.id);

  const current = sessionExercises[cursor.exerciseIdx];

  const snapshot = useMemo<LiveSessionSnapshot | null>(() => {
    if (!session) return null;
    return {
      /**
       * The start time is the identity of the run.
       *
       * A random suffix looks safer and buys nothing: two sessions cannot share
       * a start millisecond, and relaunching mid-workout loses `activeSession`
       * entirely, so there is no old run left to be mistaken for. Deriving it
       * also keeps this function pure, which a ref holding a random value did
       * not.
       */
      sessionKey: String(session.startedAt.getTime()),
      startedAt: session.startedAt,
      exerciseName: current?.name,
      // One-based, because it is read as "3 of 6" and not as an array index.
      exerciseIndex: current ? cursor.exerciseIdx + 1 : undefined,
      exerciseCount: sessionExercises.length || undefined,
      setNumber: current ? cursor.setIdx + 1 : undefined,
      setCount: current?.sets.length || undefined,
      setsDone: sessionTotals.setsDone,
      setsPlanned: sessionTotals.setsPlanned,
      /**
       * Which container this session belongs to, so a partner's screen can
       * narrow to the people training with them.
       *
       * Sent, not trusted: the server checks the claim against the participants
       * table and drops it otherwise. Joining is an act, not an assertion.
       */
      sharedSessionId,
    };
  }, [session, current, cursor.exerciseIdx, cursor.setIdx, sessionExercises.length,
      sessionTotals.setsDone, sessionTotals.setsPlanned, sharedSessionId]);

  useEffect(() => {
    if (!available || !profileId || !snapshot) return;

    useSocialStore.getState().publishPresence(profileId, snapshot);

    // Republished on a timer as well as on change, so a long rest does not read
    // as having left the gym.
    const beat = window.setInterval(() => {
      useSocialStore.getState().publishPresence(profileId, snapshot);
    }, HEARTBEAT_MS);

    return () => window.clearInterval(beat);
  }, [available, profileId, snapshot]);
}
