import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, Check, CloudOff, RefreshCw, RotateCw, Trash2, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import { discardRefused, getSyncState, retryNow, subscribeSyncState } from '../../data/offline';

/** How long "All saved" stays up once a queue or a failure has cleared. */
const SAVED_MS = 2200;

/**
 * What the app tells you about getting your changes to the server — a
 * floating pill at the top of the frame.
 *
 * Outside `app-scroll`, so switching tabs does not make it flicker. Reads
 * `syncState` directly rather than through the store: the offline layer cannot
 * import `store.ts` (the store imports the repositories, which import the
 * layer), and going through the store would re-render every subscribed screen
 * on every tick of a draining queue.
 *
 * The states, loudest first:
 * - refused: retry, or discard — and discarding asks first, because it is the
 *   one button here that loses something;
 * - retrying / syncing: the same card with an indeterminate bar;
 * - waiting, or offline with nothing waiting;
 * - "All saved" with a lime check, briefly, once something that was waiting
 *   or refused has gone through — and then nothing.
 *
 * Silent when there is nothing to say. A permanent "you are online" strip would
 * be noise on every screen forever.
 */
export const AtlasSyncBanner: React.FC = () => {
  const { t, tp } = useT();
  const state = useSyncExternalStore(subscribeSyncState, getSyncState, getSyncState);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  // "All saved" is the answer to something having been outstanding, so it
  // fires on the edge from busy to clear — never on a cold start, and never
  // after a discard, which cleared the queue by throwing it away.
  const busy = state.failed + state.pending > 0;
  const [wasBusy, setWasBusy] = useState(busy);
  if (busy !== wasBusy) {
    setWasBusy(busy);
    setSaved(!busy && state.online && !discarded);
    if (!busy) setDiscarded(false);
    if (state.failed === 0) setConfirming(false);
  }
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  if (state.failed > 0 && !state.flushing) {
    if (confirming) {
      return (
        <div className="at-top-banner at-sync-banner" data-warn role="alertdialog" aria-label={t('sync.failedTitle')}>
          <div className="at-top-banner-main">
            <div className="at-top-banner-icon"><Trash2 size={18} /></div>
            <div className="at-top-banner-text">
              <b>{tp('sync.discardConfirm', state.failed)}</b>
            </div>
            <button className="at-btn at-btn-sm" data-ghost="true" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="at-btn at-btn-sm"
              data-danger="true"
              onClick={() => { setDiscarded(true); setConfirming(false); void discardRefused(); }}
            >
              {t('sync.discard')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="at-top-banner at-sync-banner" data-warn role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon"><AlertTriangle size={18} /></div>
          <div className="at-top-banner-text">
            <b>{t('sync.failedTitle')}</b>
            <small>{t('sync.failedBody', { n: state.failed })}</small>
          </div>
          {/* Retry puts them back in the queue — the thing to press once the
              server has been fixed. Discard is the way out when it never will. */}
          {state.online && (
            <button className="at-round-sm" onClick={() => void retryNow()}
              aria-label={t('sync.retry')} title={t('sync.retry')}>
              <RotateCw size={16} />
            </button>
          )}
          <button className="at-round-sm" onClick={() => setConfirming(true)}
            aria-label={t('sync.discard')} title={t('sync.discard')}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (state.pending > 0 || (state.failed > 0 && state.flushing)) {
    return (
      <div className="at-top-banner at-sync-banner" role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon">
            {state.flushing ? <RefreshCw size={18} className="at-spin" /> : <CloudOff size={18} />}
          </div>
          <div className="at-top-banner-text">
            <b>{state.flushing ? t('sync.syncing') : tp('sync.pending', state.pending)}</b>
            <small>{t('sync.offlineSub')}</small>
          </div>
          {/* Only when nothing is in flight — a retry mid-drain would do
              nothing, and a button that does nothing is worse than no button. */}
          {!state.flushing && state.online && (
            <button className="at-btn at-btn-sm" onClick={() => void retryNow()}>{t('sync.retry')}</button>
          )}
        </div>
        {state.flushing && <div className="at-top-banner-bar" aria-hidden="true"><i /></div>}
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

  if (saved) {
    return (
      <div className="at-top-banner at-sync-banner" data-saved role="status">
        <div className="at-top-banner-main">
          <div className="at-top-banner-icon"><Check size={18} strokeWidth={3} /></div>
          <div className="at-top-banner-text">
            <b>{t('sync.saved')}</b>
            <small>{t('sync.savedSub')}</small>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
