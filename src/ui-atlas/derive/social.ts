import type {
  BuddyInvite, BuddyLink, BuddyMessage, BuddyMessageKind, BuddyPresence, SharedRoutine,
} from '../../core/entities/Buddy';
import type { TFn } from '../../i18n';

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
  unread: number;
}

/** One message as the thread renders it. */
export interface BuddyMessageVM {
  id: string;
  mine: boolean;
  /**
   * Which shape the thread draws.
   *
   * Carried rather than inferred from the fields present: a text message and an
   * invitation are different things to look at, and deciding that from "does it
   * have a body" would quietly turn an empty message into a card.
   */
  kind: BuddyMessageKind;
  /** Present on text. An invitation has nothing to say beyond being one. */
  body?: string;
  /** The container an invitation points at. */
  sharedSessionId?: string;
  /** The routine a share carries, once it has survived being read back. */
  routine?: SharedRoutine;
  at: Date;
}

/** A day's worth of messages, so the thread can show one date header per day. */
export interface BuddyDayVM {
  /** Midnight of the day, for the render edge to format. */
  day: Date;
  messages: BuddyMessageVM[];
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
      unread: link.unreadCount ?? 0,
    }))
    .sort((a, b) => {
      if (a.muted !== b.muted) return a.muted ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

/** Every unread message across every conversation, for the badge on the hub. */
export function totalUnread(rows: BuddyRowVM[]): number {
  // Muted conversations are excluded: nothing arrives through them, so a count
  // there would be a badge you cannot clear.
  return rows.reduce((sum, row) => sum + (row.muted ? 0 : row.unread), 0);
}

/** One partner training, as the strip on Today shows them. */
export interface PresenceRowVM {
  profileId: string;
  linkId: string;
  name: string;
  picture?: string;
  exerciseName?: string;
  exerciseIndex?: number;
  exerciseCount?: number;
  setNumber?: number;
  setCount?: number;
  /** The container they are training in, if any. Undefined means alone. */
  sharedSessionId?: string;
  /**
   * When they started, corrected for the difference between their clock and
   * the server's. A `Date`, so the ticker at the render edge owns the counting.
   */
  startedAt: Date;
}

/**
 * Partners who are training, newest session first.
 *
 * Joined to the partner list for the name and picture: presence carries a
 * profile id and nothing else, deliberately, so that the only place a partner's
 * identity comes from is the friendship you already have with them.
 *
 * `clockSkewMs` is this device's clock minus the server's. Adding it to a
 * partner's `startedAt` expresses their start in *our* clock, which is the one
 * the elapsed counter will subtract from.
 */
export function buildPresenceRows(
  presence: BuddyPresence[],
  rows: BuddyRowVM[],
  clockSkewMs: number,
): PresenceRowVM[] {
  const byProfile = new Map(rows.map(row => [row.profileId, row]));

  return presence
    .flatMap(entry => {
      const row = byProfile.get(entry.profileId);
      // Someone with no live friendship should never have reached us; if they
      // did, showing an unnamed stranger training is worse than showing nobody.
      if (!row || row.muted) return [];
      return [{
        profileId: entry.profileId,
        linkId: entry.linkId,
        name: row.name,
        picture: row.picture,
        exerciseName: entry.exerciseName,
        exerciseIndex: entry.exerciseIndex,
        exerciseCount: entry.exerciseCount,
        setNumber: entry.setNumber,
        setCount: entry.setCount,
        sharedSessionId: entry.sharedSessionId,
        startedAt: new Date(entry.startedAt.getTime() + clockSkewMs),
      }];
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * The partners training in the same container as you.
 *
 * A filter over the rows above and nothing more — which is the whole design of
 * shared sessions. Being in one shows you no more about somebody than being
 * their partner already did; it only says who is in the room right now.
 *
 * Ordered by when each arrived, oldest first, so the strip does not reshuffle
 * itself under a thumb every time somebody closes a set.
 */
export function buildSharedRows(
  training: PresenceRowVM[],
  sharedSessionId: string | null,
): PresenceRowVM[] {
  if (!sharedSessionId) return [];
  return training
    .filter(row => row.sharedSessionId === sharedSessionId)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

/**
 * What a partner's row of `training` reads as, everywhere it is shown — the
 * exercise and how far through it they are, or that they have just started.
 *
 * Takes `t` rather than living in a component: three places show this exact
 * line (Today's strip, the shared-session strip, and the Buddies list), and
 * they had each grown their own copy before this existed.
 */
export function presenceProgress(
  row: Pick<PresenceRowVM, 'exerciseName' | 'setNumber' | 'setCount'>,
  t: TFn,
): string {
  return row.exerciseName && row.setNumber && row.setCount
    ? t('buddy.progress', {
        exercise: row.exerciseName,
        n: String(row.setNumber),
        total: String(row.setCount),
      })
    : t('buddy.warmingUp');
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Reads a shared routine back out of a message payload.
 *
 * The server already rebuilds it field by field on the way in, so this is not
 * where the trust boundary is. It is where an *old* payload is handled: a
 * message is stored forever, and a routine written by a version of the app that
 * shaped them differently must not put a card with no exercises on screen.
 *
 * Returns undefined for anything it cannot make a whole routine out of, which
 * the thread renders as a share that arrived broken rather than as a button
 * that would save nothing.
 */
export function parseSharedRoutine(payload: unknown): SharedRoutine | undefined {
  if (payload == null || typeof payload !== 'object') return undefined;
  const raw = payload as Partial<SharedRoutine>;
  if (!Array.isArray(raw.exercises) || raw.exercises.length === 0) return undefined;

  const exercises = raw.exercises.filter(item => item?.exerciseName);
  if (exercises.length === 0) return undefined;

  return {
    title: raw.title ?? '',
    description: raw.description ?? '',
    targetMuscles: Array.isArray(raw.targetMuscles) ? raw.targetMuscles : [],
    exercises,
  };
}

/**
 * The thread, grouped into days.
 *
 * Grouping happens here rather than in the component because it is the kind of
 * thing that is wrong at midnight and nowhere else, and a pure function is the
 * only place that is cheap to test.
 *
 * `myProfileId` decides which side each bubble sits on — the messages carry a
 * sender id and nothing else, since the same conversation renders mirrored on
 * the other person's phone.
 */
export function buildMessageDays(
  messages: BuddyMessage[],
  myProfileId: string,
): BuddyDayVM[] {
  const days: BuddyDayVM[] = [];

  for (const message of messages) {
    // A text message with nothing in it has nothing to draw. Every other kind
    // carries its own shape and the thread knows how to render it.
    if (message.kind === 'text' && !message.body) continue;

    const day = startOfDay(message.createdAt);
    const last = days[days.length - 1];
    const payload = message.payload as { sharedSessionId?: string } | undefined;
    const vm: BuddyMessageVM = {
      id: message.id,
      mine: String(message.senderProfileId) === String(myProfileId),
      kind: message.kind,
      body: message.body,
      sharedSessionId: payload?.sharedSessionId,
      routine: message.kind === 'routine' ? parseSharedRoutine(message.payload) : undefined,
      at: message.createdAt,
    };

    if (last && last.day.getTime() === day.getTime()) last.messages.push(vm);
    else days.push({ day, messages: [vm] });
  }

  return days;
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
