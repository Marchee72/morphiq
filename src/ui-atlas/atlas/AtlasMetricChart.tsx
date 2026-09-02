import React, { useId } from 'react';
import { useT } from '../../i18n';
import { SERIES_WEEKS } from '../derive/bodyMetrics';
import { sparkArea, sparkPath } from '../derive/spark';

const CHART_W = 300;
const CHART_PAD = 6;

/**
 * One metric's 12-week trend.
 *
 * Was inline in the Body screen and drew weight only, which is why nothing else
 * had a chart — every metric has carried a `series` all along.
 *
 * Deliberately not a charting library: `recharts` is in package.json and unused,
 * and this is a sparkline of twelve points. What it adds over a bare sparkline
 * is a scale — min and max labels and a dot on the latest point — because a line
 * with no numbers on it says "something changed" and nothing more.
 */
export const AtlasMetricChart: React.FC<{
  series: number[];
  /** Digits for the min/max labels — matches the metric's own precision. */
  decimals?: number;
  height?: number;
  now?: Date;
  /**
   * Weeks the series spans, for the month labels along the bottom.
   *
   * Body metrics are always drawn over `SERIES_WEEKS`, which is why this was a
   * constant. Exercise stats let you pick the window, and a six-month series
   * labelled as twelve weeks puts every month name in the wrong place.
   */
  weeks?: number;
}> = ({ series, decimals = 1, height = 90, now = new Date(), weeks = SERIES_WEEKS }) => {
  // `useId` rather than a literal: the showcase's `id="atFill"` was
  // document-global and collided the moment two charts rendered at once.
  const fillId = useId();
  const { t, fmt } = useT();

  if (series.length === 0) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);

  // The last point of `sparkPath`, recomputed rather than parsed back out of it.
  // Both the one-point and the multi-point path end at `width - pad`; only the
  // height differs, and a one-point path is drawn down the middle.
  const usableHeight = height - CHART_PAD * 2;
  const span = max - min || 1;
  const lastX = CHART_W - CHART_PAD;
  const lastY = series.length === 1
    ? CHART_PAD + usableHeight / 2
    : CHART_PAD + usableHeight - ((series[series.length - 1] - min) / span) * usableHeight;

  return (
    <>
      <svg viewBox={`0 0 ${CHART_W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--clay)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--clay)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={sparkArea(series, CHART_W, height, CHART_PAD)} fill={`url(#${fillId})`} />
        <path
          d={sparkPath(series, CHART_W, height, CHART_PAD)}
          fill="none" stroke="var(--clay)" strokeWidth="2.5" strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Anchors "now" at the right edge, so the line has a head and not just a shape. */}
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--clay)" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="at-chart-axis">
        {/* Real month labels across the window, not the showcase's fixed May/June/July. */}
        {[weeks - 1, Math.floor((weeks - 1) / 2), 0].map(weeksAgo => (
          <span key={weeksAgo}>
            {fmt.monthShort(new Date(now.getTime() - weeksAgo * 7 * 86_400_000))}
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
