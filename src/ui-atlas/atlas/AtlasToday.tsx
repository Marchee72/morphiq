import React, { useState } from 'react';
import {
  ArrowRight, Check, Dumbbell, Footprints, Heart, Scale, Sparkles, Trophy, UtensilsCrossed,
} from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useElapsedSeconds } from '../components/useTicker';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { metricByKey } from '../derive/bodyMetrics';
import { daypart } from '../derive/profile';
import { AtlasStates } from './AtlasStates';
import { AtlasSessionDetail } from './AtlasSessionDetail';
import { AtlasTodayDetail, type TodayDetail } from './AtlasTodayDetail';
import { AtlasHeatMap } from './AtlasHeatMap';
import { AtlasBuddyStrip } from './AtlasBuddyStrip';

/**
 * Today — the screen that answers "what do I need to know right now".
 *
 * Structure is the concept as designed: greeting, one hero for the live session,
 * a snap rail of the day's moments, the coach note, the week, muscle balance.
 * What changed is that every number is real, and every previously-dead button
 * now goes somewhere.
 */
export const AtlasToday: React.FC = () => {
  const {
    profile, body, session, sessionExercises, sessionTotals, nutrition, training, steps,
  } = useAppData();
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

  // Tapping a card explains its number before it offers the tab that owns it.
  const [detail, setDetail] = useState<TodayDetail | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  /**
   * The volume card read `0.0 t` on every rest day, because it only ever showed
   * the live session. With nothing running the week is the honest number.
   */
  const volumeKg = session ? sessionTotals.volumeKg : training.weeklyStats.volumeKg;

  /**
   * The fold-level answer: what today has been, or — when it has been nothing
   * yet — what the last session was and which group is furthest behind. The
   * question people open this app with is "what do I train now", and until now
   * the screen answered it only by implication, through a ring and a set count.
   */
  const doneToday = training.today;
  const trainedToday = doneToday.sessions.length > 0;
  

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
          <button className="at-btn" onClick={() => actions.beginSession()}>
            {t('common.start')} <i><ArrowRight size={16} /></i>
          </button>
        </div>
      )}

      {/* A partner training right now, if any — renders nothing otherwise, so it
          costs nothing on the common path. */}
      <AtlasBuddyStrip />

      {/* Directly under the hero, because it is the first thing you want and the
          hero cannot carry it: once a session is finished the hero goes back to
          offering a new one, as though the day were still empty.

          Suppressed in the one case the hero does answer — a session running with
          nothing finished yet — where this would otherwise say "not trained yet"
          over the top of a live workout. */}
      {(trainedToday || !session) && (
      <div className="at-pad" style={{ paddingTop: 16 }}>
        <div className="at-card at-todaytrain" data-trained={trainedToday}>
          <div className="at-todaytrain-head">
            <span className="at-todaytrain-icon"><Dumbbell size={16} /></span>
            <div>
              <small>{t('today.trainingToday')}</small>
              <b>
                {trainedToday
                  ? doneToday.sessions.map(s => s.title).join(' · ')
                  : t('today.notTrainedYet')}
              </b>
            </div>
          </div>

          {trainedToday ? (
            <>
              {/* The names, not just the count — "6 sets" does not tell you
                  whether legs are done. */}
              {doneToday.exercises.length > 0 && (
                <p className="at-todaytrain-list">{doneToday.exercises.join(' · ')}</p>
              )}
              <div className="at-todaytrain-stats">
                <div>
                  <b>{tp('unit.sets', doneToday.sets)}</b>
                  <small>{t('today.setsLogged')}</small>
                </div>
                <div>
                  <b>{fmt.n(doneToday.volumeKg / 1000, 1)} {t('unit.tonnes')}</b>
                  <small>{t('today.volume')}</small>
                </div>
                <div>
                  <b>{doneToday.minutes} min</b>
                  <small>{t('summary.duration')}</small>
                </div>
              </div>
              {doneToday.prs > 0 && (
                <p className="at-todaytrain-pr">
                  <Trophy size={13} /> {tp('today.prsToday', doneToday.prs)}
                </p>
              )}
              {/* One tap to the sets themselves, which is the next question. */}
              <button
                className="at-btn"
                data-ghost="true"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setSessionId(doneToday.sessions[0].id)}
              >
                {t('today.seeWhatYouDid')} <i><ArrowRight size={15} /></i>
              </button>
            </>
          ) : (
            <>
              <p className="at-todaytrain-list">
                {doneToday.previous
                  ? t('today.lastTrained', {
                      name: doneToday.previous.title,
                      when: fmt.relativeDay(doneToday.previous.at, now),
                      date: fmt.dmy(doneToday.previous.at),
                    })
                  : t('today.neverTrained')}
              </p>
              {/* What the previous session actually was, so "chest tomorrow"
                  is a decision you can make from this screen. */}
              {doneToday.previous && doneToday.previous.exercises.length > 0 && (
                <p className="at-todaytrain-list">{doneToday.previous.exercises.join(' · ')}</p>
              )}
            </>
          )}
        </div>
      </div>
      )}

      <div className="at-rail-head">
        <h3>{t('today.soFar')}</h3>
        <button onClick={() => actions.navigate('body')}>{t('common.seeAll')}</button>
      </div>
      <div className="at-rail">
        <button className="at-moment" onClick={() => setDetail({ kind: 'weight' })}>
          <span className="at-moment-icon"><Scale size={17} /></span>
          <b>{body.hasData ? fmt.n(weight?.value ?? 0, 1) : '—'}<small>{t('unit.kg')}</small></b>
          <span>
            {t('today.weight')}
            {weight?.delta7d != null && ` · ${fmt.signed(weight.delta7d)} ${t('unit.kg')} / ${t('today.change7d')}`}
            {weight?.delta7d == null && weight?.delta30d != null
              && ` · ${t('body.overMonth', { delta: fmt.signed(weight.delta30d), unit: t('unit.kg') })}`}
          </span>
        </button>
        {/* Steps sit next to weight rather than at the end of the rail: they are
            the other thing that happened to your body today without you logging
            anything. An em-dash when the phone has not answered — a zero would
            read as "you did not move". */}
        <button
          className="at-moment"
          onClick={() => setDetail({ kind: 'steps' })}
          aria-label={t('today.stepsDetail')}
        >
          <span className="at-moment-icon"><Footprints size={17} /></span>
          <b>{steps.today == null ? '—' : fmt.n(steps.today)}<small>{t('unit.steps')}</small></b>
          <span>
            {t('today.steps')}
            {steps.weeklyAvg != null && ` · ${t('today.stepsAvg', { n: fmt.n(steps.weeklyAvg) })}`}
          </span>
        </button>
        <button className="at-moment" onClick={() => setDetail({ kind: 'nutrition', macro: 'protein' })}>
          <span className="at-moment-icon"><UtensilsCrossed size={17} /></span>
          <b>{fmt.n(nutrition.protein.eaten)}<small>{t('unit.g')}</small></b>
          <span>{t('today.protein')} · {fmt.n(Math.max(0, nutrition.protein.target - nutrition.protein.eaten))} {t('unit.g')}</span>
        </button>
        <button className="at-moment" onClick={() => setDetail({ kind: 'volume' })}>
          <span className="at-moment-icon"><Dumbbell size={17} /></span>
          <b>{fmt.n(volumeKg / 1000, 1)}<small>{t('unit.tonnes')}</small></b>
          <span>
            {session ? t('today.sessionVolume') : t('today.weekVolume')}
            {session
              ? sessionTotals.prs > 0 ? ` · ${sessionTotals.prs} PR` : ''
              : ` · ${tp('history.sessions', training.weeklyStats.workouts)}`}
          </span>
        </button>
        <button className="at-moment" onClick={() => setDetail({ kind: 'nutrition', macro: 'calories' })}>
          <span className="at-moment-icon"><Heart size={17} /></span>
          <b>{fmt.n(nutrition.calories.eaten)}<small>{t('unit.kcal')}</small></b>
          <span>{t('today.calories')} · {fmt.n(nutrition.calories.target)}</span>
        </button>
      </div>

      <div className="at-rail-head">
        <h3>{t('today.thisWeek')}</h3>
        <button onClick={() => actions.navigate('train')}>
          {t('today.weeklyGoal', { done: training.streak.weekDone, goal: training.streak.weekGoal })}
          {training.streak.current > 0 && ` · ${t('today.streak', { n: training.streak.current })}`}
        </button>
      </div>
      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <div className="at-card">
          <div className="at-week">
            {training.streak.week.map(day => (
              // A day is a tap target now: the ring says whether you trained,
              // the sheet says what you did.
              <button
                key={day.date.toISOString()}
                className="at-day"
                onClick={() => setDetail({ kind: 'day', date: day.date })}
                aria-label={t('today.openDay', { date: fmt.shortDate(day.date) })}
              >
                <div className="at-day-ring" data-done={day.done} data-today={day.isToday}>
                  {day.done ? <Check size={14} strokeWidth={3} /> : ''}
                </div>
                <span>{fmt.weekdayShort(day.date).charAt(0).toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="at-pad" style={{ paddingBottom: 22 }}>
        <AtlasHeatMap onPickRegion={(group) => setDetail({ kind: 'muscle', group })} />
      </div>

      {training.history.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3>{t('today.recent')}</h3>
            <button onClick={() => actions.openOverlay('history')}>{t('common.seeAll')}</button>
          </div>
          <div className="at-pad" style={{ paddingBottom: 22 }}>
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {training.history.slice(0, 3).map((entry, i) => (
                <button
                  key={entry.id}
                  className="at-routine-item"
                  style={{ borderTop: i === 0 ? 'none' : undefined, width: '100%' }}
                  onClick={() => setSessionId(entry.id)}
                  aria-label={t('history.openSession', { name: entry.title })}
                >
                  <span>
                    {entry.title}
                    <small>
                      {fmt.relativeDay(entry.at, now)} · {entry.durationMin} min · {tp('unit.sets', entry.sets)}
                    </small>
                  </span>
                  <b>
                    {entry.prs > 0 && <Trophy size={13} color="var(--clay)" />}
                    {fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}
                  </b>
                </button>
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

      <AtlasTodayDetail
        detail={detail}
        onClose={() => setDetail(null)}
        onOpenSession={setSessionId}
      />
      <AtlasSessionDetail workoutLogId={sessionId} onClose={() => setSessionId(null)} />
    </>
  );
};
