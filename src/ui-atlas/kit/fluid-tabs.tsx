import { useId, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';

export interface FluidTabOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * A segmented control whose selected pill springs from option to option.
 *
 * After Watermelon's fluid-tabs: the pill is one shared `layoutId`, so it
 * travels rather than fading between buttons, and the label it lands on
 * flashes a short blur. Here it is a radio group — the options are
 * alternatives to one another, not tabs owning panels — and the `layoutId` is
 * scoped per instance, or two controls on one screen would trade pills.
 */
export function FluidTabs<T extends string>({ label, options, value, onChange, className }: {
  label?: string;
  options: FluidTabOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  className?: string;
}) {
  const pill = useId();
  // Nothing selected reads as broken; every caller has a value at all times.
  const selected = options.some(o => o.value === value) ? value : options[0]?.value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-full bg-[var(--at-tonal)] p-[3px]', className)}
    >
      {options.map(option => {
        const on = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13px] transition-colors',
              on ? 'font-bold text-[var(--cocoa)]' : 'font-semibold text-[var(--muted)]',
            )}
          >
            {on && (
              <motion.span
                layoutId={pill}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[image:var(--d-pill)] shadow-[var(--d-soft)]"
                transition={{ type: 'spring', stiffness: 280, damping: 25, mass: 0.8 }}
              />
            )}
            <motion.span
              className="relative flex items-center gap-1.5 truncate"
              animate={{ filter: on ? ['blur(0px)', 'blur(3px)', 'blur(0px)'] : 'blur(0px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {option.icon}
              {option.label}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}
