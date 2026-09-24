import React, { useId, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { SERIES_WEEKS } from '../derive/bodyMetrics';
import { sparkArea, sparkPath } from '../derive/spark';

const CHART_W = 300;
const CHART_PAD = 6;
const WEEK_MS = 7 * 86_400_000;

/**
 * One metric's trend, one point per week.
 *
 * Deliberately not a charting library: this is a sparkline of a dozen points.
 * What it adds over a bare sparkline is a scale — min and max labels and a dot
 * on the latest point — and a reading: touch or drag along it and a guide, a
 * highlighted point and a tooltip say which week and how much. The line draws
 * itself in and the area under it follows.
 */
export const AtlasMetricChart: React.FC<{
  series: number[];
  /** Digits for the min/max labels — matches the metric's own precision. */
  decimals?: number;
  height?: number;
  now?: Date;
  /**
   * Weeks the series spans, for the month labels along the bottom and the
   * tooltip's dates. Body metrics are always drawn over `SERIES_WEEKS`;
   * exercise stats let you pick the window.
   */
  weeks?: number;
}> = ({ series, decimals = 1, height = 90, now = new Date(), weeks = SERIES_WEEKS }) => {
  // `useId` rather than a literal: a fixed id collides the moment two charts render at once.
  const fillId = useId();
  const { t, fmt } = useT();
  const [hover, setHover] = useState<number | null>(null);
  /** Where a press started, so a drag along the chart does not also count as a tap on its card. */
  const downX = useRef<number | null>(null);
  const dragged = useRef(false);

  if (series.length === 0) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const usableHeight = height - CHART_PAD * 2;
  const span = max - min || 1;
  const step = series.length > 1 ? (CHART_W - CHART_PAD * 2) / (series.length - 1) : 0;
  /** Where point `i` sits, in the same terms `sparkPath` draws it. */
  const point = (i: number) => ({
    x: series.length === 1 ? CHART_W - CHART_PAD : CHART_PAD + i * step,
    y: series.length === 1
      ? CHART_PAD + usableHeight / 2
      : CHART_PAD + usableHeight - ((series[i] - min) / span) * usableHeight,
  });
  const last = point(series.length - 1);

  /** The nearest point to a finger at `clientX`. */
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || series.length < 2) return;
    const x = ((e.clientX - r.left) / r.width) * CHART_W;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((x - CHART_PAD) / step))));
  };
  const at = hover != null ? point(hover) : null;
  /** The week a point stands for: the last one is this week. */
  const weekOf = (i: number) => new Date(now.getTime() - (series.length - 1 - i) * WEEK_MS);

  return (
    <>
      <div
        className="at-chart"
        onPointerDown={e => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          downX.current = e.clientX;
          dragged.current = false;
          pick(e);
        }}
        onPointerMove={e => {
          if (hover == null) return;
          if (downX.current != null && Math.abs(e.clientX - downX.current) > 6) dragged.current = true;
          pick(e);
        }}
        onClickCapture={e => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }}
        onPointerUp={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${CHART_W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--ember)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="at-chart-area" d={sparkArea(series, CHART_W, height, CHART_PAD)} fill={`url(#${fillId})`} />
          <path
            className="at-chart-line"
            d={sparkPath(series, CHART_W, height, CHART_PAD)}
            pathLength={1}
            fill="none" stroke="var(--ember)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {at && (
            <line x1={at.x} x2={at.x} y1={0} y2={height} stroke="var(--muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
          {/* Anchors "now" at the right edge, so the line has a head and not just a shape. */}
          <circle cx={last.x} cy={last.y} r="3.5" fill="var(--ember)" vectorEffect="non-scaling-stroke" />
        </svg>
        {at && hover != null && (
          <>
            <span className="at-chart-dot" style={{ left: `${(at.x / CHART_W) * 100}%`, top: at.y }} aria-hidden="true" />
            <span
              className="at-chart-tip"
              role="status"
              style={{ left: `${Math.min(82, Math.max(18, (at.x / CHART_W) * 100))}%` }}
            >
              <b>{fmt.n(series[hover], decimals)}</b>
              <small>{fmt.shortDate(weekOf(hover))}</small>
            </span>
          </>
        )}
      </div>

      <div className="at-chart-axis">
        {[weeks - 1, Math.floor((weeks - 1) / 2), 0].map(weeksAgo => (
          <span key={weeksAgo}>
            {fmt.monthShort(new Date(now.getTime() - weeksAgo * WEEK_MS))}
          </span>
        ))}
      </div>
      {/* A flat series has nothing to bracket — one number twice reads as a bug. */}
      {min !== max && (
        <div className="at-chart-axis">
          <span>{t('body.min')} {fmt.n(min, decimals)}</span>
          <span>{t('body.max')} {fmt.n(max, decimals)}</span>
        </div>
      )}
    </>
  );
};
