import React from 'react';
import { Heart, Plus, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useAppData, useAppActions } from '../data/useAppData';
import { mediaUrl } from '../derive/catalog';
import { normalizeName } from '../derive/records';
import { AtlasSheet } from './AtlasSheet';
import type { Exercise } from '../../core/entities/Exercise';

/**
 * What an exercise actually is: the animation, the steps, the muscles it hits,
 * and your own best on it.
 *
 * The classic app had this screen and it was lost when the classic shell went —
 * for a while there was no way to see how an exercise is performed at all,
 * which for a 1,324-entry catalogue full of unfamiliar names is a real gap.
 */
export const AtlasExerciseDetail: React.FC<{
  exercise: Exercise | null;
  onClose: () => void;
}> = ({ exercise, onClose }) => {
  const { t, tp, fmt } = useT();
  const { catalog, session, exerciseHistory } = useAppData();
  const actions = useAppActions();
  const favouriteIds = useStore(s => s.favoriteExerciseIds);
  const addExercise = useStore(s => s.addActiveSessionExercise);

  if (!exercise) return null;

  const item = catalog.toItem(exercise);
  const isFavourite = favouriteIds.includes(exercise.id);
  const secondary = exercise.secondaryMuscles.filter(Boolean);
  const past = exerciseHistory(exercise.name);
  const now = new Date();

  return (
    <AtlasSheet
      open
      onClose={onClose}
      title={exercise.name}
      subtitle={`${exercise.equipment} · ${exercise.target}`}
      footer={
        <>
          <button
            className="at-btn"
            data-ghost="true"
            onClick={() => actions.toggleFavorite(exercise.id)}
            aria-pressed={isFavourite}
          >
            <Heart size={15} fill={isFavourite ? 'var(--clay)' : 'none'} /> {t('detail.favourite')}
          </button>
          {session && (
            <button
              className="at-btn"
              onClick={() => { addExercise({ id: exercise.id, name: exercise.name }); onClose(); }}
            >
              <Plus size={15} /> {t('detail.addToSession')}
            </button>
          )}
        </>
      }
    >
      {/* The animated GIF is the point of this sheet, so it leads. */}
      {exercise.gifUrl && (
        <img
          className="at-detail-gif"
          src={mediaUrl(exercise.gifUrl)}
          alt={exercise.name}
          loading="lazy"
        />
      )}

      <div className="at-detail-stats">
        <div>
          <small>{t('detail.yourBest')}</small>
          <b>{item.bestKg ? `${fmt.n(item.bestKg, 1)} ${t('unit.kg')}` : t('detail.noHistory')}</b>
        </div>
        <div>
          <small>{t('detail.primary')}</small>
          <b>{exercise.target}</b>
        </div>
      </div>

      {/* Every session you have done this lift, newest first. The aggregate
          above says how strong you got; this says how you got there — whether
          the last number was a step up, and how long you have sat on it. */}
      {past.length > 0 && (
        <div>
          <div className="at-field-label">{t('detail.previousSessions')}</div>
          <div className="at-past">
            {past.map(entry => (
              <div key={entry.workoutLogId} className="at-past-session">
                <div className="at-past-head">
                  <b>{fmt.dmy(entry.at)}</b>
                  <span>
                    {fmt.relativeDay(entry.at, now)} · {tp('unit.sets', entry.sets.length)}
                    {entry.volumeKg > 0 && ` · ${fmt.n(entry.volumeKg)} ${t('unit.kg')}`}
                  </span>
                </div>
                <div className="at-past-sets">
                  {entry.sets.map(set => (
                    <span key={set.setNum} className="at-past-set" data-pr={set.isPr}>
                      {set.isPr && <Trophy size={10} />}
                      {fmt.kgReps(set.weightKg, set.reps)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {exercise.instructionSteps.length > 0 && (
        <div>
          <div className="at-field-label">{t('detail.instructions')}</div>
          <ol className="at-detail-steps">
            {exercise.instructionSteps.map((step, i) => (
              <li key={`${normalizeName(exercise.name)}-${i}`}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {secondary.length > 0 && (
        <div>
          <div className="at-field-label">{t('detail.secondary')}</div>
          <div className="at-choice">
            {secondary.map(muscle => (
              <span key={muscle} className="at-chip" data-static="true">{muscle}</span>
            ))}
          </div>
        </div>
      )}

      {exercise.attribution && (
        <p className="at-detail-credit">{exercise.attribution}</p>
      )}
    </AtlasSheet>
  );
};
