import React from 'react';
import { ArrowRight } from 'lucide-react';
import { fillGaps } from '../derive/buckets';
import { ScoreRing } from './AtlasYourDay';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { metricByKey } from '../derive/bodyMetrics';
import { dayKey } from '../derive/buckets';
import type { MuscleGroupId } from '../types';
import { AtlasMetricChart } from './AtlasMetricChart';
import { AtlasSheet } from './AtlasSheet';
import { AtlasSessionRow } from './AtlasSessionRow';

/**
 * What is behind a Today card.
 *
 * Every card on Today is one number. Tapping one used to jump to the tab that
 * owns it, which answers "where does this live" but never "where did this come
 * from" — so the sheet explains the number first and offers the tab second.
 *
 * One component rather than five: the sheets share a shape (a stat block, a
 * list, a way through) and splitting them would be five files of the same frame.
 */

/** Sleep's blues, darkest for the deepest stage — the same as the Today panel. */
const SLEEP_BLUE = { deep: '#1E3A8A', rem: '#3B82F6', light: '#93C5FD' };

/** Six blues, darker for a longer night. */
const NIGHT_SHADES = ['#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#1D4ED8', '#1E3A8A'];
const nightShade = (minutes: number) =>
  NIGHT_SHADES[[300, 360, 390, 420, 450].filter(limit => minutes >= limit).length];

const hm = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;

/** A `YYYY-MM-DD` day key as local noon, clear of any midnight edge. */
const dateOfDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export type TodayDetail =
  | { kind: 'weight' }
  | { kind: 'nutrition'; macro: 'protein' | 'calories' }
  | { kind: 'volume' }
  | { kind: 'steps' }
  | { kind: 'day'; date: Date }
  | { kind: 'muscle'; group: MuscleGroupId }
  | { kind: 'wellness' }
  | { kind: 'sleep' }
  | { kind: 'energy' };

export const AtlasTodayDetail: React.FC<{
  detail: TodayDetail | null;
  onClose: () => void;
  /** A session row inside the day sheet hands off to the session detail. */
  onOpenSession: (workoutLogId: string) => void;
}> = ({ detail, onClose, onOpenSession }) => {
  const { t, tp, fmt } = useT();
  const { body, nutrition, session, sessionExercises, steps, training, wellness } = useAppData();
  const actions = useAppActions();

  if (!detail) return null;

  const now = new Date();
  const go = (screen: 'body' | 'train' | 'library') => () => { onClose(); actions.navigate(screen); };

  /** The shared frame — every branch below supplies title, subtitle, body and a way through. */
  const sheet = (
    title: string,
    subtitle: string,
    children: React.ReactNode,
    footer?: React.ReactNode,
  ) => (
    <AtlasSheet open onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
      {children}
    </AtlasSheet>
  );

  const row = (key: string, label: string, sub: string, value: React.ReactNode, i: number) => (
    <div key={key} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
      <span>{label}<small>{sub}</small></span>
      <b>{value}</b>
    </div>
  );

  if (detail.kind === 'weight') {
    const weight = metricByKey(body.metrics, 'weight');
    const windows: [string, number | null][] = [
      [t('today.change7d'), weight?.delta7d ?? null],
      [t('today.change30d'), weight?.delta30d ?? null],
      [t('today.change90d'), weight?.delta90d ?? null],
    ];

    return sheet(
      t('today.weightDetail'),
      body.latestAt ? fmt.relativeDay(body.latestAt, now) : t('common.noData'),
      <>
        <div className="at-summary-stats">
          {windows.map(([label, delta]) => (
            <div key={label}>
              {/* An em-dash, not a zero: no reading in the window is not "no change". */}
              <b>{delta === null ? '—' : fmt.signed(delta)}<i>{t('unit.kg')}</i></b>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {body.metrics.slice(0, 4).map((metric, i) =>
            row(
              metric.key,
              t(metric.labelKey),
              metric.delta30d === null
                ? t('common.noData')
                : t('body.overMonth', { delta: fmt.signed(metric.delta30d, metric.decimals), unit: '' }),
              `${fmt.n(metric.value, metric.decimals)} ${t(metric.unitKey)}`,
              i,
            ))}
        </div>
      </>,
      <button className="at-btn" onClick={go('body')}>
        {t('nav.body')} <i><ArrowRight size={16} /></i>
      </button>,
    );
  }

  if (detail.kind === 'nutrition') {
    const macro = detail.macro === 'protein' ? nutrition.protein : nutrition.calories;
    const unit = detail.macro === 'protein' ? t('unit.g') : t('unit.kcal');
    const left = macro.target - macro.eaten;

    return sheet(
      t('today.nutritionDetail'),
      left >= 0
        ? t('today.remaining', { n: fmt.n(left), unit })
        : t('today.overTarget', { n: fmt.n(-left), unit }),
      <>
        <div className="at-summary-stats">
          <div><b>{fmt.n(nutrition.calories.eaten)}<i>{t('unit.kcal')}</i></b><small>{t('today.calories')}</small></div>
          <div><b>{fmt.n(nutrition.protein.eaten)}<i>{t('unit.g')}</i></b><small>{t('today.protein')}</small></div>
          <div><b>{fmt.n(nutrition.carbs.eaten)}<i>{t('unit.g')}</i></b><small>{t('food.carbs')}</small></div>
          <div><b>{fmt.n(nutrition.fat.eaten)}<i>{t('unit.g')}</i></b><small>{t('food.fat')}</small></div>
        </div>
        {nutrition.meals.length > 0 ? (
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {nutrition.meals.map((meal, i) =>
              row(
                `${meal.mealType}-${meal.at.getTime()}-${i}`,
                meal.description,
                `${meal.mealType} · ${fmt.clock(meal.at)} · ${fmt.n(meal.protein)} ${t('unit.g')}`,
                `${fmt.n(meal.calories)} ${t('unit.kcal')}`,
                i,
              ))}
          </div>
        ) : (
          <p className="at-summary-empty">{t('today.noMealsSub')}</p>
        )}
      </>,
      <button className="at-btn" onClick={() => { onClose(); actions.openOverlay('addFood'); }}>
        {t('food.title')} <i><ArrowRight size={16} /></i>
      </button>,
    );
  }

  if (detail.kind === 'volume') {
    // Mid-session the interesting breakdown is this session's exercises; with
    // nothing running it is the week's sessions, which is what the card shows.
    const weekSince = now.getTime() - 7 * 86_400_000;
    // Strength sessions only: a walk adds nothing to tonnage, so listing it
    // here at 0.0 t was a row about something the figure does not contain.
    const weekSessions = training.history.filter(entry => entry.at.getTime() >= weekSince && entry.sets > 0);

    return sheet(
      t('today.volumeDetail'),
      session ? t('today.sessionVolume') : t('today.weekVolume'),
      session ? (
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {sessionExercises.map((exercise, i) => {
            const done = exercise.sets.filter(s => s.done);
            const volume = done.reduce((total, s) => total + s.weightKg * s.reps, 0);
            return row(
              exercise.key,
              exercise.name,
              t('train.setsDone', { done: done.length, total: exercise.sets.length }),
              `${fmt.n(volume)} ${t('unit.kg')}`,
              i,
            );
          })}
        </div>
      ) : weekSessions.length > 0 ? (
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {weekSessions.map((entry, i) => (
            <button
              key={entry.id}
              className="at-routine-item"
              style={{ borderTop: i === 0 ? 'none' : undefined, width: '100%' }}
              onClick={() => { onClose(); onOpenSession(entry.id); }}
            >
              <span>
                {entry.title}
                <small>{fmt.relativeDay(entry.at, now)} · {tp('unit.sets', entry.sets)}</small>
              </span>
              <b>{fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}</b>
            </button>
          ))}
        </div>
      ) : (
        <p className="at-summary-empty">{t('gym.noHistory')}</p>
      ),
      <button className="at-btn" onClick={go('train')}>
        {t('nav.train')} <i><ArrowRight size={16} /></i>
      </button>,
    );
  }

  if (detail.kind === 'steps') {
    return sheet(
      t('today.stepsDetail'),
      steps.today == null ? t('today.stepsNoSource') : t('today.steps'),
      <>
        <div className="at-summary-stats">
          <div>
            <b>{steps.today == null ? '—' : fmt.n(steps.today)}</b>
            <small>{t('common.today')}</small>
          </div>
          <div>
            <b>{steps.weeklyAvg == null ? '—' : fmt.n(steps.weeklyAvg)}</b>
            <small>{t('today.stepsAvgLabel')}</small>
          </div>
          <div>
            <b>{steps.recent.length}</b>
            <small>{t('today.stepsDays')}</small>
          </div>
        </div>
        {steps.recent.length > 0 ? (
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {steps.recent.map((day, i) =>
              row(
                day.date.toISOString(),
                fmt.dmy(day.date),
                fmt.relativeDay(day.date, now),
                fmt.n(day.steps),
                i,
              ))}
          </div>
        ) : (
          <p className="at-summary-empty">{t('today.stepsNoSourceSub')}</p>
        )}
      </>,
    );
  }

  if (detail.kind === 'sleep') {
    const log = wellness.today.log;
    const total = log?.sleepMinutes ?? 0;
    const deep = Math.min(total, log?.sleepDeepMinutes ?? 0);
    const rem = Math.min(total - deep, log?.sleepRemMinutes ?? 0);
    const stages = [
      { key: 'deep', label: t('wellness.deep'), min: deep, tint: SLEEP_BLUE.deep },
      { key: 'rem', label: t('wellness.rem'), min: rem, tint: SLEEP_BLUE.rem },
      { key: 'light', label: t('wellness.light'), min: total - deep - rem, tint: SLEEP_BLUE.light },
    ];
    const start = log?.sleepStart ? new Date(log.sleepStart) : null;
    const end = log?.sleepEnd ? new Date(log.sleepEnd) : null;
    const nights = wellness.today.nights;
    const most = Math.max(1, ...nights.map(n => n.minutes ?? 0));
    const recorded = nights.filter(n => n.minutes !== null);
    const avg = recorded.length > 0 ? recorded.reduce((s, n) => s + (n.minutes ?? 0), 0) / recorded.length : null;

    return sheet(
      t('wellness.sleep'),
      t('sleep.lastNight'),
      <>
        <div className="at-card at-sleep-head">
          <div>
            <b>{total > 0 ? hm(total) : '—'}</b>
            {start && end && <small>{fmt.clock(start)} → {fmt.clock(end)}</small>}
          </div>
          {log?.sleepScore != null && (
            <ScoreRing score={log.sleepScore} tint={SLEEP_BLUE.rem} size={84} label={`${t('sleep.score')} ${log.sleepScore}`} />
          )}
        </div>

        {total > 0 && deep + rem > 0 && (
          <div className="at-card at-sleep-stages">
            <b>{t('sleep.stages')}</b>
            <span className="at-panel-stages" aria-hidden="true">
              {stages.map(s => <i key={s.key} style={{ flexGrow: s.min, background: s.tint }} />)}
            </span>
            <div>
              {stages.map(s => (
                <span key={s.key}>
                  <small><i style={{ background: s.tint }} />{s.label}</small>
                  <b>{hm(s.min)}</b>
                  <small>{fmt.n((s.min / total) * 100)} %</small>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="at-card at-sleep-nights">
          <span><b>{t('sleep.nights')}</b>{avg !== null && <small>{t('sleep.avg', { time: hm(avg) })}</small>}</span>
          <div aria-hidden="true">
            {nights.map((n, i) => (
              <span key={n.day}>
                <i style={{ height: `${Math.max(4, ((n.minutes ?? 0) / most) * 88)}px`, background: n.minutes ? nightShade(n.minutes) : undefined }} />
                <small data-today={i === nights.length - 1}>{fmt.weekdayShort(dateOfDay(n.day)).slice(0, 1).toUpperCase()}</small>
              </span>
            ))}
          </div>
          <small>{t('sleep.shadeHint')}</small>
        </div>

        <p className="at-metric-source">{log?.sleepScore != null ? t('sleep.fromSamsung') : t('wellness.fromHealthConnect')}</p>
      </>,
    );
  }

  if (detail.kind === 'energy') {
    const { energy, energyAvg7, energyDays } = wellness.today;
    const series = fillGaps(energyDays.map(d => d.score));
    const delta = energy != null && energyAvg7 != null ? energy - energyAvg7 : null;

    return sheet(
      t('energy.title'),
      fmt.relativeDay(now, now),
      <>
        <div className="at-card at-energy-head">
          {energy != null
            ? <ScoreRing score={energy} tint="var(--sage)" size={132} label={`${t('energy.title')} ${energy}`} />
            : <b>—</b>}
          {delta !== null && (
            <span className="at-delta-chip" data-good={delta > 0}>{t('energy.vsAvg7', { delta: fmt.signed(delta, 0) })}</span>
          )}
        </div>

        {series && (
          <div className="at-card" style={{ padding: '18px 16px 12px' }}>
            <div className="at-goal-row" style={{ marginBottom: 8 }}>
              <b>{t('energy.last14')}</b>
              {energyAvg7 != null && <span>{t('energy.avg7', { n: energyAvg7 })}</span>}
            </div>
            <AtlasMetricChart series={series} decimals={0} height={110} now={now} color="var(--sage)" axis={false} stepMs={86_400_000} />
            <div className="at-chart-axis">
              <span>{fmt.shortDate(dateOfDay(energyDays[0].day))}</span>
              <span>{fmt.relativeDay(now, now)}</span>
            </div>
          </div>
        )}

        <div className="at-card at-energy-about">
          <b>{t('energy.whatTitle')}</b>
          <p>{t('energy.what')}</p>
        </div>
      </>,
      // The check-in lives here now that the cell it hung off shows the score.
      <button className="at-btn" data-block="true" onClick={() => { onClose(); actions.openOverlay('wellness'); }}>
        {wellness.today.answered ? t('wellness.edit') : t('wellness.ask')}
      </button>,
    );
  }

  if (detail.kind === 'wellness') {
    const { today, trend } = wellness;
    return sheet(
      t('wellness.title'),
      today.answered ? t('wellness.readiness') : t('wellness.ask'),
      <>
        <div className="at-summary-stats">
          <div>
            {/* An unanswered day has no readiness. A zero would read as
                "unfit to train", which is the opposite of "not asked". */}
            <b>{today.readiness === null ? '—' : today.readiness}</b>
            <small>{t('wellness.readiness')}</small>
          </div>
          <div>
            <b>{today.log?.sleepMinutes ? fmt.duration(today.log.sleepMinutes * 60) : '—'}</b>
            <small>{t('wellness.sleep')}</small>
          </div>
          <div>
            <b>{today.log?.restingHr ? fmt.n(today.log.restingHr) : '—'}</b>
            <small>{t('wellness.restingHr')}</small>
          </div>
        </div>

        {/* Against your own recent average, not a population table: 58 bpm
            means nothing alone and a lot if you normally sit at 52. */}
        {today.restingHrDelta !== null && (
          <p className="at-metric-source">
            {t('wellness.hrVsBaseline', { delta: fmt.signed(today.restingHrDelta, 1) })}
          </p>
        )}

        {trend.readinessSeries ? (
          <div className="at-card" style={{ padding: '18px 16px 12px' }}>
            <AtlasMetricChart
              series={trend.readinessSeries}
              decimals={0}
              height={120}
              now={now}
              weeks={trend.weeks}
            />
          </div>
        ) : (
          <p className="at-summary-empty">{t('wellness.noHistory')}</p>
        )}

        <div className="at-statrows">
          {trend.itemSeries.map(item => {
            const latest = item.series?.at(-1);
            return (
              <div key={item.key} className="at-statrow">
                <span>{t(item.labelKey)}</span>
                <b>{latest == null ? '—' : fmt.upTo(latest, 1)}</b>
                <small>{t('wellness.outOfFive')}</small>
              </div>
            );
          })}
        </div>
      </>,
      <button className="at-btn" onClick={() => { onClose(); actions.openOverlay('wellness'); }}>
        {today.answered ? t('wellness.edit') : t('wellness.answer')}
      </button>,
    );
  }

  if (detail.kind === 'day') {
    const key = dayKey(detail.date);
    const entries = training.history.filter(entry => dayKey(entry.at) === key);

    return sheet(
      fmt.relativeDay(detail.date, now),
      fmt.shortDate(detail.date),
      entries.length > 0 ? (
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {entries.map((entry, i) => (
            <AtlasSessionRow
              key={entry.id}
              entry={entry}
              time={fmt.clock(entry.at)}
              onClick={() => { onClose(); onOpenSession(entry.id); }}
              first={i === 0}
            />
          ))}
        </div>
      ) : (
        <p className="at-summary-empty">{t('today.noDaySessions')}</p>
      ),
      <button className="at-btn" onClick={() => { onClose(); actions.openOverlay('history'); }}>
        {t('history.title')} <i><ArrowRight size={16} /></i>
      </button>,
    );
  }

  const muscleRow = training.muscleLoad.rows.find(r => r.group === detail.group);
  if (!muscleRow) return null;

  /** Recency dot color matching the heat gradient. */
  const recencyColor = (lastHitAt: Date | null): string => {
    if (!lastHitAt) return 'var(--at-figure-limb)';
    const hours = (now.getTime() - lastHitAt.getTime()) / 3_600_000;
    if (hours <= 48) return 'var(--clay-strong)';
    if (hours <= 120) return 'var(--muted)';
    return 'var(--at-figure-limb)';
  };

  /** Resolve the session title for an exercise by looking it up in history. */
  const sessionTitleFor = (exerciseName: string): string => {
    const entry = training.history.find(h => h.exercises.includes(exerciseName));
    return entry?.title ?? '';
  };

  return sheet(
    t(muscleRow.labelKey),
    `${muscleRow.sets} ${t('today.setsThisWeekShort')}`,
    muscleRow.exercises.length > 0 ? (
      <div className="at-card" style={{ padding: '8px 20px' }}>
        {muscleRow.exercises.map((exercise, i) => (
          <div
            key={exercise.name}
            className="at-routine-item"
            style={{ borderTop: i === 0 ? 'none' : undefined }}
          >
            <span>
              <span style={{ color: recencyColor(exercise.lastHitAt) }}>●</span>{' '}
              {exercise.name}
              <small>
                {exercise.lastHitAt
                  ? `${fmt.relativeDay(exercise.lastHitAt, now)}${
                      sessionTitleFor(exercise.name) ? ` · ${sessionTitleFor(exercise.name)}` : ''
                    }`
                  : t('common.noData')}
              </small>
            </span>
            <b>
              {tp('unit.sets', exercise.sets)}
              {exercise.bestSet && (
                <small style={{ display: 'block', fontWeight: 400 }}>
                  {t('today.bestSet', { weight: fmt.n(exercise.bestSet.weightKg, 1), reps: exercise.bestSet.reps })}
                </small>
              )}
            </b>
          </div>
        ))}
      </div>
    ) : (
      <p className="at-summary-empty">
        {t('today.noGroupWork', { group: t(muscleRow.labelKey) })}
      </p>
    ),
    <button className="at-btn" onClick={go('library')}>
      {t('nav.library')} <i><ArrowRight size={16} /></i>
    </button>,
  );
};
