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
  /** Messages from them you have not read, past anything you cleared. */
  unreadCount: number;
}

/**
 * Kinds a message can be.
 *
 * Only `text` is sent today; the other two arrive with their own stages. They
 * are named here so a reader handling messages knows the set is not open.
 */
export type BuddyMessageKind = 'text' | 'routine' | 'sessionInvite';

export interface BuddyMessage {
  id: string;
  linkId: string;
  senderProfileId: string;
  kind: BuddyMessageKind;
  body?: string;
  /** A shared routine, or which session is being joined. Empty for text. */
  payload?: unknown;
  createdAt: Date;
}

/**
 * What one partner is doing right now.
 *
 * Note what is absent and has to stay absent: no weight, no reps, no volume. A
 * partner sees the exercise, the progress through it, and how long it has been
 * going. The server's table has no column for anything else, which is the real
 * guarantee — this type only has to avoid inventing one.
 */
export interface BuddyPresence {
  profileId: string;
  linkId: string;
  /** New each time a session starts, so a restart is not the old one resumed. */
  sessionKey: string;
  startedAt: Date;
  exerciseName?: string;
  exerciseIndex?: number;
  exerciseCount?: number;
  setNumber?: number;
  setCount?: number;
  setsDone: number;
  setsPlanned: number;
  /** The container they are training in, if any. See `SharedSession`. */
  sharedSessionId?: string;
  updatedAt: Date;
}

/** What this device publishes about its own session. Never read back. */
export type LiveSessionSnapshot = Omit<BuddyPresence, 'profileId' | 'linkId' | 'updatedAt'>;

/**
 * Two partners training at the same time.
 *
 * A container, not a synchronised workout: each person does their own
 * exercises, at their own weights, at their own pace. Nothing in here describes
 * a plan, because there is no shared plan — only a shared hour.
 *
 * It therefore discloses nothing new. What a participant sees of the others is
 * the presence they could already see, narrowed to the people in the same
 * container.
 */
export interface SharedSession {
  id: string;
  /** The friendship it was opened on, which is also what authorises reaching it. */
  linkId: string;
  createdAt: Date;
  startedByMe: boolean;
  /** Everyone still in it, you included. */
  profileIds: string[];
}

/**
 * A routine as it travels between two people.
 *
 * A snapshot, not a link. It carries no `id` and no `profileId`, and the two
 * absences are the design: the receiver saves a copy that belongs to them, so
 * there is nothing pointing back at the sender's row for a later edit to follow.
 *
 * Which means the two copies drift apart the moment either is changed, and that
 * is the honest behaviour — the button says "save a copy" because that is what
 * it does, not because the wording is softer.
 *
 * `exerciseId` survives because it names an entry in the shared exercise
 * catalogue, which belongs to nobody.
 */
export interface SharedRoutine {
  title: string;
  description: string;
  targetMuscles: string[];
  exercises: {
    exerciseId: string;
    exerciseName: string;
    targetSets: number;
    targetReps?: number;
    notes?: string;
  }[];
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
