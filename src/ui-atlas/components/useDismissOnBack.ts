import { useEffect, useId } from 'react';
import { registerBackHandler } from '../../presentation/state/backHandler';
import { lockBodyScroll, unlockBodyScroll } from '../shell/bodyScrollLock';

/**
 * Makes a dismissable surface behave like one on both platforms.
 *
 * Extracted from `AtlasSheet`, which was the only surface that ever had this.
 * The full-screen overlays — the exercise picker, the session list, settings, the
 * post-session summary — never registered, so on Android the hardware back
 * button fell through to the tab stack and *left the screen* rather than closing
 * the thing on top of it. From inside the picker that reads as the app quitting
 * mid-workout.
 *
 * `registerBackHandler` is a LIFO stack, so nesting works: picker over session
 * list over screen closes in that order.
 */
export function useDismissOnBack(open: boolean, onClose: () => void, kind = 'overlay'): void {
  const instanceId = useId();

  useEffect(() => {
    if (!open) return;

    lockBodyScroll();
    const unregister = registerBackHandler(`at-${kind}-${instanceId}`, () => {
      onClose();
      return true;
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    return () => {
      unlockBodyScroll();
      unregister();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, kind, instanceId]);
}
