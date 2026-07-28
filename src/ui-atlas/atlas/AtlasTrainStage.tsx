import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useT } from '../../i18n';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { useSwipeNav } from '../components/useSwipeNav';
import type { SessionExerciseVM } from '../types';

/**
 * The exercise you are on, and the gesture that changes it.
 *
 * Swiping is bound here rather than to the screen on purpose. Everything below
 * this — the weight and reps wheels especially — scrolls, and a screen-wide
 * handler competes with all of it. Confining the gesture to the disc also makes
 * it discoverable: the thing that moves is the thing you drag.
 *
 * Past the last exercise sits an add slot rather than a hard stop. Reaching the
 * end of the session and being told "no" is the moment you most want to add
 * something.
 */
export const AtlasTrainStage: React.FC<{
  exercise: SessionExerciseVM | undefined;
  /** Which exercise this is. Changing it plays the slide-in. */
  index: number;
  /** True when the cursor has run past the last exercise onto the add slot. */
  onAddSlot: boolean;
  complete: boolean;
  /** Rendered under the disc, inside the sliding block. */
  caption: React.ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  onOpenDetail: () => void;
  onAddExercise: () => void;
}> = ({ exercise, index, onAddSlot, complete, caption, onNext, onPrevious, onOpenDetail, onAddExercise }) => {
  const { t } = useT();
  const swipe = useSwipeNav(onNext, onPrevious);

  /**
   * Which way the exercise changed, so the incoming disc enters from the side you
   * came from. Tracked during render against the previous index rather than in an
   * effect, which would play the animation a frame late.
   */
  const [seen, setSeen] = useState(index);
  const [enterFrom, setEnterFrom] = useState<'left' | 'right' | null>(null);
  if (seen !== index) {
    setEnterFrom(index > seen ? 'right' : 'left');
    setSeen(index);
  }

  return (
    <div
      className="at-stage"
      {...swipe.bind}
      // The browser must not claim the horizontal axis for its own back-gesture
      // or overscroll before the handler above sees the move.
      style={{ touchAction: 'pan-y' }}
    >
      {/* Disc and caption travel together — sliding the photo while the name it
          belongs to snaps reads as two separate things happening. Keyed on the
          index so React remounts the block and the entry animation restarts on
          every change rather than only the first. */}
      <div
        className="at-stage-slide"
        key={index}
        data-enter={enterFrom ?? undefined}
        style={{
          transform: swipe.dragging ? `translateX(${swipe.dx * 0.4}px)` : undefined,
          transition: swipe.dragging ? 'none' : undefined,
        }}
      >
      <div className="at-disc-wrap">
        {onAddSlot ? (
          <button className="at-exercise-disc at-disc-add" onClick={onAddExercise}>
            <Plus size={34} />
          </button>
        ) : (
          <button
            className="at-exercise-disc"
            data-complete={complete}
            onClick={onOpenDetail}
            aria-label={t('detail.instructions')}
          >
            <ExerciseThumb
              name={exercise?.name ?? ''}
              image={exercise?.image}
              gif={exercise?.gif}
            />
          </button>
        )}
      </div>

        {caption}
      </div>
    </div>
  );
};
