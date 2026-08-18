import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

/**
 * `clearMockData` was a byte-for-byte copy of `clearDatabaseData`, so the
 * button labelled "clear demo data" deleted real training history and left the
 * demo behind. These pin the distinction it now has to make.
 */
describe('store — clearMockData', () => {
  let profileId: string;

  beforeEach(async () => {
    useStore.setState(useStore.getState(), true);
    await Promise.all(db.tables.map(t => t.clear()));
    const id = await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
    });
    profileId = String(id);
    await useStore.getState().setActiveProfile(profileId);
    await useStore.getState().seedMockData();
  });

  it('removes the seeded demo rows', async () => {
    expect(useStore.getState().measurements.length).toBeGreaterThan(0);

    await useStore.getState().clearMockData();

    expect(await db.measurements.where({ profileId }).count()).toBe(0);
    expect(await db.foodLogs.where({ profileId }).count()).toBe(0);
  });

  it('leaves a real weigh-in and a real session alone', async () => {
    await useStore.getState().addManualMeasurement(84.3);
    await db.workoutLogs.add({
      profileId, timestamp: new Date(), type: 'Strength Training',
      description: 'Real session I actually did', duration: 45, source: 'manual',
    });

    await useStore.getState().clearMockData();

    const measurements = await db.measurements.where({ profileId }).toArray();
    expect(measurements).toHaveLength(1);
    expect(measurements[0].weight).toBe(84.3);

    const workouts = await db.workoutLogs.where({ profileId }).toArray();
    expect(workouts.map(w => w.description)).toEqual(['Real session I actually did']);
  });

  /**
   * The demo used to survive clearing, so seeding again stacked another copy —
   * this is what put ten duplicates of every demo weigh-in in production.
   */
  it('does not accumulate when seeded, cleared and seeded again', async () => {
    const afterFirstSeed = await db.measurements.where({ profileId }).count();

    await useStore.getState().clearMockData();
    await useStore.getState().seedMockData();

    expect(await db.measurements.where({ profileId }).count()).toBe(afterFirstSeed);
  });
});
