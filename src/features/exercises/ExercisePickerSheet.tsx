import React, { useState, useEffect, useMemo } from 'react';
import { Search, Heart, Info } from 'lucide-react';
import type { Exercise } from '../../core/entities/Exercise';
import { Sheet } from '../../ui/primitives/Sheet';
import { Chip } from '../../ui/primitives/Chip';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';
import { getExerciseCatalog, ExerciseCatalog } from '../../data/exercises/ExerciseCatalog';
import { useStore } from '../../presentation/state/store';
import { getCdnUrl } from '../../data/exercises/mediaCache';

export interface ExercisePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

export const ExercisePickerSheet: React.FC<ExercisePickerSheetProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { favoriteExerciseIds, toggleFavorite, activeProfile } = useStore();
  const [catalog, setCatalog] = useState<ExerciseCatalog | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [filterGymEquipment, setFilterGymEquipment] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    let active = true;
    getExerciseCatalog().then(cat => {
      if (active) setCatalog(cat);
    });
    return () => {
      active = false;
    };
  }, []);

  const facets = useMemo(() => {
    return catalog ? catalog.facets() : { categories: [], equipment: [] };
  }, [catalog]);

  const favoritesList = useMemo(() => {
    return catalog && favoriteExerciseIds.length > 0
      ? catalog.getMany(favoriteExerciseIds)
      : [];
  }, [catalog, favoriteExerciseIds]);

  const userEquipment = activeProfile?.availableEquipment || [];

  const searchResults = useMemo(() => {
    if (!catalog) return [];
    let results = catalog.search(query, { category: selectedCategory });
    if (filterGymEquipment && userEquipment.length > 0) {
      results = results.filter(ex => {
        if (!ex.equipment) return true;
        const normEq = ex.equipment.toLowerCase();
        return userEquipment.some(eq => normEq.includes(eq.toLowerCase()));
      });
    }
    return results;
  }, [catalog, query, selectedCategory, filterGymEquipment, userEquipment]);

  const handleInfoClick = (e: React.MouseEvent, exercise: Exercise) => {
    e.stopPropagation();
    setPreviewExercise(exercise);
  };

  return (
    <>
      <Sheet open={isOpen} onClose={onClose} title="Select Exercise">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--ui-tonal)',
              padding: '10px 14px',
              borderRadius: 16,
            }}
          >
            <Search size={18} style={{ color: 'var(--ui-text-secondary)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 1,300+ exercises..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ui-text-primary)',
              }}
            />
          </div>

          {/* Category Filters */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 4,
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              scrollSnapType: 'x mandatory',
            }}
          >
            {userEquipment.length > 0 && (
              <Chip
                selected={filterGymEquipment}
                onClick={() => setFilterGymEquipment(!filterGymEquipment)}
                style={{
                  background: filterGymEquipment ? 'var(--ui-primary)' : 'var(--ui-surface-dim)',
                  color: filterGymEquipment ? '#FFFFFF' : 'var(--ui-text-primary)',
                }}
              >
                🏋️ Mi Equipamiento
              </Chip>
            )}
            <Chip
              selected={selectedCategory === undefined && !filterGymEquipment}
              onClick={() => {
                setSelectedCategory(undefined);
                setFilterGymEquipment(false);
              }}
            >
              Todos
            </Chip>
            {facets.categories.map(cat => (
              <Chip
                key={cat}
                selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
              >
                {cat}
              </Chip>
            ))}
          </div>

          {/* Favorites section (if no active query) */}
          {!query && favoritesList.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ui-text-secondary)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Heart size={14} style={{ color: 'var(--ui-error)' }} fill="var(--ui-error)" /> Favorites
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favoritesList.map(exercise => (
                  <div
                    key={exercise.id}
                    onClick={() => {
                      onSelect(exercise);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 14,
                      background: 'var(--ui-surface)',
                      border: '1px solid var(--ui-outline)',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={getCdnUrl(exercise.image)}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{exercise.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>{exercise.target} · {exercise.equipment}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Preview exercise details"
                      onClick={(e) => handleInfoClick(e, exercise)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ui-primary)',
                        padding: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Info size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results / Exercise List */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ui-text-secondary)',
                margin: '12px 0 8px 0',
              }}
            >
              Catalog ({searchResults.length})
            </div>

            {searchResults.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)', textAlign: 'center', margin: '20px 0' }}>
                No exercises match your search.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {searchResults.slice(0, 50).map(exercise => (
                  <div
                    key={exercise.id}
                    onClick={() => {
                      onSelect(exercise);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 14,
                      background: 'var(--ui-surface)',
                      border: '1px solid var(--ui-outline)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'var(--ui-tonal)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={getCdnUrl(exercise.image)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{exercise.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ui-text-secondary)' }}>{exercise.target} · {exercise.equipment}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Preview exercise details"
                      onClick={(e) => handleInfoClick(e, exercise)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ui-primary)',
                        padding: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Info size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Sheet>

      {/* Exercise Detail Preview Sheet */}
      <ExerciseDetailScreen
        exercise={previewExercise}
        isOpen={Boolean(previewExercise)}
        isFavorite={previewExercise ? favoriteExerciseIds.includes(previewExercise.id) : false}
        onClose={() => setPreviewExercise(null)}
        onToggleFavorite={(id: string) => toggleFavorite(id)}
        onLogSet={(exercise) => {
          onSelect(exercise);
          setPreviewExercise(null);
          onClose();
        }}
      />
    </>
  );
};
