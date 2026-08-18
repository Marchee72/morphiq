import React from 'react';
import { Dumbbell, Play, Plus, RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';

/**
 * A running session with nothing in it yet.
 *
 * This was one card saying "No exercises yet" over a button to the library,
 * which is the least useful moment in the app to offer only browsing: the
 * session clock is already running, and the three ways people actually fill a
 * session are picking a lift, running a routine they saved, and doing what they
 * did last time. Only the first was reachable, and the other two meant leaving
 * the screen.
 *
 * Everything here is already derived for other screens — routines for the hub,
 * the last session for Today — so this adds no new derivation, only the three
 * doors in one place.
 */
export const AtlasSessionStart: React.FC = () => {
  const { training, sessionDetail } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const routines = training.routines;
  /**
   * The most recent finished session, full stop.
   *
   * `today.previous` deliberately skips today — it backs Today's "last trained"
   * read, which is about the gap since you last went. Here that would be wrong:
   * train in the morning, start a second session in the evening, and the card
   * would offer to repeat the day before while ignoring the one you just did.
   */
  const previous = training.today.sessions[0] ?? training.today.previous;

  /**
   * The last session's exercises, or null when there is nothing to repeat.
   *
   * `sessionDetail` returns null once a session falls outside the loaded window,
   * and a finished session can hold no exercises at all, so both are the same
   * answer here: no card.
   */
  const last = previous ? sessionDetail(previous.id) : null;
  const repeatable = last && last.exercises.length > 0 ? last : null;

  /**
   * Routines append rather than going through `startRoutine`.
   *
   * That guards against a routine replacing a session already under way by
   * raising the merge sheet — but the sheet asks whether to append or to drop
   * the pending exercises, and in a session with neither sets nor exercises both
   * answers do exactly the same thing. Asking would be a tap that cannot change
   * the outcome.
   */
  const start = (title: string, exercises: { exerciseId: string; exerciseName: string; targetSets: number; targetReps?: number }[]) =>
    actions.applyRoutine({ title, exercises }, 'append');

  return (
    <>
      <div className="at-pad" style={{ paddingBottom: 4 }}>
        <div className="at-card at-empty">
          <span className="at-empty-icon"><Dumbbell size={20} /></span>
          <h4>{t('train.emptyPrompt')}</h4>
          <p>{t('train.emptyPromptSub')}</p>
          <button
            className="at-btn"
            data-block="true"
            onClick={() => actions.openOverlay('exercisePicker')}
          >
            <Plus size={16} /> {t('train.addExercise')}
          </button>
        </div>
      </div>

      {routines.length > 0 && (
        <>
          <div className="at-rail-head"><h3>{t('train.startFromRoutine')}</h3></div>
          <div className="at-pad">
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {routines.map((routine, i) => (
                <button
                  key={routine.id ?? routine.title}
                  className="at-routine-item"
                  style={{ borderTop: i === 0 ? 'none' : undefined }}
                  onClick={() => start(routine.title, routine.exercises)}
                >
                  <span>
                    {routine.title}
                    <small>{tp('unit.sets', routine.exercises.reduce((n, e) => n + e.targetSets, 0))}</small>
                  </span>
                  <b><Play size={15} /></b>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {repeatable && previous && (
        <>
          <div className="at-rail-head">
            <h3>{t('train.lastTimeLabel')}</h3>
            <span className="at-launch-when">{fmt.relativeDay(previous.at)}</span>
          </div>
          <div className="at-pad">
            <div className="at-card at-launch-repeat">
              <b>{repeatable.title}</b>
              {/* The lifts, not the count: "Bench · Row · Curl" is what tells you
                  whether this is the session you meant to repeat. */}
              <small>{repeatable.exercises.map(ex => ex.name).join(' · ')}</small>
              <button
                className="at-btn"
                data-ghost="true"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => start(
                  repeatable.title,
                  repeatable.exercises.map(ex => ({
                    exerciseId: ex.exerciseId ?? '',
                    exerciseName: ex.name,
                    // The sets that were performed, so repeating a session means
                    // the same work — not a default three every time.
                    targetSets: ex.sets.length,
                  })),
                )}
              >
                <RotateCcw size={15} /> {t('train.repeatSession')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
