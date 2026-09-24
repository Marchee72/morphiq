import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { cn } from './cn';

const digitVariants = {
  initial: (dir: number) => ({ y: dir > 0 ? 18 : -18, opacity: 0, scale: 0.6, filter: 'blur(2px)' }),
  animate: { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ y: dir > 0 ? -18 : 18, opacity: 0, scale: 0.6, filter: 'blur(2px)' }),
};

/**
 * − value + with digits that roll in the direction you pressed. After
 * Watermelon's stepper: each digit is keyed on how many times *that position*
 * has changed, so going 9 → 10 rolls the new tens digit in and leaves nothing
 * else jumping.
 */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit, decLabel, incLabel, className }: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the number, smaller — "reps". */
  unit?: string;
  decLabel: string;
  incLabel: string;
  className?: string;
}) {
  const [direction, setDirection] = useState(0);
  const digits = String(value).split('');
  const [prev, setPrev] = useState<{ digits: string[]; ticks: number[] }>({ digits, ticks: digits.map(() => 0) });

  // Render-time sync (React's "storing information from previous renders"):
  // a position that changed gets a new tick, and the new tick is the key that
  // makes AnimatePresence roll it.
  let ticks = prev.ticks;
  if (prev.digits.join('') !== digits.join('')) {
    const shift = digits.length - prev.digits.length;
    ticks = digits.map((d, i) => {
      const was = prev.digits[i - shift];
      const tick = prev.ticks[i - shift] ?? 0;
      return d === was ? tick : tick + 1;
    });
    setPrev({ digits, ticks });
  }

  const go = (dir: number) => {
    const next = Math.min(max, Math.max(min, value + dir * step));
    if (next === value) return;
    setDirection(dir);
    onChange(next);
  };

  const button = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[image:var(--d-tonal)] text-[var(--cocoa)] shadow-[var(--d-soft)] disabled:cursor-default disabled:opacity-40';
  return (
    <div className={cn('flex items-center gap-3 rounded-full bg-[var(--at-tonal)] p-1.5', className)}>
      <motion.button type="button" whileTap={{ scale: 0.92 }} className={button} aria-label={decLabel} disabled={value <= min} onClick={() => go(-1)}>
        <Minus size={18} />
      </motion.button>
      <span className="flex min-w-[76px] items-baseline justify-center gap-1" aria-live="polite">
        <span className="flex text-[17px] font-bold tabular-nums">
          {digits.map((d, i) => (
            <span key={`${i}-${digits.length}`} className="relative inline-block h-[1.3em] w-[0.62em] overflow-visible">
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.span
                  key={ticks[i]}
                  custom={direction}
                  variants={digitVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  {d}
                </motion.span>
              </AnimatePresence>
            </span>
          ))}
        </span>
        {unit && <span className="text-[13px] font-semibold text-[var(--muted)]">{unit}</span>}
      </span>
      <motion.button type="button" whileTap={{ scale: 0.92 }} className={button} aria-label={incLabel} disabled={value >= max} onClick={() => go(1)}>
        <Plus size={18} />
      </motion.button>
    </div>
  );
}
