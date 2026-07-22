import React, { useState } from 'react';
import { Heart, Dumbbell } from 'lucide-react';
import type { Exercise } from '../../core/entities/Exercise';
import { Card } from '../../ui/primitives/Card';
import { Chip } from '../../ui/primitives/Chip';
import { getCdnUrl } from '../../data/exercises/mediaCache';

export interface ExerciseCardProps {
  exercise: Exercise;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  isFavorite,
  onToggleFavorite,
  onClick,
}) => {
  const [prevImage, setPrevImage] = useState(exercise.image);
  const [imgSrc, setImgSrc] = useState<string>(() => getCdnUrl(exercise.image));
  const [imgError, setImgError] = useState(false);

  if (exercise.image !== prevImage) {
    setPrevImage(exercise.image);
    setImgSrc(getCdnUrl(exercise.image));
    setImgError(false);
  }

  return (
    <Card onClick={onClick}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: 'var(--ui-tonal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {imgError || !imgSrc ? (
            <Dumbbell size={28} style={{ color: 'var(--ui-text-secondary)' }} />
          ) : (
            <img
              src={imgSrc}
              alt={exercise.name}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--ui-text-primary)',
              margin: '0 0 6px 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textTransform: 'capitalize',
            }}
          >
            {exercise.name}
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip size="sm">{exercise.target}</Chip>
            <Chip size="sm">{exercise.equipment}</Chip>
          </div>
        </div>

        {/* Favorite heart button */}
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
          onClick={(e) => onToggleFavorite(exercise.id, e)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
            color: isFavorite ? 'var(--ui-error)' : 'var(--ui-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'transform 0.15s ease',
          }}
        >
          <Heart size={20} fill={isFavorite ? 'var(--ui-error)' : 'none'} />
        </button>
      </div>
    </Card>
  );
};
