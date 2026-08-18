import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';
import { BiaCalculator } from '../../data/calculation/BiaCalculator';
import { getAge } from '../../core/entities/UserProfile';

const initialState = useStore.getState();

describe('store — addManualMeasurement', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
    const profileId = await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
    });
    await useStore.getState().setActiveProfile(String(profileId));
  });

  it('saves a weight-only measurement with computed BMI/BMR', async () => {
    await useStore.getState().addManualMeasurement(80);
    const measurements = useStore.getState().measurements;
    expect(measurements).toHaveLength(1);
    expect(measurements[0].weight).toBe(80);
    expect(measurements[0].impedance).toBe(0);
    expect(measurements[0].bmi).toBeCloseTo(24.69, 2);
    expect(measurements[0].bodyFat).toBe(0);
  });

  /**
   * BMR used to be a Harris-Benedict expression written out inside the store,
   * while a synced weigh-in went through `BiaCalculator`. The two disagree by
   * roughly 195 kcal, and both land in the same chart — so the BMR line stepped
   * whenever the source changed rather than when the body did.
   *
   * Asserted against the calculator rather than a literal because the profile's
   * age, and therefore the expected figure, moves with the real clock.
   */
  it('derives BMR through the same calculator a synced reading uses', async () => {
    await useStore.getState().addManualMeasurement(80);
    const profile = useStore.getState().activeProfile!;
    const expected = BiaCalculator.getBMR(80, 180, getAge(profile.birthDate), 'male');

    expect(useStore.getState().measurements[0].bmr).toBeCloseTo(expected, 2);
  });

  it('stores scale readings when given, and derives the rest from them', async () => {
    await useStore.getState().addManualMeasurement(80, { bodyFat: 18.2, muscleMass: 34.1, bodyWater: 55 });
    const m = useStore.getState().measurements[0];

    expect(m.bodyFat).toBe(18.2);
    expect(m.muscleMass).toBe(34.1);
    expect(m.bodyWater).toBe(55);
    // Present only because body fat was: bone mass is a formula over the reading.
    expect(m.boneMass).toBeGreaterThan(0);
  });

  /**
   * Zero is what the Body screen reads as "never measured". A manual weigh-in
   * must not fabricate a body fat figure it was not given, or the charts would
   * show a reading nobody took.
   */
  it('leaves composition at zero when only a weight is entered', async () => {
    await useStore.getState().addManualMeasurement(80);
    const m = useStore.getState().measurements[0];

    for (const field of ['bodyFat', 'muscleMass', 'bodyWater', 'boneMass'] as const) {
      expect(m[field]).toBe(0);
    }
  });

  it('ignores partial readings that cannot support a derivation', async () => {
    // Muscle and water without body fat: the sync path gates every derived
    // figure on body fat, and this must gate the same way.
    await useStore.getState().addManualMeasurement(80, { muscleMass: 34.1, bodyWater: 55 });
    const m = useStore.getState().measurements[0];

    expect(m.muscleMass).toBe(34.1);
    expect(m.bodyWater).toBe(55);
    expect(m.bodyFat).toBe(0);
    expect(m.boneMass).toBe(0);
  });

  it('appends to existing measurements in chronological order', async () => {
    await useStore.getState().addManualMeasurement(81);
    await useStore.getState().addManualMeasurement(80.5);
    expect(useStore.getState().measurements.map(m => m.weight)).toEqual([81, 80.5]);
  });

  it('rejects implausible weights', async () => {
    await useStore.getState().addManualMeasurement(5);
    await useStore.getState().addManualMeasurement(500);
    expect(useStore.getState().measurements).toHaveLength(0);
  });

  it('is a no-op without an active profile', async () => {
    useStore.setState({ activeProfile: null });
    await useStore.getState().addManualMeasurement(80);
    expect(useStore.getState().measurements).toHaveLength(0);
  });
});
