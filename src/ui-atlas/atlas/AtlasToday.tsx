import React, { useState } from 'react';
import {
  ArrowRight, Bike, Dumbbell, Flame, Footprints, HeartPulse, Percent, Plus, Sparkles, Trophy,
} from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useElapsedSeconds } from '../components/useTicker';
import { isImproving, metricByKey } from '../derive/bodyMetrics';
import { daypart } from '../derive/profile';
import { nextMuscleFocus } from '../derive/todayTraining';
import { sparkPath } from '../derive/spark';
import { RollingNumber } from '../kit/rolling-number';
import { AtlasTodayHeader } from './AtlasTodayHeader';
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

/** The three day rings, outer to inner, and the colour each keeps everywhere. */
const RING_TINT: Record<string, string> = { steps: '#FF6A2B', protein: '#FFB020', calories: '#FF8A5B' };
/** Tiles take the colour of what they measure; the text stays ink, the colour is the tint and the icon. */
const TILE_TINT: Record<string, string> = { wellness: '#9CCC5A', volume: '#FFB020', bodyFat: '#FF8A5B', streak: '#FF6A2B' };
/** What the steps ring fills against before there is a weekly average to use. */
const STEPS_GOAL = 8000;

/**
 * Steps, protein and calories as concentric rings that draw themselves — the
 * three numbers with a target, read against it at a glance. Each ring's
 * fraction is clamped at a full turn; the legend still says the real number.
 */
const DayRings: React.FC<{ rings: { key: string; pct: number }[] }> = ({ rings }) => {
  const radii = [52, 38, 24];
  return (
    <svg className="at-rings" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      {rings.map((ring, i) => {
        const r = radii[i];
        const c = 2 * Math.PI * r;
        const tint = RING_TINT[ring.key];
        return (
          <g key={ring.key}>
            <circle cx="60" cy="60" r={r} style={{ stroke: `color-mix(in srgb, ${tint} 18%, transparent)` }} />
            <circle
              cx="60" cy="60" r={r}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - Math.min(1, Math.max(0, ring.pct)))}
              transform="rotate(-90 60 60)"
              style={{ stroke: tint, animationDelay: `${200 + i * 150}ms`, ['--c' as string]: c }}
            />
          </g>
        );
      })}
    </svg>
  );
};

export const AtlasToday: React.FC = () => {
  const {
    profile, body, session, sessionExercises, sessionTotals, nutrition, training, steps, wellness,
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
   * The wellness chip is the one exception, and it is not really one: it is a
   * question rather than a reading, so it is never waiting on data. See below.
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
    /** Steps draw a ring against their weekly average. */
    ring?: { value: number; target: number };
    spark?: number[];
    /** The value as a number, so it rolls when it changes. */
    num?: { value: number; decimals: number };
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

  /**
   * Readiness, or the invitation to say how the day is going.
   *
   * The only entry in the rail that is pushed unconditionally, and deliberately
   * so: every other chip is a reading that either exists or does not, while this
   * one is a question. An unanswered day is not "no data" — it is the one thing
   * on this screen you can still do something about, and hiding it until it is
   * answered means it never gets answered.
   */
  moments.push(wellness.today.readiness !== null
    ? {
        key: 'wellness',
        icon: <HeartPulse size={17} />,
        value: String(wellness.today.readiness),
        unit: '/100',
        label: (
          <>
            {t('wellness.readiness')}
            {wellness.today.log?.sleepMinutes
              ? ` · ${t('wellness.sleep')} ${fmt.duration(wellness.today.log.sleepMinutes * 60)}`
              : ''}
          </>
        ),
        onClick: () => actions.openOverlay('wellness'),
      }
    : {
        key: 'wellness',
        icon: <HeartPulse size={17} />,
        value: '?',
        label: t('wellness.ask'),
        onClick: () => actions.openOverlay('wellness'),
        ariaLabel: t('wellness.ask'),
      });

  if (volumeKg > 0 || !session) {
    moments.push({
      key: 'volume',
      icon: <Dumbbell size={17} />,
      value: fmt.n(volumeKg / 1000, 1),
      num: { value: volumeKg / 1000, decimals: 1 },
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

  const bodyFat = metricByKey(body.metrics, 'bodyFat');
  // A scale without impedance writes 0 rather than nothing: not a reading.
  if (bodyFat?.value != null && bodyFat.value > 0) {
    moments.push({
      key: 'bodyFat',
      icon: <Percent size={17} />,
      value: fmt.n(bodyFat.value, 1),
      num: { value: bodyFat.value, decimals: 1 },
      unit: t('unit.pct'),
      label: t('body.metric.bodyFat'),
      onClick: () => actions.navigate('body'),
    });
  }

  moments.push({
    key: 'streak',
    icon: <Flame size={17} />,
    value: String(training.streak.current),
    num: { value: training.streak.current, decimals: 0 },
    unit: t('unit.days'),
    label: training.streak.best > training.streak.current
      ? `${t('today.streakTile')} · ${t('today.streakBest', { n: training.streak.best })}`
      : t('today.streakTile'),
    onClick: () => actions.openOverlay('history'),
  });

  /**
   * The three numbers with a target, as rings — always, because an empty ring
   * is the goal still ahead, not a missing reading. Steps are the exception to
   * the zero: null means the phone has not answered, so the ring stays empty
   * and the number reads as a dash.
   */
  const stepsTarget = steps.weeklyAvg ?? STEPS_GOAL;
  const rings = [
    {
      key: 'steps',
      pct: steps.today != null ? steps.today / stepsTarget : 0,
      label: steps.weeklyAvg != null
        ? `${t('today.steps')} · ${t('today.stepsAvg', { n: fmt.n(steps.weeklyAvg) })}`
        : t('today.steps'),
      value: steps.today,
      unit: t('unit.steps'),
      onClick: () => setDetail({ kind: 'steps' }),
      ariaLabel: t('today.stepsDetail'),
    },
    {
      key: 'protein',
      pct: nutrition.protein.target > 0 ? nutrition.protein.eaten / nutrition.protein.target : 0,
      label: t('today.protein'),
      value: nutrition.protein.eaten,
      unit: `/ ${fmt.n(nutrition.protein.target)} ${t('unit.g')}`,
      onClick: () => setDetail({ kind: 'nutrition', macro: 'protein' }),
      ariaLabel: undefined,
    },
    {
      key: 'calories',
      pct: nutrition.calories.target > 0 ? nutrition.calories.eaten / nutrition.calories.target : 0,
      label: t('today.calories'),
      value: nutrition.calories.eaten,
      unit: `/ ${fmt.n(nutrition.calories.target)}`,
      onClick: () => setDetail({ kind: 'nutrition', macro: 'calories' }),
      ariaLabel: undefined,
    },
  ];
  const hasWeight = body.hasData && weight?.value != null;

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

      <div className="at-rail-head">
        <h3>{t('today.yourDay')}</h3>
        {/* The day sheet covers everything below. */}
        <button onClick={() => setDetail({ kind: 'day', date: now })}>{t('common.seeAll')}</button>
      </div>
      {/* Rings for what has a target, a strip for weight, colour tiles for
          the rest. */}
      <div className="at-moments">
        <div className="at-rings-card at-enter">
          <DayRings rings={rings.map(r => ({ key: r.key, pct: r.pct }))} />
          <div className="at-rings-legend">
            {rings.map(r => (
              <button key={r.key} onClick={r.onClick} aria-label={r.ariaLabel}>
                <i style={{ background: RING_TINT[r.key] }} aria-hidden="true" />
                <span>
                  <small>{r.label}</small>
                  <b>
                    {r.value != null ? <RollingNumber value={r.value} decimals={0} /> : '—'}
                    <em> {r.unit}</em>
                  </b>
                </span>
              </button>
            ))}
          </div>
        </div>

        {hasWeight ? (
          <button className="at-weightstrip at-enter" onClick={() => setDetail({ kind: 'weight' })} style={{ animationDelay: '80ms' }}>
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

        {moments.length > 0 && (
          <div className="at-tiles">
            {moments.map((moment, i) => (
              <button
                key={moment.key}
                className="at-moment at-tile"
                onClick={moment.onClick}
                aria-label={moment.ariaLabel}
                style={{
                  ['--tint' as string]: TILE_TINT[moment.key] ?? '#FF6A2B',
                  animationDelay: `${120 + Math.min(i, 6) * 60}ms`,
                }}
              >
                <span className="at-moment-icon">{moment.icon}</span>
                <b>
                  {moment.num ? <RollingNumber value={moment.num.value} decimals={moment.num.decimals} /> : moment.value}
                  {moment.unit && <small>{moment.unit}</small>}
                </b>
                {moment.bar && <MomentBar value={moment.bar.value} target={moment.bar.target} />}
                <span>{moment.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="at-pad at-enter" style={{ paddingTop: 22, paddingBottom: 22, animationDelay: '180ms' }}>
        <AtlasHeatMap onPickRegion={(group) => setDetail({ kind: 'muscle', group })} />
      </div>

      {training.history.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3>{t('today.recent')}</h3>
            <button onClick={() => actions.openOverlay('history')}>{t('common.seeAll')}</button>
          </div>
          {/* A timeline: when, what, how much — the dot is ember for lifting,
              amber for a run, lime when the session set a record. */}
          <ol className="at-timeline at-enter" style={{ animationDelay: '240ms' }}>
            {training.history.slice(0, 5).map(entry => (
              <li key={entry.id} data-kind={entry.prs > 0 ? 'pr' : entry.cardio ? 'cardio' : 'lift'}>
                <button onClick={() => setSessionId(entry.id)} aria-label={t('history.openSession', { name: entry.title })}>
                  <small>{fmt.relativeDay(entry.at, now)}</small>
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
