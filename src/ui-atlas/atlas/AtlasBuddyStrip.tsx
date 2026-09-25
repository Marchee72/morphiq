import React from 'react';
import { ChevronRight, Dumbbell, MessageCircle, UserPlus } from 'lucide-react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import { useAppActions } from '../data/useAppData';
import { useStore } from '../../presentation/state/store';
import { useElapsedSeconds } from '../components/useTicker';
import { presenceProgress, type PresenceRowVM } from '../derive/social';
import { AtlasBuddyAvatar } from './AtlasBuddyAvatar';

/**
 * Your gymbros, on Today: who is training right now, and everyone else as a
 * row of faces with what is waiting from them.
 *
 * Only what the app already knows — presence and unread messages. It shows the
 * exercise and the position in it, never a weight: that is enforced at the
 * database and again at the serialiser; this is only the last place it would
 * be visible if it were not.
 *
 * Renders nothing where partners cannot exist (no server, not signed in), so
 * Today does not advertise a feature this build cannot reach.
 */
export const AtlasBuddyStrip: React.FC = () => {
  const { available, ready, rows, training, unread } = useSocial();
  const { t, tp } = useT();
  const actions = useAppActions();

  if (!available || !ready) return null;

  const openChat = (linkId: string) => {
    actions.navigate('buddies');
    useStore.getState().setBuddiesFocus({ linkId });
  };
  const liveIds = new Set(training.map(row => row.linkId));

  return (
    <>
      <div className="at-rail-head">
        <h3>{t('buddy.title')}</h3>
        <button onClick={() => actions.navigate('buddies')}>{t('common.seeAll')}</button>
      </div>
      <div className="at-pad at-buddy-strip">
        {training.map(row => <LiveRow key={row.profileId} row={row} onOpen={() => openChat(row.linkId)} />)}

        {rows.length === 0 ? (
          <button className="at-buddy-today" onClick={() => actions.navigate('buddies')}>
            <i className="at-buddy-today-icon"><UserPlus size={18} /></i>
            <span className="at-buddy-today-text">
              <b>{t('buddy.todayInvite')}</b>
              <small>{t('buddy.subtitle')}</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <div className="at-buddy-today">
            <span className="at-buddy-faces">
              {rows.filter(row => !row.muted).slice(0, 6).map(row => (
                <button key={row.linkId} onClick={() => openChat(row.linkId)}
                  aria-label={row.unread > 0 ? `${row.name} · ${tp('buddy.unread', row.unread)}` : row.name}>
                  <AtlasBuddyAvatar name={row.name} picture={row.picture} live={liveIds.has(row.linkId)} size={42} />
                  {row.unread > 0 && <em className="at-buddy-badge" aria-hidden="true">{row.unread}</em>}
                </button>
              ))}
            </span>
            <small className="at-buddy-today-line">
              {unread > 0
                ? <><MessageCircle size={13} /> {tp('buddy.unread', unread)}</>
                : training.length === 0 && t('buddy.todayNobody')}
            </small>
          </div>
        )}
      </div>
    </>
  );
};

const LiveRow: React.FC<{ row: PresenceRowVM; onOpen: () => void }> = ({ row, onOpen }) => {
  const { t, fmt } = useT();
  // The one ticking value in the feature, and it stays at the render edge —
  // nothing that counts belongs in a view model. It already floors at zero, so
  // a partner's clock running fast shows 0:00 rather than a countdown.
  const elapsed = useElapsedSeconds(row.startedAt);

  return (
    <button className="at-buddy-live" onClick={onOpen}>
      <AtlasBuddyAvatar name={row.name} picture={row.picture} live size={44} />
      <span className="at-buddy-livetext">
        <b>{t('buddy.training', { name: row.name || '—' })}</b>
        <small>{presenceProgress(row, t)} · {fmt.duration(elapsed)}</small>
      </span>
      <Dumbbell size={18} aria-hidden="true" />
    </button>
  );
};
