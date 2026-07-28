import { describe, it, expect } from 'vitest';
import { ExerciseCatalog } from './ExerciseCatalog';
import type { Exercise } from '../../core/entities/Exercise';

const fixture: Exercise[] = [
  { id: '0025', name: 'barbell bench press', category: 'chest', equipment: 'barbell', target: 'pectorals', muscleGroup: 'triceps', secondaryMuscles: ['triceps', 'shoulders'], instructionSteps: ['Lie down.', 'Press.'], image: 'images/0025-x.jpg', gifUrl: 'videos/0025-x.gif', attribution: '© Gym visual' },
  { id: '0043', name: 'barbell full squat', category: 'upper legs', equipment: 'barbell', target: 'glutes', muscleGroup: 'quadriceps', secondaryMuscles: ['hamstrings'], instructionSteps: ['Brace.', 'Squat.'], image: 'images/0043-x.jpg', gifUrl: 'videos/0043-x.gif', attribution: '© Gym visual' },
  { id: '0652', name: 'pull-up', category: 'back', equipment: 'body weight', target: 'lats', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], instructionSteps: ['Hang.', 'Pull.'], image: 'images/0652-x.jpg', gifUrl: 'videos/0652-x.gif', attribution: '© Gym visual' },
  { id: '0334', name: 'dumbbell lateral raise', category: 'shoulders', equipment: 'dumbbell', target: 'delts', muscleGroup: 'traps', secondaryMuscles: [], instructionSteps: ['Raise.'], image: 'images/0334-x.jpg', gifUrl: 'videos/0334-x.gif', attribution: '© Gym visual' },
  { id: '9001', name: 'incline barbell press', category: 'chest', equipment: 'barbell', target: 'pectorals', muscleGroup: 'triceps', secondaryMuscles: [], instructionSteps: ['Press.'], image: 'images/9001-x.jpg', gifUrl: 'videos/9001-x.gif', attribution: '© Gym visual' },
  { id: '9002', name: 'incline press', category: 'chest', equipment: 'barbell', target: 'pectorals', muscleGroup: 'triceps', secondaryMuscles: [], instructionSteps: ['Press.'], image: 'images/9002-x.jpg', gifUrl: 'videos/9002-x.gif', attribution: '© Gym visual' },
];

describe('ExerciseCatalog', () => {
  const catalog = new ExerciseCatalog(fixture);

  it('reports the catalog size', () => {
    expect(catalog.size).toBe(6);
  });

  it('finds exercises by case-insensitive name substring', () => {
    expect(catalog.search('BENCH').map(e => e.id)).toEqual(['0025']);
  });

  it('requires every query term to match somewhere in name/target/muscles/category/equipment', () => {
    expect(catalog.search('barbell glutes').map(e => e.id)).toEqual(['0043']);
    expect(catalog.search('barbell lats')).toEqual([]);
  });

  it('ranks name-prefix matches before other name matches before field matches', () => {
    const results = catalog.search('barbell');
    expect(results.map(e => e.id)).toEqual(['0025', '0043', '9001', '9002']);
  });

  it('filters by category and equipment', () => {
    expect(catalog.search('', { category: 'back' }).map(e => e.id)).toEqual(['0652']);
    expect(catalog.search('', { equipment: 'barbell' })).toHaveLength(4);
    expect(catalog.search('barbell', { category: 'chest' }).map(e => e.id)).toEqual(['0025', '9001', '9002']);
  });

  it('returns all exercises for an empty query without filters, alphabetically', () => {
    expect(catalog.search().map(e => e.name)).toEqual([...fixture.map(e => e.name)].sort((a, b) => a.localeCompare(b)));
  });

  it('getById returns the exercise or undefined', () => {
    expect(catalog.getById('0652')?.name).toBe('pull-up');
    expect(catalog.getById('9999')).toBeUndefined();
  });

  it('getMany hydrates ids in order, skipping unknown ids', () => {
    expect(catalog.getMany(['0652', '9999', '0025']).map(e => e.id)).toEqual(['0652', '0025']);
  });

  it('facets returns sorted unique categories and equipment', () => {
    expect(catalog.facets()).toEqual({
      categories: ['back', 'chest', 'shoulders', 'upper legs'],
      equipment: ['barbell', 'body weight', 'dumbbell'],
    });
  });

  it('facetCounts reports how many exercises sit behind each facet, busiest first', () => {
    expect(catalog.facetCounts().category).toEqual([
      { id: 'chest', count: 3 },
      { id: 'back', count: 1 },
      { id: 'shoulders', count: 1 },
      { id: 'upper legs', count: 1 },
    ]);
    expect(catalog.facetCounts().equipment[0]).toEqual({ id: 'barbell', count: 4 });
  });

  it('facetCounts cross-filters each dimension by the other, not by itself', () => {
    // Selecting a category narrows the equipment counts, but the category counts
    // stay whole so the user can still see what switching would give them.
    const counts = catalog.facetCounts({ category: 'chest' });
    expect(counts.equipment).toEqual([{ id: 'barbell', count: 3 }]);
    expect(counts.category).toEqual(catalog.facetCounts().category);
  });

  it('facetCounts caches the unfiltered result', () => {
    expect(catalog.facetCounts()).toBe(catalog.facetCounts());
  });

  it('facetCounts totals match the catalog size', () => {
    const sum = (b: { count: number }[]) => b.reduce((t, x) => t + x.count, 0);
    expect(sum(catalog.facetCounts().category)).toBe(catalog.size);
    expect(sum(catalog.facetCounts().equipment)).toBe(catalog.size);
  });

  it('getExerciseCatalog memoizes a single instance backed by the vendored dataset', async () => {
    const { getExerciseCatalog } = await import('./ExerciseCatalog');
    const [a, b] = await Promise.all([getExerciseCatalog(), getExerciseCatalog()]);
    expect(a).toBe(b);
    expect(a.size).toBe(1324);
    expect(a.getById('0025')?.name).toBe('barbell bench press');
  });
});
