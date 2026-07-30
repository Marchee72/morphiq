import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import type { BuddyRowVM } from '../derive/social';
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
  const { t, fmt } = useT();
  const { conversation, watchConversation, sendMessage } = useSocial();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
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

      {days.length === 0 ? (
        <p className="at-field-hint">{t('buddy.chatEmpty', { name: row.name || '—' })}</p>
      ) : (
        days.map(day => (
          <div key={day.day.toISOString()} className="at-buddy-day">
            <span className="at-buddy-daymark">{fmt.dmy(day.day)}</span>
            {day.messages.map(message => (
              <div key={message.id} className="at-buddy-bubble" data-mine={message.mine}>
                <p>{message.body}</p>
                <small>{fmt.clock(message.at)}</small>
              </div>
            ))}
          </div>
        ))
      )}

      {failed && <span className="at-buddy-error">{t('buddy.chatFailed')}</span>}

      <div ref={endRef} />
    </AtlasSheet>
  );
};
