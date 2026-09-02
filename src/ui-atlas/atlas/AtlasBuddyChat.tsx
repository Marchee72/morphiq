import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, Send, Users } from 'lucide-react';
import { useT } from '../../i18n';
import { RoutineCopyButton } from '../components/RoutineCopyButton';
import { useStore } from '../../presentation/state/store';
import { useSocial } from '../data/useSocial';
import { useAppData } from '../data/useAppData';
import type { BuddyMessageVM, BuddyRowVM } from '../derive/social';
import { AtlasSheet } from './AtlasSheet';

/** Matches the server's cap. Beyond it the request is refused, not truncated. */
const MAX_BODY = 2000;

/**
 * One conversation.
 *
 * Coordination, not correspondence — "¿vas a las 18?" and an answer. So the
 * thread is plain text with a date header per day, and the composer is one
 * line: everything that would make this a messaging app is deliberately absent.
 */
export const AtlasBuddyChat: React.FC<{
  row: BuddyRowVM;
  onClose: () => void;
}> = ({ row, onClose }) => {
  const { t, tp, fmt } = useT();
  const {
    conversation, watchConversation, sendMessage, shared, startShared, shareRoutine,
  } = useSocial();
  const { training } = useAppData();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [togetherFailed, setTogetherFailed] = useState(false);
  const [picking, setPicking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const days = conversation(row.linkId);

  // Following starts on open and stops on close, so a thread left open in a
  // pocket is not still polling.
  useEffect(() => watchConversation(row.linkId), [watchConversation, row.linkId]);

  const lastId = days.at(-1)?.messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setFailed(false);
    try {
      await sendMessage(row.linkId, body);
      setDraft('');
    } catch {
      // Kept in the box rather than lost: retyping a message the gym's signal
      // ate is the one thing guaranteed to annoy.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const propose = async () => {
    setTogetherFailed(false);
    try {
      await startShared(row.linkId);
    } catch {
      setTogetherFailed(true);
    }
  };

  return (
    <AtlasSheet
      open
      onClose={onClose}
      title={row.name || '—'}
      subtitle={t('buddy.title')}
      footer={
        <div className="at-buddy-composer">
          <input
            className="at-input"
            value={draft}
            maxLength={MAX_BODY}
            placeholder={t('buddy.chatPlaceholder')}
            aria-label={t('buddy.chatPlaceholder')}
            onChange={e => { setDraft(e.target.value); setFailed(false); }}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          />
          <button
            className="at-round"
            disabled={sending || draft.trim().length === 0}
            aria-label={t('buddy.chatSend')}
            onClick={() => void submit()}
          >
            <Send size={16} />
          </button>
        </div>
      }
    >
      {row.muted && <p className="at-field-hint">{t('buddy.chatMuted')}</p>}

      {/* Offered only while you are not already in one. Two containers between
          the same two people is the failure this whole feature exists to avoid,
          and the tidiest place to prevent it is not showing the button. */}
      {!row.muted && !shared && (
        <button className="at-buddy-together" onClick={() => void propose()}>
          <Users size={15} />
          <span>
            <b>{t('buddy.together')}</b>
            <small>{t('buddy.togetherSub')}</small>
          </span>
        </button>
      )}
      {togetherFailed && <span className="at-buddy-error">{t('buddy.togetherFailed')}</span>}

      {!row.muted && (
        <button className="at-buddy-together" onClick={() => setPicking(true)}>
          <ClipboardList size={15} />
          <span>
            <b>{t('buddy.shareRoutine')}</b>
            <small>{t('buddy.shareRoutineSub')}</small>
          </span>
        </button>
      )}

      {picking && (
        <div className="at-buddy-pick">
          <span className="at-buddy-picklabel">{t('buddy.shareRoutinePick')}</span>
          {training.routines.length === 0 ? (
            <p className="at-field-hint">{t('buddy.shareRoutineNone')}</p>
          ) : (
            training.routines.map(routine => (
              <button
                key={routine.id ?? routine.title}
                className="at-buddy-pickitem"
                onClick={() => {
                  setPicking(false);
                  // `id` and `profileId` are left behind here as well as being
                  // dropped by the server: what travels is a snapshot, and the
                  // copy the other person saves is theirs.
                  void shareRoutine(row.linkId, {
                    title: routine.title,
                    description: routine.description,
                    targetMuscles: routine.targetMuscles,
                    exercises: routine.exercises,
                  });
                }}
              >
                <b>{routine.title}</b>
                <small>{tp('buddy.routineExercises', routine.exercises.length)}</small>
              </button>
            ))
          )}
        </div>
      )}

      {days.length === 0 ? (
        <p className="at-field-hint">{t('buddy.chatEmpty', { name: row.name || '—' })}</p>
      ) : (
        days.map(day => (
          <div key={day.day.toISOString()} className="at-buddy-day">
            <span className="at-buddy-daymark">{fmt.dmy(day.day)}</span>
            {day.messages.map(message => {
              if (message.kind === 'sessionInvite') {
                return <InviteBubble key={message.id} message={message} name={row.name} />;
              }
              if (message.kind === 'routine') {
                return <RoutineBubble key={message.id} message={message} name={row.name} />;
              }
              return (
                <div key={message.id} className="at-buddy-bubble" data-mine={message.mine}>
                  <p>{message.body}</p>
                  <small>{fmt.clock(message.at)}</small>
                </div>
              );
            })}
          </div>
        ))
      )}

      {failed && <span className="at-buddy-error">{t('buddy.chatFailed')}</span>}

      <div ref={endRef} />
    </AtlasSheet>
  );
};

/**
 * An invitation to train together, as it sits in the conversation.
 *
 * The invitation is an ordinary message on purpose, so it arrives through the
 * machinery that already delivers messages — the stream, the unread badge, the
 * transcript that survives a reload. A separate notification channel would have
 * needed every one of those again.
 *
 * Which also means old invitations stay in the thread forever, so what this has
 * to get right is telling a live one from a record of last Tuesday. The server
 * refuses a finished session; this just stops offering a button that would be.
 */
const InviteBubble: React.FC<{
  message: BuddyMessageVM;
  name: string;
}> = ({ message, name }) => {
  const { t, fmt } = useT();
  const { shared, joinShared } = useSocial();
  const [failed, setFailed] = useState(false);

  const id = message.sharedSessionId;
  const joined = id != null && shared?.id === id;
  // In a different container, or in none while this invitation is stale. Either
  // way there is nothing to join from here.
  const joinable = id != null && !shared;

  const join = async () => {
    if (!id) return;
    setFailed(false);
    try {
      await joinShared(id);
    } catch {
      // Covers both the network and a session that has since ended, which read
      // the same from here: the invitation did not take you anywhere.
      setFailed(true);
    }
  };

  return (
    <div className="at-buddy-invitecard" data-mine={message.mine}>
      <Users size={15} />
      <div className="at-buddy-invitetext">
        <b>
          {message.mine
            ? t('buddy.togetherInviteMine', { name: name || '—' })
            : t('buddy.togetherInviteTheirs', { name: name || '—' })}
        </b>
        <small>{t('buddy.togetherSub')} · {fmt.clock(message.at)}</small>
      </div>

      {joined && <span className="at-buddy-invitestate">{t('buddy.togetherJoined')}</span>}
      {!joined && joinable && (
        <button className="at-buddy-invitejoin" onClick={() => void join()}>
          {t('buddy.togetherJoin')}
        </button>
      )}
      {failed && <span className="at-buddy-error">{t('buddy.togetherEnded')}</span>}
    </div>
  );
};

/**
 * A routine somebody shared, and the button that keeps it.
 *
 * The button says "save a copy" because that is exactly what happens: the
 * routine is written under *your* profile with *your* timestamp, and from then
 * on the two are unrelated. Anything friendlier — "add", "get" — would suggest
 * a link that later edits follow, and there is no such link.
 *
 * Which is also what makes this stage cheap: the copy goes through the
 * `saveRoutineTemplate` that already exists, so no routine is ever read across
 * accounts.
 */
const RoutineBubble: React.FC<{
  message: BuddyMessageVM;
  name: string;
}> = ({ message, name }) => {
  const { t, tp, fmt } = useT();
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const routine = message.routine;

  const save = async () => {
    if (!routine) return;
    setFailed(false);
    try {
      // No `id` is passed, so this is an insert rather than a write aimed at
      // the sender's row — and the store fills in the profile and the date.
      await useStore.getState().saveRoutineTemplate({
        title: routine.title,
        description: routine.description,
        targetMuscles: routine.targetMuscles,
        exercises: routine.exercises,
      });
      setSaved(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="at-buddy-routinecard" data-mine={message.mine}>
      <div className="at-buddy-invitetext">
        <b>
          {message.mine
            ? t('buddy.routineFromMe')
            : t('buddy.routineFromThem', { name: name || '—' })}
        </b>
        {routine ? (
          <>
            <span className="at-buddy-routinetitle">{routine.title}</span>
            <small>
              {tp('buddy.routineExercises', routine.exercises.length)} · {fmt.clock(message.at)}
            </small>
          </>
        ) : (
          // A payload from an older shape of the app. Better a record that
          // something was shared than a button that would save nothing.
          <small>{t('buddy.routineBroken')}</small>
        )}
      </div>

      {routine && (
        <div className="at-buddy-routineacts">
          {/* Offered on your own shares too: getting a routine out as text is
              useful whichever end of the conversation you are on. */}
          <RoutineCopyButton routine={routine} className="at-buddy-invitejoin" />
          {!message.mine && (
            saved
              ? <span className="at-buddy-invitestate">{t('buddy.routineSaved')}</span>
              : (
                <button className="at-buddy-invitejoin" onClick={() => void save()}>
                  {t('buddy.routineSave')}
                </button>
              )
          )}
        </div>
      )}
      {failed && <span className="at-buddy-error">{t('buddy.routineFailed')}</span>}
    </div>
  );
};
