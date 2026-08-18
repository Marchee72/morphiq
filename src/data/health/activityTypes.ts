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
function normalizeType(type: string): string {
  return type
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    // Strip accents so 'musculación' matches the plain-ASCII pattern.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

export function isStrengthActivity(type: string | undefined): boolean {
  if (!type) return false;
  return STRENGTH_PATTERNS.some(pattern => pattern.test(normalizeType(type)));
}

/**
 * Activities whose distance is read as a pace — minutes per kilometre.
 *
 * Prefix matches rather than whole words, because sources spell the same
 * activity as 'RUNNING', 'Outdoor Running' and 'run'. `\brun` catches all
 * three without also matching 'running shoes'-style noise we never see here.
 */
const PACE_PATTERNS: RegExp[] = [
  /\brun/,
  /\bjog/,
  /\bwalk/,
  /\bhik/,
  /\btrail/,
  /\bcorrer\b/,        // Spanish-locale sources
  /\btrote\b/,
  /\bcaminata\b/,
  /\bcaminar\b/,
  /\bmarcha\b/,
  /\bsenderismo\b/,
];

/** Activities whose distance is read as a speed — kilometres per hour. */
const SPEED_PATTERNS: RegExp[] = [
  /\bcycl/,
  /\bbik/,
  /\bcicl/,          // ciclismo
  /\bbicicl/,        // bicicleta — the word boundary above stops short of it
  /\bspinning\b/,
  /\bskat/,
  /\browing\b/,
  /\bremo\b/,
  /\bpatin/,
];

/**
 * How to read an activity's distance, or null when distance is not the point.
 *
 * A run and a bike ride both record kilometres, but nobody reads a ride in
 * minutes per kilometre or a run in km/h. Strength is checked first so a
 * 'gym bike' style label does not get a pace it has no distance for.
 */
export function distanceReadout(type: string | undefined): 'pace' | 'speed' | null {
  if (!type) return null;
  const normalized = normalizeType(type);
  if (STRENGTH_PATTERNS.some(pattern => pattern.test(normalized))) return null;
  if (PACE_PATTERNS.some(pattern => pattern.test(normalized))) return 'pace';
  if (SPEED_PATTERNS.some(pattern => pattern.test(normalized))) return 'speed';
  return null;
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
