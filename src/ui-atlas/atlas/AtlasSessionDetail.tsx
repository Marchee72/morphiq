import React from 'react';
import { Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { FEELING_OPTIONS } from '../../features/gym/feelingOptions';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { AtlasSheet } from './AtlasSheet';
import type { Exercise } from '../../core/entities/Exercise';

/**
 * A past session, opened up.
 *
 * `AtlasSessionSummary` shows this the moment you finish, but it reads from a
 * throwaway store and is gone by the next launch. This rebuilds the same view
 * from what was persisted, so any session in the history is openable — which is
 * what makes the history list worth tapping.
 */
export const AtlasSessionDetail: React.FC<{
  /** Null closes the sheet; the id is resolved against the loaded window. */
  workoutLogId: string | null;
  onClose: () => void;
  /** Opens the exercise detail for one of the lifts, when the host has one. */
  onOpenExercise?: (exercise: Exercise) => void;
}> = ({ workoutLogId, onClose, onOpenExercise }) => {
  const { t, tp, fmt } = useT();
  const { sessionDetail, catalog } = useAppData();

  if (!workoutLogId) return null;

  const detail = sessionDetail(workoutLogId);
  const now = new Date();

  if (!detail) {
    return (
      <AtlasSheet open onClose={onClose} title={t('session.detail')}>
        <p className="at-summary-empty">{t('session.notFound')}</p>
      </AtlasSheet>
    );
  }

  const feeling = FEELING_OPTIONS.find(f => f.id === detail.feeling);
  const { cardio } = detail;
  const rate = cardio?.readout === 'speed'
    ? fmt.speed(cardio.distanceKm, detail.durationMin)
    : cardio?.readout === 'pace'
      ? fmt.pace(cardio.distanceKm, detail.durationMin)
      : null;

  return (
    <AtlasSheet
      open
      onClose={onClose}
      title={detail.title}
      subtitle={`${fmt.dmy(detail.at)} · ${fmt.clock(detail.at)} · ${fmt.relativeDay(detail.at, now)}`}
      footer={<button className="at-btn" onClick={onClose}>{t('common.close')}</button>}
    >
      {/* An activity and a lifting session answer different questions, so they
          get different tiles. Only the ones with a number are rendered — a
          treadmill run has no distance, and a dash in its place says nothing. */}
      <div className="at-summary-stats">
        <div>
          <b>{detail.durationMin}<i>min</i></b>
          <small>{t('summary.duration')}</small>
        </div>

        {cardio ? (
          <>
            {cardio.distanceKm != null && (
              <div>
                <b>{fmt.n(cardio.distanceKm, 2)}<i>{t('unit.km')}</i></b>
                <small>{t('cardio.distance')}</small>
              </div>
            )}
            {rate && (
              <div>
                <b>{rate}</b>
                <small>{cardio.readout === 'speed' ? t('cardio.speed') : t('cardio.pace')}</small>
              </div>
            )}
            {cardio.calories != null && (
              <div>
                <b>{fmt.n(cardio.calories)}<i>{t('unit.kcal')}</i></b>
                <small>{t('today.calories')}</small>
              </div>
            )}
            {cardio.avgHeartRate != null && (
              <div>
                <b>{fmt.n(cardio.avgHeartRate)}<i>bpm</i></b>
                <small>
                  {t('cardio.avgHr')}
                  {cardio.maxHeartRate != null && ` · ${t('cardio.maxHr', { n: fmt.n(cardio.maxHeartRate) })}`}
                </small>
              </div>
            )}
            {cardio.steps != null && (
              <div>
                <b>{fmt.n(cardio.steps)}</b>
                <small>{t('today.steps')}</small>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <b>{fmt.n(detail.volumeKg)}<i>{t('unit.kg')}</i></b>
              <small>{t('summary.volume')}</small>
            </div>
            <div>
              <b>{detail.setsDone}</b>
              <small>{t('summary.sets')}</small>
            </div>
            <div>
              <b>{detail.exercises.length}</b>
              <small>{t('summary.exercises')}</small>
            </div>
          </>
        )}
      </div>

      {feeling && (
        <span className="at-summary-feeling">
          <span aria-hidden="true">{feeling.emoji}</span> {t(feeling.labelKey)}
        </span>
      )}

      {detail.notes && (
        <div>
          <div className="at-field-label">{t('session.notes')}</div>
          <p className="at-detail-credit">{detail.notes}</p>
        </div>
      )}

      {cardio ? (
        // Not "no sets were logged" — for a run there were never sets to log.
        <p className="at-summary-empty">{t('cardio.fromWatch')}</p>
      ) : detail.exercises.length > 0 ? (
        <div className="at-past">
          {detail.exercises.map(exercise => {
            // Free-text exercises carry no catalogue entry, so there is nothing
            // to open — those rows stay static rather than pretending to be taps.
            const catalogEntry = exercise.exerciseId ? catalog.byId(exercise.exerciseId) : undefined;
            const openable = Boolean(onOpenExercise && catalogEntry);

            const body = (
              <>
                <div className="at-past-head">
                  <b>{exercise.name}</b>
                  <span>
                    {tp('unit.sets', exercise.sets.length)}
                    {exercise.volumeKg > 0 && ` · ${fmt.n(exercise.volumeKg)} ${t('unit.kg')}`}
                  </span>
                </div>
                <div className="at-past-sets">
                  {exercise.sets.map(set => (
                    <span key={set.setNum} className="at-past-set" data-pr={set.isPr}>
                      {set.isPr && <Trophy size={10} />}
                      {fmt.kgReps(set.weightKg, set.reps)}
                    </span>
                  ))}
                </div>
              </>
            );

            return openable ? (
              <button
                key={exercise.key}
                className="at-past-session at-past-tap"
                onClick={() => onOpenExercise?.(catalogEntry!)}
                aria-label={t('session.viewExercise')}
              >
                <span className="at-past-thumb">
                  <ExerciseThumb name={exercise.name} image={exercise.image} />
                </span>
                <span className="at-past-body">{body}</span>
              </button>
            ) : (
              <div key={exercise.key} className="at-past-session">{body}</div>
            );
          })}
        </div>
      ) : (
        <p className="at-summary-empty">{t('session.noSets')}</p>
      )}
    </AtlasSheet>
  );
};
