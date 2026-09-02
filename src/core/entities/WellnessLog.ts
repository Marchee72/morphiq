/**
 * How the day is going, before and around the training in it.
 *
 * The first entity in the app that is genuinely keyed by day. Everything else
 * daily — steps, volume, whether you trained — is derived by filtering
 * timestamped rows through `dayKey`. This has no underlying event to filter:
 * "I slept badly and my legs are wrecked" is a statement about a day, so the
 * day is the key, and there is at most one row per profile per day.
 */
export interface WellnessLog {
  id?: string;
  profileId: string;
  /**
   * Local calendar day, `YYYY-MM-DD`. Zero-padded so it sorts and compares as a
   * string — `dayKey` in `derive/buckets.ts` emits `2026-8-2`, which does
   * neither, and is only ever used as a map key.
   */
  day: string;
  /** When the day was last answered. The day, not this, is the identity. */
  timestamp: Date;

  /**
   * Self-reported, 1-5.
   *
   * **Higher is always better**, including for `soreness` and `stress`: 1 is
   * "wrecked" and "frayed", 5 is "fresh" and "calm". Without that the readiness
   * score would have to invert two of the four, which is exactly where a flipped
   * sign hides — and a flipped sign here is invisible, because the number still
   * looks plausible.
   */
  energy?: number;
  soreness?: number;
  stress?: number;
  mood?: number;

  /**
   * Read from Health Connect where it exists, editable by hand where it does
   * not. Nothing here can be asked for: Health Connect has no record type for
   * stress, mood or soreness, and Samsung's own scores are proprietary.
   */
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  restingHr?: number;
  /** RMSSD. Not every watch writes it, so its absence is normal, not an error. */
  hrvMs?: number;
  /** Which of the two filled the sleep fields, so the sheet can say so. */
  sleepSource?: 'manual' | 'health-connect';

  notes?: string;
}

/** The four self-reported scales share one range. */
export const WELLNESS_SCALE_MIN = 1;
export const WELLNESS_SCALE_MAX = 5;

/**
 * `YYYY-MM-DD` in the phone's own timezone — the day a person would call it.
 *
 * Same shape and same reasoning as `localDayKey` in the Capacitor health
 * provider; duplicated rather than imported so a core entity does not depend on
 * the Capacitor layer.
 */
export function wellnessDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
