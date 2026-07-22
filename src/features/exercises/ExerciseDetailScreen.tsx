import React, { useState, useEffect } from 'react';
import { Heart, Dumbbell, Play } from 'lucide-react';
import type { Exercise } from '../../core/entities/Exercise';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';
import { fetchCachedMedia, getCdnUrl } from '../../data/exercises/mediaCache';

export interface ExerciseDetailScreenProps {
  exercise: Exercise | null;
  isOpen: boolean;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onLogSet?: (exercise: Exercise) => void;
}

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({
  exercise,
  isOpen,
  isFavorite,
  onClose,
  onToggleFavorite,
  onLogSet,
}) => {
  const [prevExerciseId, setPrevExerciseId] = useState<string | undefined>(undefined);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(false);
  const [gifSrc, setGifSrc] = useState<string>('');
  const [gifLoading, setGifLoading] = useState<boolean>(true);
  const [gifError, setGifError] = useState<boolean>(false);

  if (exercise?.id !== prevExerciseId || isOpen !== prevIsOpen) {
    setPrevExerciseId(exercise?.id);
    setPrevIsOpen(isOpen);
    if (exercise && isOpen) {
      setGifLoading(true);
      setGifError(false);
    }
  }

  useEffect(() => {
    if (!exercise || !isOpen) return;

    let active = true;

    const loadMedia = async () => {
      try {
        const url = await fetchCachedMedia(exercise.gifUrl || exercise.image);
        if (active) {
          setGifSrc(url);
          setGifLoading(false);
        }
      } catch {
        if (active) {
          setGifSrc(getCdnUrl(exercise.gifUrl || exercise.image));
          setGifLoading(false);
        }
      }
    };

    loadMedia();
    return () => {
      active = false;
    };
  }, [exercise, isOpen]);

  if (!exercise) return null;

  return (
    <Sheet open={isOpen} onClose={onClose} title={exercise.name}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
        {/* GIF Demo Container */}
        <div
          style={{
            width: '100%',
            height: 200,
            borderRadius: 22,
            background: 'var(--ui-tonal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {gifLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--ui-text-secondary)' }}>
              <Dumbbell size={32} className="animate-pulse" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Loading demo animation...</span>
            </div>
          ) : gifError || !gifSrc ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--ui-text-secondary)' }}>
              <Dumbbell size={36} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Animation unavailable</span>
            </div>
          ) : (
            <img
              src={gifSrc}
              alt={`${exercise.name} demonstration`}
              onError={() => setGifError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}

          {/* Favorite button floating on media */}
          <button
            type="button"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => onToggleFavorite(exercise.id)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--ui-surface)',
              border: '1px solid var(--ui-outline)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isFavorite ? 'var(--ui-error)' : 'var(--ui-text-secondary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <Heart size={20} fill={isFavorite ? 'var(--ui-error)' : 'none'} />
          </button>
        </div>

        {/* Target & Equipment Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip selected>{exercise.category}</Chip>
          <Chip>{exercise.target}</Chip>
          <Chip>{exercise.equipment}</Chip>
          {exercise.secondaryMuscles.map(m => (
            <Chip key={m} size="sm">{m}</Chip>
          ))}
        </div>

        {/* Step-by-Step Instructions */}
        <div>
          <h4
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ui-text-secondary)',
              margin: '0 0 10px 0',
            }}
          >
            Instructions
          </h4>
          {exercise.instructionSteps.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--ui-text-secondary)' }}>No detailed instructions recorded.</p>
          ) : (
            <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exercise.instructionSteps.map((step, idx) => (
                <li key={idx} style={{ fontSize: 14, lineHeight: '1.4', color: 'var(--ui-text-primary)' }}>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Log Set Shortcut */}
        {onLogSet && (
          <Button
            variant="filled"
            onClick={() => {
              onLogSet(exercise);
              onClose();
            }}
            style={{ width: '100%', marginTop: 8 }}
          >
            <Play size={18} style={{ marginRight: 6 }} /> Log set for this exercise
          </Button>
        )}

        {/* Gym Visual Attribution */}
        <div
          style={{
            fontSize: 11,
            textAlign: 'center',
            color: 'var(--ui-text-secondary)',
            marginTop: 8,
          }}
        >
          {exercise.attribution || '© Gym visual — gymvisual.com'}
        </div>
      </div>
    </Sheet>
  );
};
