import React, { useState } from 'react';
import { Check, Flag, Plus, Trash2, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useLiveSession } from '../data/useLiveSession';
import { useSetDraft } from '../components/useSetDraft';
import { useFocusOnAdd } from '../components/useFocusOnAdd';
import { useTicker } from '../components/useTicker';
import { remainingSec, useRestTimer } from '../state/restTimer';
import { useSessionSummary } from '../state/sessionSummary';
import { buildSessionSummary } from '../derive/summary';
import type { FeelingId, SessionCursor } from '../types';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasGymHub } from './AtlasGymHub';
import { AtlasSessionEditor } from './AtlasSessionEditor';
import { AtlasStates } from './AtlasStates';
import { AtlasDial } from './AtlasDial';
import { AtlasTrainHeader } from './AtlasTrainHeader';
import { AtlasTrainStage } from './AtlasTrainStage';
import { AtlasRestBar } from './AtlasRestBar';
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
  useFocusOnAdd(sessionExercises.length, setCursor);

  const showSummary = useSessionSummary(s => s.show);
  const { endsAt, totalSec } = useRestTimer();
  const tick = useTicker(1000, endsAt !== null);
  const restLeft = remainingSec(endsAt, tick);

  const exercise = live.exercise;
  const set = exercise?.sets[live.setIdx];
  const draft = useSetDraft(`${live.cursor.exerciseIdx}:${live.cursor.setIdx}`, set);

  if (!session) return <AtlasGymHub />;

  /**
   * Snapshot, then write, then show. `finishActiveSession` nulls the session, so
   * a summary derived after the call would describe nothing.
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
    await live.finish();
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
  const sessionComplete = sessionTotals.setsPlanned > 0 && sessionTotals.setsDone === sessionTotals.setsPlanned;
  const restPct = endsAt && totalSec > 0 ? (restLeft / totalSec) * 100 : 0;
  const exerciseVolume = exercise.sets.reduce((sum, s) => (s.done ? sum + s.weightKg * s.reps : sum), 0);

  const openDetail = () => {
    const full = exercise.exerciseId ? catalog.byId(exercise.exerciseId) : undefined;
    if (full) setDetail(full);
  };

  return (
    <>
      {header}

      {/* Directly under the header rather than after the dials: a countdown you
          have to scroll to find is not a countdown. Renders nothing when no rest
          clock is running, so it costs no space the rest of the time. */}
      <AtlasRestBar />

      <AtlasTrainStage
        exercise={exercise}
        onAddSlot={false}
        complete={exerciseComplete}
        restPct={restPct}
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

      <div className="at-exercise-name">{exercise.name}</div>
      <div className="at-exercise-meta">
        {t('train.exerciseOf', { n: live.cursor.exerciseIdx + 1, total: sessionExercises.length })}
        {exercise.target && ` · ${exercise.target}`}
        {exercise.equipment && ` · ${exercise.equipment}`}
      </div>

      {/* What the lift is worth to you: the number to beat, the number to match,
          and what you have put into it today. None of this reached the screen
          before, though every value was already derived. */}
      <div className="at-facts">
        <div className="at-fact">
          <small><Trophy size={11} /> {t('train.yourPr')}</small>
          <b>{exercise.best ? fmt.kgReps(exercise.best.weightKg, exercise.best.reps) : t('train.noPrYet')}</b>
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

      <div className="at-setpills">
        {exercise.sets.map((s, i) => (
          <button
            key={s.setNum}
            className="at-setpill"
            data-done={s.done}
            data-cur={i === live.setIdx}
            data-pr={s.isPr}
            onClick={() => live.goTo(live.cursor.exerciseIdx, i)}
            aria-label={t('train.setOf', { n: s.setNum, total: exercise.sets.length })}
          >
            {s.isPr ? <Trophy size={13} /> : s.done ? <Check size={14} strokeWidth={3} /> : s.setNum}
          </button>
        ))}
        <button className="at-setpill" onClick={live.addSet} aria-label={t('train.addSet')}>
          <Plus size={13} />
        </button>
      </div>

      {exerciseComplete ? (
        <div className="at-pad">
          <div className="at-card at-done">
            <span className="at-done-mark"><Check size={20} strokeWidth={3} /></span>
            <h4 className="at-serif">{t('train.exerciseDone')}</h4>
            <p>{t('train.exerciseDoneSub', { n: exercise.sets.length })}</p>
            {/* Finishing an exercise is the moment you decide what comes next, so
                the choice sits right here rather than only behind a gesture. */}
            <button
              className="at-btn"
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={() => actions.openOverlay('exercisePicker')}
            >
              <Plus size={16} /> {t('train.pickNext')}
            </button>
            <p className="at-swipe-hint">{t('train.swipeHint')}</p>
          </div>
        </div>
      ) : (
        <>
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

          <div className="at-pad at-setmeta">
            <span>{t('train.setsDone', { done, total: exercise.sets.length })}</span>
            {exercise.sets.length > 1 && (
              <button onClick={() => live.removeSet(live.setIdx)}>
                <Trash2 size={13} /> {t('train.removeSet')}
              </button>
            )}
          </div>
        </>
      )}

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
        {sessionComplete ? (
          <button className="at-btn" data-block="true" onClick={() => setFinishingAt(new Date())}>
            <Flag size={16} /> {t('train.finish')}
          </button>
        ) : exerciseComplete ? (
          <button
            className="at-btn"
            data-block="true"
            onClick={() => {
              const nextUnfinished = sessionExercises.findIndex(ex => ex.sets.some(s => !s.done));
              if (nextUnfinished !== -1) live.goToExercise(nextUnfinished);
              else actions.openOverlay('exercisePicker');
            }}
          >
            {t('train.nextExercise')}
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
