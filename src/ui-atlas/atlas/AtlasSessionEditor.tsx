import React from 'react';
import { ArrowDown, ArrowUp, Flag, Plus, Repeat, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppActions } from '../data/useAppData';
import { normalizeName } from '../derive/records';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { useDismissOnBack } from '../components/useDismissOnBack';
import type { LiveSession } from '../data/useLiveSession';
import { UndoAction } from '../kit/time-undo-action';

interface SessionListProps {
  onClose: () => void;
  live: LiveSession;
  currentIdx: number;
  onGoTo: (index: number) => void;
  onFinish: () => void;
}

/**
 * The panel, mounted only while it is open.
 *
 * The gate is a wrapper rather than an `if (!open) return null` inside, because
 * that early return keeps the component mounted and its state alive. Here that
 * state is a running undo countdown: closing the panel with the X unmounts it,
 * which cancels the countdown — the X reads as "cancel", so it means it.
 */
export const AtlasSessionEditor: React.FC<SessionListProps & { open: boolean }> = ({ open, ...rest }) =>
  open ? <SessionList {...rest} /> : null;

/**
 * The session's exercise list: where you are, where else you could be, and what
 * to change.
 *
 * This started as a reorder/swap surface, which is why it was called an editor.
 * But it is what the top-right button opens, so it is the list — and a list you
 * cannot navigate from is a strange thing. Rows are the primary action now
 * (tap to go there); the tools sit to the side.
 *
 * Finish and discard live here too. Both are session-scoped decisions rather
 * than set-scoped ones, and neither belongs next to the button you press forty
 * times an hour.
 */
const SessionList: React.FC<SessionListProps> = ({ onClose, live, currentIdx, onGoTo, onFinish }) => {
  const { t, tp } = useT();
  const actions = useAppActions();
  useDismissOnBack(true, onClose, 'editor');

  const jump = (index: number) => { onGoTo(index); onClose(); };

  /**
   * Stand down before handing over to the picker.
   *
   * The list is a full-screen panel and the picker is another one. Leaving this
   * open underneath means that after choosing an exercise you land back on the
   * list rather than on the exercise you just picked — and the list, still
   * covering the screen, swallows every gesture aimed at it.
   */
  const openPicker = (payload?: { swapIndex: number }) => {
    onClose();
    actions.openOverlay('exercisePicker', payload);
  };

  return (
    <div className="at-editor-scrim" onClick={onClose}>
      <div
        className="at-editor"
        role="dialog"
        aria-modal="true"
        aria-label={t('train.editSession')}
        onClick={e => e.stopPropagation()}
      >
      <div className="at-editor-head">
        <div>
          <small>{t('train.editSession')}</small>
          <h3 className="at-serif">{t('train.exercises')}</h3>
        </div>
        <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <div className="at-pad">
        {live.exercises.map((exercise, i) => {
          const logged = exercise.sets.filter(s => s.done).length;
          /**
           * Whether removing this row actually costs anything.
           *
           * Sets belong to an exercise *name*, not to a row — `dropSetsFor` and
           * `buildSessionExercises` both key that way — so with the same
           * exercise on two rows the sets stay with the row that remains and
           * this removal loses nothing. Asking anyway would put a scary count
           * on a free action.
           */
          const twin = live.exercises.some(
            (other, j) => j !== i && normalizeName(other.name) === normalizeName(exercise.name),
          );
          const losesSets = logged > 0 && !twin;
          return (
          <div key={exercise.key} className="at-card at-editor-row" data-cur={i === currentIdx}>
            <button
              className="at-editor-jump"
              onClick={() => jump(i)}
              aria-label={t('train.goToExercise', { name: exercise.name })}
              aria-current={i === currentIdx ? 'true' : undefined}
            >
              <span className="at-editor-thumb">
                <ExerciseThumb name={exercise.name} image={exercise.image} />
              </span>
              <span className="at-editor-name">
                <b>{exercise.name}</b>
                <small>
                  {t('train.setsDone', {
                    done: exercise.sets.filter(s => s.done).length,
                    total: exercise.sets.length,
                  })}
                  {i === currentIdx && ` · ${t('train.currentExercise')}`}
                </small>
              </span>
            </button>

            <div className="at-editor-tools">
              <button
                onClick={() => live.reorderExercises(i, i - 1)}
                disabled={i === 0}
                aria-label={t('common.of', { a: i, b: live.exercises.length })}
                title="↑"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => live.reorderExercises(i, i + 1)}
                disabled={i === live.exercises.length - 1}
                title="↓"
              >
                <ArrowDown size={15} />
              </button>
              {/* The index travels with the request — the picker lives in the
                  shell and has no other way to know which row asked. */}
              <button
                onClick={() => openPicker({ swapIndex: i })}
                title={t('train.swap')}
                aria-label={t('train.swap')}
              >
                <Repeat size={15} />
              </button>
              {/* Nothing to lose, nothing to ask: an exercise with no logged
                  sets goes on the tap. One that takes sets with it counts down
                  five seconds with an undo instead of asking — removed by key,
                  so moving a row mid-countdown cannot delete a different one. */}
              {losesSets ? (
                <UndoAction
                  className="at-editor-undo"
                  label={<Trash2 size={15} />}
                  ariaLabel={t('train.remove')}
                  undoLabel={tp('train.undoRemove', logged)}
                  seconds={5}
                  onCommit={() => {
                    const at = live.exercises.findIndex(e => e.key === exercise.key);
                    if (at !== -1) live.removeExercise(at);
                  }}
                />
              ) : (
                <button
                  onClick={() => live.removeExercise(i)}
                  title={t('train.remove')}
                  aria-label={t('train.remove')}
                  data-danger="true"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          );
        })}

        <button
          className="at-btn"
          data-ghost="true"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          onClick={() => openPicker()}
        >
          <Plus size={16} /> {t('train.addExercise')}
        </button>

        <div className="at-editor-session">
          <button
            className="at-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { onClose(); onFinish(); }}
          >
            <Flag size={15} /> {t('train.finish')}
          </button>

          {/* Ten seconds to take it back instead of a question: the undo is
              right where the finger is. */}
          <UndoAction
            className="at-editor-discard"
            icon={<Trash2 size={15} />}
            label={t('train.discard')}
            undoLabel={t('train.undoDiscard')}
            seconds={10}
            onCommit={() => { onClose(); live.discard(); }}
          />
        </div>
      </div>
      </div>
    </div>
  );
};
