import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useCoachThread, latestRoutine } from '../components/useCoachThread';
import { useStore } from '../../presentation/state/store';
import { AtlasStates } from './AtlasStates';
import type { StaticKey } from '../../i18n/types';

const PROMPTS: StaticKey[] = ['coach.prompt.week', 'coach.prompt.routine', 'coach.prompt.balance', 'coach.prompt.plateau'];

export const AtlasCoach: React.FC = () => {
  const { coach, body, training } = useAppData();
  const actions = useAppActions();
  const { t, fmt } = useT();

  const turns = useCoachThread(coach.thread);
  const routine = latestRoutine(turns);
  const [draft, setDraft] = useState('');

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || coach.isLoading) return;
    actions.sendCoachMessage(trimmed);
    setDraft('');
  };

  return (
    <>
      <div className="at-greet">
        <div>
          <small>
            {t('coach.context', { sessions: training.history.length, weighIns: body.readingCount })}
          </small>
          <h1>{t('nav.coach')}</h1>
        </div>
        <button className="at-avatar" style={{ background: 'var(--sage)' }} aria-hidden="true">
          <Sparkles size={18} />
        </button>
      </div>

      {turns.length === 0 ? (
        <AtlasStates icon={<Sparkles size={22} />} title={t('coach.empty')} body={t('coach.emptySub')} />
      ) : (
        <div className="at-pad">
          {turns.map(turn => (
            <div key={turn.key} className="at-bubble" data-from={turn.from}>
              {turn.text}
              <span className="at-bubble-time">{fmt.clock(turn.at)}</span>
            </div>
          ))}
          {coach.isLoading && (
            <div className="at-bubble" data-from="coach">{t('coach.thinking')}…</div>
          )}
        </div>
      )}

      {routine && (
        <div className="at-pad" style={{ paddingTop: 8 }}>
          <div className="at-routine">
            <h4>{routine.title}</h4>
            <div className="at-routine-meta">
              {t('coach.routineMeta', {
                sets: routine.exercises.reduce((n, e) => n + e.targetSets, 0),
                min: Math.round(routine.exercises.reduce((n, e) => n + e.targetSets, 0) * 3),
              })}
            </div>
            {routine.exercises.map(exercise => (
              <div key={exercise.exerciseName} className="at-routine-item">
                <span>{exercise.exerciseName}<small>{exercise.notes ?? ''}</small></span>
                <b>{exercise.targetSets} × {exercise.targetReps ?? 10}</b>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                className="at-btn"
                style={{ flex: 1, justifyContent: 'center', padding: 12 }}
                onClick={() => actions.startRoutine(routine)}
              >
                {t('coach.startRoutine')}
              </button>
              <button
                className="at-btn"
                data-ghost="true"
                onClick={() => useStore.getState().saveRoutineTemplate(routine)}
              >
                {t('coach.saveRoutine')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="at-rail-head"><h3>{t('coach.ask')}</h3></div>
      <div className="at-chiprail" style={{ flexWrap: 'wrap' }}>
        {PROMPTS.map(key => (
          <button key={key} className="at-chip" onClick={() => send(t(key))}>{t(key)}</button>
        ))}
      </div>

      <div className="at-pad" style={{ paddingTop: 14, paddingBottom: 26 }}>
        <form
          className="at-searchpill"
          onSubmit={e => { e.preventDefault(); send(draft); }}
        >
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={t('coach.placeholder')}
            aria-label={t('coach.placeholder')}
          />
          <button type="submit" className="at-round" disabled={coach.isLoading} aria-label={t('coach.send')}>
            <Send size={15} />
          </button>
        </form>
      </div>
    </>
  );
};
