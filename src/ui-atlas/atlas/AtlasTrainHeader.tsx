import React from 'react';
import { ChevronDown, ListOrdered } from 'lucide-react';
import { useT } from '../../i18n';
import { useElapsedSeconds } from '../components/useTicker';
import type { SessionExerciseVM, SessionVM } from '../types';

/**
 * The session's fixed frame: get out, know how long you have been here, see
 * where you are, jump anywhere.
 *
 * The clock is the reason this is its own component. It ticks once a second, and
 * `useElapsedSeconds` re-renders whoever calls it — putting it in `AtlasTrain`
 * would re-render the disc, the dials and the set pills every second for a
 * number in the corner.
 *
 * The dots were `<i>` elements: they showed which exercise you were on and could
 * not take you there. They are buttons now, which together with the swipe makes
 * every exercise one gesture away.
 */
export const AtlasTrainHeader: React.FC<{
  session: SessionVM;
  exercises: SessionExerciseVM[];
  currentIdx: number;
  onGoTo: (index: number) => void;
  onMinimize: () => void;
  onOpenList: () => void;
}> = ({ session, exercises, currentIdx, onGoTo, onMinimize, onOpenList }) => {
  const { t, fmt } = useT();
  const elapsed = useElapsedSeconds(session.startedAt);

  return (
    <div className="at-train-head">
      <div className="at-train-top">
        <button className="at-round" onClick={onMinimize} aria-label={t('train.minimize')}>
          <ChevronDown size={18} />
        </button>

        <div className="at-train-clock">
          <b>{fmt.duration(elapsed)}</b>
          <small>{session.title}</small>
        </div>

        <button className="at-round" onClick={onOpenList} aria-label={t('train.editSession')}>
          <ListOrdered size={17} />
        </button>
      </div>

      {exercises.length > 0 && (
        <div className="at-dots">
          {exercises.map((exercise, i) => (
            <button
              key={exercise.key}
              data-on={exercise.sets.length > 0 && exercise.sets.every(s => s.done)}
              data-cur={i === currentIdx}
              onClick={() => onGoTo(i)}
              aria-label={t('train.goToExercise', { name: exercise.name })}
              aria-current={i === currentIdx ? 'true' : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};
