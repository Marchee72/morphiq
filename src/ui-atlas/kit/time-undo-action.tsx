import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Undo2 } from 'lucide-react';
import { cn } from './cn';

/**
 * A destructive action you can take back for a few seconds, instead of a
 * confirm dialog. After Watermelon's time-undo-action.
 *
 * Tap it and it turns into "Undo" with a countdown; tap again to cancel. When
 * the count reaches zero the action runs — once. Unlike the registry demo,
 * which only ever cancelled itself, the point here is that it commits.
 *
 * The width follows its content with a spring (`layout`), so the swap from the
 * action's label to the undo label does not jump.
 */
export function UndoAction({ label, ariaLabel, undoLabel, seconds = 5, onCommit, icon, className }: {
  label: ReactNode;
  /** Accessible name before the countdown, when `label` is only an icon. */
  ariaLabel?: string;
  undoLabel: string;
  seconds?: number;
  onCommit: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  const [left, setLeft] = useState<number | null>(null);
  // The latest callback, so an unrelated re-render mid-countdown cannot commit a stale one.
  const commit = useRef(onCommit);
  useEffect(() => { commit.current = onCommit; }, [onCommit]);

  const counting = left !== null;
  // One timer per second shown; the last one commits instead of counting down.
  useEffect(() => {
    if (left === null) return;
    const timer = setTimeout(() => {
      if (left > 1) { setLeft(left - 1); return; }
      setLeft(null);
      commit.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return (
    <motion.button
      type="button"
      onClick={() => setLeft(counting ? null : seconds)}
      aria-label={counting ? undefined : ariaLabel}
      aria-live="polite"
      layout
      transition={{ type: 'spring', stiffness: 250, damping: 22 }}
      className={cn(
        'relative inline-flex cursor-pointer items-center overflow-hidden rounded-full border-0 p-0 font-bold transition-colors duration-300',
        counting
          ? 'bg-[color-mix(in_srgb,#c24a2f_14%,transparent)] text-[#c24a2f]'
          : 'bg-[image:var(--d-danger)] text-white shadow-[var(--d-danger-hi)]',
        className,
      )}
    >
      <span className={cn('flex items-center gap-2 whitespace-nowrap py-2.5 text-sm', counting ? 'px-2' : 'px-5')}>
        <AnimatePresence mode="popLayout" initial={false}>
          {counting && (
            <motion.span
              key="undo"
              className="flex rounded-full bg-[image:var(--d-danger)] p-1.5 text-white"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <Undo2 size={16} />
            </motion.span>
          )}
        </AnimatePresence>
        {!counting && icon}
        <span>{counting ? undoLabel : label}</span>
        <AnimatePresence mode="popLayout" initial={false}>
          {counting && (
            <motion.span
              key="count"
              className="flex min-w-7 justify-center rounded-full bg-[image:var(--d-danger)] px-2 py-0.5 text-white tabular-nums"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={left}
                  initial={{ y: -14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 14, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  {left}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
