import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

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
    expect(measurements[0].bmr).toBeGreaterThan(1700);
    expect(measurements[0].bodyFat).toBe(0);
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
