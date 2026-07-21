import { describe, it, expect, beforeEach } from 'vitest';
import { db, FavoriteExerciseRepository } from './LocalDatabase';

describe('FavoriteExerciseRepository (Dexie v4)', () => {
  const repo = new FavoriteExerciseRepository();

  beforeEach(async () => {
    await db.favoriteExercises.clear();
  });

  it('exposes the favoriteExercises table after upgrade', () => {
    expect(db.tables.map(t => t.name)).toContain('favoriteExercises');
  });

  it('adds and lists favorites for a profile', async () => {
    await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    await repo.add({ profileId: 'p1', exerciseId: '0652', addedAt: new Date() });
    await repo.add({ profileId: 'p2', exerciseId: '0043', addedAt: new Date() });

    const p1 = await repo.getAll('p1');
    expect(p1.map(f => f.exerciseId).sort()).toEqual(['0025', '0652']);
    expect(await repo.getAll('p2')).toHaveLength(1);
  });

  it('returns string ids on added favorites', async () => {
    const id = await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    expect(typeof id).toBe('string');
    const all = await repo.getAll('p1');
    expect(typeof all[0].id).toBe('string');
  });

  it('removes a favorite by profileId + exerciseId only', async () => {
    await repo.add({ profileId: 'p1', exerciseId: '0025', addedAt: new Date() });
    await repo.add({ profileId: 'p2', exerciseId: '0025', addedAt: new Date() });

    await repo.remove('p1', '0025');

    expect(await repo.getAll('p1')).toHaveLength(0);
    expect(await repo.getAll('p2')).toHaveLength(1);
  });
});
