import React from 'react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import { useAppActions } from '../data/useAppData';
import { useElapsedSeconds } from '../components/useTicker';

/**
 * Partners who are training right now.
 *
 * Renders nothing when nobody is, which is most of the time — a permanent empty
 * state on the app's primary screen would be a worse trade than the feature is
 * worth. That also means it can be dropped anywhere on Today without designing
 * around it.
 *
 * Shows the exercise and the position in it, never a weight. That is enforced
 * at the database and again at the serialiser; this is only the last place it
 * would be visible if it were not.
 */
export const AtlasBuddyStrip: React.FC = () => {
  const { training } = useSocial();
  if (training.length === 0) return null;

  return (
    <div className="at-pad at-buddy-strip">
      {training.map(row => <StripRow key={row.profileId} row={row} />)}
    </div>
  );
};

const StripRow: React.FC<{ row: ReturnType<typeof useSocial>['training'][number] }> = ({ row }) => {
  const { t, fmt } = useT();
  const actions = useAppActions();
  // The one ticking value in the feature, and it stays at the render edge —
  // nothing that counts belongs in a view model. It already floors at zero, so
  // a partner's clock running fast shows 0:00 rather than a countdown.
  const elapsed = useElapsedSeconds(row.startedAt);

  const progress = row.exerciseName && row.setNumber && row.setCount
    ? t('buddy.progress', {
        exercise: row.exerciseName,
        n: String(row.setNumber),
        total: String(row.setCount),
      })
    : t('buddy.warmingUp');

  return (
    <button
      className="at-card at-buddy-live"
      onClick={() => actions.openOverlay('buddies', { buddyLinkId: row.linkId })}
    >
      <span className="at-buddy-dot" aria-hidden="true" />
      <span className="at-buddy-livetext">
        <b>{t('buddy.training', { name: row.name || '—' })}</b>
        <small>{progress} · {fmt.duration(elapsed)}</small>
      </span>
    </button>
  );
};
