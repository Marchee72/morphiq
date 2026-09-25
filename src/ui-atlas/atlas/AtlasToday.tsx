import React, { useState } from 'react';
import { ArrowRight, Dumbbell, Footprints, Sparkles, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useElapsedSeconds } from '../components/useTicker';
import { daypart } from '../derive/profile';
import { nextMuscleFocus } from '../derive/todayTraining';
import { AtlasTodayHeader } from './AtlasTodayHeader';
import { AtlasStates } from './AtlasStates';
import { AtlasSessionDetail } from './AtlasSessionDetail';
import { AtlasTodayDetail, type TodayDetail } from './AtlasTodayDetail';
import { AtlasHeatMap } from './AtlasHeatMap';
import { AtlasBuddyStrip } from './AtlasBuddyStrip';
import { AtlasYourDay } from './AtlasYourDay';

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
    profile, body, session, sessionExercises, sessionTotals, training,
  } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const now = new Date();
  const elapsed = useElapsedSeconds(session?.startedAt);
  const setsLeft = Math.max(0, sessionTotals.setsPlanned - sessionTotals.setsDone);

  // The concept's hero says what is coming next; the showcase hardcoded it.
  const next = sessionExercises
    .flatMap(ex => ex.sets.map(set => ({ ex, set })))
    .find(({ set }) => !set.done);

  /**
   * The running session in one line of the header: how long, and what is left
   * — "0 sets left" is not what an empty session has left, so that one says it
   * is waiting for its first exercise instead.
   */
  const live = session
    ? [
        `${session.title} · ${t('today.inProgress')} · ${fmt.duration(elapsed)}`,
        sessionExercises.length === 0 ? t('today.sessionEmpty') : tp('today.setsLeft', setsLeft),
        next ? t('today.nextIs', { name: next.ex.name, weight: fmt.n(next.set.lastWeightKg ?? next.set.weightKg, 1) }) : null,
      ].filter(Boolean).join(' · ')
    : undefined;

  /** The group furthest behind this week — the header's "up next". */
  const focus = nextMuscleFocus(training.muscleLoad.rows);

  // Tapping a card explains its number before it offers the tab that owns it.
  const [detail, setDetail] = useState<TodayDetail | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);



  /**
   * The fold-level answer: what today has been, or — when it has been nothing
   * yet — what the last session was and which group is furthest behind. The
   * question people open this app with is "what do I train now", and until now
   * the screen answered it only by implication, through a ring and a set count.
   */
  const doneToday = training.today;
  const trainedToday = doneToday.sessions.length > 0;

  /**
   * A day of nothing but activities — a run, a ride — has no sets and no
   * tonnage, so the strength tiles would read `0 sets · 0.0 t` over a day you
   * did train. A mixed day keeps the strength tiles: the run is already named
   * in the session list above them.
   */
  const cardioOnly = trainedToday && doneToday.cardioSessions.length === doneToday.sessions.length;

  return (
    <>
      <AtlasTodayHeader
        now={now}
        greeting={t(`today.greeting.${daypart(now)}`, { name: profile.name })}
        initial={profile.name.charAt(0).toUpperCase() || '·'}
        onSettings={() => actions.openOverlay('settings')}
        week={training.streak.week}
        done={training.streak.weekDone}
        goal={training.streak.weekGoal}
        streak={training.streak.current}
        volumeKg={training.weeklyStats.volumeKg}
        minutes={training.weeklyStats.minutes}
        workouts={training.weeklyStats.workouts}
        live={live}
        ctaLabel={session
          ? (sessionExercises.length === 0 ? t('today.pickFirst') : t('today.continueSession'))
          : t('today.startSession')}
        onCta={() => (session ? actions.navigate('train') : actions.beginSession())}
        upNext={focus ? t(focus.labelKey) : undefined}
        onDay={date => setDetail({ kind: 'day', date })}
      />

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
        <div className="at-todaytrain" data-trained={trainedToday}>
          <div className="at-todaytrain-head">
            <span className="at-todaytrain-icon">
              {cardioOnly ? <Footprints size={16} /> : <Dumbbell size={16} />}
            </span>
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
              {/* Sets and tonnes describe nothing about a day that was a run.
                  When the day held both, the lifting tiles win and the run is
                  already named in the list above. */}
              <div className="at-todaytrain-stats">
                {cardioOnly ? (
                  <>
                    <div>
                      <b>{doneToday.minutes} min</b>
                      <small>{t('summary.duration')}</small>
                    </div>
                    {doneToday.cardioDistanceKm > 0 && (
                      <div>
                        <b>{fmt.km(doneToday.cardioDistanceKm)}</b>
                        <small>{t('cardio.distance')}</small>
                      </div>
                    )}
                    {doneToday.cardioCalories > 0 && (
                      <div>
                        <b>{fmt.kcal(doneToday.cardioCalories)}</b>
                        <small>{t('today.calories')}</small>
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
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

      <AtlasYourDay now={now} onDetail={setDetail} onSession={setSessionId} />

      <div className="at-pad at-enter" style={{ paddingTop: 22, paddingBottom: 22, animationDelay: '180ms' }}>
        <AtlasHeatMap onPickRegion={(group) => setDetail({ kind: 'muscle', group })} />
      </div>

      {training.history.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3>{t('today.recent')}</h3>
            <button onClick={() => actions.openOverlay('history')}>{t('common.seeAll')}</button>
          </div>
          {/* A row of cards that slides sideways: when, what, how much — the
              dot is ember for lifting, amber for a run, lime for a record. */}
          <ol className="at-recent at-enter" style={{ animationDelay: '240ms' }}>
            {training.history.slice(0, 5).map(entry => (
              <li key={entry.id} data-kind={entry.prs > 0 ? 'pr' : entry.cardio ? 'cardio' : 'lift'}>
                <button onClick={() => setSessionId(entry.id)} aria-label={t('history.openSession', { name: entry.title })}>
                  <small><i aria-hidden="true" />{fmt.relativeDay(entry.at, now)}</small>
                  <b>{entry.title}</b>
                  <span>
                    {entry.cardio
                      ? `${entry.durationMin} min`
                      : [
                          `${entry.durationMin} min`,
                          `${fmt.n(entry.volumeKg / 1000, 1)} ${t('unit.tonnes')}`,
                          tp('unit.sets', entry.sets),
                          entry.prs > 0 ? `${entry.prs} PR` : null,
                        ].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ol>
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
