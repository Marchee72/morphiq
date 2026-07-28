import React, { useId } from 'react';
import { Scale } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { metricByKey } from '../derive/bodyMetrics';
import { goalProgress } from '../derive/profile';
import { sparkArea, sparkPath } from '../derive/spark';
import { AtlasStates } from './AtlasStates';

const CHART_W = 300;
const CHART_H = 90;
const CHART_PAD = 6;

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
  const { body, profile, training } = useAppData();
  const actions = useAppActions();
  const { t, fmt } = useT();

  // `useId` rather than a literal: the showcase's `id="atFill"` was
  // document-global and collided the moment two Body screens rendered at once.
  const fillId = useId();
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

  const callouts = (['muscleMass', 'bodyFat', 'bodyWater', 'visceralFat'] as const)
    .map(key => metricByKey(body.metrics, key))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const calloutPositions = [
    { side: 'left', style: { left: 14, top: 40 } },
    { side: 'right', style: { right: 14, top: 40 } },
    { side: 'left', style: { left: 14, top: 128 } },
    { side: 'right', style: { right: 14, top: 128 } },
  ] as const;

  return (
    <>
      <div className="at-greet" style={{ paddingBottom: 4 }}>
        <div>
          <small>
            {body.latestAt ? `${fmt.relativeDay(body.latestAt, now)} · ` : ''}
            {t('body.lastReading', { device: 'Mi Scale 2', n: body.readingCount })}
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

      {series && (
        <>
          <div className="at-rail-head"><h3>{t('body.composition')}</h3><button onClick={() => actions.openOverlay('logWeight')}>{t('today.weight')}</button></div>
          <div className="at-pad" style={{ paddingBottom: 22 }}>
            <div className="at-card" style={{ padding: '18px 16px 12px' }}>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height={CHART_H} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--clay)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--clay)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparkArea(series, CHART_W, CHART_H, CHART_PAD)} fill={`url(#${fillId})`} />
                <path
                  d={sparkPath(series, CHART_W, CHART_H, CHART_PAD)}
                  fill="none" stroke="var(--clay)" strokeWidth="2.5" strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="at-goal-row" style={{ marginTop: 8, fontSize: 11 }}>
                {/* Real month labels across the 12-week window, not the showcase's fixed May/June/July. */}
                {[11, 6, 0].map(weeksAgo => (
                  <span key={weeksAgo}>
                    {fmt.monthShort(new Date(now.getTime() - weeksAgo * 7 * 86_400_000))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="at-rail-head"><h3>{t('body.composition')}</h3></div>
      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {body.metrics.filter(m => m.key !== 'weight' && m.value > 0).map((metric, i) => (
            <div key={metric.key} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
              <span>
                {t(metric.labelKey)}
                <small>
                  {metric.delta30d === null
                    ? t('common.noData')
                    : t('body.overMonth', { delta: fmt.signed(metric.delta30d, metric.decimals), unit: '' })}
                </small>
              </span>
              <b>{fmt.n(metric.value, metric.decimals)}</b>
            </div>
          ))}
        </div>
      </div>

      {training.records.length > 0 && (
        <>
          <div className="at-rail-head"><h3>{t('body.records')}</h3></div>
          <div className="at-pad" style={{ paddingBottom: 22 }}>
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {training.records.slice(0, 4).map((record, i) => (
                <div key={record.exerciseName} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                  <span>{record.exerciseName}<small>{fmt.relativeDay(record.at, now)}</small></span>
                  <b>{fmt.kgReps(record.weightKg, record.reps)}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};
