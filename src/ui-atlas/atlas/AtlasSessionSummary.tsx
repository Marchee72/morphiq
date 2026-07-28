import React, { useState } from 'react';
import { BookmarkPlus, Check, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { FEELING_OPTIONS } from '../../features/gym/feelingOptions';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { useDismissOnBack } from '../components/useDismissOnBack';
import { useSessionSummary } from '../state/sessionSummary';

/**
 * What you just did.
 *
 * Finishing used to drop you back on Today with no acknowledgement at all — an
 * hour of work ended in a screen transition. This is the payoff: the totals, the
 * records you set, and every exercise you actually performed.
 *
 * It reads from `useSessionSummary` rather than the app data, because by the time
 * it renders the session it describes no longer exists — `finishActiveSession`
 * has already nulled it.
 */
export const AtlasSessionSummary: React.FC = () => {
  const { t, tp, fmt } = useT();
  const summary = useSessionSummary(s => s.summary);
  const dismiss = useSessionSummary(s => s.dismiss);
  const saveRoutineTemplate = useStore(s => s.saveRoutineTemplate);

  const [saved, setSaved] = useState(false);

  useDismissOnBack(summary !== null, dismiss, 'summary');

  if (!summary) return null;

  const feeling = FEELING_OPTIONS.find(f => f.id === summary.feeling);

  const saveAsRoutine = async () => {
    setSaved(true);
    await saveRoutineTemplate({
      title: summary.title,
      description: '',
      targetMuscles: [],
      exercises: summary.exercises.map(row => ({
        exerciseId: row.exerciseId ?? '',
        exerciseName: row.name,
        targetSets: row.setsDone,
        targetReps: row.topSet?.reps,
      })),
    // Best-effort: the recap is still worth showing if the routine write fails.
    }).catch(() => setSaved(false));
  };

  return (
    <div className="at-summary" role="dialog" aria-label={t('summary.title')}>
      <div className="at-summary-head">
        <span className="at-summary-mark"><Check size={26} strokeWidth={3} /></span>
        <small>{t('summary.subtitle')}</small>
        <h2 className="at-serif">{summary.title}</h2>
        {feeling && (
          <span className="at-summary-feeling">
            <span aria-hidden="true">{feeling.emoji}</span> {t(feeling.labelKey)}
          </span>
        )}
      </div>

      <div className="at-summary-stats">
        <div>
          <b>{fmt.duration(summary.durationSec)}</b>
          <small>{t('summary.duration')}</small>
        </div>
        <div>
          <b>{fmt.n(summary.volumeKg)}<i>{t('unit.kg')}</i></b>
          <small>{t('summary.volume')}</small>
        </div>
        <div>
          <b>{summary.setsDone}</b>
          <small>{t('summary.sets')}</small>
        </div>
        <div>
          <b>{summary.exercisesDone}</b>
          <small>{t('summary.exercises')}</small>
        </div>
      </div>

      {summary.prs.length > 0 && (
        <>
          <div className="at-rail-head">
            <h3><Trophy size={14} color="var(--clay)" /> {t('summary.records')}</h3>
          </div>
          <div className="at-pad">
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {summary.prs.map((pr, i) => (
                <div
                  key={`${pr.exerciseName}-${pr.weightKg}-${pr.reps}-${i}`}
                  className="at-routine-item"
                  style={{ borderTop: i === 0 ? 'none' : undefined }}
                >
                  <span>{pr.exerciseName}<small>{t('train.personalRecord')}</small></span>
                  <b>{fmt.kgReps(pr.weightKg, pr.reps)}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="at-rail-head"><h3>{t('summary.exercises')}</h3></div>
      {summary.exercises.length > 0 ? (
        <div className="at-pad">
          {summary.exercises.map(row => (
            <div key={row.key} className="at-card at-summary-row">
              <span className="at-editor-thumb">
                <ExerciseThumb name={row.name} image={row.image} />
              </span>
              <div className="at-editor-name">
                <b>{row.name}</b>
                <small>
                  {tp('unit.sets', row.setsDone)}
                  {row.topSet && ` · ${fmt.kgReps(row.topSet.weightKg, row.topSet.reps)}`}
                </small>
              </div>
              {row.prCount > 0 && <span className="at-pr-badge"><Trophy size={12} /></span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="at-pad"><p className="at-summary-empty">{t('summary.noSets')}</p></div>
      )}

      <div className="at-summary-actions">
        <button className="at-btn" data-ghost="true" onClick={saveAsRoutine} disabled={saved}>
          <BookmarkPlus size={15} /> {saved ? t('summary.savedAsRoutine') : t('summary.saveAsRoutine')}
        </button>
        <button className="at-btn" onClick={dismiss}>{t('summary.done')}</button>
      </div>
    </div>
  );
};
