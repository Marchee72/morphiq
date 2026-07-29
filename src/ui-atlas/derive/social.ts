import type { BuddyInvite, BuddyLink } from '../../core/entities/Buddy';

/**
 * One partner as the list shows them.
 *
 * No pre-formatted strings, the same rule the rest of the derive layer follows:
 * `name` is a name, and every date stays a `Date` for the render edge to word.
 */
export interface BuddyRowVM {
  linkId: string;
  profileId: string;
  name: string;
  picture?: string;
  since: Date;
  blockedByMe: boolean;
  blockedByThem: boolean;
  /** True when nothing flows either way — either side having blocked stops it. */
  muted: boolean;
}

/**
 * The partner list, active first.
 *
 * Blocked partners sink rather than disappear: they are still a friendship you
 * agreed to, and hiding them would leave no way to lift a block you set.
 * Ordering is by name within each group, because the list is read by name.
 */
export function buildBuddyRows(links: BuddyLink[]): BuddyRowVM[] {
  return links
    .map(link => ({
      linkId: link.id,
      profileId: link.buddyProfileId,
      // A partner whose profile has no name still has to be tappable.
      name: link.buddyName?.trim() || '',
      picture: link.buddyPicture,
      since: link.createdAt,
      blockedByMe: link.blockedByMe,
      blockedByThem: link.blockedByThem,
      muted: link.blockedByMe || link.blockedByThem,
    }))
    .sort((a, b) => {
      if (a.muted !== b.muted) return a.muted ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Whether an invitation is still worth showing.
 *
 * The server refuses an expired code anyway; this stops the screen offering one
 * it already knows is dead, which would otherwise sit there looking valid until
 * somebody tried it.
 */
export function isInviteLive(invite: BuddyInvite | null, now: Date): boolean {
  return invite !== null && invite.expiresAt.getTime() > now.getTime();
}

/**
 * Whole hours left on an invitation, rounded up, floored at zero.
 *
 * Hours rather than a timestamp because that is the only precision that means
 * anything here — a code lasts three days and nobody counts the minutes.
 */
export function inviteHoursLeft(invite: BuddyInvite, now: Date): number {
  const ms = invite.expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 3600_000));
}

/**
 * The alphabet an invite code is drawn from, mirrored from the server.
 *
 * No `0/O`, no `1/I/L`. Typing normalises into it rather than rejecting: someone
 * reading a code off a screenshot writes `0` for `O` about as often as not, and
 * refusing the input teaches them nothing about which character was wrong.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/**
 * Cleans up a typed or pasted code.
 *
 * Everything outside the alphabet is dropped rather than rejected — spaces and
 * dashes from a pasted message, and the confusable characters the alphabet
 * excludes precisely because people type them by mistake. What survives is
 * uppercase, in-alphabet, and no longer than a code.
 */
export function normalizeInviteCode(input: string): string {
  return [...input.toUpperCase()]
    .filter(char => CODE_ALPHABET.includes(char))
    .slice(0, CODE_LENGTH)
    .join('');
}

/** True once a code is long enough to be worth sending to the server. */
export function isCompleteCode(code: string): boolean {
  return code.length === CODE_LENGTH;
}
