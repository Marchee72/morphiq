import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useT } from '../../i18n';

/**
 * A scroll-to-pick number wheel, with keyboard entry.
 *
 * Replaces the ± steppers on the training screen. Going from 20 kg to 80 kg with
 * a 2.5 kg stepper is 24 taps; here it is one flick, or four keystrokes if you
 * tap the number and type it.
 *
 * The wheel runs **vertically**: values ascend downward and you flick up and
 * down, which is the gesture every native picker uses and gives each value a
 * full row to hit rather than a sliver of a finger-high track. It also leaves the
 * horizontal axis free for the Train screen's swipe-between-exercises.
 *
 * Only a window of values around the current one is rendered — the full weight
 * range is 240 items, and mounting all of them made the wheel stutter in the
 * Android WebView.
 */
/** How many values either side of the current one to mount. */
const WINDOW = 12;

/** Must match `.at-dial-tick`'s height in atlas.css — the snap maths depends on it. */
const ROW_PX = 40;

/** A flick fires `scroll` every frame; commit once it settles instead. */
const SETTLE_MS = 90;

export interface AtlasDialProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /**
   * The exact values to offer, when an even `step` cannot describe them.
   *
   * Weight uses this: its allowed decimals (.125/.5/.75) sit at uneven
   * intervals. Left out, the ladder is derived from min/max/step as before,
   * which is what reps still does.
   */
  values?: number[];
  /** Decimals to show. Weight uses 1 (so 32.5 reads correctly), reps 0. */
  decimals?: number;
  suffix?: string;
  formatValue?: (value: number) => string;
}

export const AtlasDial: React.FC<AtlasDialProps> = ({
  label, value, onChange, min, max, step, values: ladderProp, decimals = 0, suffix, formatValue,
}) => {
  const { t } = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  /** Suppresses the scroll handler while we are the ones doing the scrolling. */
  const settling = useRef(false);
  const commitTimer = useRef<number | undefined>(undefined);

  /**
   * Every value the dial can hold, in order.
   *
   * The component works in *indices* into this list rather than in multiples of
   * `step`, so an uneven ladder costs it nothing. An evenly stepped dial simply
   * gets its ladder generated here instead of implied.
   */
  const ladder = useMemo(
    () => ladderProp ?? Array.from(
      { length: Math.floor((max - min) / step) + 1 },
      (_, i) => min + i * step,
    ),
    [ladderProp, min, max, step],
  );

  // Nearest rather than exact: a value can arrive from a logged set, a routine's
  // suggestion or an older build, and none of those are obliged to sit on the
  // ladder. Landing on the closest rung beats falling back to index 0.
  const index = useMemo(() => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < ladder.length; i++) {
      const distance = Math.abs(ladder[i] - value);
      if (distance < bestDistance) { best = i; bestDistance = distance; }
    }
    return best;
  }, [ladder, value]);

  const total = ladder.length;

  const values = useMemo(() => {
    const from = Math.max(0, index - WINDOW);
    const to = Math.min(total - 1, index + WINDOW);
    return ladder.slice(from, to + 1);
  }, [ladder, index, total]);

  const show = useCallback(
    (v: number) => (formatValue ? formatValue(v) : v.toFixed(decimals)),
    [formatValue, decimals],
  );

  /** The value at an index, held inside the ladder. */
  const at = useCallback(
    (i: number) => ladder[Math.min(ladder.length - 1, Math.max(0, i))],
    [ladder],
  );

  /** Whatever was typed, moved to the nearest rung the dial actually has. */
  const clampToRange = useCallback((v: number) => {
    const bounded = Math.min(max, Math.max(min, v));
    let best = ladder[0];
    let bestDistance = Infinity;
    for (const candidate of ladder) {
      const distance = Math.abs(candidate - bounded);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
    }
    return best;
  }, [ladder, max, min]);

  // Keep the wheel centred on the value, including when it changes from outside
  // (moving to another set re-seeds it).
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !active) return;
    settling.current = true;
    const top = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
    // `scrollTo` is missing in jsdom and in some older WebViews; assigning
    // `scrollTop` works everywhere and is what the fallback uses.
    if (typeof list.scrollTo === 'function') list.scrollTo({ top });
    else list.scrollTop = top;
    const id = setTimeout(() => { settling.current = false; }, 60);
    return () => clearTimeout(id);
  }, [value, editing]);

  useEffect(() => () => window.clearTimeout(commitTimer.current), []);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (settling.current) return;
    const list = event.currentTarget;
    const centre = list.scrollTop + list.clientHeight / 2;
    let closest: { value: number; distance: number } | null = null;
    for (const child of Array.from(list.children) as HTMLElement[]) {
      const mid = child.offsetTop + child.clientHeight / 2;
      const distance = Math.abs(mid - centre);
      const v = Number(child.dataset.value);
      if (!Number.isFinite(v)) continue;
      if (!closest || distance < closest.distance) closest = { value: v, distance };
    }
    if (!closest || closest.value === value) return;

    // Debounced: mid-flick every frame would otherwise write a different weight,
    // and the centring effect above would fight the momentum scroll doing it.
    const next = closest.value;
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => onChange(next), SETTLE_MS);
  };

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    setEditing(false);
    if (!Number.isFinite(parsed)) return;
    onChange(clampToRange(parsed));
  };

  const nudge = (direction: 1 | -1) => {
    const next = index + direction;
    if (next >= 0 && next < ladder.length) onChange(ladder[next]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const jump = (steps: number) => { e.preventDefault(); onChange(at(index + steps)); };
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
    if (e.key === 'PageUp') jump(10);
    if (e.key === 'PageDown') jump(-10);
    if (e.key === 'Home') { e.preventDefault(); onChange(at(0)); }
    if (e.key === 'End') { e.preventDefault(); onChange(at(ladder.length - 1)); }
  };

  return (
    <div className="at-dial">
      <div className="at-dial-label">{label}</div>

      {editing ? (
        <input
          className="at-dial-input"
          type="text"
          inputMode="decimal"
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label={label}
        />
      ) : (
        <>
          <button
            className="at-dial-value"
            onClick={() => { setDraft(show(value)); setEditing(true); }}
            aria-label={`${label}: ${show(value)}`}
          >
            {show(value)}{suffix && <small>{suffix}</small>}
          </button>

          <div className="at-dial-wheel">
            {/* Frames the centre row, so it is obvious which value is selected. */}
            <div className="at-dial-marker" aria-hidden="true" style={{ height: ROW_PX }} />

            {/* Single-step nudges. A 1.25 kg change should never need a careful flick. */}
            <button
              className="at-dial-nudge"
              onClick={() => nudge(-1)}
              disabled={value <= min}
              aria-label={t('train.decrease', { label })}
            >
              <Minus size={15} />
            </button>

            <div
              className="at-dial-track"
              ref={listRef}
              onScroll={onScroll}
              role="spinbutton"
              tabIndex={0}
              aria-valuenow={value}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-label={label}
              style={{ height: ROW_PX * 3 }}
              onKeyDown={onKeyDown}
            >
              {values.map(v => (
                <span
                  key={v}
                  className="at-dial-tick"
                  data-value={v}
                  data-active={v === value}
                  onClick={() => onChange(v)}
                >
                  {show(v)}
                </span>
              ))}
            </div>

            <button
              className="at-dial-nudge"
              onClick={() => nudge(1)}
              disabled={value >= max}
              aria-label={t('train.increase', { label })}
            >
              <Plus size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
