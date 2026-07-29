import React, { useState } from 'react';
import { PauseCircle, PlayCircle, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useSocial } from '../data/useSocial';
import type { BuddyRowVM } from '../derive/social';
import { AtlasSheet } from './AtlasSheet';
import { AtlasStates } from './AtlasStates';
import { AtlasBuddyInvite } from './AtlasBuddyInvite';
import { AtlasBuddyRedeem } from './AtlasBuddyRedeem';
import { useDismissOnBack } from '../components/useDismissOnBack';

type Panel = 'invite' | 'redeem' | null;

/**
 * Training partners.
 *
 * A full-screen overlay rather than a sixth tab: the dock is full at 390px, and
 * this is an errand — you come here to add someone or to stop training with
 * them, not several times a day. The signal that actually belongs on a daily
 * screen is a partner's presence, which lands on Today.
 *
 * Nested panels use local state, the way `AtlasSettings` does, because the shell
 * holds one overlay at a time.
 */
export const AtlasBuddies: React.FC<{
  onClose: () => void;
  initialCode?: string;
}> = ({ onClose, initialCode }) => {
  const { t, tp, fmt } = useT();
  const activeProfile = useStore(state => state.activeProfile);
  const { ready, rows, error, removeBuddy, setBlocked } = useSocial();

  // Opened straight onto redemption when a code arrived in the link: the person
  // following it has one thing to do, and it is not reading a list.
  const [panel, setPanel] = useState<Panel>(initialCode ? 'redeem' : null);
  const [confirming, setConfirming] = useState<BuddyRowVM | null>(null);

  useDismissOnBack(true, onClose, 'buddies');

  return (
    <div className="at-settings">
      <div className="at-editor-head">
        <div>
          <small>{activeProfile ? t('buddy.forProfile', { name: activeProfile.name }) : 'MorphIQ'}</small>
          <h3 className="at-serif">{t('buddy.title')}</h3>
        </div>
        <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <div className="at-pad at-settings-body">
        <div className="at-card at-settings-stack">
          <div>
            <span className="at-field-label">{t('buddy.subtitle')}</span>
            {ready && rows.length > 0 && <small>{tp('buddy.count', rows.length)}</small>}
          </div>
          <div className="at-buddy-actions">
            <button className="at-btn" onClick={() => setPanel('invite')}>
              <UserPlus size={15} /> {t('buddy.invite')}
            </button>
            <button className="at-btn" data-ghost="true" onClick={() => setPanel('redeem')}>
              {t('buddy.redeem')}
            </button>
          </div>
        </div>

        {/* Offline keeps whatever was loaded on screen and says so, rather than
            blanking a list that is probably still accurate. */}
        {error && (
          <div className="at-card at-settings-stack">
            <span className="at-field-label">{t('buddy.offline')}</span>
            <small className="at-field-hint">{t('buddy.offlineSub')}</small>
          </div>
        )}

        {ready && rows.length === 0 ? (
          <AtlasStates
            icon={<Users size={20} />}
            title={t('buddy.none')}
            body={t('buddy.noneSub')}
            action={{ label: t('buddy.invite'), onClick: () => setPanel('invite') }}
          />
        ) : (
          rows.map(row => (
            <div key={row.linkId} className="at-card at-buddy-row" data-muted={row.muted}>
              <div className="at-account">
                {row.picture && <img src={row.picture} alt="" referrerPolicy="no-referrer" />}
                <div>
                  <b>{row.name || '—'}</b>
                  <small>
                    {row.blockedByMe
                      ? t('buddy.blockedByMe')
                      : row.blockedByThem
                        ? t('buddy.blockedByThem')
                        : t('buddy.since', { date: fmt.dmy(row.since) })}
                  </small>
                </div>
              </div>

              <div className="at-buddy-actions">
                {/* Offered only to the side that blocked. The other side seeing
                    "resume" would promise something the server refuses. */}
                {row.blockedByMe ? (
                  <button className="at-chip" onClick={() => void setBlocked(row.linkId, false)}>
                    <PlayCircle size={14} /> {t('buddy.unblock')}
                  </button>
                ) : !row.blockedByThem && (
                  <button className="at-chip" onClick={() => void setBlocked(row.linkId, true)}>
                    <PauseCircle size={14} /> {t('buddy.block')}
                  </button>
                )}
                <button className="at-chip" data-danger="true" onClick={() => setConfirming(row)}>
                  <Trash2 size={14} /> {t('buddy.remove')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AtlasBuddyInvite open={panel === 'invite'} onClose={() => setPanel(null)} />

      {/* Mounted only while open, so each visit starts on an empty field rather
          than on the code that failed last time. */}
      {panel === 'redeem' && (
        <AtlasBuddyRedeem onClose={() => setPanel(null)} initialCode={initialCode} />
      )}

      {/* Removal takes the conversation with it, for both people. That is worth
          one deliberate confirmation rather than an undo that cannot exist. */}
      <AtlasSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming ? t('buddy.removeConfirm', { name: confirming.name || '—' }) : ''}
        footer={
          <div className="at-buddy-actions">
            <button className="at-btn" data-ghost="true" onClick={() => setConfirming(null)}>
              {t('buddy.cancel')}
            </button>
            <button
              className="at-chip"
              data-danger="true"
              onClick={async () => {
                if (!confirming) return;
                await removeBuddy(confirming.linkId);
                setConfirming(null);
              }}
            >
              {t('buddy.removeAction')}
            </button>
          </div>
        }
      >
        <p className="at-field-hint">{t('buddy.removeConfirmSub')}</p>
      </AtlasSheet>
    </div>
  );
};
