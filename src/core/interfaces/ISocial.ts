import type {
  BuddyInvite, BuddyLink, BuddyMessage, BuddyMessageKind, BuddyPresence, LiveSessionSnapshot,
  SharedRoutine, SharedSession,
} from '../entities/Buddy';

/**
 * What the app can ask about training partners.
 *
 * Deliberately not part of `IDatabase`. That file is the contract both storage
 * backends implement, so anything added to it obliges a Dexie implementation —
 * and a friendship held in local IndexedDB, with nobody on the other end, is
 * not a degraded version of this feature but a meaningless one. Keeping the
 * contract separate means the type system never asks for that implementation.
 *
 * Consequently there is exactly one implementation, and callers reach it only
 * when `isServerMode` and a session are both true.
 */
export interface ISocialRepository {
  listBuddies(profileId: string): Promise<BuddyLink[]>;
  removeBuddy(linkId: string): Promise<void>;
  setBlocked(linkId: string, profileId: string, blocked: boolean): Promise<BuddyLink>;

  /** The profile's live invitation, or null if it has none. */
  getInvite(profileId: string): Promise<BuddyInvite | null>;
  /** Mints a code, withdrawing whatever the profile had before. */
  createInvite(profileId: string): Promise<BuddyInvite>;
  revokeInvite(code: string): Promise<void>;
  /** Turns a code into a friendship. Idempotent if the two already are. */
  redeemInvite(profileId: string, code: string): Promise<BuddyLink>;

  /**
   * The conversation from your side, oldest first.
   *
   * `sinceId` is the poll's cursor. Anything you cleared by leaving is filtered
   * out by the server regardless of what is passed here.
   */
  listMessages(linkId: string, sinceId?: string): Promise<BuddyMessage[]>;
  sendMessage(
    linkId: string,
    draft: { kind?: BuddyMessageKind; body?: string; payload?: unknown },
  ): Promise<BuddyMessage>;
  /** Moves your read line forward. The server refuses to move it back. */
  markRead(linkId: string, upToId: string): Promise<void>;
  /**
   * Sends a routine into a conversation as a snapshot.
   *
   * The server rebuilds the payload field by field, so whatever is passed here
   * is a request rather than what gets stored — and `id` and `profileId` are
   * dropped on the way through whether or not the caller thought to omit them.
   */
  shareRoutine(linkId: string, routine: SharedRoutine): Promise<BuddyMessage>;

  /**
   * Which partners are training, with the server's clock alongside.
   *
   * `serverNow` is not decoration: `startedAt` comes off the other person's
   * phone, and without a reference their elapsed time can read minutes wrong.
   */
  listPresence(profileId: string): Promise<{ serverNow: Date; presence: BuddyPresence[] }>;
  /** Publishes this device's session. One way — nothing is ever read back. */
  publishPresence(profileId: string, snapshot: LiveSessionSnapshot): Promise<void>;
  endPresence(profileId: string): Promise<void>;

  /**
   * The container this profile is training in, or null.
   *
   * The one piece of social state the client cannot rebuild from its own
   * actions, so it is asked for on load rather than assumed — a reload
   * mid-workout would otherwise forget you were training with somebody.
   */
  getShared(profileId: string): Promise<SharedSession | null>;
  /**
   * Opens a container on a friendship and posts the invitation into it.
   *
   * Idempotent per friendship: both partners pressing this at once join one
   * session rather than opening two and each finding an empty room.
   */
  startShared(linkId: string): Promise<SharedSession>;
  joinShared(sessionId: string): Promise<SharedSession>;
  /** Steps out. Succeeds even for a session that has already ended. */
  leaveShared(sessionId: string): Promise<void>;
}
