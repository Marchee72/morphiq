import React from 'react';
import { ArrowRight, Check, Dumbbell, Heart, Scale, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useElapsedSeconds } from '../components/useTicker';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { metricByKey } from '../derive/bodyMetrics';
import { daypart } from '../derive/profile';
import { AtlasStates } from './AtlasStates';

/**
 * Today — the screen that answers "what do I need to know right now".
 *
 * Structure is the concept as designed: greeting, one hero for the live session,
 * a snap rail of the day's moments, the coach note, the week, muscle balance.
 * What changed is that every number is real, and every previously-dead button
 * now goes somewhere.
 */
export const AtlasToday: React.FC = () => {
  const { profile, body, session, sessionExercises, sessionTotals, nutrition, training } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const now = new Date();
  const weight = metricByKey(body.metrics, 'weight');
  const elapsed = useElapsedSeconds(session?.startedAt);
  const setsLeft = Math.max(0, sessionTotals.setsPlanned - sessionTotals.setsDone);

  // The concept's hero says what is coming next; the showcase hardcoded it.
  const next = sessionExercises
    .flatMap(ex => ex.sets.map(set => ({ ex, set })))
    .find(({ set }) => !set.done);

  const heroImage = sessionExercises[0]?.image;
  const heroName = sessionExercises[0]?.name ?? session?.title ?? '';

  return (
    <>
      <div className="at-greet">
        <div>
          <small>{fmt.weekdayShort(now)}, {fmt.shortDate(now)}</small>
          <h1>{t(`today.greeting.${daypart(now)}`, { name: profile.name })}</h1>
        </div>
        <button className="at-avatar" onClick={() => actions.openOverlay('settings')} aria-label={t('nav.settings')}>
          {profile.name.charAt(0).toUpperCase() || '·'}
        </button>
      </div>

      {session ? (
        <div className="at-hero">
          <div className="at-hero-disc">
            <ExerciseThumb name={heroName} image={heroImage} />
          </div>
          <span className="at-hero-tag">● {t('today.inProgress')} · {fmt.duration(elapsed)}</span>
          <h2>{session.title}</h2>
          <p>
            {tp('today.setsLeft', setsLeft)}
            {next && ` · ${t('today.nextIs', { name: next.ex.name, weight: fmt.n(next.set.lastWeightKg ?? next.set.weightKg, 1) })}`}
          </p>
          <button className="at-btn" onClick={() => actions.navigate('train')}>
            {t('today.continueSession')} <i><ArrowRight size={16} /></i>
          </button>
        </div>
      ) : (
        <div className="at-hero" data-idle="true">
          <span className="at-hero-tag">{t('today.noSession')}</span>
          <h2>{t('today.startSession')}</h2>
          <p>{t('today.noSessionSub')}</p>
          <button className="at-btn" onClick={() => actions.startSession()}>
            {t('common.start')} <i><ArrowRight size={16} /></i>
          </button>
        </div>
      )}

      <div className="at-rail-head">
        <h3>{t('today.soFar')}</h3>
        <button onClick={() => actions.navigate('body')}>{t('common.seeAll')}</button>
      </div>
      <div className="at-rail">
        <button className="at-moment" onClick={() => actions.navigate('body')}>
          <span className="at-moment-icon"><Scale size={17} /></span>
          <b>{body.hasData ? fmt.n(weight?.value ?? 0, 1) : '—'}<small>{t('unit.kg')}</small></b>
          <span>
            {t('today.weight')}
            {weight?.delta30d != null && ` · ${t('body.overMonth', { delta: fmt.signed(weight.delta30d), unit: t('unit.kg') })}`}
          </span>
        </button>
        <button className="at-moment" onClick={() => actions.openOverlay('addFood')}>
          <span className="at-moment-icon"><UtensilsCrossed size={17} /></span>
          <b>{fmt.n(nutrition.protein.eaten)}<small>{t('unit.g')}</small></b>
          <span>{t('today.protein')} · {fmt.n(Math.max(0, nutrition.protein.target - nutrition.protein.eaten))} {t('unit.g')}</span>
        </button>
        <button className="at-moment" onClick={() => actions.navigate('train')}>
          <span className="at-moment-icon"><Dumbbell size={17} /></span>
          <b>{fmt.n(sessionTotals.volumeKg / 1000, 1)}<small>{t('unit.tonnes')}</small></b>
          <span>{t('today.volume')}{sessionTotals.prs > 0 ? ` · ${sessionTotals.prs} PR` : ''}</span>
        </button>
        <button className="at-moment" onClick={() => actions.openOverlay('addFood')}>
          <span className="at-moment-icon"><Heart size={17} /></span>
          <b>{fmt.n(nutrition.calories.eaten)}<small>{t('unit.kcal')}</small></b>
          <span>{t('today.calories')} · {fmt.n(nutrition.calories.target)}</span>
        </button>
      </div>

      <div className="at-rail-head">
        <h3>{t('today.thisWeek')}</h3>
        <button onClick={() => actions.navigate('train')}>
          {t('today.weeklyGoal', { done: training.streak.weekDone, goal: training.streak.weekGoal })}
        </button>
      </div>
      <div className="at-pad">
        <div className="at-card">
          <div className="at-week">
            {training.streak.week.map(day => (
              <div key={day.date.toISOString()} className="at-day">
                <div className="at-day-ring" data-done={day.done} data-today={day.isToday}>
                  {day.done ? <Check size={14} strokeWidth={3} /> : ''}
                </div>
                <span>{fmt.weekdayShort(day.date).charAt(0).toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="at-rail-head">
        <h3>{t('today.muscleLoad')}</h3>
        <button onClick={() => actions.navigate('library')}>{t('today.balance')}</button>
      </div>
      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <div className="at-card" style={{ padding: '8px 20px' }}>
          {training.muscleLoad.rows.map((row, i) => (
            <div key={row.group} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
              <span>
                {t(row.labelKey)}
                <small>
                  {row.lastHitAt
                    ? `${row.recoveredPct}% · ${fmt.relativeDay(row.lastHitAt, now)}`
                    : t('common.noData')}
                </small>
              </span>
              <b data-met={row.sets >= row.target}>{row.sets}/{row.target}</b>
            </div>
          ))}
          {training.muscleLoad.unmappedSets > 0 && (
            <div className="at-routine-note">
              {tp('muscle.unattributed', training.muscleLoad.unmappedSets)}
            </div>
          )}
        </div>
      </div>

      {training.history.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3>{t('today.recent')}</h3>
            <button onClick={() => actions.navigate('train')}>{t('common.seeAll')}</button>
          </div>
          <div className="at-pad" style={{ paddingBottom: 22 }}>
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {training.history.slice(0, 3).map((entry, i) => (
                <div key={entry.id} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                  <span>
                    {entry.title}
                    <small>{fmt.relativeDay(entry.at, now)} · {entry.durationMin} min</small>
                  </span>
                  <b>{fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!session && training.history.length === 0 && !body.hasData && (
        <AtlasStates
          icon={<Sparkles size={22} />}
          title={t('today.noSession')}
          body={t('today.noSessionSub')}
        />
      )}
    </>
  );
};
