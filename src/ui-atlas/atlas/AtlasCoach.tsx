import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useCoachThread, useDismissedRoutines } from '../components/useCoachThread';
import { useStore } from '../../presentation/state/store';
import { AtlasStates } from './AtlasStates';
import type { StaticKey } from '../../i18n/types';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import { RoutineCopyButton } from '../components/RoutineCopyButton';

/**
 * One routine the coach proposed, rendered where it was proposed.
 *
 * Its own component now that there is one per turn rather than one per screen —
 * the copy button and the dismiss button both need local state, and a card that
 * held them inline would put that state on the whole thread.
 */
const RoutineCard: React.FC<{
  routine: RoutineTemplate;
  onStart: () => void;
  onSave: () => void;
  /** Absent when the message has no stable id to remember the dismissal against. */
  onDismiss?: () => void;
}> = ({ routine, onStart, onSave, onDismiss }) => {
  const { t } = useT();
  const totalSets = routine.exercises.reduce((n, e) => n + e.targetSets, 0);

  return (
    <div className="at-routine">
      <div className="at-routine-head">
        <h4>{routine.title}</h4>
        {onDismiss && (
          <button className="at-routine-dismiss" onClick={onDismiss} aria-label={t('coach.dismissRoutine')}>
            <X size={15} />
          </button>
        )}
      </div>
      <div className="at-routine-meta">
        {t('coach.routineMeta', { sets: totalSets, min: Math.round(totalSets * 3) })}
      </div>
      {routine.exercises.map(exercise => (
        <div key={exercise.exerciseName} className="at-routine-item">
          <span>{exercise.exerciseName}<small>{exercise.notes ?? ''}</small></span>
          {/* Sets alone when no reps were prescribed. This used to print a
              fabricated 10, which read as the coach's instruction. */}
          <b>
            {exercise.targetReps != null
              ? `${exercise.targetSets} × ${exercise.targetReps}`
              : t('coach.setsOnly', { n: exercise.targetSets })}
            {exercise.targetWeight != null && ` · ${exercise.targetWeight} kg`}
          </b>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button
          className="at-btn"
          style={{ flex: 1, justifyContent: 'center', padding: 12 }}
          onClick={onStart}
        >
          {t('coach.startRoutine')}
        </button>
        <button className="at-btn" data-ghost="true" onClick={onSave}>
          {t('coach.saveRoutine')}
        </button>
        <RoutineCopyButton routine={routine} />
      </div>
    </div>
  );
};

const PROMPTS: StaticKey[] = ['coach.prompt.week', 'coach.prompt.routine', 'coach.prompt.balance', 'coach.prompt.plateau'];

export const AtlasCoach: React.FC = () => {
  const { coach, body, training } = useAppData();
  const actions = useAppActions();
  const { t, fmt } = useT();

  const turns = useCoachThread(coach.thread);
  const [dismissed, dismiss] = useDismissedRoutines();
  const [draft, setDraft] = useState('');

  /**
   * Pins the thread to its newest message.
   *
   * `AppShell` keys the scroll container on the screen, so opening Coach mounts
   * it at the very top — on the oldest message in the history. With the routine
   * card hoisted out of the thread that was merely odd; now that a card sits
   * where the coach proposed it, landing at the top would hide every one of
   * them. Same `endRef` the buddy thread uses.
   */
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [turns.length, coach.isLoading]);

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
            <React.Fragment key={turn.key}>
              {turn.text && (
                <div className="at-bubble" data-from={turn.from}>
                  {turn.text}
                  <span className="at-bubble-time">{fmt.clock(turn.at)}</span>
                </div>
              )}
              {/* The routine renders with the message that proposed it, rather
                  than in a slot at the end of the screen — where the newest one
                  landed regardless of which turn it came from, and every older
                  one was simply dropped. */}
              {turn.routine && !dismissed.has(turn.key) && (
                <RoutineCard
                  routine={turn.routine}
                  onStart={() => actions.startRoutine(turn.routine!)}
                  onSave={() => void useStore.getState().saveRoutineTemplate(turn.routine!)}
                  // Only when the message has a real id: `turn.key` falls back
                  // to the array index, which names a different message as soon
                  // as the thread grows.
                  onDismiss={turn.hasId ? () => dismiss(turn.key) : undefined}
                />
              )}
            </React.Fragment>
          ))}
          {coach.isLoading && (
            <div className="at-bubble" data-from="coach">{t('coach.thinking')}…</div>
          )}
          <div ref={endRef} />
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
