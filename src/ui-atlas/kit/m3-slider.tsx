import { useRef, useState } from 'react';
import { cn } from './cn';

/**
 * A Material 3 slider: a thick track split at the value, a narrow upright
 * handle in the gap, a dot on every stop, and a bubble with the number while
 * you hold it. The active side carries the primary relief (`--d-grad`).
 *
 * Drag, tap anywhere on the track, or use the arrow / Home / End keys.
 */
export function M3Slider({ label, value, onChange, min, max, step = 1, valueText, marks, className }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** What a screen reader hears for a value — "13, somewhat hard". */
  valueText?: (value: number) => string;
  /** Labels under the track, at their values. */
  marks?: { value: number; label: string }[];
  className?: string;
}) {
  const [held, setHeld] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const span = max - min;
  const pct = ((value - min) / span) * 100;

  const clampStep = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const set = (v: number) => { const next = clampStep(v); if (next !== value) onChange(next); };
  const fromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    return min + ((clientX - r.left) / r.width) * span;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step };
    if (e.key === 'Home') { e.preventDefault(); set(min); return; }
    if (e.key === 'End') { e.preventDefault(); set(max); return; }
    if (moves[e.key] === undefined) return;
    e.preventDefault();
    set(value + moves[e.key]);
  };

  const stops = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => min + i * step);
  const ease = held ? '' : 'transition-all duration-200 ease-out motion-reduce:transition-none';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText?.(value)}
        className="relative h-[72px] cursor-grab touch-none outline-none focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-[var(--ember)]"
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); setHeld(true); set(fromPointer(e.clientX)); }}
        onPointerMove={e => { if (held) set(fromPointer(e.clientX)); }}
        onPointerUp={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onKeyDown={onKeyDown}
      >
        {/* The two halves stop 6 px short of the handle, the gap M3 draws around it. */}
        <span
          aria-hidden="true"
          className={cn('absolute top-7 left-0 h-4 rounded-l-lg rounded-r-[3px] bg-[image:var(--d-grad)] shadow-[var(--d-hi)]', ease)}
          style={{ width: `max(0px, calc(${pct}% - 6px))` }}
        />
        <span
          aria-hidden="true"
          className={cn('absolute top-7 right-0 h-4 rounded-l-[3px] rounded-r-lg bg-[var(--at-tonal)]', ease)}
          style={{ width: `max(0px, calc(${100 - pct}% - 6px))` }}
        />
        {stops.map(s => (
          <span
            key={s}
            aria-hidden="true"
            className="absolute top-[34px] -ml-0.5 size-1 rounded-full"
            style={{ left: `${((s - min) / span) * 100}%`, background: s <= value ? 'rgba(255,255,255,.7)' : 'var(--muted)', opacity: s === value ? 0 : 1 }}
          />
        ))}
        <span
          aria-hidden="true"
          className={cn('absolute top-3.5 -ml-0.5 h-11 w-1 rounded-sm bg-[image:var(--d-grad)] shadow-[var(--d-hi)]', ease)}
          style={{ left: `${pct}%` }}
        />
        <span
          aria-hidden="true"
          className={cn('absolute -top-[18px] -ml-6 flex h-8 w-12 items-center justify-center rounded-2xl bg-[var(--cocoa)] text-[15px] font-extrabold text-[var(--sand)]', ease)}
          style={{ left: `${pct}%`, opacity: held ? 1 : 0 }}
        >
          {value}
        </span>
      </div>
      {marks && (
        <div className="relative h-4 text-xs font-semibold text-[var(--muted)]" aria-hidden="true">
          {marks.map((m, i) => (
            <span
              key={m.value}
              className="absolute whitespace-nowrap"
              style={{
                left: `${((m.value - min) / span) * 100}%`,
                transform: i === 0 ? 'none' : i === marks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
