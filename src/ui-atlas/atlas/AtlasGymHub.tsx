import React from 'react';
import { ArrowRight, Dumbbell, Play } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { AtlasStates } from './AtlasStates';

/**
 * The Train tab when no session is running.
 *
 * The concept only ever drew the live session, but the tab has to hold
 * everything the old gym screen did — starting a session, saved routines,
 * history, records and the week's totals — or those features disappear.
 */
export const AtlasGymHub: React.FC = () => {
  const { training } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();
  const now = new Date();

  return (
    <>
      <div className="at-greet">
        <div>
          <small>{t('today.thisWeek')}</small>
          <h1>{t('nav.train')}</h1>
        </div>
      </div>

      <div className="at-hero" data-idle="true">
        <span className="at-hero-tag">{t('today.noSession')}</span>
        <h2>{t('today.startSession')}</h2>
        <p>{t('today.noSessionSub')}</p>
        <button className="at-btn" onClick={() => actions.startSession()}>
          <Play size={15} /> {t('gym.startEmpty')} <i><ArrowRight size={16} /></i>
        </button>
      </div>

      <div className="at-rail-head"><h3>{t('today.thisWeek')}</h3></div>
      <div className="at-rail">
        <div className="at-moment">
          <span className="at-moment-icon"><Dumbbell size={17} /></span>
          <b>{training.weeklyStats.workouts}</b>
          <span>{t('gym.workouts')}</span>
        </div>
        <div className="at-moment">
          <span className="at-moment-icon"><Dumbbell size={17} /></span>
          <b>{training.weeklyStats.minutes}</b>
          <span>{t('gym.minutes')}</span>
        </div>
        <div className="at-moment">
          <span className="at-moment-icon"><Dumbbell size={17} /></span>
          <b>{fmt.n(training.weeklyStats.volumeKg / 1000, 1)}<small>{t('unit.tonnes')}</small></b>
          <span>{t('today.volume')}</span>
        </div>
      </div>

      <div className="at-rail-head"><h3>{t('gym.routines')}</h3></div>
      {training.routines.length > 0 ? (
        <div className="at-pad">
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {training.routines.map((routine, i) => (
              <button
                key={routine.id ?? routine.title}
                className="at-routine-item"
                style={{ borderTop: i === 0 ? 'none' : undefined, width: '100%' }}
                onClick={() => actions.startRoutine(routine)}
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
      ) : (
        <AtlasStates title={t('gym.noRoutines')} body={t('gym.noRoutinesSub')} />
      )}

      {training.records.length > 0 && (
        <>
          <div className="at-rail-head"><h3>{t('gym.records')}</h3></div>
          <div className="at-pad">
            <div className="at-card" style={{ padding: '8px 20px' }}>
              {training.records.slice(0, 4).map((record, i) => (
                <div key={record.exerciseName} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                  <span>{record.exerciseName}<small>{fmt.relativeDay(record.at, now)}</small></span>
                  <b>{fmt.kgReps(record.weightKg, record.reps)}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="at-rail-head"><h3>{t('gym.history')}</h3></div>
      {training.history.length > 0 ? (
        <div className="at-pad" style={{ paddingBottom: 24 }}>
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {training.history.slice(0, 10).map((entry, i) => (
              <div key={entry.id} className="at-routine-item" style={{ borderTop: i === 0 ? 'none' : undefined }}>
                <span>
                  {entry.title}
                  <small>
                    {fmt.relativeDay(entry.at, now)} · {entry.durationMin} min · {tp('unit.sets', entry.sets)}
                    {entry.prs > 0 && ` · ${entry.prs} PR`}
                  </small>
                </span>
                <b>{fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AtlasStates title={t('gym.noHistory')} body={t('today.noSessionSub')} />
      )}
    </>
  );
};
