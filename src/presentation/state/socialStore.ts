import { create } from 'zustand';
import type {
  BuddyInvite, BuddyLink, BuddyMessage, BuddyPresence, LiveSessionSnapshot,
} from '../../core/entities/Buddy';
import { ServerSocialRepository } from '../../data/social/ServerSocialRepository';
import { getUser } from '../../data/auth/session';
import { isServerMode } from '../../data/database/mode';
import type { SocialEvent } from '../../data/social/socialStream';

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

/**
 * Minimum gap between two presence writes.
 *
 * Worst case with the heartbeat is a few hundred tiny upserts an hour, which is
 * nothing — the throttle exists so that scrubbing the weight wheel does not
 * turn into one request per frame.
 */
const PUBLISH_INTERVAL_MS = 5_000;

// Module scope rather than store state: these are the mechanics of a timer, and
// nothing renders from them. Putting them in the store would re-render every
// consumer on each tick of a throttle.
let pendingSnapshot: { profileId: string; snapshot: LiveSessionSnapshot } | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPublishAt = 0;

/**
 * Dates over the wire are strings.
 *
 * The repository rehydrates what it fetches; the stream bypasses it, so the
 * same job has to happen here or a `Date` field arrives holding a string and
 * everything downstream that calls `.getTime()` breaks at a distance.
 */
function parseLinkDates(raw: BuddyLink): BuddyLink {
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

function parseMessageDates(raw: BuddyMessage): BuddyMessage {
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

function parsePresenceDates(raw: BuddyPresence): BuddyPresence {
  return {
    ...raw,
    startedAt: new Date(raw.startedAt),
    updatedAt: new Date(raw.updatedAt),
  };
}

function keyPresence(entries: BuddyPresence[]): Record<string, BuddyPresence> {
  const byProfile: Record<string, BuddyPresence> = {};
  for (const entry of entries) byProfile[entry.profileId] = entry;
  return byProfile;
}

function flushPresence(): void {
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
  const queued = pendingSnapshot;
  pendingSnapshot = null;
  if (!queued) return;

  lastPublishAt = Date.now();
  // Best-effort by design: a failed heartbeat costs the partner a stale reading
  // for a few seconds, and must never surface as an error during a workout.
  void repo.publishPresence(queued.profileId, queued.snapshot).catch(() => {});
}

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
  /** Partners currently training, by their profile id. Replace-by-key. */
  presence: Record<string, BuddyPresence>;
  /**
   * How far this device's clock is from the server's, in milliseconds.
   *
   * Applied to a partner's `startedAt` before showing elapsed time. Without it
   * a phone whose clock is three minutes fast makes its owner look like they
   * started three minutes before they did.
   */
  clockSkewMs: number;
  connection: SocialConnection;
  /** The last failure, for the screen to show. Cleared by the next success. */
  error: string | null;

  load: (profileId: string) => Promise<void>;
  /** Folds one frame off the stream into state. */
  applyEvent: (event: SocialEvent) => void;
  loadPresence: (profileId: string) => Promise<void>;
  /** Publishes a snapshot, throttled. Safe to call on every session change. */
  publishPresence: (profileId: string, snapshot: LiveSessionSnapshot) => void;
  endPresence: (profileId: string) => Promise<void>;
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
  presence: {},
  clockSkewMs: 0,
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
   * Folds one frame off the stream into state.
   *
   * Every case is idempotent, because the transport can and does redeliver: the
   * presence window overlaps on purpose, and a reconnect replays from a cursor
   * that may be slightly behind. Anything here that appended blindly would
   * duplicate on a flaky connection, which is precisely when it is hardest to
   * notice.
   */
  applyEvent: event => {
    const payload = event.data as Record<string, unknown>;

    switch (event.event) {
      case 'hello': {
        // A snapshot, so it replaces rather than merges — the server is telling
        // us the whole truth and anything we hold that is missing from it is
        // stale.
        set({
          links: (payload.links as BuddyLink[] ?? []).map(parseLinkDates),
          presence: keyPresence((payload.presence as BuddyPresence[] ?? []).map(parsePresenceDates)),
          clockSkewMs: Date.now() - new Date(payload.serverNow as string).getTime(),
          ready: true,
          connection: 'live',
          error: null,
        });
        break;
      }

      case 'buddy':
        set({ links: (payload.links as BuddyLink[] ?? []).map(parseLinkDates) });
        break;

      case 'message': {
        const message = parseMessageDates(payload as unknown as BuddyMessage);
        set(state => {
          const held = state.messages[message.linkId] ?? [];
          // Keyed on id rather than appended: a redelivered message is a
          // redelivery, not a second message.
          if (held.some(m => m.id === message.id)) return state;
          return {
            messages: { ...state.messages, [message.linkId]: [...held, message] },
          };
        });
        break;
      }

      case 'presence': {
        const entry = parsePresenceDates(payload as unknown as BuddyPresence);
        set(state => ({ presence: { ...state.presence, [entry.profileId]: entry } }));
        break;
      }

      case 'presence.end': {
        const gone = String(payload.profileId);
        set(state => {
          const { [gone]: _ended, ...rest } = state.presence;
          return { presence: rest };
        });
        break;
      }

      default:
        // Unknown events are ignored rather than thrown on: the server may
        // learn to send something this client predates.
        break;
    }
  },

  loadPresence: async profileId => {
    const { serverNow, presence } = await repo.listPresence(profileId);
    const byProfile: Record<string, BuddyPresence> = {};
    for (const entry of presence) byProfile[entry.profileId] = entry;
    // Replaced wholesale rather than merged: the server's answer is the set of
    // people who are live, so anyone missing from it has stopped, and merging
    // would leave them training forever.
    set({ presence: byProfile, clockSkewMs: Date.now() - serverNow.getTime() });
  },

  /**
   * Publishes this device's session, throttled.
   *
   * Leading edge fires at once, because closing a set updating your partner
   * immediately is the entire point. After that at most one write every few
   * seconds, with the last snapshot coalesced and flushed on the trailing edge
   * so the final state is never the one that got dropped.
   *
   * Best-effort throughout: presence failing must never disturb a workout.
   */
  publishPresence: (profileId, snapshot) => {
    pendingSnapshot = { profileId, snapshot };

    const now = Date.now();
    const elapsed = now - lastPublishAt;

    if (elapsed >= PUBLISH_INTERVAL_MS) {
      flushPresence();
      return;
    }
    if (flushTimer === null) {
      flushTimer = setTimeout(flushPresence, PUBLISH_INTERVAL_MS - elapsed);
    }
  },

  endPresence: async profileId => {
    // Whatever was queued is now stale — flushing it after the end would
    // resurrect the session on the other side until the TTL caught up.
    pendingSnapshot = null;
    if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
    await repo.endPresence(profileId);
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
    ready: false, links: [], invite: null, messages: {}, presence: {}, clockSkewMs: 0,
    connection: 'idle', error: null, available: socialAvailable(),
  }),
}));
