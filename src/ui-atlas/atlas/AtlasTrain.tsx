import React, { useState } from 'react';
import { Check, Flag, Gauge, Plus, Timer, Trash2, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { borgLabelKey } from '../derive/borg';
import { e1rm } from '../derive/records';
import { useStore } from '../../presentation/state/store';
import { useAppData, useAppActions } from '../data/useAppData';
import { useLiveSession } from '../data/useLiveSession';
import { useSetDraft } from '../components/useSetDraft';
import { useFocusOnAdd } from '../components/useFocusOnAdd';
import { useElapsedSeconds } from '../components/useTicker';
import { useSessionSummary } from '../state/sessionSummary';
import { buildSessionSummary } from '../derive/summary';
import type { FeelingId, SessionCursor, SessionSetVM } from '../types';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasGymHub } from './AtlasGymHub';
import { AtlasSessionEditor } from './AtlasSessionEditor';
import { AtlasSessionStart } from './AtlasSessionStart';
import { AtlasRpeSheet } from './AtlasRpeSheet';
import { WeightWheel } from '../kit/weight-wheel';
import { Stepper } from '../kit/stepper';
import { SlideToConfirm } from '../kit/slide-to-confirm';
import { AtlasSetList } from './AtlasSetList';
import { AtlasSharedStrip } from './AtlasSharedStrip';
import { AtlasTrainHeader } from './AtlasTrainHeader';
import { AtlasTrainStage } from './AtlasTrainStage';
import { AtlasFinishSheet } from './AtlasFinishSheet';
import { AtlasExerciseDetail } from './AtlasExerciseDetail';

const MAX_WEIGHT_KG = 300;
const MAX_REPS = 50;

/**
 * How long since the last set went in.
 *
 * It is the number a gym looks at most between sets, and until now the app had
 * nothing to say about it — the header's clock times the whole session, so
 * anyone resting to a schedule was doing it in another app.
 *
 * Its own component for the same reason the header's clock is: `useElapsedSeconds`
 * re-renders whoever calls it, and called from `AtlasTrain` that would repaint
 * the disc, both wheels and every pill once a second for a line under the pills.
 *
 * Counting up rather than down, and no configurable target: what a rest timer
 * has to answer first is "how long have I been standing here".
 *
 * ponytail: the moment lives in `AtlasTrain`'s state rather than on the set,
 * because `DraftSet` has no timestamp (store.ts:154). The ceiling that buys is
 * that leaving Train and coming back restarts the rest from nothing — which a
 * reload would do anyway, so migrating the stored model for it can wait until
 * someone asks for a rest that survives one.
 */
const AtlasRestTimer: React.FC<{ since: Date }> = ({ since }) => {
  const { t, fmt } = useT();
  const elapsed = useElapsedSeconds(since);

  // Deliberately not a live region: a value that changes every second would
  // have a screen reader talking over the set being logged.
  return (
    <div className="at-rest">
      <Timer size={13} />
      <span>{t('train.rest')}</span>
      <b>{fmt.duration(elapsed)}</b>
    </div>
  );
};

/**
 * Train — one exercise at a time, oversized circular controls.
 *
 * The flow it has to support: pick an exercise, load weight and reps set by set,
 * move between exercises freely, and finish knowing what you did.
 *
 * Three things are fixed relative to the scroll: the header with the session
 * clock, and the action bar at the bottom. Everything between them is the
 * exercise, and the cursor moving is the only thing that changes it. That is
 * what makes the primary action — log this set — reachable without ever
 * scrolling, which matters when the phone is on the floor next to a barbell.
 */
export const AtlasTrain: React.FC = () => {
  const { session, sessionExercises, sessionTotals, catalog } = useAppData();
  const actions = useAppActions();
  const { t, fmt } = useT();

  const [cursor, setCursor] = useState<SessionCursor | undefined>(undefined);
  const [listOpen, setListOpen] = useState(false);
  /** The clock, stopped at the moment finish was pressed. Null means not finishing. */
  const [finishingAt, setFinishingAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  /** When the last set was logged, which is what the rest timer counts from. */
  const [lastSetAt, setLastSetAt] = useState<Date | null>(null);
  const live = useLiveSession(cursor, setCursor);
  useFocusOnAdd(sessionExercises, setCursor);

  const showSummary = useSessionSummary(s => s.show);
  const dismissSummary = useSessionSummary(s => s.dismiss);
  const finishing = useStore(s => s.isFinishingSession);

  const exercise = live.exercise;
  const set = exercise?.sets[live.setIdx];

  /**
   * The last thing actually put on the bar for this exercise today, which is
   * what the next set should open on. See `useSetDraft` for why.
   */
  const carry = exercise?.sets
    .slice(0, live.setIdx)
    .reduce<SessionSetVM | undefined>((found, s) => (s.done ? s : found), undefined);
  const draft = useSetDraft(
    `${live.cursor.exerciseIdx}:${live.cursor.setIdx}`,
    set,
    carry && { weightKg: carry.weightKg, reps: carry.reps },
  );

  /**
   * Which set of this exercise has its row open for editing. Held here rather
   * than inside the list because a finished set pill hands its set down to the
   * list instead of putting the wheels on it — a set you have logged is
   * corrected in one place, not two.
   */
  const [editRow, setEditRow] = useState<number | null>(null);

  /**
   * A set already logged that the pills are showing back to you, read-only.
   *
   * Pressing a finished pill used to open its row in the list for editing, which
   * meant a glance at "what did I put on the bar for set 1" was one stray tap
   * away from overwriting it. Looking and changing are now separate: the pill
   * shows, the list edits.
   */
  const [viewSet, setViewSet] = useState<number | null>(null);

  /**
   * Why the exertion sheet is up, or null when it is not.
   *
   * `finish` is "finish exercise" waiting on an answer before it ends the
   * exercise — the question and the ending are one decision, so the button opens
   * this rather than closing the exercise and asking afterwards. `rate` is the
   * far more common path: the last set finished the exercise by itself, and the
   * sheet comes up on its own while the answer is still fresh.
   */
  const [ask, setAsk] = useState<'finish' | 'rate' | null>(null);

  /**
   * Exercises the question has already been put for in this session.
   *
   * Without it, dismissing the sheet would raise it again on the very next
   * render, and swiping back to a finished exercise would ask a second time
   * about something already answered — or already declined.
   */
  const [asked, setAsked] = useState<readonly string[]>([]);

  const [editRowFor, setEditRowFor] = useState(live.cursor.exerciseIdx);
  if (editRowFor !== live.cursor.exerciseIdx) {
    setEditRowFor(live.cursor.exerciseIdx);
    setEditRow(null);
    setViewSet(null);
    setAsk(null);
  }

  /**
   * The rest belongs to the session that logged the set, and this screen never
   * unmounts between sessions — so without this, opening tomorrow's workout
   * showed a rest timer already running from yesterday's last set.
   *
   * Keyed on the session's start, not on the exercise: moving between exercises
   * does not interrupt the rest, and the same session resumed after a reload is
   * still the same session.
   */
  const startedAt = session?.startedAt.getTime();
  const [restFor, setRestFor] = useState(startedAt);
  if (restFor !== startedAt) {
    setRestFor(startedAt);
    setLastSetAt(null);
  }

  if (!session) return <AtlasGymHub />;

  /**
   * Snapshot, then write, then show. `finishActiveSession` nulls the session, so
   * a summary derived after the call would describe nothing.
   *
   * If the write fails the summary has to come back down — a recap of a session
   * that was never saved is the most misleading screen the app could show — and
   * the confirm sheet reopens so the attempt can be repeated.
   */
  const finish = async (feeling: FeelingId | undefined) => {
    const endedAt = finishingAt ?? new Date();
    setFinishingAt(null);
    live.setFeeling(feeling, session.bodyNotes);

    /**
     * A session with nothing logged is discarded rather than filed, so there is
     * no recap to give — the same reason a failed write pulls the summary back
     * down.
     *
     * Read off the store rather than `sessionTotals`, which cannot answer this:
     * `setsPlanned` counts the routine's target sets whether or not any were
     * logged, so a three-exercise routine reports nine while the session holds
     * none, and `setsDone` counts only ticked sets, so it reports none for a
     * session that does have rows and will be saved. This is the same array the
     * guard in `finishActiveSession` decides on.
     */
    const willBeSaved = (useStore.getState().activeSession?.sets.length ?? 0) > 0;
    if (willBeSaved) {
      showSummary(buildSessionSummary(
        { ...session, feelingTag: feeling },
        sessionExercises,
        sessionTotals,
        endedAt,
      ));
    }
    try {
      await live.finish();
    } catch {
      dismissSummary();
      setFinishingAt(endedAt);
    }
  };

  const header = (
    <>
      <AtlasTrainHeader
        session={session}
        exercises={sessionExercises}
        currentIdx={live.cursor.exerciseIdx}
        onGoTo={live.goToExercise}
        onMinimize={() => actions.navigate('today')}
        onOpenList={() => setListOpen(true)}
      />
      {/* Sits beside the header rather than inside it. Both tick once a second,
          but each owns its own clock at the leaf that shows it — folded together,
          the header's timer would drag the partner rows along with it and the
          rows' timers would drag the whole header back. */}
      <AtlasSharedStrip />
    </>
  );

  const sheets = (
    <>
      <AtlasSessionEditor
        open={listOpen}
        onClose={() => setListOpen(false)}
        live={live}
        currentIdx={live.cursor.exerciseIdx}
        onGoTo={live.goToExercise}
        onFinish={() => setFinishingAt(new Date())}
      />
      <AtlasFinishSheet
        open={finishingAt !== null}
        onClose={() => setFinishingAt(null)}
        busy={finishing}
        totals={sessionTotals}
        elapsedSec={finishingAt
          ? Math.max(0, Math.floor((finishingAt.getTime() - session.startedAt.getTime()) / 1000))
          : 0}
        initialFeeling={session.feelingTag as FeelingId | undefined}
        onConfirm={finish}
        exercises={sessionExercises}
        onRate={live.rateExercise}
      />
      <AtlasExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
    </>
  );

  if (!exercise) {
    return (
      <>
        {header}
        <AtlasSessionStart />
        <div className="at-train-spacer" />
        {sheets}
      </>
    );
  }

  const done = exercise.sets.filter(s => s.done).length;
  const exerciseComplete = done === exercise.sets.length && exercise.sets.length > 0;

  /**
   * Whether this exercise has been closed — rated, or the question put and
   * waved away. Until then a finished last set is not the end of the exercise:
   * sets are added on demand, so the screen offers the next one and "Finish
   * exercise", which is what asks how hard it was. Raising the question on its
   * own after every last set would fire after the first set of every exercise.
   */
  const closed = exercise.rpe !== undefined || asked.includes(exercise.name);
  const closeExercise = () => {
    if (!asked.includes(exercise.name)) setAsked([...asked, exercise.name]);
    setAsk('rate');
  };

  /**
   * The earliest set still to log. Sets happen in order, so it is also the only
   * one the wheels may be moved onto — see the pills below.
   */
  const firstOpenSet = exercise.sets.findIndex(s => !s.done);
  /** The logged set being read back, if any. Never one you can type into here. */
  const viewing = viewSet != null ? exercise.sets[viewSet] : undefined;
  const sessionComplete = sessionTotals.setsPlanned > 0 && sessionTotals.setsDone === sessionTotals.setsPlanned;
  /**
   * Work behind you and work still planned — see the button in the action bar.
   * Excluded while a logged set is being read back, where the bar's one job is
   * getting you out of that view.
   */
  const canFinishExercise = done > 0 && done < exercise.sets.length && viewing === undefined;

  /**
   * One exercise, all of it logged — which is not the same thing as a session
   * you meant to end.
   *
   * `sessionComplete` turns true the moment a single exercise's sets are in, so
   * promoting Finish there is precisely the accident the bar below says it is
   * built to avoid. With more than one exercise behind you, finishing is a
   * deliberate answer and takes the slot back.
   */
  const soloExerciseDone = sessionComplete && exerciseComplete && closed && sessionExercises.length === 1;
  /** The action bar's Finish branch — see the two places below that read it. */
  const barIsFinish = sessionComplete && closed && !soloExerciseDone;
  const exerciseVolume = exercise.sets.reduce((sum, s) => (s.done ? sum + s.weightKg * s.reps : sum), 0);

  /**
   * The next exercise with something still to log, which is rarely the one after
   * this in the list — you land on whatever you added last, so "next" often means
   * going back to the top. Naming it stops the button lying about where it goes.
   */
  const nextUnfinished = sessionExercises.findIndex(
    (ex, i) => i !== live.cursor.exerciseIdx && ex.sets.some(s => !s.done),
  );
  const nextExercise = nextUnfinished === -1 ? undefined : sessionExercises[nextUnfinished];

  /** What the set on the wheels is worth as a one-rep max, and whether it beats the best. */
  const best = exercise.best?.e1rm ?? 0;
  const projected = e1rm(draft.weight, draft.reps);
  const record = best > 0 && projected > best + 0.05;

  const openDetail = () => {
    const full = exercise.exerciseId ? catalog.byId(exercise.exerciseId) : undefined;
    if (full) setDetail(full);
  };

  return (
    <>
      {header}

      <AtlasTrainStage
        exercise={exercise}
        index={live.cursor.exerciseIdx}
        onAddSlot={false}
        complete={exerciseComplete}
        caption={
          <>
            <div className="at-exercise-name">{exercise.name}</div>
            <div className="at-exercise-meta">
              {t('train.exerciseOf', { n: live.cursor.exerciseIdx + 1, total: sessionExercises.length })}
              {exercise.target && ` · ${exercise.target}`}
              {exercise.equipment && ` · ${exercise.equipment}`}
            </div>
            {!exerciseComplete && viewSet == null && projected > 0 && (
              <span className="at-e1rm-chip" data-record={record}>
                {record
                  ? t('train.newE1rm', { weight: fmt.upTo(projected, 1) })
                  : t('train.thisSet', { weight: fmt.upTo(projected, 1) })}
              </span>
            )}
          </>
        }
        onNext={() => {
          // Past the last exercise there is nothing to move to, so offer the one
          // thing you could possibly want there.
          if (live.cursor.exerciseIdx + 1 < sessionExercises.length) {
            live.goToExercise(live.cursor.exerciseIdx + 1);
          } else {
            actions.openOverlay('exercisePicker');
          }
        }}
        onPrevious={() => live.goToExercise(Math.max(0, live.cursor.exerciseIdx - 1))}
        onOpenDetail={openDetail}
        onAddExercise={() => actions.openOverlay('exercisePicker')}
      />

      {/* What the lift is worth to you: the number to beat, the number to match,
          and what you have put into it today. None of this reached the screen
          before, though every value was already derived. */}
      <div className="at-facts">
        {/* The best set, and under it what that set implies you could lift for
            one. The estimate has been derived since the beginning and had
            nowhere to go — which left the strip showing "92.5 kg × 3" and
            leaving the number people actually train off to be worked out in
            their head. Suppressed on a true single, where the estimate is just
            the same figure again. */}
        <div className="at-fact">
          <small><Trophy size={11} /> {t('train.yourPr')}</small>
          <b>{exercise.best ? fmt.kgReps(exercise.best.weightKg, exercise.best.reps) : t('train.noPrYet')}</b>
          {exercise.best && exercise.best.reps > 1 && exercise.best.e1rm > 0 && (
            <span className="at-fact-sub">
              {t('train.estimated1rm', { weight: fmt.upTo(exercise.best.e1rm, 1) })}
            </span>
          )}
        </div>
        <div className="at-fact">
          <small>{t('train.lastTimeLabel')}</small>
          <b>
            {set?.lastWeightKg != null
              ? fmt.kgReps(set.lastWeightKg, set.lastReps ?? 0)
              : '—'}
          </b>
        </div>
        <div className="at-fact">
          <small>{t('train.thisSession')}</small>
          <b>{fmt.n(exerciseVolume)}<i>{t('unit.kg')}</i></b>
        </div>
      </div>

      {/* Three states, and the difference between them is the point.
          - The next set still to do moves the wheels onto it.
          - A set already logged reads back below, and cannot be typed into from
            here — its row in the list is the one place that edits it.
          - A set further ahead than the next one is locked. Sets are performed
            in order, and jumping to 4 with 2 and 3 empty writes a session that
            never happened; the empty sets in between then look deliberate. */}
      <div className="at-setpills">
        {exercise.sets.map((s, i) => {
          const locked = !s.done && firstOpenSet !== -1 && i > firstOpenSet;
          return (
            <button
              key={s.setNum}
              className="at-setpill"
              data-done={s.done}
              data-cur={i === (viewSet ?? live.setIdx)}
              data-pr={s.isPr}
              data-locked={locked}
              disabled={locked}
              onClick={() => {
                if (s.done) { setViewSet(i); return; }
                setViewSet(null);
                live.goTo(live.cursor.exerciseIdx, i);
              }}
              aria-label={locked
                ? t('train.setLocked', { n: s.setNum, next: firstOpenSet + 1 })
                : s.done
                  ? t('train.viewSetValues', { n: s.setNum })
                  : t('train.setOf', { n: s.setNum, total: exercise.sets.length })}
            >
              {s.isPr ? <Trophy size={13} /> : s.done ? <Check size={14} strokeWidth={3} /> : s.setNum}
            </button>
          );
        })}
        <button className="at-setpill" onClick={live.addSet} aria-label={t('train.addSet')}>
          <Plus size={13} />
        </button>
      </div>

      {/* Beside the pills, because that is where "how far through am I" already
          lives and resting is the other half of the same question. */}
      {lastSetAt && <AtlasRestTimer since={lastSetAt} />}

      {/* Read-only on purpose. The wheels are the one control that writes
          without confirming, so they never point at a set that is already in the
          book — the list below is where a logged set gets corrected. */}
      {viewing ? (
        <div className="at-pad">
          <div className="at-card at-setview">
            <small>{t('train.setOf', { n: viewing.setNum, total: exercise.sets.length })} · {t('train.logged')}</small>
            <b>{fmt.kgReps(viewing.weightKg, viewing.reps)}</b>
            {viewing.isPr && <span className="at-setview-pr"><Trophy size={12} /> {t('train.personalRecord')}</span>}
            <p>{t('train.viewOnly')}</p>
          </div>
        </div>
      ) : exerciseComplete ? (
        <div className="at-pad">
          <div className="at-card at-done">
            <span className="at-done-mark"><Check size={20} strokeWidth={3} /></span>
            <h4 className="at-serif">{t('train.exerciseDone')}</h4>
            <p>{t('train.exerciseDoneSub', { n: exercise.sets.length })}</p>

            {/* The sheet raises itself the moment the exercise completes, so
                what belongs here is the answer — or, if the sheet was waved
                away, the way back to it. Two chances at a question that costs
                one tap, and no third. */}
            {!closed && (
              <button className="at-addset" onClick={live.addSet}>
                <Plus size={18} strokeWidth={2.6} /> {t('train.addSetN', { n: exercise.sets.length + 1 })}
              </button>
            )}
            {!closed ? null : exercise.rpe === undefined ? (
              <button
                className="at-btn at-rpe-reopen"
                data-ghost="true"
                onClick={() => setAsk('rate')}
              >
                <Gauge size={15} /> {t('train.rpeRate')}
              </button>
            ) : (
              <p className="at-rpe-said">
                {t('train.rpe')} {exercise.rpe} · {t(borgLabelKey(exercise.rpe))}
              </p>
            )}

            {/* Only when the bar below is not already a way to the picker.
                With no next exercise the bar offers "add exercise" itself, so
                showing this too put three routes to one picker on one screen;
                the one moment it does not is a complete session, where the bar
                is Finish and this card would otherwise say "pick the next one"
                with no way to pick. */}
            {barIsFinish && (
              <button
                className="at-btn"
                style={{ justifyContent: 'center', width: '100%' }}
                onClick={() => actions.openOverlay('exercisePicker')}
              >
                <Plus size={16} /> {t('train.pickNext')}
              </button>
            )}
            <p className="at-swipe-hint">{t('train.swipeHint')}</p>
          </div>
        </div>
      ) : (
        <div className="at-pad">
          <div className="at-card at-dials">
            <WeightWheel
              label={t('train.weight')}
              value={draft.weight}
              onChange={draft.setWeight}
              best={exercise.best?.e1rm}
              max={MAX_WEIGHT_KG}
            />
            <Stepper
              value={draft.reps}
              onChange={draft.setReps}
              min={1}
              max={MAX_REPS}
              unit={t('train.reps').toLowerCase()}
              decLabel={t('train.decrease', { label: t('train.reps') })}
              incLabel={t('train.increase', { label: t('train.reps') })}
            />
          </div>
        </div>
      )}

      {/* Every set of this exercise, so filling them in after the fact — or
          fixing set 2 while standing on set 4 — does not mean walking the cursor
          back through each one. Stays visible once the exercise is done, which
          is when you would want to check it over. */}
      <div className="at-pad" style={{ paddingTop: 14 }}>
        <AtlasSetList
          sets={exercise.sets}
          currentIdx={live.setIdx}
          editing={editRow}
          onEditing={setEditRow}
          onUpdate={live.updateSet}
          rpe={exercise.rpe}
        />
      </div>

      {/* Ending an exercise early is now a button in the action bar rather than
          a line of small print down here, so what is left is the count and the
          one destructive action, which does not want promoting. */}
      <div className="at-pad at-setmeta">
        <span>{t('train.setsDone', { done, total: exercise.sets.length })}</span>
        {exercise.sets.length > 1 && (
          <button onClick={() => live.removeSet(live.setIdx)}>
            <Trash2 size={13} /> {t('train.removeSet')}
          </button>
        )}
      </div>

      {/* Swiping past the last exercise reaches the picker too, but a gesture is
          not an affordance — this is the one that can be seen. */}
      <div className="at-pad" style={{ paddingTop: 16 }}>
        <button
          className="at-btn"
          data-ghost="true"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => actions.openOverlay('exercisePicker')}
        >
          <Plus size={16} /> {t('train.addExercise')}
        </button>
      </div>

      {/* Room for the fixed action bar, so the last row is never trapped under
          it — two rows' worth when the bar is carrying both actions. */}
      <div
        className="at-train-spacer"
        // `soloExerciseDone` stacks Finish under "add exercise" — but not while a
        // logged set is being read back, where the bar is the single way out.
        data-stacked={canFinishExercise || (soloExerciseDone && viewing === undefined)}
      />

      {/* One primary action, always the thing you would do next. Finish only
          takes the slot once there is genuinely nothing left to log — offering it
          after a single exercise is how people end sessions by accident. */}
      <div className="at-train-actions">
        {viewing ? (
          // While a past set is on screen the primary action cannot be "complete
          // set 3" — the pills are highlighting set 1. It becomes the way back.
          <button
            className="at-btn"
            data-block="true"
            onClick={() => setViewSet(null)}
          >
            {t('train.backToSet', { n: live.setIdx + 1 })}
          </button>
        ) : exerciseComplete && !closed ? (
          <button className="at-btn" data-block="true" onClick={closeExercise}>
            <Flag size={16} /> {t('train.finishExercise')}
          </button>
        ) : barIsFinish ? (
          // A slide rather than a tap: ending the session is the one action
          // here a stray thumb must not trigger. It opens the finish sheet.
          <SlideToConfirm
            key={finishingAt ? 'open' : 'idle'}
            label={finishing ? t('train.finishing') : t('train.slideToFinish')}
            disabled={finishing}
            onConfirm={() => setFinishingAt(new Date())}
          />
        ) : exerciseComplete && nextExercise ? (
          <button
            className="at-btn"
            data-block="true"
            onClick={() => live.goToExercise(nextUnfinished)}
          >
            {t('train.nextNamed', { name: nextExercise.name })}
          </button>
        ) : exerciseComplete ? (
          <>
            <button
              className="at-btn"
              data-block="true"
              onClick={() => actions.openOverlay('exercisePicker')}
            >
              <Plus size={16} /> {t('train.addExercise')}
            </button>
            {/* Still one tap away, just not the thing under your thumb — the
                same arrangement "finish exercise" gets below. */}
            {soloExerciseDone && (
              <button
                className="at-btn"
                data-block="true"
                data-ghost="true"
                disabled={finishing}
                onClick={() => setFinishingAt(new Date())}
              >
                <Flag size={15} /> {finishing ? t('train.finishing') : t('train.finish')}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="at-btn"
              data-block="true"
              onClick={() => {
                live.logSet(draft.weight, draft.reps);
                setLastSetAt(new Date());
              }}
            >
              <Check size={17} strokeWidth={3} />{' '}
              {/* An exercise with no history opens on 0 kg (`useSetDraft`), and
                  "Complete set 1" would then write `0 kg × 10` with nothing on
                  screen saying so. 0 kg is legitimate — it is most of
                  calisthenics — so this names it rather than blocking it. */}
              {draft.weight === 0
                ? t('train.completeSetBodyweight', { n: live.setIdx + 1 })
                : t('train.completeSet', { n: live.setIdx + 1 })}
            </button>
            {/* Ending the exercise sits beside logging into it, because that is
                where the decision is actually made — you finish an exercise
                standing over the phone with a set left on the card, not by
                going hunting for a link under the set list. Offered only with
                work behind you and work still planned: with nothing done this
                is "remove the exercise", and with nothing left the exercise has
                already finished itself. */}
            {canFinishExercise && (
              <button
                className="at-btn"
                data-block="true"
                data-ghost="true"
                onClick={() => setAsk('finish')}
              >
                <Flag size={15} /> {t('train.finishExercise')}
              </button>
            )}
          </>
        )}
      </div>

      {/* One sheet for one question, whichever of the two moments raised it.
          Answering the `finish` variant ends the exercise; skipping it ends the
          exercise anyway, because Finish was pressed and the rating was only
          ever the second half of that. */}
      <AtlasRpeSheet
        open={ask !== null}
        exerciseName={exercise.name}
        value={exercise.rpe}
        onPick={rpe => {
          setAsk(null);
          if (ask === 'finish') live.finishExercise(rpe);
          else live.rateExercise(exercise.name, rpe);
        }}
        onSkip={() => {
          setAsk(null);
          if (ask === 'finish') live.finishExercise();
        }}
      />

      {sheets}
    </>
  );
};
