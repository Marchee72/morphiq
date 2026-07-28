import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Flag, Plus, Repeat, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppActions } from '../data/useAppData';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { useDismissOnBack } from '../components/useDismissOnBack';
import type { LiveSession } from '../data/useLiveSession';

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
export const AtlasSessionEditor: React.FC<{
  open: boolean;
  onClose: () => void;
  live: LiveSession;
  currentIdx: number;
  onGoTo: (index: number) => void;
  onFinish: () => void;
}> = ({ open, onClose, live, currentIdx, onGoTo, onFinish }) => {
  const { t } = useT();
  const actions = useAppActions();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useDismissOnBack(open, onClose, 'editor');

  if (!open) return null;

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
    <div className="at-editor" role="dialog" aria-label={t('train.editSession')}>
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
        {live.exercises.map((exercise, i) => (
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
              <button onClick={() => live.removeExercise(i)} title={t('train.remove')} aria-label={t('train.remove')} data-danger="true">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

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

          {confirmingDiscard ? (
            <div className="at-confirm">
              <p>{t('train.discardConfirm')}</p>
              <div className="at-confirm-actions">
                <button className="at-btn" data-ghost="true" onClick={() => setConfirmingDiscard(false)}>
                  {t('common.cancel')}
                </button>
                <button className="at-btn" data-danger="true" onClick={() => { onClose(); live.discard(); }}>
                  {t('train.discard')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="at-btn"
              data-ghost="true"
              data-danger="true"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setConfirmingDiscard(true)}
            >
              <Trash2 size={15} /> {t('train.discard')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
