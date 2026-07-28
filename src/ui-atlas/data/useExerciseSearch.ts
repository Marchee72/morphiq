import { useCallback, useMemo, useState } from 'react';
import type { Exercise } from '../../core/entities/Exercise';
import type { CatalogItemVM, MuscleGroupId } from '../types';
import { matchesGroup } from '../derive/catalog';
import { MUSCLE_GROUPS } from '../derive/muscleLoad';
import { useAppData } from './useAppData';

export const SEARCH_LIMIT = 60;

export interface EquipmentFacet {
  id: string;
  count: number;
}

export interface ExerciseSearch {
  ready: boolean;
  total: number;

  query: string;
  setQuery: (value: string) => void;
  group: MuscleGroupId | null;
  setGroup: (value: MuscleGroupId | null) => void;
  equipment: string | null;
  setEquipment: (value: string | null) => void;
  favouritesOnly: boolean;
  setFavouritesOnly: (value: boolean) => void;

  /** Every filter cleared? Used to decide whether to surface the favourites shelf. */
  isPristine: boolean;
  clear: () => void;

  /** Matches, capped. */
  results: CatalogItemVM[];
  /** How many matched before the cap, so the UI can say "60 of 214". */
  matchCount: number;
  favourites: CatalogItemVM[];
  countForGroup: (group: MuscleGroupId) => number;
  /** Equipment options for the current muscle-group filter, busiest first. */
  equipmentFacets: EquipmentFacet[];
}

/**
 * One search behaviour, shared by the Library screens and both exercise pickers.
 *
 * Written once because the two surfaces have to agree: whatever you can filter
 * by when browsing, you can filter by when adding to a session. The skins differ
 * only in how they draw it.
 */
export function useExerciseSearch(): ExerciseSearch {
  const { catalog } = useAppData();

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroupId | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const matches = useMemo(() => {
    if (!catalog.ready) return [] as Exercise[];
    return catalog
      .search(query, equipment ? { equipment } : {})
      .filter(exercise => matchesGroup(exercise, group));
  }, [catalog, query, equipment, group]);

  const favourites = useMemo(() => {
    if (!catalog.ready) return [];
    // Favourites ignore the muscle/equipment filters: the point of the shelf is
    // that what you always do is one tap away, whatever else you were browsing.
    return catalog
      .search('')
      .map(catalog.toItem)
      .filter(item => item.favorite);
  }, [catalog]);

  const visible = useMemo(() => {
    const mapped = matches.map(catalog.toItem);
    return favouritesOnly ? mapped.filter(item => item.favorite) : mapped;
  }, [matches, catalog, favouritesOnly]);

  // All six computed up front rather than memoised behind a closure: there are
  // only six, and a lazily-filled cache would be a mutation after render.
  const groupCounts = useMemo(() => {
    const counts = new Map<MuscleGroupId, number>();
    for (const id of MUSCLE_GROUPS) {
      counts.set(
        id,
        catalog.facets.category
          .filter(bucket => matchesGroup({ category: bucket.id } as Exercise, id))
          .reduce((total, bucket) => total + bucket.count, 0),
      );
    }
    return counts;
  }, [catalog.facets]);

  const countForGroup = useCallback(
    (id: MuscleGroupId) => groupCounts.get(id) ?? 0,
    [groupCounts],
  );

  // Equipment counts respond to the muscle filter — picking "chest" should not
  // still offer equipment that only appears on leg exercises.
  const equipmentFacets = useMemo(() => {
    if (!catalog.ready) return [];
    const counts = new Map<string, number>();
    for (const exercise of catalog.search('')) {
      if (!matchesGroup(exercise, group)) continue;
      counts.set(exercise.equipment, (counts.get(exercise.equipment) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  }, [catalog, group]);

  const isPristine = !query && group === null && equipment === null && !favouritesOnly;

  return {
    ready: catalog.ready,
    total: catalog.total,
    query, setQuery,
    group, setGroup,
    equipment, setEquipment,
    favouritesOnly, setFavouritesOnly,
    isPristine,
    clear: () => { setQuery(''); setGroup(null); setEquipment(null); setFavouritesOnly(false); },
    results: visible.slice(0, SEARCH_LIMIT),
    matchCount: visible.length,
    favourites,
    countForGroup,
    equipmentFacets,
  };
}

export { MUSCLE_GROUPS };
