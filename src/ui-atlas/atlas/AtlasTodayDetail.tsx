import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { metricByKey } from '../derive/bodyMetrics';
import { dayKey } from '../derive/buckets';
import type { MuscleGroupId } from '../types';
import { AtlasSheet } from './AtlasSheet';

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

export type TodayDetail =
  | { kind: 'weight' }
  | { kind: 'nutrition'; macro: 'protein' | 'calories' }
  | { kind: 'volume' }
  | { kind: 'steps' }
  | { kind: 'day'; date: Date }
  | { kind: 'muscle'; group: MuscleGroupId };

export const AtlasTodayDetail: React.FC<{
  detail: TodayDetail | null;
  onClose: () => void;
  /** A session row inside the day sheet hands off to the session detail. */
  onOpenSession: (workoutLogId: string) => void;
}> = ({ detail, onClose, onOpenSession }) => {
  const { t, tp, fmt } = useT();
  const { body, nutrition, session, sessionExercises, steps, training } = useAppData();
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
    const weekSessions = training.history.filter(entry => entry.at.getTime() >= weekSince);

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

  if (detail.kind === 'day') {
    const key = dayKey(detail.date);
    const entries = training.history.filter(entry => dayKey(entry.at) === key);

    return sheet(
      fmt.relativeDay(detail.date, now),
      fmt.shortDate(detail.date),
      entries.length > 0 ? (
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {entries.map((entry, i) => (
            <button
              key={entry.id}
              className="at-routine-item"
              style={{ borderTop: i === 0 ? 'none' : undefined, width: '100%' }}
              onClick={() => { onClose(); onOpenSession(entry.id); }}
            >
              <span>
                {entry.title}
                <small>
                  {fmt.clock(entry.at)} · {entry.durationMin} min · {tp('unit.sets', entry.sets)}
                </small>
              </span>
              <b>{fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}</b>
            </button>
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

  return sheet(
    t(muscleRow.labelKey),
    muscleRow.lastHitAt
      ? `${t('today.lastHit')} · ${fmt.relativeDay(muscleRow.lastHitAt, now)}`
      : t('today.muscleDetail'),
    <>
      <div className="at-summary-stats">
        <div><b>{muscleRow.sets}</b><small>{t('today.setsThisWeek')}</small></div>
        <div><b>{muscleRow.target}</b><small>{t('today.targetSets')}</small></div>
        <div><b>{muscleRow.recoveredPct}<i>{t('unit.pct')}</i></b><small>{t('today.recovered')}</small></div>
      </div>
      {muscleRow.exercises.length > 0 ? (
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {muscleRow.exercises.map((exercise, i) =>
            row(
              exercise.name,
              exercise.name,
              tp('unit.sets', exercise.sets),
              `${fmt.n(exercise.volumeKg)} ${t('unit.kg')}`,
              i,
            ))}
        </div>
      ) : (
        <p className="at-summary-empty">{t('common.noData')}</p>
      )}
    </>,
    <button className="at-btn" onClick={go('library')}>
      {t('nav.library')} <i><ArrowRight size={16} /></i>
    </button>,
  );
};
