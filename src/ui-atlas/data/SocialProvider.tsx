import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { sseTransport } from '../../data/social/socialStream';
import { useStore } from '../../presentation/state/store';
import { useSocialStore } from '../../presentation/state/socialStore';
import {
  buildBuddyRows, buildMessageDays, buildPresenceRows, buildSharedRows, totalUnread,
} from '../derive/social';
import { usePresencePublisher } from './usePresencePublisher';
import { SocialContext } from './contexts';
import { useAppActions } from './useAppData';
import type { SharedRoutine } from '../../core/entities/Buddy';
import type { SocialState } from './types';

/**
 * How often an open conversation is topped up, on top of the stream.
 *
 * The stream delivers new messages, so this is a safety net rather than the
 * mechanism: it covers the seconds between opening a thread and the first frame
 * arriving, and closes the gap if a reconnect ever loses one. Slow on purpose.
 */
const CONVERSATION_REFRESH_MS = 15_000;

/**
 * Training partners.
 *
 * Mounted innermost of the providers on purpose. Everything it holds changes on
 * its own, without anyone touching the screen, and wrapping the shell any higher
 * would re-render the whole app each time a partner list came back.
 *
 * Does nothing at all when a friendship cannot exist — see `available` — so
 * local mode and a signed-out session cost one boolean, not a failing request
 * every twenty seconds.
 */
export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const actions = useAppActions();
  const profileId = useStore(state => state.activeProfile?.id);
  const available = useSocialStore(state => state.available);
  const ready = useSocialStore(state => state.ready);
  const links = useSocialStore(state => state.links);
  const invite = useSocialStore(state => state.invite);
  const messages = useSocialStore(state => state.messages);
  const presence = useSocialStore(state => state.presence);
  const shared = useSocialStore(state => state.shared);
  const clockSkewMs = useSocialStore(state => state.clockSkewMs);
  const error = useSocialStore(state => state.error);

  /**
   * Where the stream got to, kept across reconnects.
   *
   * A ref rather than state: it changes on every frame and nothing renders from
   * it, so putting it in state would re-render every consumer per message.
   */
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!available || !profileId) return;

    const store = useSocialStore.getState();
    // A profile switch is a different set of friendships, not a slow refresh of
    // the same one: clearing first stops the previous profile's partners showing
    // under the new one's name while the request is in flight.
    store.reset();

    let close: (() => void) | null = null;

    /**
     * Held open only while the app is in front.
     *
     * A stream behind a backgrounded app is a serverless invocation billed for
     * nothing — and during a workout the phone is in a pocket with the screen
     * off for most of the hour. Reopening carries the cursor, so nothing that
     * happened while away is missed.
     */
    const openStream = () => {
      if (close) return;
      close = sseTransport.open({
        profileId,
        since: cursorRef.current,
        onEvent: event => {
          if (event.id) cursorRef.current = event.id;
          useSocialStore.getState().applyEvent(event);
        },
        onStatus: status => useSocialStore.setState({
          connection: status === 'live' ? 'live' : status === 'retrying' ? 'offline' : 'loading',
        }),
      });
    };

    const closeStream = () => {
      close?.();
      close = null;
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') openStream();
      else closeStream();
    };

    if (document.visibilityState === 'visible') openStream();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      closeStream();
    };
  }, [available, profileId]);

  /**
   * A code arriving in the URL, from an invite link opened in a browser.
   *
   * Consumed once and stripped from the address bar: leaving it there means a
   * refresh reopens the sheet for a code that has already been spent, and the
   * only thing that can report is "not valid".
   */
  useEffect(() => {
    if (!available) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('buddy');
    if (!code) return;

    params.delete('buddy');
    const query = params.toString();
    window.history.replaceState(
      {}, '', `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
    actions.openOverlay('buddies', { buddyCode: code });
  }, [available, actions]);

  const rows = useMemo(() => buildBuddyRows(links), [links]);
  const unread = useMemo(() => totalUnread(rows), [rows]);
  const training = useMemo(
    () => buildPresenceRows(Object.values(presence), rows, clockSkewMs),
    [presence, rows, clockSkewMs],
  );
  const sharedPartners = useMemo(
    () => buildSharedRows(training, shared?.id ?? null),
    [training, shared],
  );

  // Publishing this device's own session. Mounted here so it runs wherever the
  // app is, not only while the Train screen happens to be on screen.
  usePresencePublisher();

  const conversation = useCallback((linkId: string) => {
    const held = messages[linkId];
    if (!held || !profileId) return [];
    return buildMessageDays(held, profileId);
  }, [messages, profileId]);

  /**
   * Follows one conversation while its sheet is open.
   *
   * Faster than the partner list because the gap is being watched: twenty
   * seconds to see a reply, with the thread on screen, reads as broken. Stops
   * on unsubscribe and while the app is backgrounded, so a chat left open in a
   * pocket costs nothing.
   */
  const watchConversation = useCallback((linkId: string) => {
    if (!available) return () => {};

    const store = useSocialStore.getState();
    void store.loadMessages(linkId).then(() => useSocialStore.getState().markRead(linkId));

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void useSocialStore.getState().loadMessages(linkId)
        .then(() => useSocialStore.getState().markRead(linkId))
        .catch(() => { /* offline; the next tick tries again */ });
    }, CONVERSATION_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [available]);

  const sendMessage = useCallback(async (linkId: string, body: string) => {
    await useSocialStore.getState().sendMessage(linkId, body);
  }, []);

  const shareRoutine = useCallback(async (linkId: string, routine: SharedRoutine) => {
    await useSocialStore.getState().shareRoutine(linkId, routine);
  }, []);

  const refresh = useCallback(async () => {
    if (profileId) await useSocialStore.getState().load(profileId);
  }, [profileId]);

  const createInvite = useCallback(async () => {
    if (profileId) await useSocialStore.getState().createInvite(profileId);
  }, [profileId]);

  const revokeInvite = useCallback(async () => {
    await useSocialStore.getState().revokeInvite();
  }, []);

  const redeemInvite = useCallback(async (code: string) => {
    if (!profileId) return;
    await useSocialStore.getState().redeemInvite(profileId, code);
    // Redeeming spends the code, so whatever invitation this profile was
    // offering may now be stale — and the far side's name arrives with the list.
    await useSocialStore.getState().load(profileId);
  }, [profileId]);

  const removeBuddy = useCallback(async (linkId: string) => {
    await useSocialStore.getState().removeBuddy(linkId);
  }, []);

  const setBlocked = useCallback(async (linkId: string, blocked: boolean) => {
    if (profileId) await useSocialStore.getState().setBlocked(linkId, profileId, blocked);
  }, [profileId]);

  const startShared = useCallback(async (linkId: string) => {
    await useSocialStore.getState().startShared(linkId);
  }, []);

  const joinShared = useCallback(async (sessionId: string) => {
    await useSocialStore.getState().joinShared(sessionId);
  }, []);

  const leaveShared = useCallback(async () => {
    await useSocialStore.getState().leaveShared();
  }, []);

  const value = useMemo<SocialState>(() => ({
    available, ready, links, invite, error, rows, unread, training, shared, sharedPartners,
    refresh, createInvite, revokeInvite, redeemInvite, removeBuddy, setBlocked,
    conversation, watchConversation, sendMessage, shareRoutine,
    startShared, joinShared, leaveShared,
  }), [
    available, ready, links, invite, error, rows, unread, training, shared, sharedPartners,
    refresh, createInvite, revokeInvite, redeemInvite, removeBuddy, setBlocked,
    conversation, watchConversation, sendMessage, shareRoutine,
    startShared, joinShared, leaveShared,
  ]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
};
