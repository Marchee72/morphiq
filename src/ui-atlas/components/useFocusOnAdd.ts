import { useState } from 'react';
import type { SessionCursor } from '../types';

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
  exercises: { key: string }[],
  setCursor: (cursor: SessionCursor) => void,
): void {
  const keys = exercises.map(ex => ex.key);
  const [seen, setSeen] = useState<string[]>(keys);

  if (seen.length === keys.length && keys.every((key, i) => key === seen[i])) return;

  setSeen(keys);
  const known = new Set(seen);
  const firstNew = keys.findIndex(key => !known.has(key));
  if (firstNew !== -1) setCursor({ exerciseIdx: firstNew, setIdx: 0 });
}
