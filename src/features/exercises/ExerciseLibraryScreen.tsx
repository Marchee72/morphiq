import React, { useState, useEffect, useMemo } from 'react';
import { Search, Heart, Dumbbell, SlidersHorizontal, X } from 'lucide-react';
import type { Exercise } from '../../core/entities/Exercise';
import { AppBar } from '../../ui/primitives/AppBar';
import { Chip } from '../../ui/primitives/Chip';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';
import { getExerciseCatalog, ExerciseCatalog } from '../../data/exercises/ExerciseCatalog';
import { useStore } from '../../presentation/state/store';

const PAGE_SIZE = 24;

export const ExerciseLibraryScreen: React.FC<{ onLogSet?: (exercise: Exercise) => void }> = ({ onLogSet }) => {
  const { favoriteExerciseIds, toggleFavorite } = useStore();
  const [catalog, setCatalog] = useState<ExerciseCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedEquipment, setSelectedEquipment] = useState<string | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let active = true;
    getExerciseCatalog()
      .then(cat => { if (active) { setCatalog(cat); setLoading(false); } })
      .catch(err => { console.error('Failed to load exercise catalog:', err); if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const facets = useMemo(() => catalog ? catalog.facets() : { categories: [], equipment: [] }, [catalog]);

  const favorites = useMemo(() => {
    return catalog && favoriteExerciseIds.length > 0
      ? catalog.getMany(favoriteExerciseIds)
      : [];
  }, [catalog, favoriteExerciseIds]);

  const isFiltering = Boolean(query || selectedCategory || selectedEquipment);
  const activeFilterCount = (selectedCategory ? 1 : 0) + (selectedEquipment ? 1 : 0);

  const filteredExercises = useMemo(() => {
    if (!catalog) return [];
    return catalog.search(query, { category: selectedCategory, equipment: selectedEquipment });
  }, [catalog, query, selectedCategory, selectedEquipment]);

  const [prevFilterKey, setPrevFilterKey] = useState('');
  const filterKey = `${query}|${selectedCategory || ''}|${selectedEquipment || ''}`;

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  const visibleExercises = useMemo(() => filteredExercises.slice(0, visibleCount), [filteredExercises, visibleCount]);

  const handleToggleFav = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleFavorite(id);
  };

  const handleCardClick = (exercise: Exercise) => {
    setActiveExercise(exercise);
    setDetailOpen(true);
  };

  const clearAllFilters = () => {
    setSelectedCategory(undefined);
    setSelectedEquipment(undefined);
    setQuery('');
  };

  return (
    <>
      <AppBar
        title="Exercises"
        overline={catalog ? `${catalog.size.toLocaleString()} exercises` : 'Exercise Catalog'}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 140px' }}>
        {/* Search + Filter button row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--ui-surface-dim)',
            padding: '10px 14px',
            borderRadius: 'var(--ui-radius-pill)',
          }}>
            <Search size={18} style={{ color: 'var(--ui-text-secondary)' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search exercises..."
              aria-label="Search exercises"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ui-text-primary)',
                fontFamily: 'var(--ui-font)',
              }}
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--ui-text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter button with active count badge */}
          <button
            type="button"
            aria-label="Open filters"
            onClick={() => setFiltersOpen(true)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: activeFilterCount > 0 ? 'var(--ui-tonal)' : 'var(--ui-surface-dim)',
              color: activeFilterCount > 0 ? 'var(--ui-on-tonal)' : 'var(--ui-text-secondary)',
              border: 'none',
              borderRadius: 'var(--ui-radius-pill)',
              padding: '10px 14px',
              cursor: 'pointer',
              fontFamily: 'var(--ui-font)',
              fontSize: 13,
              fontWeight: 700,
              minHeight: 44,
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: 'var(--ui-primary)',
                color: 'var(--ui-on-primary)',
                fontSize: 10,
                fontWeight: 800,
                minWidth: 18,
                height: 18,
                borderRadius: 'var(--ui-radius-pill)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}>{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Active filter chips (inline, only when filtering) */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {selectedCategory && (
              <Chip selected onClick={() => setSelectedCategory(undefined)}>
                {selectedCategory} ✕
              </Chip>
            )}
            {selectedEquipment && (
              <Chip selected onClick={() => setSelectedEquipment(undefined)}>
                {selectedEquipment} ✕
              </Chip>
            )}
            <button type="button" onClick={clearAllFilters}
              style={{
                background: 'none', border: 'none', color: 'var(--ui-primary)',
                fontFamily: 'var(--ui-font)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 8px',
              }}>
              Clear all
            </button>
          </div>
        )}

        {/* Result count */}
        {!loading && (
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
            {filteredExercises.length} {filteredExercises.length === 1 ? 'result' : 'results'}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ui-text-secondary)' }}>
            <Dumbbell size={36} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600 }}>Loading exercises...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Favorites — only when not filtering */}
            {!isFiltering && favorites.length > 0 && (
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Heart size={15} style={{ color: 'var(--ui-error)' }} fill="var(--ui-error)" /> Favorites
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {favorites.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isFavorite={true}
                      onToggleFavorite={handleToggleFav}
                      onClick={() => handleCardClick(ex)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main list */}
            {filteredExercises.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ui-text-secondary)' }}>
                <Dumbbell size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ui-text-primary)' }}>No exercises found</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Try a different search or clear filters.</p>
              </div>
            ) : (
              <>
                {/* Section divider between favorites and all */}
                {!isFiltering && favorites.length > 0 && (
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)', marginTop: 4 }}>
                    All Exercises
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleExercises.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      isFavorite={favoriteExerciseIds.includes(ex.id)}
                      onToggleFavorite={handleToggleFav}
                      onClick={() => handleCardClick(ex)}
                    />
                  ))}
                </div>

                {/* Load more — subtle text button */}
                {visibleCount < filteredExercises.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                    style={{
                      alignSelf: 'center',
                      background: 'none',
                      border: 'none',
                      color: 'var(--ui-primary)',
                      fontFamily: 'var(--ui-font)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '12px 20px',
                    }}
                  >
                    Show more ({filteredExercises.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter bottom sheet */}
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Category */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 10 }}>
              Category
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip selected={selectedCategory === undefined} onClick={() => setSelectedCategory(undefined)}>All</Chip>
              {facets.categories.map(cat => (
                <Chip key={cat} selected={selectedCategory === cat} onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}>
                  {cat}
                </Chip>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 10 }}>
              Equipment
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip selected={selectedEquipment === undefined} onClick={() => setSelectedEquipment(undefined)}>All</Chip>
              {facets.equipment.map(eq => (
                <Chip key={eq} selected={selectedEquipment === eq} onClick={() => setSelectedEquipment(selectedEquipment === eq ? undefined : eq)}>
                  {eq}
                </Chip>
              ))}
            </div>
          </div>

          {/* Clear + Apply */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button variant="outlined" onClick={clearAllFilters} style={{ flex: 1 }}>Clear all</Button>
            <Button variant="filled" onClick={() => setFiltersOpen(false)} style={{ flex: 1 }}>Show {filteredExercises.length}</Button>
          </div>
        </div>
      </Sheet>

      {/* Exercise Detail Sheet */}
      <ExerciseDetailScreen
        exercise={activeExercise}
        isOpen={detailOpen}
        isFavorite={activeExercise ? favoriteExerciseIds.includes(activeExercise.id) : false}
        onClose={() => setDetailOpen(false)}
        onToggleFavorite={handleToggleFav}
        onLogSet={onLogSet}
      />
    </>
  );
};