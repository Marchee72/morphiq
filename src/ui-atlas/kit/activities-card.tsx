import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export interface ActivityItem {
  key: string;
  icon: ReactNode;
  title: string;
  desc: string;
  time: string;
  onClick?: () => void;
  /** Accessible name for the row, when the visible text is not enough. */
  ariaLabel?: string;
}

/**
 * A card that opens into a list: the header icon shrinks, the subtitle steps
 * aside and the rows arrive one after another. After Watermelon's
 * activities-card, in atlas surfaces (`--d-card`) instead of its greys.
 */
export function ActivitiesCard({ icon, title, subtitle, items, defaultOpen = false }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  items: ActivityItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panel = useId();
  return (
    <MotionConfig transition={{ type: 'spring', bounce: 0, duration: 0.55 }}>
      <motion.div
        layout
        className="overflow-hidden rounded-[22px] bg-[image:var(--d-card)] shadow-[var(--d-card-hi)]"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen(o => !o)}
          className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left text-[var(--cocoa)]"
        >
          <motion.span
            className="flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--at-tonal)] text-[var(--clay)]"
            initial={false}
            animate={{ width: open ? 36 : 44, height: open ? 36 : 44 }}
          >
            <motion.span className="flex" animate={{ scale: open ? 0.8 : 1 }}>{icon}</motion.span>
          </motion.span>
          <span className="flex min-w-0 flex-1 flex-col">
            <motion.span layout className="truncate text-[15px] font-bold">{title}</motion.span>
            <AnimatePresence mode="popLayout" initial={false}>
              {!open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate text-[13px] text-[var(--muted)]"
                >
                  {subtitle}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex text-[var(--muted)]">
            <ChevronDown size={20} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panel}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-[var(--hair)]"
            >
              <ul className="m-0 list-none py-1.5">
                {items.map((item, i) => (
                  <motion.li
                    key={item.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                  >
                    <button
                      type="button"
                      onClick={item.onClick}
                      aria-label={item.ariaLabel}
                      disabled={!item.onClick}
                      className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-[var(--cocoa)] disabled:cursor-default"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[image:var(--d-tonal)] text-[var(--clay)] shadow-[var(--d-soft)]">
                        {item.icon}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-bold">{item.title}</span>
                        <span className="truncate text-[13px] text-[var(--muted)]">{item.desc}</span>
                      </span>
                      <span className="whitespace-nowrap text-xs text-[var(--muted)]">{item.time}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}
