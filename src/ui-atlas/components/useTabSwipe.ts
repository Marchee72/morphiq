import { useRef } from 'react';
import { animate, useMotionValue, type MotionValue } from 'motion/react';

/** Past this many pixels, or a flick of at least FLICK_PX this fast, a release changes tab. */
const COMMIT_PX = 80;
const FLICK_PX = 40;
const COMMIT_VELOCITY = 0.5; // px per ms
/** Horizontal must beat vertical by this much before the gesture is claimed. */
const AXIS_RATIO = 1.5;
/** Movement below this is a tap. */
const SLOP_PX = 10;
/** At the first and last tab the page gives, but only this much of the finger's travel. */
const EDGE_RESISTANCE = 0.25;

/**
 * Whether a pointer that went down on `target` belongs to something else that
 * moves sideways — a slider, the weight wheel, a sheet, a form field, or any
 * element that scrolls horizontally (chip rails, strips).
 */
function ownedElsewhere(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('[role="dialog"], [role="alertdialog"], .at-scrim, [role="slider"], input, textarea, select, [data-no-tab-swipe]')) return true;
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
  }
  return false;
}

export interface TabSwipe {
  /** The live horizontal offset of the page; 0 at rest (no transform, so nothing fixed inside is trapped). */
  x: MotionValue<number>;
  bind: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onClickCapture: (e: React.MouseEvent) => void;
  };
}

/**
 * Swiping sideways between tabs, following the finger.
 *
 * The same rules as `useSwipeNav` (axis lock, commit on release, a drag never
 * doubles as a tap), but the offset is a motion value rather than state: the
 * page moves on every pointer event and React renders nothing until the tab
 * actually changes. Short of the threshold the page springs back; at the ends
 * it resists.
 *
 * `enabled` is false where sideways already means something else — Train
 * during a session, where the swipe changes exercise — and while an overlay is
 * open.
 */
export function useTabSwipe({ enabled, canPrev, canNext, onPrev, onNext }: {
  enabled: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}): TabSwipe {
  const x = useMotionValue(0);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  const swallowClick = useRef(false);

  const reset = () => {
    start.current = null;
    axis.current = null;
  };

  return {
    x,
    bind: {
      onPointerDown: e => {
        if (!enabled || start.current || ownedElsewhere(e.target, e.currentTarget)) return;
        start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
        axis.current = null;
      },
      onPointerMove: e => {
        const from = start.current;
        if (!from || e.pointerId !== from.id) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (axis.current === null) {
          if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
          axis.current = Math.abs(dx) > Math.abs(dy) * AXIS_RATIO ? 'x' : 'y';
        }
        if (axis.current !== 'x') return;
        const blocked = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
        x.set(blocked ? dx * EDGE_RESISTANCE : dx);
      },
      onPointerUp: e => {
        const from = start.current;
        if (!from || e.pointerId !== from.id) return;
        const dx = e.clientX - from.x;
        const wasX = axis.current === 'x';
        reset();
        if (!wasX) return;
        if (Math.abs(dx) >= SLOP_PX) swallowClick.current = true;
        const velocity = Math.abs(dx) / Math.max(1, e.timeStamp - from.t);
        const far = Math.abs(dx) >= COMMIT_PX || (Math.abs(dx) >= FLICK_PX && velocity >= COMMIT_VELOCITY);
        const width = e.currentTarget.clientWidth || 390;
        if (far && dx < 0 && canNext) {
          // Out the way it was going, then the next screen enters from the other side.
          void animate(x, -width * 0.4, { duration: 0.12, ease: 'easeIn' }).then(() => { onNext(); x.set(0); });
        } else if (far && dx > 0 && canPrev) {
          void animate(x, width * 0.4, { duration: 0.12, ease: 'easeIn' }).then(() => { onPrev(); x.set(0); });
        } else {
          void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
        }
      },
      onPointerCancel: () => {
        reset();
        void animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
      },
      onClickCapture: e => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}
