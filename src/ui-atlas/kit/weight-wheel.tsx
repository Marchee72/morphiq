import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useT } from '../../i18n';
import { snapWeight } from '../derive/weightLadder';
import { PLATE_KG, stepPlate, toPlate, zoneOf, type WheelZone } from '../derive/plates';
import { cn } from './cn';

/** Degrees of wheel per kilo: ±25 kg fills the visible half-circle. */
const DEG_PER_KG = 3.6;
/** Pixels of horizontal drag per plate. */
const PX_PER_PLATE = 12;
/** Ticks drawn either side of the value; a little past the visible ±25 kg so a spin never shows an edge. */
const WINDOW_KG = 30;
/** The wheel's centre in viewBox units; the viewBox starts 14 above the ticks to fit the selector. */
const CX = 150;
const CY = 128;
const TOP = -14;

const ZONE_COLOUR: Record<WheelZone, string> = {
  warmup: 'var(--muted)',
  volume: 'var(--amber)',
  strength: 'var(--coral)',
  heavy: 'var(--ember)',
  record: 'var(--lime)',
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number) => ({
  x: (CX + r * Math.cos(rad(deg))).toFixed(1),
  y: (CY + r * Math.sin(rad(deg))).toFixed(1),
});

/**
 * The weight picker: a wheel that turns under a selector fixed on top.
 *
 * One tick per 2,5 kg plate, numbers every 10 kg standing radially like a real
 * dial, ±25 kg in view. Drag sideways and the ticks follow the finger; tap a
 * tick to go straight to it; −/+ and the arrow keys move a plate at a time.
 * With a best e1RM the ticks up to the weight take the colour of its intensity
 * zone and a lime tick marks the 1RM — it slides past on the way to a record,
 * with no stop and no change of mode.
 *
 * Tapping the number opens exact entry, for the 1,25 and fixed-dumbbell weights
 * the plate grid does not reach (`snapWeight`).
 */
export function WeightWheel({ label, value, onChange, best, max = 300 }: {
  label: string;
  value: number;
  onChange: (kg: number) => void;
  /** Best e1RM for this lift; without one there are no zones and no 1RM tick. */
  best?: number | null;
  max?: number;
}) {
  const { t, fmt } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; w: number; k: number; left: number; top: number; moved: boolean } | null>(null);

  const hasBest = best != null && best > 0;
  const zone = hasBest ? zoneOf(value, best) : null;
  const clamp = (kg: number) => Math.min(max, Math.max(0, kg));
  const set = (kg: number) => { const next = clamp(kg); if (next !== value) onChange(next); };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: value, k: 300 / (r.width || 300), left: r.left, top: r.top, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) * d.k;
    if (Math.abs(dx) > 4) d.moved = true;
    if (!d.moved) return;
    // The ticks follow the finger: dragging left brings heavier plates in from the right.
    set(toPlate(d.w - Math.round(dx / PX_PER_PLATE) * PLATE_KG));
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.moved) return;
    // A tap: the tick's angle from the top is the difference in kilos.
    const x = (e.clientX - d.left) * d.k - CX;
    const y = (e.clientY - d.top) * d.k + TOP - CY;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI;
    if (Math.abs(deg) > 95) return;
    set(toPlate(d.w + deg / DEG_PER_KG));
  };
  const onPointerCancel = () => { drag.current = null; setDragging(false); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
    if (e.key === 'Home') { e.preventDefault(); set(0); return; }
    const n = moves[e.key];
    if (!n) return;
    e.preventDefault();
    let next = value;
    for (let i = 0; i < Math.abs(n); i++) next = stepPlate(next, n > 0 ? 1 : -1);
    set(next);
  };

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed)) set(snapWeight(parsed));
  };

  // Ticks sit at fixed angles in their group (the weight on top); turning the
  // group by −value × 3,6° brings the chosen plate under the selector, and a
  // CSS transition makes that a spin rather than a jump.
  const ticks = [];
  const from = Math.max(0, Math.floor((value - WINDOW_KG) / PLATE_KG));
  const to = Math.min(Math.floor(max / PLATE_KG), Math.ceil((value + WINDOW_KG) / PLATE_KG));
  for (let i = from; i <= to; i++) {
    const kg = i * PLATE_KG;
    const deg = 270 + kg * DEG_PER_KG;
    const big = kg % 10 === 0;
    const lit = kg <= value;
    const a = polar(deg, 118);
    const b = polar(deg, big ? 100 : 108);
    const colour = !lit ? 'var(--hair)' : hasBest ? ZONE_COLOUR[zoneOf(kg, best)] : 'var(--ember)';
    ticks.push(
      <line key={kg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colour} strokeWidth={big ? 3 : 2} strokeLinecap="round" />,
    );
    if (big) {
      const l = polar(deg, 89);
      ticks.push(
        <text key={`l${kg}`} x={l.x} y={l.y} transform={`rotate(${(deg - 270).toFixed(1)} ${l.x} ${l.y})`} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="var(--muted)">
          {kg}
        </text>,
      );
    }
  }
  if (hasBest && Math.abs(best - value) <= WINDOW_KG) {
    const deg = 270 + best * DEG_PER_KG;
    const a = polar(deg, 122);
    const b = polar(deg, 94);
    const l = polar(deg, 82);
    ticks.push(
      <line key="rm" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--lime)" strokeWidth={3.5} strokeLinecap="round" />,
      <text key="rml" x={l.x} y={l.y} transform={`rotate(${(deg - 270).toFixed(1)} ${l.x} ${l.y})`} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="800" fill="var(--sage)">
        1RM
      </text>,
    );
  }

  const show = (kg: number) => fmt.upTo(kg, 3);
  const pct = hasBest ? `${Math.round((value / best) * 100)}%` : null;
  const zoneLabel = zone === 'record' ? t('wheel.record', { kg: fmt.upTo(value - (best ?? 0), 1) }) : zone ? t(`wheel.${zone}`) : null;
  const selector = zone === 'record' ? 'var(--lime)' : 'var(--ember)';
  const round = 'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-[image:var(--d-tonal)] text-[var(--cocoa)] shadow-[var(--d-soft)] disabled:opacity-40';

  return (
    <div className="flex flex-col items-center">
      <svg
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(Math.max(best ?? 0, value) + 25)}
        aria-valuenow={value}
        aria-valuetext={t('wheel.valueText', { weight: show(value), detail: [pct && t('wheel.ofMax', { pct }), zoneLabel].filter(Boolean).join(', ') || t('unit.kg') })}
        width="300"
        height="134"
        viewBox={`0 ${TOP} 300 134`}
        className="max-w-full cursor-ew-resize touch-none outline-none focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--ember)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        <g
          data-testid="wheel-ticks"
          className="motion-reduce:!transition-none"
          style={{
            transform: `rotate(${(-value * DEG_PER_KG).toFixed(1)}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: dragging ? 'transform .1s linear' : 'transform .45s cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          {ticks}
        </g>
        <circle cx={CX} cy={4} r={dragging ? 14 : 0} fill={selector} fillOpacity={0.22} style={{ transition: 'r .2s ease' }} />
        <path d={`M${CX} 9 L${CX - 8} -3 L${CX + 8} -3 Z`} fill={selector} stroke="var(--card)" strokeWidth={2} strokeLinejoin="round" />
      </svg>

      <div className="-mt-[58px] flex min-w-[130px] flex-col items-center">
        {editing ? (
          <input
            className="at-dial-input"
            type="text"
            inputMode="decimal"
            autoFocus
            value={draft}
            aria-label={label}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="cursor-text border-0 bg-transparent p-0 text-[52px] leading-none font-extrabold tabular-nums text-[var(--cocoa)]"
            aria-label={`${label}: ${show(value)} ${t('unit.kg')}`}
            onClick={() => { setDraft(show(value)); setEditing(true); }}
          >
            {show(value)}
          </button>
        )}
        <span className="text-[13px] font-semibold text-[var(--muted)]">
          {t('unit.kg')}
          {pct && <> · <b className="text-[var(--clay)]">{t('wheel.ofMax', { pct })}</b></>}
        </span>
      </div>

      <div className="mt-2 flex w-full items-center justify-between">
        <button type="button" className={round} aria-label={t('train.decrease', { label })} disabled={value <= 0} onClick={() => set(stepPlate(value, -1))}>
          <Minus size={20} />
        </button>
        {zoneLabel ? (
          <span
            className={cn('rounded-full px-3 py-1.5 text-[13px] font-extrabold transition-colors duration-300',
              zone === 'record' ? 'bg-[var(--lime)] text-[var(--lime-ink)]' : 'bg-[var(--at-tonal)] text-[var(--clay)]')}
          >
            {zoneLabel}
          </span>
        ) : <span />}
        <button type="button" className={round} aria-label={t('train.increase', { label })} disabled={value >= max} onClick={() => set(stepPlate(value, 1))}>
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
