/**
 * What the sync banner needs to know, in a store of its own.
 *
 * Deliberately not part of the Zustand store, and not for tidiness. `store.ts`
 * imports the repositories, the repositories import this layer — putting sync
 * state in there would close the cycle. It also means a pending count ticking
 * down during a flush cannot re-render every screen subscribed to `useStore`.
 *
 * The `useSyncExternalStore` contract, so a component subscribes to exactly
 * this and nothing else. `getSnapshot` must return a stable reference between
 * changes or React re-renders forever, which is why the object is rebuilt only
 * inside `set`.
 */

export interface SyncState {
  /** Whether the API looks reachable. */
  online: boolean;
  /** Writes waiting to be sent. */
  pending: number;
  /** A drain is in progress. */
  flushing: boolean;
  /** Writes the server refused in a way that will not change. */
  failed: number;
}

let state: SyncState = { online: true, pending: 0, flushing: false, failed: 0 };

const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setSyncState(patch: Partial<SyncState>): void {
  const next = { ...state, ...patch };
  // Reference equality is the subscription contract: an unchanged snapshot that
  // is a new object would re-render on every tick of the flusher.
  if (next.online === state.online
    && next.pending === state.pending
    && next.flushing === state.flushing
    && next.failed === state.failed) return;

  state = next;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A component that throws while being told must not stop the others, and
      // must not take the flusher's own bookkeeping down with it.
    }
  }
}

/** Test seam. */
export function resetSyncState(): void {
  state = { online: true, pending: 0, flushing: false, failed: 0 };
  listeners.clear();
}
