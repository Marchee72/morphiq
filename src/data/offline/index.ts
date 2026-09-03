/**
 * The offline layer's front door.
 *
 * `store.ts` imports exactly one thing from here. Everything else in this
 * directory is an implementation detail of "the app keeps working without a
 * network", and keeping the surface at one function is what stops the layer
 * leaking into the ~90 repository call sites it exists to leave alone.
 */

export { decorateRepositories, type RepositoryBundle } from './offlineRepositories';
export { resetOfflineDb } from './offlineDb';
export { canEnterOffline, clearMarker } from './snapshotMarker';
export { isOnline, startConnectivity } from './connectivity';
export { OfflineUnavailableError, discardFailed } from './outbox';
export {
  onDrained, onIdResolved, resumeAfterAuth, retryNow, startFlusher, flush,
} from './flusher';
export { getSyncState, subscribeSyncState, type SyncState } from './syncState';
