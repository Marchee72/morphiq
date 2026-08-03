import type { Exercise } from '../../core/entities/Exercise';
import type { Lang } from '../../presentation/state/preferences';
import type { CatalogItemVM, MuscleGroupId } from '../types';
import { GROUP_TO_CATEGORIES } from './muscleLoad';
import { normalizeName, type ExerciseUsageMap } from './records';

/** The bundled dataset is hosted here; `Exercise.image` and `gifUrl` are repo-relative. */
export const EXERCISE_CDN = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/';

export function mediaUrl(relativePath: string): string {
  return relativePath ? `${EXERCISE_CDN}${relativePath}` : '';
}

/**
 * One catalogue row, enriched with the user's own history.
 *
 * Never map the whole 1,324-item catalogue through this — call it on an already
 * filtered and sliced result, inside a `useMemo`.
 */
export function toCatalogItem(
  exercise: Exercise,
  usage: ExerciseUsageMap,
  favorites: Set<string>,
  lang: Lang = 'en',
): CatalogItemVM {
  const used = usage.get(normalizeName(exercise.name));
  return {
    id: exercise.id,
    name: lang === 'es' ? exercise.nameEs : exercise.name,
    category: exercise.category,
    equipment: exercise.equipment,
    target: exercise.target,
    image: exercise.image,
    favorite: favorites.has(exercise.id),
    lastUsedAt: used?.lastAt ?? null,
    bestKg: used?.bestKg && used.bestKg > 0 ? used.bestKg : null,
  };
}

/** Body-map region / muscle drum → the catalogue categories it should filter to. */
export function categoriesForGroup(group: MuscleGroupId): string[] {
  return GROUP_TO_CATEGORIES[group] ?? [];
}

export function matchesGroup(exercise: Exercise, group: MuscleGroupId | null): boolean {
  if (!group) return true;
  return categoriesForGroup(group).includes(exercise.category?.toLowerCase());
}
