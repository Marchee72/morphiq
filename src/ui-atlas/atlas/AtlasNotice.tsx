import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';

/** How long a notice stays up on its own. */
export const NOTICE_MS = 6000;
/** How far sideways (or up), or how fast, a drag has to go to throw the notice away. */
const SWIPE_PX = 80;
const SWIPE_UP_PX = 30;
const SWIPE_VELOCITY = 500;

/**
 * One of the pills in `.at-notices`: swiped sideways or up, it goes; left
 * alone, it goes after `ms`.
 *
 * A pill that only left once the app stopped having the problem sat over the
 * header for as long as the train had no signal. What it says is still true
 * after it goes — the point was made.
 *
 * `id` is the message, not the element. Dismissing hides that message only;
 * when the message changes (offline → a change refused), the new one shows.
 * `hold` pauses the clock while the notice is asking something.
 */
export const AtlasNotice: React.FC<HTMLMotionProps<'div'> & {
  id: string;
  ms?: number;
  hold?: boolean;
  /** Called on a swipe, for a notice that remembers being dismissed. */
  onDismiss?: () => void;
}> = ({ id, ms = NOTICE_MS, hold = false, onDismiss, className, children, ...rest }) => {
  const [hidden, setHidden] = useState(false);
  const [seen, setSeen] = useState(id);
  if (seen !== id) {
    setSeen(id);
    setHidden(false);
  }

  useEffect(() => {
    if (hold || hidden) return;
    const timer = setTimeout(() => setHidden(true), ms);
    return () => clearTimeout(timer);
  }, [id, ms, hold, hidden]);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          {...rest}
          className={`at-top-banner ${className ?? ''}`}
          drag
          dragSnapToOrigin
          dragElastic={0.6}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
          onDragEnd={(_, { offset, velocity }) => {
            if (
              Math.abs(offset.x) > SWIPE_PX || offset.y < -SWIPE_UP_PX
              || Math.abs(velocity.x) > SWIPE_VELOCITY || velocity.y < -SWIPE_VELOCITY
            ) {
              setHidden(true);
              onDismiss?.();
            }
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
