import React, { useState } from 'react';
import { Check, Flag, Plus, Trash2, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useAppData, useAppActions } from '../data/useAppData';
import { useLiveSession } from '../data/useLiveSession';
import { useSetDraft } from '../components/useSetDraft';
import { useFocusOnAdd } from '../components/useFocusOnAdd';
import { useSessionSummary } from '../state/sessionSummary';
import { buildSessionSummary } from '../derive/summary';
import type { FeelingId, SessionCursor, SessionSetVM } from '../types';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasGymHub } from './AtlasGymHub';
import { AtlasSessionEditor } from './AtlasSessionEditor';
import { AtlasStates } from './AtlasStates';
import { AtlasDial } from './AtlasDial';
import { AtlasSetList } from './AtlasSetList';
import { AtlasTrainHeader } from './AtlasTrainHeader';
import { AtlasTrainStage } from './AtlasTrainStage';
import { AtlasFinishSheet } from './AtlasFinishSheet';
import { AtlasExerciseDetail } from './AtlasExerciseDetail';

/** 1.25 kg is the smallest plate pair on most racks, so it is the honest step. */
const WEIGHT_STEP_KG = 1.25;
const MAX_WEIGHT_KG = 300;
const MAX_REPS = 50;

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

  const [editRowFor, setEditRowFor] = useState(live.cursor.exerciseIdx);
  if (editRowFor !== live.cursor.exerciseIdx) {
    setEditRowFor(live.cursor.exerciseIdx);
    setEditRow(null);
    setViewSet(null);
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
    showSummary(buildSessionSummary(
      { ...session, feelingTag: feeling },
      sessionExercises,
      sessionTotals,
      endedAt,
    ));
    try {
      await live.finish();
    } catch {
      dismissSummary();
      setFinishingAt(endedAt);
    }
  };

  const header = (
    <AtlasTrainHeader
      session={session}
      exercises={sessionExercises}
      currentIdx={live.cursor.exerciseIdx}
      onGoTo={live.goToExercise}
      onMinimize={() => actions.navigate('today')}
      onOpenList={() => setListOpen(true)}
    />
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
      />
      <AtlasExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
    </>
  );

  if (!exercise) {
    return (
      <>
        {header}
        <AtlasStates
          title={t('train.noExercises')}
          body={t('train.noExercisesSub')}
          action={{ label: t('train.addExercise'), onClick: () => actions.openOverlay('exercisePicker') }}
        />
        {sheets}
      </>
    );
  }

  const done = exercise.sets.filter(s => s.done).length;
  const exerciseComplete = done === exercise.sets.length && exercise.sets.length > 0;

  /**
   * The earliest set still to log. Sets happen in order, so it is also the only
   * one the wheels may be moved onto — see the pills below.
   */
  const firstOpenSet = exercise.sets.findIndex(s => !s.done);
  /** The logged set being read back, if any. Never one you can type into here. */
  const viewing = viewSet != null ? exercise.sets[viewSet] : undefined;
  const sessionComplete = sessionTotals.setsPlanned > 0 && sessionTotals.setsDone === sessionTotals.setsPlanned;
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
            {/* Only offered when the sticky bar is not already showing the way
                on — two buttons for the same decision is worse than one. */}
            {!nextExercise && !sessionComplete && (
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
        <div className="at-dials">
            <AtlasDial
              label={t('train.weight')}
              value={draft.weight}
              onChange={draft.setWeight}
              min={0}
              max={MAX_WEIGHT_KG}
              step={WEIGHT_STEP_KG}
              suffix={t('unit.kg')}
              formatValue={v => fmt.upTo(v)}
            />
            <AtlasDial
              label={t('train.reps')}
              value={draft.reps}
              onChange={draft.setReps}
              min={1}
              max={MAX_REPS}
              step={1}
            />
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
        />
      </div>

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

      {/* Room for the fixed action bar, so the last row is never trapped under it. */}
      <div className="at-train-spacer" />

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
        ) : sessionComplete ? (
          <button
            className="at-btn"
            data-block="true"
            disabled={finishing}
            onClick={() => setFinishingAt(new Date())}
          >
            <Flag size={16} /> {finishing ? t('train.finishing') : t('train.finish')}
          </button>
        ) : exerciseComplete && nextExercise ? (
          <button
            className="at-btn"
            data-block="true"
            onClick={() => live.goToExercise(nextUnfinished)}
          >
            {t('train.nextNamed', { name: nextExercise.name })}
          </button>
        ) : exerciseComplete ? (
          <button
            className="at-btn"
            data-block="true"
            onClick={() => actions.openOverlay('exercisePicker')}
          >
            <Plus size={16} /> {t('train.addExercise')}
          </button>
        ) : (
          <button
            className="at-btn"
            data-block="true"
            onClick={() => live.logSet(draft.weight, draft.reps)}
          >
            <Check size={17} strokeWidth={3} /> {t('train.completeSet', { n: live.setIdx + 1 })}
          </button>
        )}
      </div>

      {sheets}
    </>
  );
};
