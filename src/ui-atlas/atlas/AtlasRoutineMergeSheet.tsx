import React from 'react';
import { AlertTriangle, Plus, Repeat } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { normalizeName } from '../derive/records';
import { AtlasSheet } from './AtlasSheet';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';

/**
 * What to do with a routine when a session is already running.
 *
 * Starting a routine used to call `startActiveSessionWithRoutine`, which
 * replaced `activeSession` outright — every set logged so far vanished, with no
 * warning and no undo. Neither way out of this sheet can do that: appending
 * leaves the session untouched, and replacing only drops planned exercises
 * nobody has completed a set on. Work you have actually done always survives.
 *
 * Duplicates are counted here and reported before you commit, because there is
 * no toast in this app to report them after.
 */
export const AtlasRoutineMergeSheet: React.FC<{
  open: boolean;
  routine?: RoutineTemplate;
  onClose: () => void;
}> = ({ open, routine, onClose }) => {
  const { session, sessionExercises } = useAppData();
  const actions = useAppActions();
  const { t, tp } = useT();

  if (!open || !routine || !session) return null;

  const present = new Set(sessionExercises.map(ex => normalizeName(ex.name)));
  const fresh = routine.exercises.filter(ex => !present.has(normalizeName(ex.exerciseName)));
  const skipped = routine.exercises.length - fresh.length;
  // What "replace what is pending" would keep: the exercises you have finished a
  // set on. Everything else is a plan you are abandoning by switching routines.
  const logged = sessionExercises.filter(ex => ex.sets.some(s => s.done)).length;

  const apply = (mode: 'append' | 'replacePending') => {
    actions.applyRoutine(routine, mode);
    onClose();
    actions.navigate('train');
  };

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('merge.title')}
      subtitle={t('merge.subtitle', { title: session.title, n: sessionExercises.length })}
      footer={
        <button className="at-btn" data-ghost="true" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
          {t('common.cancel')}
        </button>
      }
    >
      <div className="at-card" style={{ padding: '8px 20px' }}>
        {routine.exercises.map((exercise, i) => {
          const already = present.has(normalizeName(exercise.exerciseName));
          return (
            <div
              key={exercise.exerciseId ?? exercise.exerciseName}
              className="at-routine-item"
              style={{ borderTop: i === 0 ? 'none' : undefined, opacity: already ? 0.45 : undefined }}
            >
              <span>{exercise.exerciseName}<small>{exercise.notes ?? ''}</small></span>
              <b>{exercise.targetSets} × {exercise.targetReps ?? 10}</b>
            </div>
          );
        })}
      </div>

      {skipped > 0 && (
        <div className="at-warn">
          <AlertTriangle size={15} />
          <span>{tp('merge.alreadyIn', skipped)}</span>
        </div>
      )}

      {fresh.length === 0 ? (
        <div className="at-warn">
          <AlertTriangle size={15} />
          <span>{t('merge.nothingNew')}</span>
        </div>
      ) : (
        <div className="at-field">
          <button
            className="at-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => apply('append')}
          >
            <Plus size={16} /> {tp('merge.append', fresh.length)}
          </button>
          <small className="at-field-hint">{t('merge.appendSub')}</small>
        </div>
      )}

      <div className="at-field">
        <button
          className="at-btn"
          data-ghost="true"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => apply('replacePending')}
        >
          <Repeat size={16} /> {t('merge.replace')}
        </button>
        {/* Switching routines before logging anything is a common enough path
            that "keeps the 0 exercises you have logged" would be absurd. */}
        <small className="at-field-hint">
          {logged === 0 ? t('merge.replaceEmpty') : tp('merge.replaceSub', logged)}
        </small>
      </div>
    </AtlasSheet>
  );
};
