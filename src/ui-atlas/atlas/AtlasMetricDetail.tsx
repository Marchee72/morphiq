import React from 'react';
import { Scale } from 'lucide-react';
import { useT } from '../../i18n';
import type { StaticKey } from '../../i18n/types';
import { useAppActions } from '../data/useAppData';
import { isImproving, isMeasured } from '../derive/bodyMetrics';
import type { MetricPointVM } from '../types';
import { AtlasMetricChart } from './AtlasMetricChart';
import { AtlasSheet } from './AtlasSheet';

/**
 * What is behind one body metric.
 *
 * The Body screen was a wall of numbers with nothing behind any of them: no
 * history per metric, no sense of whether a figure was measured or computed.
 * Everything here already existed on `MetricPointVM` and went unread.
 *
 * Mounted from `AtlasBody` on local state rather than through `openOverlay` —
 * the same way `AtlasToday` mounts `AtlasTodayDetail`. The shell's single
 * overlay slot is for things reachable from more than one screen.
 */
export const AtlasMetricDetail: React.FC<{
  metric: MetricPointVM | null;
  latestAt: Date | null;
  onClose: () => void;
}> = ({ metric, latestAt, onClose }) => {
  const { t, fmt } = useT();
  const actions = useAppActions();

  if (!metric) return null;

  const now = new Date();
  const unit = t(metric.unitKey);
  const improving = isImproving(metric);

  const windows: [string, number | null][] = [
    [t('today.change7d'), metric.delta7d],
    [t('today.change30d'), metric.delta30d],
    [t('today.change90d'), metric.delta90d],
  ];

  const series = metric.series;

  return (
    <AtlasSheet
      open
      onClose={onClose}
      title={t(metric.labelKey)}
      subtitle={latestAt ? `${fmt.dmy(latestAt)} · ${fmt.relativeDay(latestAt, now)}` : t('common.noData')}
      footer={
        <button className="at-btn" onClick={() => { onClose(); actions.openOverlay('logWeight'); }}>
          <i><Scale size={16} /></i> {t('body.newReading')}
        </button>
      }
    >
      <div className="at-bignum" style={{ paddingTop: 0 }}>
        <b>
          {fmt.n(metric.value, metric.decimals)}
          {unit && <small> {unit}</small>}
        </b>
        <span
          style={{
            color: improving === null ? undefined : improving ? 'var(--sage)' : 'var(--muted)',
          }}
        >
          {metric.delta30d === null
            ? t('common.noData')
            : t('body.overMonth', { delta: fmt.signed(metric.delta30d, metric.decimals), unit })}
        </span>
      </div>

      {/* Says outright which numbers a scale weighed and which a formula produced.
          Presenting a computed metabolic age as a measurement is worse than
          having no detail sheet at all. */}
      <p className="at-metric-source">
        {isMeasured(metric.key) ? t('body.source.measured') : t('body.source.estimated')}
      </p>

      {series ? (
        <div className="at-card" style={{ padding: '18px 16px 12px' }}>
          <AtlasMetricChart series={series} decimals={metric.decimals} height={140} now={now} />
        </div>
      ) : (
        <p className="at-summary-empty">{t('common.noData')}</p>
      )}

      <div className="at-summary-stats" data-cols="3">
        {windows.map(([label, delta]) => (
          <div key={label}>
            {/* An em-dash, not a zero: no reading in the window is not "no change". */}
            <b>{delta === null ? '—' : fmt.signed(delta, metric.decimals)}{unit && <i>{unit}</i>}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>

      {series && (
        <>
        <p className="at-metric-source">{t('body.range12w')}</p>
        <div className="at-summary-stats" data-cols="3">
          <div>
            <b>{fmt.n(Math.min(...series), metric.decimals)}</b>
            <small>{t('body.min')}</small>
          </div>
          <div>
            <b>{fmt.n(series.reduce((a, b) => a + b, 0) / series.length, metric.decimals)}</b>
            <small>{t('body.avg')}</small>
          </div>
          <div>
            <b>{fmt.n(Math.max(...series), metric.decimals)}</b>
            <small>{t('body.max')}</small>
          </div>
        </div>
        </>
      )}

      <p className="at-metric-about">{t(`body.about.${metric.key}` as StaticKey)}</p>
    </AtlasSheet>
  );
};
