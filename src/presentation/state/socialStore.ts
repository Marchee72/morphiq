import { create } from 'zustand';
import type { BuddyInvite, BuddyLink, BuddyMessage } from '../../core/entities/Buddy';
import { ServerSocialRepository } from '../../data/social/ServerSocialRepository';
import { getUser } from '../../data/auth/session';
import { isServerMode } from '../../data/database/mode';

/**
 * Training partners, held apart from the main store on purpose.
 *
 * Three reasons, in order of how much they would hurt. The store tests reset
 * everything with `useStore.setState(initialState, true)`, and social state has
 * no business being caught in that. This slice owns a live connection's
 * lifecycle, which the app-data store deliberately has none of. And `store.ts`
 * is already the largest file in the repository.
 *
 * Nothing here works without a server and a session — see `available`.
 */
const repo = new ServerSocialRepository();

/** Whether a friendship can exist at all in this build, right now. */
export function socialAvailable(): boolean {
  // Local mode has no server to be social against, and `AUTH_REQUIRED` off means
  // you can be in server mode and anonymous — where every social route 401s.
  return isServerMode && getUser() !== null;
}

export type SocialConnection = 'idle' | 'loading' | 'live' | 'offline';

interface SocialState {
  available: boolean;
  /** False until the first load settles, so "no partners yet" is not shown early. */
  ready: boolean;
  links: BuddyLink[];
  invite: BuddyInvite | null;
  /**
   * Conversations by link id, oldest message first.
   *
   * Kept per link rather than only for the open one so the badge and the last
   * line survive closing the sheet, and so reopening is instant.
   */
  messages: Record<string, BuddyMessage[]>;
  connection: SocialConnection;
  /** The last failure, for the screen to show. Cleared by the next success. */
  error: string | null;

  load: (profileId: string) => Promise<void>;
  loadMessages: (linkId: string) => Promise<void>;
  sendMessage: (linkId: string, body: string) => Promise<void>;
  markRead: (linkId: string) => Promise<void>;
  createInvite: (profileId: string) => Promise<void>;
  revokeInvite: () => Promise<void>;
  redeemInvite: (profileId: string, code: string) => Promise<BuddyLink>;
  removeBuddy: (linkId: string) => Promise<void>;
  setBlocked: (linkId: string, profileId: string, blocked: boolean) => Promise<void>;
  /** Drops everything on sign-out or a profile switch. */
  reset: () => void;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  available: socialAvailable(),
  ready: false,
  links: [],
  invite: null,
  messages: {},
  connection: 'idle',
  error: null,

  load: async profileId => {
    if (!socialAvailable()) {
      set({ available: false, ready: true, links: [], invite: null, connection: 'idle' });
      return;
    }
    set({ available: true, connection: 'loading' });
    try {
      const [links, invite] = await Promise.all([
        repo.listBuddies(profileId),
        repo.getInvite(profileId),
      ]);
      set({ links, invite, ready: true, connection: 'live', error: null });
    } catch (err) {
      // Offline is the ordinary case here — the gym has no signal. Keep whatever
      // was already loaded on screen rather than blanking it.
      set({ ready: true, connection: 'offline', error: (err as Error).message });
    }
  },

  /**
   * Fetches whatever is new in one conversation.
   *
   * Incremental by the highest id already held, so a poll every few seconds
   * costs an empty array rather than the whole history. Anything cleared by
   * leaving never arrives — the server floors the cursor.
   */
  loadMessages: async linkId => {
    const held = get().messages[linkId] ?? [];
    const sinceId = held.length > 0 ? held[held.length - 1].id : undefined;
    const fresh = await repo.listMessages(linkId, sinceId);
    if (fresh.length === 0) return;
    set(state => ({
      messages: { ...state.messages, [linkId]: [...(state.messages[linkId] ?? []), ...fresh] },
    }));
  },

  sendMessage: async (linkId, body) => {
    const sent = await repo.sendMessage(linkId, { kind: 'text', body });
    // Appended from the server's reply rather than optimistically: the id and
    // the timestamp are the server's, and the next poll keys on that id.
    set(state => ({
      messages: {
        ...state.messages,
        [linkId]: [...(state.messages[linkId] ?? []), sent],
      },
    }));
  },

  markRead: async linkId => {
    const held = get().messages[linkId] ?? [];
    if (held.length === 0) return;
    const upToId = held[held.length - 1].id;
    await repo.markRead(linkId, upToId);
    // Reflected locally so the badge clears now rather than on the next poll.
    set(state => ({
      links: state.links.map(l => (l.id === linkId ? { ...l, unreadCount: 0 } : l)),
    }));
  },

  createInvite: async profileId => {
    const invite = await repo.createInvite(profileId);
    set({ invite, error: null });
  },

  revokeInvite: async () => {
    const current = get().invite;
    if (!current) return;
    await repo.revokeInvite(current.code);
    set({ invite: null });
  },

  redeemInvite: async (profileId, code) => {
    const link = await repo.redeemInvite(profileId, code);
    // Redeeming spends your own outstanding invite in the eyes of the list, and
    // the same friendship can arrive twice if the code is pasted twice.
    set(state => ({
      links: state.links.some(l => l.id === link.id) ? state.links : [...state.links, link],
      error: null,
    }));
    return link;
  },

  removeBuddy: async linkId => {
    await repo.removeBuddy(linkId);
    set(state => {
      // Your copy is gone on the server, so it must not linger in memory —
      // otherwise the conversation stays on screen until the next reload and
      // the deletion looks like it failed.
      const { [linkId]: _cleared, ...rest } = state.messages;
      return { links: state.links.filter(l => l.id !== linkId), messages: rest };
    });
  },

  setBlocked: async (linkId, profileId, blocked) => {
    const updated = await repo.setBlocked(linkId, profileId, blocked);
    set(state => ({ links: state.links.map(l => (l.id === linkId ? updated : l)) }));
  },

  reset: () => set({
    ready: false, links: [], invite: null, messages: {}, connection: 'idle', error: null,
    available: socialAvailable(),
  }),
}));
