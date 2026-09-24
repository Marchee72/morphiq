import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from './cn';

/**
 * An on/off switch whose knob behaves like a drop of liquid: it stretches
 * while pressed and springs across. After Bencho's Liquid toggle.
 *
 * The knob is positioned by the track's `justify-content` and moved with
 * `layout`, so there is no pixel arithmetic to keep in step with the size.
 * On, it takes the primary relief (`--d-grad`); off, it is a plain pill on
 * the tonal track.
 */
export function LiquidToggle({ checked, onChange, id, label, className }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  /** Accessible name when no `<label htmlFor>` points at `id`. */
  label?: string;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={cn(
        'relative flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-0 p-1 transition-colors duration-200',
        checked ? 'justify-end bg-[color-mix(in_srgb,var(--ember)_28%,var(--at-tonal))]' : 'justify-start bg-[var(--at-tonal)]',
        className,
      )}
    >
      <motion.span
        layout
        aria-hidden="true"
        className={cn(
          'block h-6 rounded-full',
          checked ? 'bg-[image:var(--d-grad)] shadow-[var(--d-hi)]' : 'bg-[image:var(--d-pill)] shadow-[var(--d-soft)]',
        )}
        animate={{ width: pressed ? 32 : 24 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
