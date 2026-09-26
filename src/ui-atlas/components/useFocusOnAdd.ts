import { useEffect, useState } from 'react';
import type { SessionCursor } from '../types';

/**
 * What the Train screen last saw, per session. It unmounts on every tab change,
 * so an exercise added from the Library arrived at a fresh mount that took it
 * for part of the furniture and opened on the first unfinished exercise instead.
 */
let remembered: { session: number; keys: string[] } | null = null;

/** Tests share one session start time, so the memory has to be wiped between them. */
export function forgetSeenExercises(): void {
  remembered = null;
}

/**
 * Moves the cursor onto an exercise the moment it is added to the session.
 *
 * Without this, adding an exercise mid-session leaves you looking at the one you
 * just finished — the derived cursor only advances once every earlier set is
 * done, which is the right rule for resuming but the wrong one for "I just
 * chose this, take me to it".
 *
 * Compared during render rather than in an effect: an effect renders one frame
 * pointing at the old exercise and then jumps, which reads as a flicker.
 *
 * Keys rather than a count, because merging a routine adds several exercises at
 * once and can drop others in the same update. A count only knows the list grew,
 * so it landed you on the *last* new exercise — or, when a replace shrank the
 * list before growing it, on nothing at all.
 */
export function useFocusOnAdd(
  session: number | undefined,
  exercises: { key: string }[],
  setCursor: (cursor: SessionCursor) => void,
): void {
  const keys = exercises.map(ex => ex.key);
  const [seen, setSeen] = useState<string[]>(() =>
    (session !== undefined && remembered?.session === session ? remembered.keys : keys));

  useEffect(() => {
    if (session !== undefined) remembered = { session, keys: seen };
  }, [session, seen]);

  if (seen.length === keys.length && keys.every((key, i) => key === seen[i])) return;

  setSeen(keys);
  const known = new Set(seen);
  const firstNew = keys.findIndex(key => !known.has(key));
  if (firstNew !== -1) setCursor({ exerciseIdx: firstNew, setIdx: 0 });
}
