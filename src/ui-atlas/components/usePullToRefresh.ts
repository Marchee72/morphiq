import { useEffect, useRef, useState } from 'react';

/** How far the finger travels before the pull will fire on release. */
const THRESHOLD = 72;
/** Where the pull stops following the finger, so it cannot be dragged to the floor. */
const MAX_PULL = 110;
/**
 * How much of the finger's travel the indicator takes. Below 1 the sheet lags
 * the finger, which is what makes the gesture feel like it is resisting rather
 * than like the page has come loose.
 */
const RESISTANCE = 0.55;
/** Below this the gesture is a scroll that started at the top, not a pull. */
const SLOP = 8;

export type PullState = 'idle' | 'pulling' | 'armed' | 'refreshing';

/**
 * Pull down at the top of a scroller to run something.
 *
 * Written against touch events rather than a library because the whole gesture
 * is one decision — is this finger scrolling the list or dragging the page? —
 * and that decision is about `scrollTop` at the moment the finger lands. A
 * generic implementation would still need this hook's rules to answer it.
 *
 * Four things it deliberately does:
 *
 * - Engages only from a resting scrollTop of 0. Starting mid-list and flicking
 *   back to the top must not arm a refresh you did not ask for, so the start
 *   position is captured on touchstart and never re-evaluated.
 * - Gives up the moment the finger moves further sideways than down, so it does
 *   not fight the horizontal swipe that changes exercise on Train.
 * - Calls `preventDefault` only once it has committed. Doing it earlier means
 *   the listener has to be non-passive for every touch on the page, and a
 *   scroller that cannot scroll passively janks on every drag.
 * - Writes the distance to a CSS variable rather than to React state. The
 *   distance changes on every touchmove, and putting it through a render would
 *   re-render the whole screen sixty times a second to move one spinner. Only
 *   the four discrete states go through React.
 */
export function usePullToRefresh(
  ref: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown>,
  enabled = true,
) {
  const [state, setState] = useState<PullState>('idle');

  /**
   * The callback, held in a ref so the listeners attach once rather than
   * re-binding whenever the owner re-renders. Written in an effect rather than
   * during render — a ref is not a render input, and the touch that reads it
   * cannot happen before the commit that sets it.
   */
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  /** Live gesture state. Not React state: it changes per touchmove. */
  const gesture = useRef<{ startY: number; startX: number; committed: boolean; dead: boolean } | null>(null);
  const distance = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const setDistance = (px: number) => {
      distance.current = px;
      el.style.setProperty('--at-pull', `${px}px`);
    };

    const reset = () => {
      gesture.current = null;
      setDistance(0);
      setState('idle');
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1) return;
      // Only from a genuine rest at the top. `> 0` rather than `!== 0` because
      // iOS reports small negative values while rubber-banding.
      if (el.scrollTop > 0) return;
      const touch = e.touches[0];
      gesture.current = { startY: touch.clientY, startX: touch.clientX, committed: false, dead: false };
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g || g.dead || busy.current) return;

      const touch = e.touches[0];
      const dy = touch.clientY - g.startY;
      const dx = touch.clientX - g.startX;

      if (!g.committed) {
        // Upward, or more sideways than down: this was never a pull. Killed for
        // the rest of the gesture rather than re-tested, so a wandering finger
        // cannot recapture it halfway through a scroll.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { g.dead = true; return; }
        if (dy < SLOP) return;
        g.committed = true;
      }

      // Committed: the page is following the finger, so the scroller must not
      // also be. The cancelable check keeps this quiet once the browser has
      // taken the gesture over itself.
      if (e.cancelable) e.preventDefault();

      // Clamped at zero: dragging back up past the start should close the
      // indicator, not push it off the top of the screen.
      const pulled = Math.max(0, Math.min(dy * RESISTANCE, MAX_PULL));
      setDistance(pulled);
      setState(pulled >= THRESHOLD ? 'armed' : 'pulling');
    };

    const onEnd = () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g?.committed || busy.current) { reset(); return; }
      if (distance.current < THRESHOLD) { reset(); return; }

      busy.current = true;
      setState('refreshing');
      // Parks the indicator at the threshold while the work runs, so the
      // spinner has somewhere to sit rather than snapping shut under it.
      setDistance(THRESHOLD);

      void (async () => {
        try {
          await onRefreshRef.current();
        } finally {
          busy.current = false;
          reset();
        }
      })();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      // The variable outlives the listeners otherwise, and the next screen
      // mounts holding the last screen's half-finished pull.
      el.style.removeProperty('--at-pull');
    };
  }, [ref, enabled]);

  return { state, threshold: THRESHOLD };
}
