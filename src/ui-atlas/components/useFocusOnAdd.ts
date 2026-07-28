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
 */
export function useFocusOnAdd(
  exerciseCount: number,
  setCursor: (cursor: SessionCursor) => void,
): void {
  const [seenCount, setSeenCount] = useState(exerciseCount);

  if (seenCount !== exerciseCount) {
    setSeenCount(exerciseCount);
    if (exerciseCount > seenCount) {
      setCursor({ exerciseIdx: exerciseCount - 1, setIdx: 0 });
    }
  }
}
