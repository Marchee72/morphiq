import { describe, expect, it } from 'vitest';
import { withSamsungReadings } from '../SamsungHealthPlugin';

const hc = (timestamp: string, extra = {}) => ({
  timestamp, weight: 78.4, bodyFat: 18.2, leanMass: 0, boneMass: 0, bodyWaterMass: 0, ...extra,
});
const samsung = (timestamp: string, extra = {}) => ({
  timestamp, weight: 78.4, bodyFat: 18.2, skeletalMuscleMass: 34.2, totalBodyWater: 44.1, ...extra,
});

describe('withSamsungReadings', () => {
  it('puts skeletal muscle on the Health Connect reading it belongs to', () => {
    const out = withSamsungReadings([hc('2026-09-25T07:42:00Z')], [samsung('2026-09-25T07:43:30Z')]);
    expect(out).toHaveLength(1);
    expect(out[0].skeletalMuscle).toBe(34.2);
    expect(out[0].bodyWaterMass).toBe(44.1);
  });

  it('adds a reading Health Connect has not received yet', () => {
    const out = withSamsungReadings([hc('2026-09-24T07:51:00Z')], [samsung('2026-09-25T07:42:00Z')]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ timestamp: '2026-09-25T07:42:00Z', weight: 78.4, skeletalMuscle: 34.2 });
  });

  it('leaves skeletal muscle unset when Samsung has none', () => {
    const out = withSamsungReadings([], [samsung('2026-09-25T07:42:00Z', { skeletalMuscleMass: 0 })]);
    expect(out[0].skeletalMuscle).toBeUndefined();
  });
});
