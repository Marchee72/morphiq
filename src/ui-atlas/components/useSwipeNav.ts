import { useRef, useState } from 'react';

/**
 * Horizontal swipe-to-navigate, from raw pointer events.
 *
 * No gesture library: the project ships none, and the whole behaviour is a
 * threshold and an axis lock. Adding one for this would be a dependency for
 * forty lines.
 *
 * Two rules make it usable rather than annoying on a phone:
 *
 * - **Axis lock.** The gesture only becomes a swipe once horizontal movement
 *   clearly dominates. Everything on the Train screen scrolls vertically — the
 *   screen itself, and the weight/reps wheels — so a slightly-off vertical drag
 *   must never be stolen and turned into an exercise change.
 * - **Commit on release, not on threshold.** Crossing the threshold mid-drag and
 *   firing immediately makes the screen change under a finger that is still
 *   moving. The offset is exposed instead so the caller can follow the finger,
 *   and the decision happens when the finger lifts.
 */

/** Past this many pixels of horizontal travel, a release commits. */
const COMMIT_PX = 60;

/** Horizontal must beat vertical by this much before the gesture is claimed. */
const AXIS_RATIO = 1.5;

/** Movement below this is a tap, and taps must reach the elements underneath. */
const SLOP_PX = 8;

export interface SwipeNav {
  /** Live horizontal offset in px while dragging, 0 otherwise. */
  dx: number;
  dragging: boolean;
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useSwipeNav(onNext: () => void, onPrevious: () => void): SwipeNav {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  /** null while the axis is still undecided, then locked for the rest of the gesture. */
  const axis = useRef<'x' | 'y' | null>(null);
  const [dx, setDx] = useState(0);

  const end = () => {
    start.current = null;
    axis.current = null;
    setDx(0);
  };

  return {
    dx,
    dragging: dx !== 0,
    bind: {
      onPointerDown: e => {
        // A second finger means a pinch or a stray palm, not a swipe.
        if (start.current) { end(); return; }
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        axis.current = null;
      },

      onPointerMove: e => {
        const from = start.current;
        if (!from || e.pointerId !== from.id) return;

        const moveX = e.clientX - from.x;
        const moveY = e.clientY - from.y;

        if (axis.current === null) {
          if (Math.abs(moveX) < SLOP_PX && Math.abs(moveY) < SLOP_PX) return;
          axis.current = Math.abs(moveX) > Math.abs(moveY) * AXIS_RATIO ? 'x' : 'y';
        }
        if (axis.current !== 'x') return;

        setDx(moveX);
      },

      onPointerUp: e => {
        const from = start.current;
        if (!from || e.pointerId !== from.id) return;
        const moveX = e.clientX - from.x;

        if (axis.current === 'x' && Math.abs(moveX) >= COMMIT_PX) {
          if (moveX < 0) onNext();
          else onPrevious();
        }
        end();
      },

      onPointerCancel: end,
    },
  };
}
