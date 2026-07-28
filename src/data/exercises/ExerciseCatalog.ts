import type { Exercise } from '../../core/entities/Exercise';

export interface ExerciseFilters {
  category?: string;
  equipment?: string;
}

interface IndexedExercise {
  exercise: Exercise;
  haystack: string;
}

export interface FacetBucket {
  /** The raw dataset value, e.g. `"upper legs"`. Labels are resolved through i18n at render. */
  id: string;
  count: number;
}

export interface FacetCounts {
  category: FacetBucket[];
  equipment: FacetBucket[];
}

export class ExerciseCatalog {
  private readonly byId: Map<string, Exercise>;
  private readonly index: IndexedExercise[];
  private cachedFacetCounts: FacetCounts | null = null;

  constructor(exercises: Exercise[]) {
    this.byId = new Map(exercises.map(e => [e.id, e]));
    this.index = exercises.map(exercise => ({
      exercise,
      haystack: [exercise.name, exercise.target, exercise.muscleGroup, exercise.category, exercise.equipment]
        .join(' ')
        .toLowerCase(),
    }));
  }

  get size(): number {
    return this.byId.size;
  }

  search(query: string = '', filters: ExerciseFilters = {}): Exercise[] {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = this.index
      .filter(({ exercise, haystack }) => {
        if (filters.category && exercise.category !== filters.category) return false;
        if (filters.equipment && exercise.equipment !== filters.equipment) return false;
        return terms.every(t => haystack.includes(t));
      })
      .map(({ exercise }) => exercise);

    const q = terms.join(' ');
    const rank = (e: Exercise): number => {
      if (!q) return 0;
      const name = e.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.includes(q)) return 1;
      return 2;
    };
    return [...matches].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }

  getById(id: string): Exercise | undefined {
    return this.byId.get(id);
  }

  getMany(ids: string[]): Exercise[] {
    return ids.map(id => this.byId.get(id)).filter((e): e is Exercise => e !== undefined);
  }

  facets(): { categories: string[]; equipment: string[] } {
    const categories = new Set<string>();
    const equipment = new Set<string>();
    for (const { exercise } of this.index) {
      categories.add(exercise.category);
      equipment.add(exercise.equipment);
    }
    return { categories: [...categories].sort(), equipment: [...equipment].sort() };
  }

  /**
   * Facets carrying how many exercises sit behind each one.
   *
   * Lives on the catalog rather than in a view layer because this class owns the
   * index — counting outside it means re-walking all 1,324 entries on every render.
   * The unfiltered result is computed once and cached.
   *
   * Passing `filters` cross-filters: each dimension is counted with the *other*
   * dimension's filter applied but not its own, so selecting a category updates
   * the equipment counts while leaving the category counts intact to switch between.
   */
  facetCounts(filters: ExerciseFilters = {}): FacetCounts {
    const unfiltered = !filters.category && !filters.equipment;
    if (unfiltered && this.cachedFacetCounts) return this.cachedFacetCounts;

    const categories = new Map<string, number>();
    const equipment = new Map<string, number>();

    for (const { exercise } of this.index) {
      if (!filters.equipment || exercise.equipment === filters.equipment) {
        categories.set(exercise.category, (categories.get(exercise.category) ?? 0) + 1);
      }
      if (!filters.category || exercise.category === filters.category) {
        equipment.set(exercise.equipment, (equipment.get(exercise.equipment) ?? 0) + 1);
      }
    }

    // Most-populated first: the facets worth tapping lead the rail.
    const toBuckets = (counts: Map<string, number>): FacetBucket[] =>
      [...counts.entries()]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

    const result: FacetCounts = { category: toBuckets(categories), equipment: toBuckets(equipment) };
    if (unfiltered) this.cachedFacetCounts = result;
    return result;
  }
}

let catalogPromise: Promise<ExerciseCatalog> | null = null;

/** Lazily loads the vendored JSON (separate chunk) and memoizes the catalog. */
export function getExerciseCatalog(): Promise<ExerciseCatalog> {
  if (!catalogPromise) {
    catalogPromise = import('./exercises.json').then(
      mod => new ExerciseCatalog(mod.default as Exercise[]),
      err => {
        catalogPromise = null;
        throw err;
      },
    );
  }
  return catalogPromise;
}
