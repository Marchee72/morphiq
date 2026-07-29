import React, { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '../../presentation/state/store';
import { useSocialStore } from '../../presentation/state/socialStore';
import { buildBuddyRows } from '../derive/social';
import { SocialContext } from './contexts';
import type { SocialState } from './types';

/**
 * How often the partner list is refetched while the app is in front.
 *
 * A placeholder, and knowingly a poor one: coordination does not need ten
 * seconds of latency and a friendship does not change every twenty. The stream
 * replaces this wholesale — until then, polling is what works identically on
 * Vercel, on a phone and in a test.
 */
const REFRESH_MS = 20_000;

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
  const profileId = useStore(state => state.activeProfile?.id);
  const available = useSocialStore(state => state.available);
  const ready = useSocialStore(state => state.ready);
  const links = useSocialStore(state => state.links);
  const invite = useSocialStore(state => state.invite);
  const error = useSocialStore(state => state.error);

  useEffect(() => {
    if (!available || !profileId) return;

    const store = useSocialStore.getState();
    // A profile switch is a different set of friendships, not a slow refresh of
    // the same one: clearing first stops the previous profile's partners showing
    // under the new one's name while the request is in flight.
    store.reset();
    void store.load(profileId);

    const timer = window.setInterval(() => {
      // Refetching behind a backgrounded app is spend for nothing; the phone is
      // in a pocket for most of a workout.
      if (document.visibilityState === 'visible') void useSocialStore.getState().load(profileId);
    }, REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void useSocialStore.getState().load(profileId);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [available, profileId]);

  const rows = useMemo(() => buildBuddyRows(links), [links]);

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

  const value = useMemo<SocialState>(() => ({
    available, ready, links, invite, error, rows,
    refresh, createInvite, revokeInvite, redeemInvite, removeBuddy, setBlocked,
  }), [
    available, ready, links, invite, error, rows,
    refresh, createInvite, revokeInvite, redeemInvite, removeBuddy, setBlocked,
  ]);

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
};
