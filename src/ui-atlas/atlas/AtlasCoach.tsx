import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData, useAppActions } from '../data/useAppData';
import { useCoachThread, useDismissedRoutines } from '../components/useCoachThread';
import { useStore } from '../../presentation/state/store';
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
        {/* The name and its copy action as one split pill: copying is about
            the routine itself, not one of the actions below. */}
        <div className="at-routine-pill">
          <h4><Sparkles size={14} /> {routine.title}</h4>
          <RoutineCopyButton routine={routine} className="at-routine-pill-copy" showLabel />
        </div>
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
      </div>
    </div>
  );
};

/** The starters: what to ask, and the kind of answer it gets. */
const PROMPTS: { key: StaticKey; kind: StaticKey }[] = [
  { key: 'coach.prompt.week', kind: 'coach.kind.week' },
  { key: 'coach.prompt.routine', kind: 'coach.kind.routine' },
  { key: 'coach.prompt.balance', kind: 'coach.kind.balance' },
  { key: 'coach.prompt.plateau', kind: 'coach.kind.plateau' },
];

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/**
 * The coach, as a chat: a header that stays, a thread that scrolls, and the
 * composer fixed above the dock.
 *
 * The composer used to sit at the end of the page, after the thread and a rail
 * of suggestions — so it scrolled away with the conversation and had to be
 * found again below every reply. Fixed, it is where the thumb already is; with
 * the keyboard up the dock steps aside for it (`keyboard-open` in atlas.css).
 */
export const AtlasCoach: React.FC = () => {
  const { coach, body, training } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();

  const turns = useCoachThread(coach.thread);
  const [dismissed, dismiss] = useDismissedRoutines();
  const [draft, setDraft] = useState('');
  const failed = useStore(s => s.chatError);
  /** Clearing wipes every message for good, so it asks first — in the header, where it was pressed. */
  const [confirmClear, setConfirmClear] = useState(false);

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
  }, [turns.length, coach.isLoading, failed]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || coach.isLoading) return;
    actions.sendCoachMessage(trimmed);
    setDraft('');
  };

  return (
    <>
      <header className="at-coach-head">
        {confirmClear ? (
          <>
            <b className="at-coach-confirm">{t('coach.clearConfirm')}</b>
            <button className="at-btn at-btn-sm" data-ghost="true" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="at-btn at-btn-sm"
              data-danger="true"
              onClick={() => { setConfirmClear(false); void useStore.getState().clearChat(); }}
            >
              {t('coach.clearYes')}
            </button>
          </>
        ) : (
          <>
            <span className="at-coach-avatar" aria-hidden="true"><Sparkles size={20} /></span>
            <div>
              <h1>{t('nav.coach')}</h1>
              <small>{t('coach.context', {
                sessions: tp('history.sessions', training.history.length),
                weighIns: tp('coach.weighIns', body.readingCount),
              })}</small>
            </div>
            {turns.length > 0 && (
              <button
                className="at-round-sm at-coach-clear"
                onClick={() => setConfirmClear(true)}
                disabled={coach.isLoading}
                aria-label={t('coach.clear')}
                title={t('coach.clear')}
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        )}
      </header>

      {turns.length === 0 ? (
        // Nothing asked yet: the starters are the screen, not a strip under it.
        <div className="at-coach-empty">
          <h2>{t('coach.empty')}</h2>
          <p>{t('coach.emptySub')}</p>
          <div className="at-coach-starters">
            {PROMPTS.map(prompt => (
              <button key={prompt.key} className="at-coach-starter" onClick={() => send(t(prompt.key))}>
                <small>{t(prompt.kind)}</small>
                <b>{t(prompt.key)}</b>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="at-coach-thread">
          {turns.map((turn, i) => (
            <React.Fragment key={turn.key}>
              {(i === 0 || !sameDay(turns[i - 1].at, turn.at)) && (
                <div className="at-coach-day">{fmt.relativeDay(turn.at)}</div>
              )}
              {turn.text && (
                <div className="at-msg" data-from={turn.from}>
                  <div className="at-bubble" data-from={turn.from}>{turn.text}</div>
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
            <div className="at-bubble at-typing" data-from="coach" role="status" aria-label={t('coach.thinking')}>
              <i /><i /><i />
            </div>
          )}
          {failed && !coach.isLoading && (
            <div className="at-coach-error" role="alert">
              <AlertTriangle size={17} />
              <span>
                <b>{t('coach.error')}</b>
                {t('coach.errorSub')}
              </span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="at-coach-dock">
        {turns.length > 0 && (
          <div className="at-coach-prompts">
            {PROMPTS.map(prompt => (
              <button key={prompt.key} className="at-chip" onClick={() => send(t(prompt.key))}>{t(prompt.key)}</button>
            ))}
          </div>
        )}
        <form
          className="at-searchpill at-coach-composer"
          onSubmit={e => { e.preventDefault(); send(draft); }}
        >
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            // The keyboard takes half the screen; keep the newest reply above it.
            onFocus={() => setTimeout(() => endRef.current?.scrollIntoView?.({ block: 'end' }), 300)}
            placeholder={t('coach.placeholder')}
            aria-label={t('coach.placeholder')}
          />
          <button
            type="submit"
            className="at-round"
            disabled={coach.isLoading || !draft.trim()}
            aria-label={t('coach.send')}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
    </>
  );
};
