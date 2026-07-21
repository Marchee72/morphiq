import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { db } from '../../data/database/LocalDatabase';

const initialState = useStore.getState();

describe('store — exercise favorites', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));

    const profileId = await db.userProfiles.add({
      name: 'Alex', gender: 'male', birthDate: new Date('1995-01-01'), height: 180, createdAt: new Date(),
    });
    await useStore.getState().setActiveProfile(String(profileId));
  });

  it('starts with no favorites', async () => {
    await useStore.getState().loadFavorites();
    expect(useStore.getState().favoriteExerciseIds).toEqual([]);
  });

  it('toggleFavorite adds and removes an exercise id', async () => {
    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025']);

    await useStore.getState().toggleFavorite('0652');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025', '0652']);

    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0652']);
  });

  it('persists favorites across loadFavorites calls', async () => {
    await useStore.getState().toggleFavorite('0025');
    useStore.setState({ favoriteExerciseIds: [] });

    await useStore.getState().loadFavorites();
    expect(useStore.getState().favoriteExerciseIds).toEqual(['0025']);
  });

  it('toggleFavorite is a no-op without an active profile', async () => {
    useStore.setState({ activeProfile: null });
    await useStore.getState().toggleFavorite('0025');
    expect(useStore.getState().favoriteExerciseIds).toEqual([]);
  });
});
