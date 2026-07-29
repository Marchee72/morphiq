import type { WorkoutLog } from '../../core/entities/WorkoutLog';

/**
 * Which synced activities may be merged with a session you logged yourself.
 *
 * The health sync used to merge a manual session into *any* synced record within
 * four hours of it, with no check on what the record was. A fourteen-minute walk
 * therefore swallowed a full gym session: the sets were re-pointed onto the walk
 * and the session — its name, feeling and notes — was deleted. Only a strength
 * activity can plausibly be the same event as a session of logged sets.
 *
 * Health Connect's `workoutType` reaches us verbatim through capacitor-health,
 * and different sources spell it differently ('STRENGTH_TRAINING', 'Strength
 * Training', 'weight_lifting'), so matching is on normalized substrings.
 */

const STRENGTH_PATTERNS: RegExp[] = [
  /\bstrength\b/,
  /\bweight ?(lifting|training)\b/,
  /\bweightlifting\b/,
  /\bweights\b/,
  /\bresistance\b/,
  /\bpowerlifting\b/,
  /\bbodybuilding\b/,
  /\bgym\b/,
  /\bweight machine/,
  /\bfuerza\b/,          // Spanish-locale sources
  /\bpesas\b/,
  /\bmusculacion\b/,
];

/**
 * `OTHER` is deliberately excluded. Health Connect uses it for anything the
 * source could not classify, so treating it as strength is what let an
 * 83-minute 'OTHER' record absorb 81 sets.
 */
export function isStrengthActivity(type: string | undefined): boolean {
  if (!type) return false;
  const normalized = type
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    // Strip accents so 'musculación' matches the plain-ASCII pattern.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
  return STRENGTH_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * When a log actually happened, as a start/end pair.
 *
 * The two sources disagree about what `timestamp` means, which no caller can
 * ignore: `finishActiveSession` stamps the moment you pressed finish, so a
 * manual log's timestamp is its **end**, while Health Connect gives the
 * activity's **start**. Comparing them directly puts a session a full duration
 * away from the record of itself.
 */
export function logInterval(log: Pick<WorkoutLog, 'timestamp' | 'duration' | 'source'>): {
  start: number;
  end: number;
} {
  const at = new Date(log.timestamp).getTime();
  const span = Math.max(0, (log.duration ?? 0) * 60_000);
  return log.source === 'health-connect'
    ? { start: at, end: at + span }
    : { start: at - span, end: at };
}

/**
 * Slack on either side of an interval before two records stop being the same
 * event. People press finish well after the last set, and watch clocks drift.
 */
export const MERGE_TOLERANCE_MS = 30 * 60_000;

/** True when two logs overlap in time closely enough to be one event. */
export function overlaps(
  a: Pick<WorkoutLog, 'timestamp' | 'duration' | 'source'>,
  b: Pick<WorkoutLog, 'timestamp' | 'duration' | 'source'>,
  tolerance = MERGE_TOLERANCE_MS,
): boolean {
  const first = logInterval(a);
  const second = logInterval(b);
  return (
    first.start - tolerance < second.end &&
    second.start - tolerance < first.end
  );
}
