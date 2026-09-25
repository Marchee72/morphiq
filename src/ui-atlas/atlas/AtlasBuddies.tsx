import React, { useEffect, useState } from 'react';
import {
  Check, Dumbbell, MessageCircle, Minus, MoreHorizontal, PauseCircle, PlayCircle, Trash2, UserPlus, Users,
} from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useSocial } from '../data/useSocial';
import { presenceProgress, type BuddyRowVM, type PresenceRowVM } from '../derive/social';
import { useElapsedSeconds } from '../components/useTicker';
import { AtlasSheet } from './AtlasSheet';
import { AtlasStates } from './AtlasStates';
import { AtlasSwitch } from './AtlasField';
import { AtlasBuddyInvite } from './AtlasBuddyInvite';
import { AtlasBuddyRedeem } from './AtlasBuddyRedeem';
import { AtlasBuddyChat } from './AtlasBuddyChat';
import { AtlasBuddyAvatar } from './AtlasBuddyAvatar';
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
    available, ready, rows, error, removeBuddy, setBlocked, training, shared, startShared, joinShared,
  } = useSocial();
  const trainingByLink = new Map(training.map(row => [row.linkId, row]));

  const [panel, setPanel] = useState<Panel>(buddiesFocus?.code ? 'redeem' : null);
  const [confirming, setConfirming] = useState<BuddyRowVM | null>(null);
  const [chatting, setChatting] = useState<BuddyRowVM | null>(null);
  // Whose pause / remove actions are showing. One at a time.
  const [managing, setManaging] = useState<string | null>(null);
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

  /** Train together: join their room if they opened one, else open one with them. */
  const trainWith = (linkId: string, sharedSessionId?: string) =>
    void (sharedSessionId ? joinShared(sharedSessionId) : startShared(linkId));

  return (
    <>
      <header className="at-hub-head">
        <div>
          <small>{activeProfile ? t('buddy.forProfile', { name: activeProfile.name }) : 'MorphIQ'}</small>
          <h1>{t('buddy.title')}</h1>
        </div>
        {available && rows.length > 0 && (
          <button className="at-buddy-invite-round" onClick={() => setPanel('invite')} aria-label={t('buddy.invite')}>
            <UserPlus size={20} />
          </button>
        )}
      </header>

      <div className="at-pad at-buddies">
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
            {/* Whoever is training right now, loudest: the one moment this tab
                is about something happening rather than something to manage. */}
            {training.map(live => {
              const row = rows.find(r => r.linkId === live.linkId);
              return (
                <LiveHero
                  key={live.profileId}
                  live={live}
                  canJoin={!shared}
                  onTogether={() => trainWith(live.linkId, live.sharedSessionId)}
                  onMessage={row ? () => setChatting(row) : undefined}
                />
              );
            })}

            {/* Offline keeps whatever was loaded on screen and says so, rather
                than blanking a list that is probably still accurate. */}
            {error && (
              <div className="at-card at-settings-stack">
                <span className="at-field-label">{t('buddy.offline')}</span>
                <small className="at-field-hint">{t('buddy.offlineSub')}</small>
              </div>
            )}

            {ready && rows.length === 0 ? (
              <>
                {/* No partners yet: the two ways to get one, and what a partner
                    would see of you — the question that stops people inviting. */}
                <section className="at-buddy-hero at-enter" aria-label={t('buddy.todayInvite')}>
                  <div className="at-today-glow" aria-hidden="true" />
                  <div className="at-buddy-empty-faces" aria-hidden="true">
                    <i /><i /><i><UserPlus size={22} /></i>
                  </div>
                  <h2 className="at-buddy-empty-title">{t('buddy.todayInvite')}</h2>
                  <p className="at-buddy-empty-body">{t('buddy.emptyBody')}</p>
                  <div className="at-buddy-hero-actions">
                    <button className="at-today-cta" onClick={() => setPanel('invite')}>{t('buddy.invite')}</button>
                    <button className="at-buddy-hero-ghost" onClick={() => setPanel('redeem')}>{t('buddy.redeem')}</button>
                  </div>
                </section>
                <section className="at-card at-buddy-sees" aria-label={t('buddy.seesTitle')}>
                  <b>{t('buddy.seesTitle')}</b>
                  <span><i data-yes="true"><Check size={15} strokeWidth={3} /></i>{t('buddy.seesTraining')}</span>
                  <span><i data-yes="true"><Check size={15} strokeWidth={3} /></i>{t('buddy.seesProgress')}</span>
                  <span><i><Minus size={15} strokeWidth={3} /></i>{t('buddy.seesNever')}</span>
                </section>
              </>
            ) : (
              <>
                <div className="at-buddies-head">
                  <h3>{t('buddy.yourPartners')}</h3>
                  {ready && <small>{tp('buddy.count', rows.length)}</small>}
                </div>
                {rows.map(row => {
                  const live = trainingByLink.get(row.linkId);
                  const open = managing === row.linkId;
                  return (
                    <div key={row.linkId} className="at-buddy-card" data-muted={row.muted}>
                      <div className="at-buddy-card-main">
                        {/* The whole identity block opens the conversation. Muted
                            partners are not tappable: nothing can be sent through
                            a paused link, so offering the thread is a dead end. */}
                        <button className="at-buddy-open" disabled={row.muted} onClick={() => setChatting(row)}>
                          <AtlasBuddyAvatar name={row.name} picture={row.picture} live={!!live} />
                          <span>
                            <b>{row.name || '—'}</b>
                            <small>
                              {row.blockedByMe
                                ? t('buddy.blockedByMe')
                                : row.blockedByThem
                                  ? t('buddy.blockedByThem')
                                  : live
                                    ? presenceProgress(live, t)
                                    : t('buddy.since', { date: fmt.dmy(row.since) })}
                            </small>
                          </span>
                          {row.unread > 0 && !row.muted && (
                            <span className="at-buddy-badge" aria-label={tp('buddy.unread', row.unread)}>
                              {row.unread}
                            </span>
                          )}
                        </button>
                        <button
                          className="at-buddy-more"
                          aria-expanded={open}
                          aria-label={t('buddy.manageFor', { name: row.name || '—' })}
                          onClick={() => setManaging(open ? null : row.linkId)}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>

                      {open && (
                        <div className="at-buddy-actions">
                          {/* Hidden once this device is already in a session —
                              offering it again would re-propose the room you are in. */}
                          {!row.muted && !shared && (
                            <button className="at-chip" onClick={() => trainWith(row.linkId)}>
                              <Dumbbell size={14} /> {t('buddy.trainNow')}
                            </button>
                          )}
                          {/* Offered only to the side that blocked. The other side
                              seeing "resume" would promise something the server refuses. */}
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
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* What partners can see of you, and whether they can reach you. */}
            {activeProfile && rows.length > 0 && (
              <div className="at-card at-settings-stack">
                <AtlasSwitch
                  label={t('buddy.presenceToggle')}
                  checked={activeProfile.sharePresence !== false}
                  onChange={checked => void updateProfile({ ...activeProfile, sharePresence: checked })}
                />
                <small className="at-field-hint">{t('buddy.presenceSub')}</small>
                {/* Push registration lives on the device, not the profile, so it
                    is read from the device rather than from the server. */}
                <span className="at-buddy-split" aria-hidden="true" />
                {activeProfile.id && (isPushSupported() ? (
                  <AtlasSwitch
                    label={t('buddy.pushToggle')}
                    checked={pushOn}
                    onChange={checked => { if (!pushBusy) void togglePush(activeProfile.id!, checked); }}
                  />
                ) : (
                  <span className="at-field-label">{t('buddy.pushUnsupported')}</span>
                ))}
                {activeProfile.id && (
                  <small className="at-field-hint">
                    {pushError ? t('buddy.pushError', { message: pushError }) : t('buddy.pushSub')}
                  </small>
                )}
              </div>
            )}

            {rows.length > 0 && (
            <div className="at-buddy-doors">
              <button className="at-btn" onClick={() => setPanel('invite')}>
                <UserPlus size={15} /> {t('buddy.invite')}
              </button>
              <button className="at-btn" data-ghost="true" onClick={() => setPanel('redeem')}>
                {t('buddy.redeem')}
              </button>
            </div>
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

/** A partner training right now: who, what, how long, and the two ways in. */
const LiveHero: React.FC<{
  live: PresenceRowVM;
  canJoin: boolean;
  onTogether: () => void;
  onMessage?: () => void;
}> = ({ live, canJoin, onTogether, onMessage }) => {
  const { t, fmt } = useT();
  const elapsed = useElapsedSeconds(live.startedAt);
  return (
    <section className="at-buddy-hero at-enter" aria-label={t('buddy.trainingNow')}>
      <div className="at-today-glow" aria-hidden="true" />
      <div className="at-buddy-hero-top">
        <AtlasBuddyAvatar name={live.name} picture={live.picture} live size={52} />
        <span>
          <small>{t('buddy.trainingNow')}</small>
          <b>{live.name || '—'}</b>
          <em>{presenceProgress(live, t)} · {fmt.duration(elapsed)}</em>
        </span>
      </div>
      <div className="at-buddy-hero-actions">
        {canJoin && (
          <button className="at-today-cta" onClick={onTogether}>
            <Dumbbell size={16} /> {t('buddy.together')}
          </button>
        )}
        {onMessage && (
          <button className="at-hub-another" onClick={onMessage} aria-label={t('buddy.message', { name: live.name || '—' })}>
            <MessageCircle size={18} />
          </button>
        )}
      </div>
    </section>
  );
};
