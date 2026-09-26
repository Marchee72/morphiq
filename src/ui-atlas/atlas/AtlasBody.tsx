import React, { useState } from 'react';
import { Check, ChevronRight, Clock, ExternalLink, Lock, Plus, RefreshCw, Scale, Watch } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { BodyComposition } from '../../data/health/BodyCompositionPlugin';
import { useAppData, useAppActions } from '../data/useAppData';
import { useHealthSync } from '../data/useHealthSync';
import { isImproving, metricByKey, metricColor } from '../derive/bodyMetrics';
import { syncStrip } from '../derive/syncStrip';
import { goalProgress } from '../derive/profile';
import { AtlasSegment } from './AtlasField';
import { RollingNumber } from '../kit/rolling-number';
import type { MetricKey, MetricPointVM } from '../types';
import { AtlasMetricChart } from './AtlasMetricChart';
import { AtlasMetricDetail } from './AtlasMetricDetail';
import { AtlasSkeleton, AtlasStates } from './AtlasStates';

/**
 * The lanes of the trend chart, top to bottom, all in kg. Each gets its own
 * scale: on one shared axis, 78 kg of weight, 34 of muscle and 14 of fat would
 * be three flat lines and half a kilo of change would not show.
 *
 * Skeletal muscle comes only from Samsung Health; without it the muscle lane
 * falls back to the muscle mass every scale reading carries.
 */
const LANES: MetricKey[][] = [['weight'], ['skeletalMuscle', 'muscleMass'], ['fatMass']];

/** Shown in the hero; the "more" list holds everything else. */
const IN_HERO = new Set<MetricKey>(['weight', 'fatMass', 'skeletalMuscle', 'muscleMass']);

const SyncStrip: React.FC = () => {
  const { body } = useAppData();
  const actions = useAppActions();
  const { t, fmt } = useT();
  const { status, checkedAt } = useStore(s => s.healthSync);
  const { sync } = useHealthSync();

  const strip = syncStrip(body.readingTimes, status, checkedAt);
  if (!strip) return null;
  const when = (d: Date) => `${fmt.weekdayShort(d)} ${fmt.shortDate(d)}, ${fmt.clock(d)}`;

  switch (strip.kind) {
    case 'syncing':
      return (
        <div className="at-sync" role="status">
          <RefreshCw size={16} className="at-spin" /> <span>{t('body.sync.searching')}</span>
        </div>
      );
    case 'denied':
      return (
        <div className="at-sync">
          <Lock size={16} /> <span>{t('body.sync.denied')}</span>
          <button className="at-sync-action" onClick={() => void sync()}>{t('body.sync.grant')}</button>
        </div>
      );
    case 'fresh':
      return (
        <div className="at-sync" data-tone="good">
          <Check size={16} /> <span>{t('body.sync.last', { when: when(strip.at) })}</span>
        </div>
      );
    case 'last':
      return (
        <div className="at-sync">
          <Clock size={16} /> <span>{t('body.sync.last', { when: when(strip.at) })}</span>
        </div>
      );
    case 'waiting':
      return (
        <div className="at-card at-sync-wait">
          <div className="at-sync-wait-head">
            <span className="at-sync-wait-icon"><Watch size={20} /></span>
            <div>
              <b>{t('body.sync.waitingTitle')}</b>
              <p>{t('body.sync.waitingBody', { when: when(strip.lastAt) })}</p>
            </div>
          </div>
          <div className="at-sync-wait-actions">
            <button className="at-btn" onClick={() => void BodyComposition.openSamsungHealth()}>
              {t('body.sync.openSamsung')} <ExternalLink size={15} />
            </button>
            <button className="at-btn" data-ghost="true" onClick={() => void sync()} aria-label={t('body.sync.retry')}>
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="at-sync-wait-foot">
            <span>{strip.checkedAt ? t('body.sync.checked', { time: fmt.clock(strip.checkedAt) }) : ''}</span>
            <button onClick={() => actions.openOverlay('logWeight')}>{t('body.sync.manual')}</button>
          </div>
        </div>
      );
  }
};

export const AtlasBody: React.FC = () => {
  const { body, profile } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();
  const measurementsLoaded = useStore(s => s.measurementsLoaded);

  const [detail, setDetail] = useState<MetricPointVM | null>(null);
  const [showMore, setShowMore] = useState(false);
  /**
   * How far back the trend charts look. The series are weekly, so the honest
   * windows are a month (five points) and the whole three months — a week
   * would be two points and a line between them.
   */
  const [range, setRange] = useState<'1m' | '3m'>('3m');
  const windowed = (values: number[]) => (range === '1m' ? values.slice(-5) : values);
  const now = new Date();

  const weight = metricByKey(body.metrics, 'weight');
  const series = weight?.series ?? null;

  const newReading = (
    <button className="at-avatar" style={{ background: 'var(--clay)' }} onClick={() => actions.openOverlay('logWeight')} aria-label={t('body.newReading')}>
      <Plus size={20} />
    </button>
  );

  // Still on its way is not the same as none: saying "no readings yet" to
  // someone with a year of them, for as long as the network takes, is wrong.
  if (!body.hasData && !measurementsLoaded) {
    return (
      <>
        <div className="at-greet" style={{ paddingBottom: 4 }}>
          <div><h1>{t('body.title')}</h1></div>
        </div>
        <span className="at-syncing-pill" role="status">
          <RefreshCw size={13} className="at-spin" /> {t('body.loading')}
        </span>
        <AtlasSkeleton shape="body" />
      </>
    );
  }

  if (!body.hasData || !weight) {
    return (
      <>
        <div className="at-greet" style={{ paddingBottom: 4 }}>
          <div><h1>{t('body.title')}</h1></div>
          {newReading}
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

  const lanes = LANES
    .map(keys => keys.map(k => metricByKey(body.metrics, k)).find(m => m?.series))
    .filter((m): m is MetricPointVM => Boolean(m));

  const c = body.composition;
  const parts = c && [
    { label: t('body.metric.fatMass'), kg: c.fat, color: metricColor('fatMass') },
    { label: t(`body.metric.${c.muscleKey}`), kg: c.muscle, color: metricColor(c.muscleKey) },
    { label: t('body.part.rest'), kg: c.rest, color: 'var(--hair)' },
  ];

  const more = body.metrics.filter(m => !IN_HERO.has(m.key) && m.value > 0);

  return (
    <>
      <div className="at-greet" style={{ paddingBottom: 4 }}>
        <div>
          <small>{tp('body.readings', body.readingCount)}</small>
          <h1>{t('body.title')}</h1>
        </div>
        {newReading}
      </div>

      <div className="at-pad" style={{ display: 'grid', gap: 14, paddingBottom: 22 }}>
        <SyncStrip />

        <div className="at-card at-body-hero">
          <div className="at-body-hero-head">
            <div>
              <span className="at-field-label">{t('body.metric.weight')}</span>
              <b className="at-body-weight"><RollingNumber value={weight.value} decimals={1} /><small> {t('unit.kg')}</small></b>
            </div>
            {/* Lime when the month moved the way the goal wants, tonal otherwise. */}
            <span className="at-delta-chip" data-good={isImproving(weight) === true}>
              {weight.delta30d === null
                ? t('common.noData')
                : t('body.overMonth', { delta: fmt.signed(weight.delta30d), unit: t('unit.kg') })}
            </span>
          </div>

          {lanes.length > 0 && (
            <>
              <AtlasSegment
                label={t('body.range')}
                options={[{ value: '1m', label: t('body.range1m') }, { value: '3m', label: t('body.range3m') }]}
                value={range}
                onChange={setRange}
              />
              <div className="at-lanes">
                {lanes.map(metric => (
                  <button key={metric.key} className="at-lane" onClick={() => setDetail(metric)}>
                    <span className="at-lane-head">
                      <b>{t(metric.labelKey)} · {fmt.n(metric.value, metric.decimals)} {t(metric.unitKey)}</b>
                      {metric.delta90d !== null && (
                        <span data-good={metric.lowerIsBetter ? metric.delta90d < 0 : metric.delta90d > 0}>
                          {fmt.signed(metric.delta90d, metric.decimals)}
                        </span>
                      )}
                    </span>
                    <AtlasMetricChart
                      series={windowed(metric.series!)}
                      decimals={metric.decimals}
                      now={now}
                      height={52}
                      color={metricColor(metric.key)}
                      axis={false}
                    />
                  </button>
                ))}
                <div className="at-chart-axis">
                  {[windowed(series ?? []).length - 1, Math.floor((windowed(series ?? []).length - 1) / 2), 0].map(weeksAgo => (
                    <span key={weeksAgo}>{fmt.monthShort(new Date(now.getTime() - weeksAgo * 7 * 86_400_000))}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {profile.targetWeightKg !== null && progress !== null && (
            <div>
              <div className="at-goal-track"><div className="at-goal-fill" style={{ width: `${progress}%` }} /></div>
              <div className="at-goal-row" style={{ marginTop: 8 }}>
                <span>{t('body.progressPct', { n: progress })}</span>
                <span>{toGo !== null && t('body.toGo', { n: fmt.n(Math.abs(toGo), 1) })}</span>
              </div>
            </div>
          )}

          {c && parts && (
            <div className="at-makeup">
              <b>{t('body.madeOf', { kg: fmt.n(c.weight, 1) })}</b>
              <div className="at-makeup-bar" aria-hidden="true">
                {parts.map(p => <span key={p.label} style={{ flexGrow: p.kg, background: p.color }} />)}
              </div>
              <div className="at-makeup-legend">
                {parts.map(p => (
                  <div key={p.label}>
                    <span><i style={{ background: p.color }} />{p.label}</span>
                    <b>{fmt.kg(p.kg)} <small>{fmt.n((p.kg / c.weight) * 100, 0)} %</small></b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {more.length > 0 && (
          <>
            <button className="at-btn at-body-more" data-ghost="true" onClick={() => setShowMore(v => !v)} aria-expanded={showMore}>
              <span>{t('body.more')}</span>
              <ChevronRight size={18} style={{ transform: showMore ? 'rotate(90deg)' : undefined }} />
            </button>
            {showMore && (
              <div className="at-card" style={{ padding: '8px 20px' }}>
                {more.map((metric, i) => (
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
            )}
          </>
        )}

        <div className="at-rail-head" style={{ padding: '6px 0 0' }}><h3>{t('body.recent')}</h3></div>
        <div className="at-card" style={{ padding: '4px 20px' }}>
          {body.recent.map((r, i) => (
            <div key={r.at.getTime()} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
              <span className="at-body-when">
                {fmt.relativeDay(r.at, now)} · {fmt.clock(r.at)}
                <small>{r.bodyFat > 0 ? t('body.fatPct', { n: fmt.n(r.bodyFat, 1) }) : t('body.weightOnly')}</small>
              </span>
              <b>{fmt.kg(r.weight)}</b>
            </div>
          ))}
        </div>
      </div>

      <AtlasMetricDetail metric={detail} latestAt={body.latestAt} onClose={() => setDetail(null)} />
    </>
  );
};
