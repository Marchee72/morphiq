import React, { useState } from 'react';
import {
  ArrowRight, Bike, Check, Dumbbell, Footprints, Heart, Scale, Sparkles, Trophy, UtensilsCrossed,
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
import { AtlasSessionRow } from './AtlasSessionRow';

/**
 * Today — the screen that answers "what do I need to know right now".
 *
 * Structure is the concept as designed: greeting, one hero for the live session,
 * a snap rail of the day's moments, the coach note, the week, muscle balance.
 * What changed is that every number is real, and every previously-dead button
 * now goes somewhere.
 */
/**
 * How far along a chip's number is against its target.
 *
 * Protein, calories and steps all have one, but the rail only ever said so in
 * words — "38 g left" makes you do the arithmetic to know whether that is
 * nearly done or barely started. Clamped at 100% so going over target fills the
 * bar rather than overflowing the card; the text still says by how much.
 */
const MomentBar: React.FC<{ value: number; target: number }> = ({ value, target }) => {
  if (!target || target <= 0) return null;
  const pct = Math.min(100, Math.max(0, (value / target) * 100));
  return (
    <span className="at-moment-bar" aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </span>
  );
};

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

  /**
   * A session with nothing in it yet has no lift to show.
   *
   * The disc is a photo frame, and `ExerciseThumb` falls back to initials when
   * it has no picture — so an empty session put the two letters of "Push A" in a
   * circle cropped half off the edge of the hero, which reads as a failed image
   * rather than as a session waiting to be filled. No lift, no frame.
   */
  const showDisc = Boolean(heroImage);

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

  /**
   * A day of nothing but activities — a run, a ride — has no sets and no
   * tonnage, so the strength tiles would read `0 sets · 0.0 t` over a day you
   * did train. A mixed day keeps the strength tiles: the run is already named
   * in the session list above them.
   */
  const cardioOnly = trainedToday && doneToday.cardioSessions.length === doneToday.sessions.length;

  /**
   * The rail, as a list rather than five hand-written cards.
   *
   * A chip with nothing behind it is worse than no chip: "— kg" and "0 g" read
   * as a broken reading rather than as "you have not logged this today", and
   * four of them pushed the one number that mattered off the edge of the
   * screen. Each entry is pushed only when it has something to say, so the rail
   * is exactly as long as the day has been.
   *
   * Order is by immediacy: what you did, then what your body did without you,
   * then what you logged.
   */
  const moments: {
    key: string;
    icon: React.ReactNode;
    value: string;
    unit?: string;
    label: React.ReactNode;
    bar?: { value: number; target: number };
    onClick: () => void;
    ariaLabel?: string;
  }[] = [];

  // What you actually did today leads the rail — until now a run appeared
  // nowhere on this screen.
  for (const entry of doneToday.cardioSessions) {
    const rate = entry.cardio?.readout === 'speed'
      ? fmt.speed(entry.cardio.distanceKm, entry.durationMin)
      : fmt.pace(entry.cardio?.distanceKm, entry.durationMin);
    const hasDistance = entry.cardio?.distanceKm != null;
    moments.push({
      key: `activity-${entry.id}`,
      icon: entry.cardio?.readout === 'speed' ? <Bike size={17} /> : <Footprints size={17} />,
      value: hasDistance ? fmt.n(entry.cardio!.distanceKm!, 2) : String(entry.durationMin),
      unit: hasDistance ? t('unit.km') : 'min',
      label: <>{entry.title}{rate && ` · ${rate}`}</>,
      onClick: () => setSessionId(entry.id),
    });
  }

  if (body.hasData && weight?.value != null) {
    moments.push({
      key: 'weight',
      icon: <Scale size={17} />,
      value: fmt.n(weight.value, 1),
      unit: t('unit.kg'),
      label: (
        <>
          {t('today.weight')}
          {weight.delta7d != null && ` · ${fmt.signed(weight.delta7d)} ${t('unit.kg')} / ${t('today.change7d')}`}
          {weight.delta7d == null && weight.delta30d != null
            && ` · ${t('body.overMonth', { delta: fmt.signed(weight.delta30d), unit: t('unit.kg') })}`}
        </>
      ),
      onClick: () => setDetail({ kind: 'weight' }),
    });
  }

  // Null is "the phone has not answered", which is not the same as not walking.
  if (steps.today != null) {
    moments.push({
      key: 'steps',
      icon: <Footprints size={17} />,
      value: fmt.n(steps.today),
      unit: t('unit.steps'),
      // The weekly average is the only target steps have, and the one people
      // compare today against.
      bar: steps.weeklyAvg != null ? { value: steps.today, target: steps.weeklyAvg } : undefined,
      label: (
        <>
          {t('today.steps')}
          {steps.weeklyAvg != null && ` · ${t('today.stepsAvg', { n: fmt.n(steps.weeklyAvg) })}`}
        </>
      ),
      onClick: () => setDetail({ kind: 'steps' }),
      ariaLabel: t('today.stepsDetail'),
    });
  }

  if (nutrition.protein.eaten > 0) {
    moments.push({
      key: 'protein',
      icon: <UtensilsCrossed size={17} />,
      value: fmt.n(nutrition.protein.eaten),
      unit: t('unit.g'),
      bar: { value: nutrition.protein.eaten, target: nutrition.protein.target },
      label: `${t('today.protein')} · ${fmt.n(Math.max(0, nutrition.protein.target - nutrition.protein.eaten))} ${t('unit.g')}`,
      onClick: () => setDetail({ kind: 'nutrition', macro: 'protein' }),
    });
  }

  if (volumeKg > 0) {
    moments.push({
      key: 'volume',
      icon: <Dumbbell size={17} />,
      value: fmt.n(volumeKg / 1000, 1),
      unit: t('unit.tonnes'),
      label: (
        <>
          {session ? t('today.sessionVolume') : t('today.weekVolume')}
          {session
            ? sessionTotals.prs > 0 ? ` · ${sessionTotals.prs} PR` : ''
            : ` · ${tp('history.sessions', training.weeklyStats.workouts)}`}
        </>
      ),
      onClick: () => setDetail({ kind: 'volume' }),
    });
  }

  if (nutrition.calories.eaten > 0) {
    moments.push({
      key: 'calories',
      icon: <Heart size={17} />,
      value: fmt.n(nutrition.calories.eaten),
      unit: t('unit.kcal'),
      bar: { value: nutrition.calories.eaten, target: nutrition.calories.target },
      label: `${t('today.calories')} · ${fmt.n(nutrition.calories.target)}`,
      onClick: () => setDetail({ kind: 'nutrition', macro: 'calories' }),
    });
  }
  

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
        <div className="at-hero" data-nodisc={!showDisc}>
          {showDisc && (
            <div className="at-hero-disc">
              <ExerciseThumb name={heroName} image={heroImage} />
            </div>
          )}
          <span className="at-hero-tag">● {t('today.inProgress')} · {fmt.duration(elapsed)}</span>
          <h2>{session.title}</h2>
          <p>
            {/* "0 sets left" is not what an empty session has left to do — it is
                what it has not been given yet. */}
            {sessionExercises.length === 0 ? t('today.sessionEmpty') : (
              <>
                {tp('today.setsLeft', setsLeft)}
                {next && ` · ${t('today.nextIs', { name: next.ex.name, weight: fmt.n(next.set.lastWeightKg ?? next.set.weightKg, 1) })}`}
              </>
            )}
          </p>
          <button className="at-btn" onClick={() => actions.navigate('train')}>
            {sessionExercises.length === 0 ? t('today.pickFirst') : t('today.continueSession')}
            <i><ArrowRight size={16} /></i>
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

      {moments.length > 0 && (
      <>
      <div className="at-rail-head">
        <h3>{t('today.yourDay')}</h3>
        {/* Was the Body tab, which covers two of the five chips. The day sheet
            already covers all of them. */}
        <button onClick={() => setDetail({ kind: 'day', date: now })}>{t('common.seeAll')}</button>
      </div>
      <div className="at-rail">
        {moments.map((moment, i) => (
          <button
            key={moment.key}
            className="at-moment"
            onClick={moment.onClick}
            aria-label={moment.ariaLabel}
            // Staggered entrance: the rail assembles left to right instead of
            // appearing all at once, which is what makes the order readable.
            style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
          >
            <span className="at-moment-icon">{moment.icon}</span>
            <b>{moment.value}{moment.unit && <small>{moment.unit}</small>}</b>
            {moment.bar && <MomentBar value={moment.bar.value} target={moment.bar.target} />}
            <span>{moment.label}</span>
          </button>
        ))}
      </div>
      </>
      )}

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
                <AtlasSessionRow
                  key={entry.id}
                  entry={entry}
                  time={fmt.relativeDay(entry.at, now)}
                  onClick={() => setSessionId(entry.id)}
                  first={i === 0}
                />
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
