import { describe, it, expect } from 'vitest';
import { routineToText } from '../routineText';

describe('routineToText', () => {
  it('writes sets, reps and weight when the routine prescribes them', () => {
    const text = routineToText({
      title: 'Push Day',
      exercises: [
        { exerciseName: 'Bench press', targetSets: 4, targetReps: 10, targetWeight: 60 },
      ],
    });
    expect(text).toContain('Push Day');
    expect(text).toContain('Bench press — 4 × 10 @ 60 kg');
  });

  it('omits the weight when there is no suggestion, rather than inventing one', () => {
    const text = routineToText({
      title: 'Pull Day',
      exercises: [{ exerciseName: 'Lat pulldown', targetSets: 3, targetReps: 12 }],
    });
    expect(text).toContain('Lat pulldown — 3 × 12');
    expect(text).not.toContain('@');
  });

  it('falls back to a set count when no reps were prescribed', () => {
    const text = routineToText({
      title: 'Legs',
      exercises: [{ exerciseName: 'Squat', targetSets: 5 }],
    });
    // Not "5 × 10" — the fabricated 10 the coach card used to print.
    expect(text).toContain('Squat — 5 sets');
    expect(text).not.toContain('×');
  });

  it('carries a fractional suggested weight intact', () => {
    const text = routineToText({
      title: 'Micro',
      exercises: [{ exerciseName: 'Curl', targetSets: 3, targetReps: 8, targetWeight: 12.125 }],
    });
    expect(text).toContain('@ 12.125 kg');
  });

  it('includes notes and the description when present', () => {
    const text = routineToText({
      title: 'Push Day',
      description: 'Chest focus',
      exercises: [{ exerciseName: 'Bench press', targetSets: 4, notes: 'RPE 8' }],
    });
    expect(text).toContain('Chest focus');
    expect(text).toContain('(RPE 8)');
  });

  it('produces one line per exercise', () => {
    const text = routineToText({
      title: 'Full',
      exercises: [
        { exerciseName: 'A', targetSets: 3 },
        { exerciseName: 'B', targetSets: 3 },
        { exerciseName: 'C', targetSets: 3 },
      ],
    });
    expect(text.split('\n').filter(l => l.includes('—'))).toHaveLength(3);
  });
});
