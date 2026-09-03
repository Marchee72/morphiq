import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import { getSyncState, retryNow, subscribeSyncState } from '../../data/offline';

/**
 * What the app tells you when it cannot reach the server.
 *
 * At the top of the frame rather than on a screen, because the fact is about
 * the app rather than about anything you are looking at — and outside
 * `app-scroll`, so switching tabs does not make it flicker.
 *
 * Reads `syncState` directly rather than through the store. The offline layer
 * cannot import `store.ts` (the store imports the repositories, which import
 * the layer), and going through the store would re-render every subscribed
 * screen on every tick of a draining queue.
 *
 * Silent when there is nothing to say, matching `AtlasTopInstallBanner`. A
 * permanent "you are online" strip would be noise on every screen forever.
 */
export const AtlasSyncBanner: React.FC = () => {
  const { t, tp } = useT();
  const state = useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);

  // Loudest first: something lost outranks something merely waiting, which
  // outranks being offline with nothing queued.
  if (state.failed > 0) {
    return (
      <div className="at-top-banner at-sync-banner" data-warn role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon"><AlertTriangle size={18} /></div>
          <div className="at-top-banner-text">
            <b>{t('sync.failedTitle')}</b>
            <small>{t('sync.failedBody', { n: state.failed })}</small>
          </div>
        </div>
      </div>
    );
  }

  if (state.pending > 0) {
    return (
      <div className="at-top-banner at-sync-banner" role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon">
            {state.flushing
              ? <RefreshCw size={18} className="at-spin" />
              : <CloudOff size={18} />}
          </div>
          <div className="at-top-banner-text">
            <b>{state.flushing ? t('sync.syncing') : tp('sync.pending', state.pending)}</b>
            <small>{t('sync.offlineSub')}</small>
          </div>
          {/* Only when nothing is in flight — a retry mid-drain would do
              nothing, and a button that does nothing is worse than no button. */}
          {!state.flushing && state.online && (
            <button className="at-btn at-btn-sm" onClick={retryNow}>{t('sync.retry')}</button>
          )}
        </div>
      </div>
    );
  }

  if (!state.online) {
    return (
      <div className="at-top-banner at-sync-banner" role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon"><WifiOff size={18} /></div>
          <div className="at-top-banner-text">
            <b>{t('sync.offline')}</b>
            <small>{t('sync.offlineSub')}</small>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
