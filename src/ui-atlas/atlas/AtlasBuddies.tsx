import React, { useEffect, useState } from 'react';
import { Dumbbell, PauseCircle, PlayCircle, Trash2, UserPlus, Users } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useSocial } from '../data/useSocial';
import { presenceProgress, type BuddyRowVM } from '../derive/social';
import { AtlasSheet } from './AtlasSheet';
import { AtlasStates } from './AtlasStates';
import { AtlasChoice } from './AtlasField';
import { AtlasBuddyInvite } from './AtlasBuddyInvite';
import { AtlasBuddyRedeem } from './AtlasBuddyRedeem';
import { AtlasBuddyChat } from './AtlasBuddyChat';
import {
  disablePush, enablePush, isPushEnabledFor, isPushSupported,
} from '../../data/social/pushNotifications';

type Panel = 'invite' | 'redeem' | null;

/**
 * Training partners — the tab where a partner is added, removed, chatted with,
 * or trained with.
 *
 * `buddiesFocus` is a one-shot instruction left by whoever navigated here (an
 * invite link, or a tap on a partner elsewhere): applied on mount, then
 * cleared, so a later visit to this tab starts clean.
 */
export const AtlasBuddies: React.FC = () => {
  const { t, tp, fmt } = useT();
  const activeProfile = useStore(state => state.activeProfile);
  const updateProfile = useStore(state => state.updateProfile);
  const buddiesFocus = useStore(state => state.buddiesFocus);
  const clearBuddiesFocus = useStore(state => state.clearBuddiesFocus);
  const {
    available, ready, rows, error, removeBuddy, setBlocked, training, shared, startShared,
  } = useSocial();
  const trainingByLink = new Map(training.map(row => [row.linkId, row]));

  const [panel, setPanel] = useState<Panel>(buddiesFocus?.code ? 'redeem' : null);
  const [confirming, setConfirming] = useState<BuddyRowVM | null>(null);
  const [chatting, setChatting] = useState<BuddyRowVM | null>(null);
  // Which `linkId` has already been opened, so a partner tapped elsewhere opens
  // their chat exactly once even though the match below re-runs every render
  // until the row it refers to has actually loaded.
  const [appliedFocusLinkId, setAppliedFocusLinkId] = useState<string | undefined>(undefined);
  const focusCode = buddiesFocus?.code;
  const focusLinkId = buddiesFocus?.linkId;

  const [pushOn, setPushOn] = useState(() => !!activeProfile?.id && isPushEnabledFor(activeProfile.id));
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const togglePush = async (id: string, next: boolean) => {
    setPushBusy(true);
    setPushError(null);
    try {
      if (next) await enablePush(id);
      else await disablePush(id);
      setPushOn(next);
    } catch (err) {
      setPushError((err as Error).message);
    } finally {
      setPushBusy(false);
    }
  };

  // Adjusted during render rather than in an Effect: this is state derived from
  // a value that just arrived (`buddiesFocus`), not a subscription to anything
  // external, so React's own guidance is to fold it into the render instead of
  // adding a render-then-effect round trip.
  if (focusLinkId && focusLinkId !== appliedFocusLinkId) {
    const row = rows.find(r => r.linkId === focusLinkId);
    if (row) {
      setAppliedFocusLinkId(focusLinkId);
      setChatting(row);
    }
  }

  // Clearing the flag genuinely is a side effect on something external (the
  // store), so it stays in an Effect — but only once it has been acted on,
  // otherwise a `linkId` naming a partner that has not loaded yet would be
  // discarded before the render above ever gets a chance to match it.
  useEffect(() => {
    if (focusCode) clearBuddiesFocus();
  }, [focusCode, clearBuddiesFocus]);

  useEffect(() => {
    if (appliedFocusLinkId) clearBuddiesFocus();
  }, [appliedFocusLinkId, clearBuddiesFocus]);

  return (
    <>
      <div className="at-greet">
        <div>
          <small>{activeProfile ? t('buddy.forProfile', { name: activeProfile.name }) : 'MorphIQ'}</small>
          <h1>{t('buddy.title')}</h1>
        </div>
      </div>

      <div className="at-pad at-settings-body">
        {/* Nothing here works without a server and a signed-in session — see
            `socialAvailable`. The tab itself stays reachable either way, since
            hiding a dock icon by build mode would shift the whole row under
            people who never notice why. */}
        {!available ? (
          <AtlasStates
            icon={<Users size={20} />}
            title={t('buddy.unavailable')}
            body={t('buddy.unavailableSub')}
          />
        ) : (
          <>
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

        {/* Presence sharing, moved in from Settings — this tab is now where
            everything about a partner is managed, including whether they can
            see you train. */}
        {activeProfile && (
          <div className="at-card at-settings-stack">
            <AtlasChoice
              label={t('buddy.presenceToggle')}
              value={activeProfile.sharePresence === false ? 'off' : 'on'}
              onChange={value => void updateProfile({ ...activeProfile, sharePresence: value === 'on' })}
              options={[
                { value: 'on', label: t('buddy.presenceOn') },
                { value: 'off', label: t('buddy.presenceOff') },
              ]}
            />
            <small className="at-field-hint">{t('buddy.presenceSub')}</small>
          </div>
        )}

        {/* Push registration lives on the device, not the profile, so this is
            read from the device rather than from anything the server sent. */}
        {activeProfile?.id && (
          <div className="at-card at-settings-stack">
            {isPushSupported() ? (
              <AtlasChoice
                label={t('buddy.pushToggle')}
                value={pushOn ? 'on' : 'off'}
                onChange={value => { if (!pushBusy) void togglePush(activeProfile.id!, value === 'on'); }}
                options={[
                  { value: 'on', label: t('buddy.presenceOn') },
                  { value: 'off', label: t('buddy.presenceOff') },
                ]}
              />
            ) : (
              <span className="at-field-label">{t('buddy.pushUnsupported')}</span>
            )}
            <small className="at-field-hint">
              {pushError ? t('buddy.pushError', { message: pushError }) : t('buddy.pushSub')}
            </small>
          </div>
        )}

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
          rows.map(row => {
            const live = trainingByLink.get(row.linkId);
            return (
            <div key={row.linkId} className="at-card at-buddy-row" data-muted={row.muted}>
              {/* The whole identity block opens the conversation. Muted
                  partners are not tappable: nothing can be sent through a
                  paused link, so offering the thread would be a dead end. */}
              <button
                className="at-account at-buddy-open"
                disabled={row.muted}
                onClick={() => setChatting(row)}
              >
                {row.picture && <img src={row.picture} alt="" referrerPolicy="no-referrer" />}
                <div>
                  <b>{row.name || '—'}</b>
                  <small>
                    {row.blockedByMe
                      ? t('buddy.blockedByMe')
                      : row.blockedByThem
                        ? t('buddy.blockedByThem')
                        : live
                          ? <><span className="at-buddy-dot" aria-hidden="true" /> {presenceProgress(live, t)}</>
                          : t('buddy.since', { date: fmt.dmy(row.since) })}
                  </small>
                </div>
                {row.unread > 0 && !row.muted && (
                  <span className="at-buddy-badge" aria-label={tp('buddy.unread', row.unread)}>
                    {row.unread}
                  </span>
                )}
              </button>

              <div className="at-buddy-actions">
                {/* One tap to train together, without going through the
                    conversation first. Hidden once this device is already in a
                    session — offering it again would just re-propose the room
                    you are standing in. */}
                {!row.muted && !shared && (
                  <button className="at-chip" onClick={() => void startShared(row.linkId)}>
                    <Dumbbell size={14} /> {t('buddy.trainNow')}
                  </button>
                )}
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
            );
          })
        )}
          </>
        )}
      </div>

      <AtlasBuddyInvite open={panel === 'invite'} onClose={() => setPanel(null)} />

      {/* Mounted only while open, so each visit starts on an empty field rather
          than on the code that failed last time. */}
      {panel === 'redeem' && (
        <AtlasBuddyRedeem onClose={() => setPanel(null)} initialCode={focusCode} />
      )}

      {/* Mounted only while open so the conversation stops being followed the
          moment it is closed, rather than polling behind the list. */}
      {chatting && <AtlasBuddyChat row={chatting} onClose={() => setChatting(null)} />}

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
    </>
  );
};
