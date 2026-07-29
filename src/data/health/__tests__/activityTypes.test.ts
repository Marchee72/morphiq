import { describe, expect, it } from 'vitest';
import { isStrengthActivity, logInterval, overlaps, MERGE_TOLERANCE_MS } from '../activityTypes';

describe('isStrengthActivity', () => {
  it('accepts the spellings Health Connect sources actually send', () => {
    for (const type of [
      'STRENGTH_TRAINING', 'Strength Training', 'strength-training',
      'WEIGHTLIFTING', 'Weight Lifting', 'weight_training',
      'Resistance Training', 'Powerlifting', 'Bodybuilding',
      'Gym', 'Weight Machine', 'Fuerza', 'Musculación',
    ]) {
      expect(isStrengthActivity(type), type).toBe(true);
    }
  });

  it('rejects the activity that swallowed a gym session', () => {
    expect(isStrengthActivity('WALKING')).toBe(false);
  });

  it('rejects OTHER, which is what a source sends when it does not know', () => {
    // An 83-minute 'OTHER' record absorbed 81 sets under the old rule.
    expect(isStrengthActivity('OTHER')).toBe(false);
    expect(isStrengthActivity('OTHER_WORKOUT')).toBe(false);
  });

  it('rejects everything else that is not lifting', () => {
    for (const type of [
      'RUNNING', 'BIKING', 'SWIMMING', 'YOGA', 'HIKING',
      'ELLIPTICAL', 'ROWING', 'Workout', 'HIGH_INTENSITY_INTERVAL_TRAINING',
    ]) {
      expect(isStrengthActivity(type), type).toBe(false);
    }
  });

  it('treats a missing type as not strength', () => {
    expect(isStrengthActivity(undefined)).toBe(false);
    expect(isStrengthActivity('')).toBe(false);
  });
});

describe('logInterval', () => {
  const at = new Date(2026, 6, 28, 17, 30);

  it('reads a manual timestamp as the end, because finish is when it is stamped', () => {
    const { start, end } = logInterval({ timestamp: at, duration: 60, source: 'manual' });
    expect(end).toBe(at.getTime());
    expect(start).toBe(at.getTime() - 60 * 60_000);
  });

  it('reads a synced timestamp as the start, because that is what Health Connect gives', () => {
    const { start, end } = logInterval({ timestamp: at, duration: 60, source: 'health-connect' });
    expect(start).toBe(at.getTime());
    expect(end).toBe(at.getTime() + 60 * 60_000);
  });

  it('handles a log with no duration', () => {
    const { start, end } = logInterval({ timestamp: at, duration: 0, source: 'manual' });
    expect(start).toBe(end);
  });
});

describe('overlaps', () => {
  const finishedAt = new Date(2026, 6, 28, 18, 30);
  // A 60-minute session finished at 18:30 ran 17:30 → 18:30.
  const session = { timestamp: finishedAt, duration: 60, source: 'manual' as const };

  it('matches the watch recording of the same session', () => {
    // Watch recorded 17:32 → 18:29.
    const synced = { timestamp: new Date(2026, 6, 28, 17, 32), duration: 57, source: 'health-connect' as const };
    expect(overlaps(session, synced)).toBe(true);
  });

  it('matches when the watch started a little before the first set', () => {
    const synced = { timestamp: new Date(2026, 6, 28, 17, 10), duration: 30, source: 'health-connect' as const };
    expect(overlaps(session, synced)).toBe(true);
  });

  it('does not match an activity from earlier the same day', () => {
    // 09:00 → 09:45, hours clear of the session even with the tolerance.
    const synced = { timestamp: new Date(2026, 6, 28, 9, 0), duration: 45, source: 'health-connect' as const };
    expect(overlaps(session, synced)).toBe(false);
  });

  it('does not match an activity later that evening', () => {
    const synced = { timestamp: new Date(2026, 6, 28, 21, 0), duration: 20, source: 'health-connect' as const };
    expect(overlaps(session, synced)).toBe(false);
  });

  it('is narrower than the four hours the old rule allowed', () => {
    // The shape that caused this: a 14-minute walk at 14:24, and a session
    // finished at 17:30 — 3h06m apart, comfortably inside the old ±4h filter.
    const session1730 = { timestamp: new Date(2026, 6, 28, 17, 30), duration: 60, source: 'manual' as const };
    const walk = { timestamp: new Date(2026, 6, 28, 14, 24), duration: 14, source: 'health-connect' as const };

    const oldRuleWouldMatch =
      Math.abs(walk.timestamp.getTime() - session1730.timestamp.getTime()) < 4 * 60 * 60_000;
    expect(oldRuleWouldMatch).toBe(true);

    expect(overlaps(session1730, walk)).toBe(false);
  });

  it('allows the configured slack on either side', () => {
    const justInside = new Date(finishedAt.getTime() + MERGE_TOLERANCE_MS - 60_000);
    expect(overlaps(session, { timestamp: justInside, duration: 10, source: 'health-connect' })).toBe(true);

    const justOutside = new Date(finishedAt.getTime() + MERGE_TOLERANCE_MS + 60_000);
    expect(overlaps(session, { timestamp: justOutside, duration: 10, source: 'health-connect' })).toBe(false);
  });
});
