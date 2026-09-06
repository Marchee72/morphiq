import React from 'react';
import { ArrowDown, Check, RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import type { PullState } from '../components/usePullToRefresh';

/**
 * What the pull looks like while it is happening.
 *
 * Rides `--at-pull`, the variable the gesture writes on the scroll container,
 * so nothing here re-renders as the finger moves — the four states below are
 * the only thing React sees, and each of them happens at most once per pull.
 *
 * It says which of the four it is in words as well as in the icon, because
 * "release to sync" and "syncing" look identical if the only difference is an
 * arrow that has rotated, and the whole point of the gesture is that you can
 * tell whether it took.
 */
export const AtlasPullRefresh: React.FC<{
  state: PullState;
  /** Held from the last completed sync, so the result outlives the spinner. */
  message?: string | null;
}> = ({ state, message }) => {
  const { t } = useT();

  if (state === 'idle' && !message) return null;

  const label = state === 'refreshing'
    ? t('sync.pullSyncing')
    : state === 'armed'
      ? t('sync.pullRelease')
      : state === 'pulling'
        ? t('sync.pullDown')
        : message;

  return (
    <div className="at-pull" data-state={state} aria-hidden={state === 'idle'}>
      <span className="at-pull-badge">
        {state === 'refreshing'
          ? <RefreshCw size={14} className="at-pull-spin" />
          : state === 'idle'
            ? <Check size={14} strokeWidth={3} />
            : <ArrowDown size={14} strokeWidth={2.5} />}
        {label}
      </span>
    </div>
  );
};
