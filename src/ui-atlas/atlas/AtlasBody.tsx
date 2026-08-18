import React, { useState } from 'react';
import { Scale } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { metricByKey } from '../derive/bodyMetrics';
import { goalProgress } from '../derive/profile';
import type { MetricPointVM } from '../types';
import { AtlasMetricChart } from './AtlasMetricChart';
import { AtlasMetricDetail } from './AtlasMetricDetail';
import { AtlasStates } from './AtlasStates';

/** The metrics that get a chart on the tab itself. The rest are a tap away. */
const CHARTED = ['weight', 'bodyFat', 'muscleMass'] as const;

/** The annotated figure. Non-interactive — the tappable map lives on Library. */
const BodyFigure: React.FC = () => (
  <svg viewBox="0 0 120 186" width="112" height="176" aria-hidden="true">
    <circle cx="60" cy="16" r="13" fill="var(--at-figure-skin)" />
    <rect x="54" y="27" width="12" height="9" rx="4" fill="var(--at-figure-skin)" />
    <ellipse cx="33" cy="46" rx="13" ry="9" fill="var(--at-figure-limb)" />
    <ellipse cx="87" cy="46" rx="13" ry="9" fill="var(--at-figure-limb)" />
    <rect x="40" y="37" width="40" height="27" rx="11" fill="var(--clay)" opacity="0.85" />
    <rect x="21" y="54" width="13" height="52" rx="6.5" fill="var(--at-figure-limb)" />
    <rect x="86" y="54" width="13" height="52" rx="6.5" fill="var(--at-figure-limb)" />
    <rect x="44" y="67" width="32" height="31" rx="9" fill="var(--at-figure-core)" />
    <rect x="43" y="102" width="16" height="74" rx="8" fill="var(--at-figure-limb)" />
    <rect x="61" y="102" width="16" height="74" rx="8" fill="var(--at-figure-limb)" />
  </svg>
);

export const AtlasBody: React.FC = () => {
  const { body, profile } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const [detail, setDetail] = useState<MetricPointVM | null>(null);
  const now = new Date();

  const weight = metricByKey(body.metrics, 'weight');
  const series = weight?.series ?? null;

  if (!body.hasData || !weight) {
    return (
      <>
        <div className="at-greet" style={{ paddingBottom: 4 }}>
          <div><h1>{t('body.title')}</h1></div>
          <button className="at-avatar" style={{ background: 'var(--clay)' }} onClick={() => actions.openOverlay('logWeight')}>
            <Scale size={18} />
          </button>
        </div>
        <AtlasStates
          icon={<Scale size={22} />}
          title={t('body.empty')}
          body={t('body.emptySub')}
          action={{ label: t('body.newReading'), onClick: () => actions.openOverlay('logWeight') }}
        />
      </>
    );
  }

  const toGo = profile.targetWeightKg === null ? null : +(weight.value - profile.targetWeightKg).toFixed(1);
  const progress = goalProgress(series?.[0] ?? null, weight.value, profile.targetWeightKg);

  // BMI took visceral fat's place here: the layout below places four, and BMI
  // is a figure that means something. Visceral fat was weight rescaled.
  const callouts = (['muscleMass', 'bodyFat', 'bodyWater', 'bmi'] as const)
    .map(key => metricByKey(body.metrics, key))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const calloutPositions = [
    { side: 'left', style: { left: 14, top: 40 } },
    { side: 'right', style: { right: 14, top: 40 } },
    { side: 'left', style: { left: 14, top: 128 } },
    { side: 'right', style: { right: 14, top: 128 } },
  ] as const;

  const charts = CHARTED
    .map(key => metricByKey(body.metrics, key))
    .filter((m): m is MetricPointVM => Boolean(m?.series));

  return (
    <>
      <div className="at-greet" style={{ paddingBottom: 4 }}>
        <div>
          {/* The date, not a device name: the source is not stored per reading,
              and the hardcoded "Mi Scale 2" was a lie for every manual weigh-in. */}
          <small>
            {body.latestAt ? `${t('body.lastUpdated')} ${fmt.dmy(body.latestAt)} · ` : ''}
            {tp('body.readings', body.readingCount)}
          </small>
          <h1>{t('body.title')}</h1>
        </div>
        <button className="at-avatar" style={{ background: 'var(--clay)' }} onClick={() => actions.openOverlay('logWeight')} aria-label={t('body.newReading')}>
          <Scale size={18} />
        </button>
      </div>

      <div className="at-bignum">
        <b>{fmt.n(weight.value, 1)}<small> {t('unit.kg')}</small></b>
        <span>
          {weight.delta30d === null
            ? t('common.noData')
            : t('body.overMonth', { delta: fmt.signed(weight.delta30d), unit: t('unit.kg') })}
        </span>
      </div>

      <div className="at-figure-wrap">
        {callouts.map((metric, i) => (
          <div
            key={metric.key}
            className="at-callout"
            data-side={calloutPositions[i].side === 'left' ? 'left' : undefined}
            style={calloutPositions[i].style}
          >
            <b>{fmt.n(metric.value, metric.decimals)}{metric.unitKey === 'unit.pct' ? '%' : metric.unitKey === 'unit.kg' ? ' kg' : ''}</b>
            <span>{t(metric.labelKey)}</span>
          </div>
        ))}
        <BodyFigure />
      </div>

      {profile.targetWeightKg !== null && progress !== null && (
        <div className="at-goal">
          <div className="at-card">
            <div className="at-goal-row">
              <b>{t('today.weight')}</b>
              <span>{fmt.n(profile.targetWeightKg, 1)} {t('unit.kg')}</span>
            </div>
            <div className="at-goal-track"><div className="at-goal-fill" style={{ width: `${progress}%` }} /></div>
            <div className="at-goal-row" style={{ marginTop: 10 }}>
              <span>{t('body.progressPct', { n: progress })}</span>
              <span>{toGo !== null && t('body.toGo', { n: fmt.n(Math.abs(toGo), 1) })}</span>
            </div>
          </div>
        </div>
      )}

      {charts.length > 0 && (
        <>
          <div className="at-rail-head"><h3>{t('body.trends')}</h3><button onClick={() => actions.openOverlay('logWeight')}>{t('body.newReading')}</button></div>
          <div className="at-pad" style={{ paddingBottom: 22, display: 'grid', gap: 12 }}>
            {charts.map(metric => (
              <button
                key={metric.key}
                className="at-card at-trend-card"
                onClick={() => setDetail(metric)}
              >
                <div className="at-goal-row">
                  <b>{t(metric.labelKey)}</b>
                  <span>
                    {fmt.n(metric.value, metric.decimals)} {t(metric.unitKey)}
                    {metric.delta30d !== null && ` · ${fmt.signed(metric.delta30d, metric.decimals)}`}
                  </span>
                </div>
                <AtlasMetricChart series={metric.series!} decimals={metric.decimals} now={now} />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="at-rail-head"><h3>{t('body.composition')}</h3></div>
      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {body.metrics.filter(m => m.key !== 'weight' && m.value > 0).map((metric, i) => (
            <button
              key={metric.key}
              className="at-routine-item"
              style={{ borderTop: i === 0 ? 'none' : undefined }}
              onClick={() => setDetail(metric)}
            >
              <span>
                {t(metric.labelKey)}
                <small>
                  {metric.delta30d === null
                    ? t('common.noData')
                    : t('body.overMonth', { delta: fmt.signed(metric.delta30d, metric.decimals), unit: '' })}
                </small>
              </span>
              <b>{fmt.n(metric.value, metric.decimals)} {t(metric.unitKey)}</b>
            </button>
          ))}
        </div>
      </div>

      <AtlasMetricDetail metric={detail} latestAt={body.latestAt} onClose={() => setDetail(null)} />
    </>
  );
};
