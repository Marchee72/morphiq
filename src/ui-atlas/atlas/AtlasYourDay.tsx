import React from 'react';
import {
  Bike, ChevronRight, Droplet, Dumbbell, Flame, Footprints, Moon, Plus, Timer, Zap,
} from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { isImproving, metricByKey } from '../derive/bodyMetrics';
import { sparkPath } from '../derive/spark';
import { RollingNumber } from '../kit/rolling-number';
import type { TodayDetail } from './AtlasTodayDetail';

/** Each ring's colour, kept everywhere that number appears. */
// Sleep is blue throughout, darkest for the deepest stage; energy is sage.
const TINT = {
  steps: '#FF6A2B', active: '#FFB020', kcal: '#FF8A5B', ready: '#7FB63A',
  deep: '#1E3A8A', rem: '#3B82F6', light: '#93C5FD', sleep: '#3B82F6', energy: 'var(--sage)',
};
/**
 * What each ring fills against. Not the weekly steps average: it includes today,
 * so a ring against it would always read close to full.
 */
const GOAL = { steps: 8000, activeMin: 60, activeKcal: 500 };

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Steps, active time and active calories as concentric rings — the three
 * Samsung Health counts its day by. A ring with no reading stays empty; its
 * number reads as a dash, never a zero, because "no reading" is not "no move".
 */
const Rings: React.FC<{ rings: { key: string; tint: string; pct: number }[] }> = ({ rings }) => {
  const radii = [52, 38, 24];
  return (
    <svg className="at-rings" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      {rings.map((ring, i) => {
        const r = radii[i];
        const c = 2 * Math.PI * r;
        return (
          <g key={ring.key}>
            <circle cx="60" cy="60" r={r} style={{ stroke: `color-mix(in srgb, ${ring.tint} 18%, transparent)` }} />
            <circle
              cx="60" cy="60" r={r}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ring.pct)))}
              transform="rotate(-90 60 60)"
              style={{ stroke: ring.tint, animationDelay: `${200 + i * 150}ms`, ['--c' as string]: c }}
            />
          </g>
        );
      })}
    </svg>
  );
};

/** A full ring with the score inside it, for Samsung's Energy Score. */
export const ScoreRing: React.FC<{ score: number; tint: string; size?: number; label: string }> = ({ score, tint, size = 72, label }) => (
  <svg className="at-score-ring" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
    <circle cx="50" cy="50" r="42" style={{ stroke: `color-mix(in srgb, ${tint} 20%, transparent)` }} />
    <circle
      cx="50" cy="50" r="42" transform="rotate(-90 50 50)"
      strokeDasharray="263.9"
      strokeDashoffset={263.9 * (1 - Math.min(1, Math.max(0, score / 100)))}
      style={{ stroke: tint }}
    />
    <text x="50" y="50" dominantBaseline="central" textAnchor="middle">{Math.round(score)}</text>
  </svg>
);

/** A half-circle meter, for a score out of 100. */
const Gauge: React.FC<{ pct: number; tint: string }> = ({ pct, tint }) => (
  <svg className="at-panel-gauge" width="54" height="32" viewBox="0 0 100 60" aria-hidden="true">
    <path d="M10 52 A40 40 0 0 1 90 52" style={{ stroke: `color-mix(in srgb, ${tint} 20%, transparent)` }} />
    <path
      d="M10 52 A40 40 0 0 1 90 52"
      strokeDasharray="125.7"
      strokeDashoffset={125.7 * (1 - Math.min(1, Math.max(0, pct)))}
      style={{ stroke: tint }}
    />
  </svg>
);

/** The cell's caption: a small coloured icon and a label in capitals. */
const Head: React.FC<{ icon: React.ReactNode; tint: string; children: React.ReactNode }> = ({ icon, tint, children }) => (
  <span className="at-panel-head"><span style={{ color: tint }}>{icon}</span>{children}</span>
);

/**
 * "Your day": the activity rings, the weight strip, and one panel holding the
 * rest — the day's activities, readiness, the week's volume, the streak, body
 * fat and last night's sleep. Everything in it arrives on its own (the phone,
 * the watch, the scale, the sessions); nothing waits on a target nobody set. The panel is one card split into cells rather than a tile per
 * number; each cell's colour is in its drawing, not its background.
 */
export const AtlasYourDay: React.FC<{
  now: Date;
  onDetail: (detail: TodayDetail) => void;
  onSession: (id: string) => void;
}> = ({ now, onDetail, onSession }) => {
  const { body, training, steps, wellness } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const weight = metricByKey(body.metrics, 'weight');
  const hasWeight = body.hasData && weight?.value != null;
  const bodyFat = metricByKey(body.metrics, 'bodyFat');
  // A scale without impedance writes 0 rather than nothing: not a reading.
  const hasBodyFat = bodyFat?.value != null && bodyFat.value > 0;

  const activeMin = training.today.minutes;
  const stepsGoal = GOAL.steps;
  const rings = [
    {
      key: 'steps', tint: TINT.steps, icon: <Footprints size={15} />,
      pct: (steps.today ?? 0) / stepsGoal,
      label: t('today.steps'), value: steps.today, unit: `/ ${fmt.n(stepsGoal)}`,
      sub: steps.weeklyAvg != null ? t('today.stepsAvg', { n: fmt.n(steps.weeklyAvg) }) : null,
      onClick: () => onDetail({ kind: 'steps' }), ariaLabel: t('today.stepsDetail'),
    },
    {
      key: 'active', tint: TINT.active, icon: <Timer size={15} />,
      pct: activeMin / GOAL.activeMin,
      label: t('today.activeTime'), value: activeMin, unit: `/ ${GOAL.activeMin} min`,
      sub: t('today.activeTimeSub'),
      onClick: () => onDetail({ kind: 'day', date: now }), ariaLabel: undefined,
    },
    {
      key: 'kcal', tint: TINT.kcal, icon: <Flame size={15} />,
      pct: (steps.activeKcal ?? 0) / GOAL.activeKcal,
      label: t('today.activeKcal'), value: steps.activeKcal, unit: `/ ${GOAL.activeKcal} ${t('unit.kcal')}`,
      sub: t('today.activeKcalSub'),
      onClick: () => onDetail({ kind: 'day', date: now }), ariaLabel: undefined,
    },
  ];

  // The week's tonnage per day, Monday first, for the volume cell's bars.
  const week = training.streak.week;
  const perDay = week.map(day => training.history
    .filter(entry => sameDay(entry.at, day.date))
    .reduce((total, entry) => total + entry.volumeKg, 0));
  const maxDay = Math.max(1, ...perDay);

  const log = wellness.today.log;
  // Samsung's Energy Score, as it comes — nothing of ours mixed in.
  const energy = wellness.today.energy;

  // Last night, as Samsung Health splits it. Light is what the stages leave.
  const sleep = log?.sleepMinutes ?? 0;
  const deep = Math.min(sleep, log?.sleepDeepMinutes ?? 0);
  const rem = Math.min(sleep - deep, log?.sleepRemMinutes ?? 0);
  const stages = sleep > 0 && deep + rem > 0
    ? [
        { key: 'deep', label: t('wellness.deep'), min: deep, tint: TINT.deep },
        { key: 'rem', label: t('wellness.rem'), min: rem, tint: TINT.rem },
        { key: 'light', label: t('wellness.light'), min: sleep - deep - rem, tint: TINT.light },
      ]
    : [];
  const hm = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;

  return (
    <>
      <div className="at-rail-head">
        <h3>{t('today.yourDay')}</h3>
        {/* The day sheet covers everything below. */}
        <button onClick={() => onDetail({ kind: 'day', date: now })}>{t('common.seeAll')}</button>
      </div>

      <div className="at-moments">
        <div className="at-rings-card at-enter">
          <Rings rings={rings} />
          <div className="at-rings-legend">
            {rings.map(r => (
              <button key={r.key} onClick={r.onClick} aria-label={r.ariaLabel}>
                <i style={{ background: `color-mix(in srgb, ${r.tint} 20%, transparent)`, color: r.tint }} aria-hidden="true">{r.icon}</i>
                <span>
                  <small>{r.label}</small>
                  <b>
                    {r.value != null ? <RollingNumber value={r.value} decimals={0} /> : '—'}
                    <em> {r.unit}</em>
                  </b>
                  {r.sub && <small className="at-rings-sub">{r.sub}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {hasWeight ? (
          <button className="at-weightstrip at-enter" onClick={() => onDetail({ kind: 'weight' })} style={{ animationDelay: '80ms' }}>
            <span className="at-weightstrip-num">
              <small>{t('today.weight')}</small>
              <b>
                <RollingNumber value={weight!.value!} decimals={1} />
                <em> {t('unit.kg')}</em>
              </b>
            </span>
            {weight!.series && weight!.series.length > 1 && (
              <svg className="at-moment-spark" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
                <path d={sparkPath(weight!.series.slice(-8), 120, 24, 3)} />
              </svg>
            )}
            {weight!.delta30d != null && (
              <span className="at-delta-chip" data-good={weight!.delta30d !== 0 && isImproving(weight!) === true}>
                {fmt.signed(weight!.delta30d)} {t('unit.kg')}
              </span>
            )}
          </button>
        ) : (
          // No weigh-in yet: the strip is where the first one goes.
          <button className="at-weightstrip at-enter" onClick={() => actions.openOverlay('logWeight')} style={{ animationDelay: '80ms' }}>
            <span className="at-weightstrip-num">
              <small>{t('today.weight')}</small>
              <b>—<em> {t('unit.kg')}</em></b>
            </span>
            <span className="at-weightstrip-add"><Plus size={15} /> {t('today.logWeight')}</span>
          </button>
        )}

        <section className="at-panel at-enter" aria-label={t('today.moreToday')} style={{ animationDelay: '140ms' }}>
          {/* What you did today leads: a run appears nowhere else on this screen. */}
          {training.today.cardioSessions.map(entry => {
            const rate = entry.cardio?.readout === 'speed'
              ? fmt.speed(entry.cardio.distanceKm, entry.durationMin)
              : fmt.pace(entry.cardio?.distanceKm, entry.durationMin);
            const distance = entry.cardio?.distanceKm != null ? ` · ${fmt.km(entry.cardio.distanceKm)}` : '';
            return (
              <button key={entry.id} className="at-panel-run" onClick={() => onSession(entry.id)}>
                <i style={{ color: TINT.steps, background: `color-mix(in srgb, ${TINT.steps} 18%, transparent)` }}>
                  {entry.cardio?.readout === 'speed' ? <Bike size={18} /> : <Footprints size={18} />}
                </i>
                <span>
                  <b>{entry.title}{distance}</b>
                  <small>{[`${entry.durationMin} min`, rate, fmt.clock(entry.at)].filter(Boolean).join(' · ')}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            );
          })}

          <div className="at-panel-grid">
            {/* Without a score (no Samsung read, the web build) the cell is the
                way into the check-in instead of into a sheet with nothing in it. */}
            <button className="at-panel-cell"
              onClick={() => (energy != null ? onDetail({ kind: 'energy' }) : actions.openOverlay('wellness'))}>
              <Head icon={<Zap size={14} />} tint={TINT.energy}>{t('energy.title')}</Head>
              <span className="at-panel-row">
                <b className="at-panel-big">{energy ?? '—'}{energy != null && <small> /100</small>}</b>
                <Gauge pct={(energy ?? 0) / 100} tint={TINT.energy} />
              </span>
              <small className="at-panel-sub">{wellness.today.answered ? ' ' : t('wellness.ask')}</small>
            </button>

            <button className="at-panel-cell" onClick={() => onDetail({ kind: 'volume' })}>
              <Head icon={<Dumbbell size={14} />} tint={TINT.active}>{t('today.volume')}</Head>
              <span className="at-panel-row">
                <b className="at-panel-big">
                  <RollingNumber value={training.weeklyStats.volumeKg / 1000} decimals={1} /><small> {t('unit.tonnes')}</small>
                </b>
                <span className="at-panel-bars" aria-hidden="true">
                  {perDay.map((kg, i) => (
                    <i key={i} style={{
                      height: `${Math.max(3, Math.round(kg / maxDay * 34))}px`,
                      background: kg > 0 ? TINT.active : undefined,
                      animationDelay: `${300 + i * 50}ms`,
                    }} />
                  ))}
                </span>
              </span>
              <small className="at-panel-sub">{tp('history.sessions', training.weeklyStats.workouts)}</small>
            </button>

            <button className="at-panel-cell" data-wide={!hasBodyFat} onClick={() => actions.openOverlay('history')}>
              <Head icon={<Flame size={14} />} tint={TINT.steps}>{t('today.streakTile')}</Head>
              <b className="at-panel-big"><RollingNumber value={training.streak.current} decimals={0} /><small> {t('unit.days')}</small></b>
              <span className="at-panel-dots" aria-hidden="true">
                {week.map(day => (
                  <i key={day.date.toISOString()} data-done={day.done} data-today={day.isToday} />
                ))}
              </span>
              <small className="at-panel-sub">{t('today.streakBest', { n: training.streak.best })}</small>
            </button>

            {hasBodyFat && (
              <button className="at-panel-cell" onClick={() => actions.navigate('body')}>
                <Head icon={<Droplet size={14} />} tint={TINT.kcal}>{t('body.metric.bodyFat')}</Head>
                <b className="at-panel-big"><RollingNumber value={bodyFat!.value!} decimals={1} /><small> {t('unit.pct')}</small></b>
                {bodyFat!.series && bodyFat!.series.length > 1 && (
                  <svg className="at-moment-spark" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
                    <path d={sparkPath(bodyFat!.series.slice(-8), 120, 24, 3)} style={{ stroke: TINT.kcal }} />
                  </svg>
                )}
                <small className="at-panel-sub">
                  {bodyFat!.delta30d != null
                    ? t('body.overMonth', { delta: fmt.signed(bodyFat!.delta30d), unit: t('unit.pct') })
                    : ' '}
                </small>
              </button>
            )}
          </div>

          {/* Last night's sleep: from the watch through Health Connect, so it is
              filled without anyone typing it. */}
          <button className="at-panel-sleep" onClick={() => onDetail({ kind: 'sleep' })}>
            <span className="at-panel-row">
              <Head icon={<Moon size={14} />} tint={TINT.sleep}>{t('wellness.sleep')}</Head>
              <b className="at-panel-big">{sleep > 0 ? hm(sleep) : '—'}</b>
            </span>
            {stages.length > 0 ? (
              <>
                <span className="at-panel-stages" aria-hidden="true">
                  {stages.map(stage => (
                    <i key={stage.key} style={{ flexGrow: stage.min, background: stage.tint }} />
                  ))}
                </span>
                <span className="at-panel-legend">
                  {stages.map(stage => (
                    <span key={stage.key}><i style={{ background: stage.tint }} />{stage.label} {hm(stage.min)}</span>
                  ))}
                </span>
              </>
            ) : (
              <small className="at-panel-sub">{sleep > 0 ? t('wellness.sleepHint') : t('today.sleepNone')}</small>
            )}
          </button>
        </section>
      </div>
    </>
  );
};
