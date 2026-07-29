/**
 * Training partners.
 *
 * The first entities in the app that describe somebody who is not you. Messages,
 * presence and shared sessions join them as their stages land; what is here is
 * what a friendship needs to exist at all.
 */

/**
 * One friendship, seen from your side.
 *
 * The server stores a friendship as a single row with two profiles in canonical
 * order and resolves the far side per request, so `buddyProfileId` is already
 * "the other one" and no screen has to work out which end it is standing on.
 *
 * Note there is no email here, and there never should be: an invite code is
 * deliberately the only thing that travels between two people.
 */
export interface BuddyLink {
  id: string;
  myProfileId: string;
  buddyProfileId: string;
  buddyName: string;
  buddyPicture?: string;
  createdAt: Date;
  /**
   * Two flags rather than one, because the UI offers "unblock" only to the
   * person who blocked. A single boolean would let the blocked side lift it.
   */
  blockedByMe: boolean;
  blockedByThem: boolean;
}

/**
 * A code you send someone, single-use and short-lived.
 *
 * `expiresAt` is a `Date`, not a formatted countdown — the render edge turns it
 * into words, the same as every other date in the app.
 */
export interface BuddyInvite {
  code: string;
  createdAt: Date;
  expiresAt: Date;
}
