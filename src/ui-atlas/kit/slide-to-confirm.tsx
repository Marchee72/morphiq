import { useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';

/**
 * Drag the knob to the end to confirm — for the one action that must not
 * happen by a stray tap (ending a session). After Bencho's Slide to confirm.
 *
 * Released short of the end, the knob springs back. The label fades as the
 * knob covers it. Keyboard and screen-reader users get the same action from
 * Enter or Space on the knob, which is a real button.
 */
export function SlideToConfirm({ label, onConfirm, disabled = false }: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [done, setDone] = useState(false);
  const labelOpacity = useTransform(x, [0, 120], [1, 0]);
  const KNOB = 48;
  const PAD = 6;

  const reach = () => Math.max(0, (track.current?.clientWidth ?? 0) - KNOB - PAD * 2);
  const confirm = () => {
    if (done || disabled) return;
    setDone(true);
    animate(x, reach(), { type: 'spring', stiffness: 400, damping: 35 });
    onConfirm();
  };

  return (
    <div
      ref={track}
      className="relative flex h-[60px] items-center overflow-hidden rounded-full bg-[image:var(--d-card)] p-1.5 shadow-[var(--d-card-hi)]"
      data-done={done}
    >
      <motion.span
        aria-hidden="true"
        style={{ opacity: labelOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-semibold text-[var(--muted)]"
      >
        {label}
      </motion.span>
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        drag={done || disabled ? false : 'x'}
        dragConstraints={track}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() >= reach() - 8) confirm();
          else animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
        }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm(); } }}
        className="relative z-10 flex size-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-full border-0 bg-[image:var(--d-grad)] text-[var(--at-on-clay)] shadow-[var(--d-hi)] active:cursor-grabbing disabled:opacity-50"
      >
        {done ? <Check size={20} strokeWidth={3} /> : <ArrowRight size={20} strokeWidth={2.4} />}
      </motion.button>
    </div>
  );
}
