import type { BuddyInvite, BuddyLink } from '../entities/Buddy';

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
}
