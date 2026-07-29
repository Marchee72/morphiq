import React from 'react';
import { Play } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { latestRoutineIn } from '../components/useCoachThread';
import { AtlasSheet } from './AtlasSheet';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';

/**
 * The question that used to have one silent answer.
 *
 * Both start buttons — Today's hero and the gym hub's — called `startSession()`
 * and dropped you into an empty session, so a saved routine could only be
 * started from a list further down a different screen. Now every way into a
 * workout passes through here, and the routines are the first thing offered.
 *
 * `beginSession` decides whether this appears at all: with nothing saved and
 * nothing from the coach, a sheet with one option in it is just a tap tax.
 */
export const AtlasStartSheet: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { training, coach } = useAppData();
  const actions = useAppActions();
  const { t, tp } = useT();

  const fromCoach = latestRoutineIn(coach.thread);
  /**
   * The coach's card carries a Save button, so the routine on screen is often
   * the one already sitting in the list below. Offering it twice reads as two
   * different routines that happen to share a name.
   */
  const showCoach = fromCoach !== null && !training.routines.some(r => r.title === fromCoach.title);

  const setsIn = (routine: RoutineTemplate) =>
    routine.exercises.reduce((n, e) => n + e.targetSets, 0);

  // Closing first: `startRoutine` may raise the merge sheet, and the shell holds
  // one overlay at a time — leaving this open would swallow it.
  const start = (routine: RoutineTemplate) => { onClose(); actions.startRoutine(routine); };

  const row = (routine: RoutineTemplate, first: boolean) => (
    <button
      key={routine.id ?? routine.title}
      className="at-routine-item"
      style={{ borderTop: first ? 'none' : undefined }}
      onClick={() => start(routine)}
    >
      <span>{routine.title}<small>{tp('unit.sets', setsIn(routine))}</small></span>
      <b><Play size={15} /></b>
    </button>
  );

  return (
    <AtlasSheet open={open} onClose={onClose} title={t('start.title')} subtitle={t('start.subtitle')}>
      <div className="at-card" style={{ padding: '8px 20px' }}>
        <button
          className="at-routine-item"
          style={{ borderTop: 'none' }}
          onClick={() => { onClose(); actions.startSession(); }}
        >
          <span>{t('start.empty')}<small>{t('start.emptySub')}</small></span>
          <b><Play size={15} /></b>
        </button>
      </div>

      {training.routines.length > 0 && (
        <div className="at-field">
          <div className="at-field-label">{t('gym.routines')}</div>
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {training.routines.map((routine, i) => row(routine, i === 0))}
          </div>
        </div>
      )}

      {showCoach && (
        <div className="at-field">
          <div className="at-field-label">{t('start.fromCoach')}</div>
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {row(fromCoach, true)}
          </div>
        </div>
      )}
    </AtlasSheet>
  );
};
