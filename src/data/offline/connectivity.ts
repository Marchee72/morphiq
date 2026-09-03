/**
 * Whether the API is worth trying right now.
 *
 * `navigator.onLine` alone is not enough and never was: it reports whether the
 * device has *a* network, not whether anything is at the other end of it. Gym
 * wifi that needs a captive-portal login is "online" by that measure, and so is
 * a phone attached to a router with no uplink. So this combines the browser's
 * answer with the only evidence that actually settles it — whether the last
 * request got through.
 *
 * Deliberately not a Capacitor plugin. `@capacitor/network` would give a better
 * signal on Android, but it is a dependency, a permission and a second code
 * path for something the observed-failure half already handles; the browser
 * event is the coarse trigger and the request outcome is the truth.
 */

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

/**
 * What the last request told us, if anything has been tried since the browser
 * last changed its mind.
 *
 * Cleared on a browser transition so a stale failure cannot outlive the
 * connection drop that caused it.
 */
let observed: boolean | null = null;

export function isOnline(): boolean {
  // A browser that says it is offline is believed without argument: there is no
  // network at all, so nothing is worth attempting.
  const browserSays = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!browserSays) return false;
  return observed ?? true;
}

/** The last request got through. */
export function reportReachable(): void {
  setObserved(true);
}

/**
 * The last request did not get through.
 *
 * Only ever called for a `'retryable'` failure — a 400 says the payload was
 * wrong, not that the network is down, and treating it as a connectivity
 * signal would put the whole app in offline mode over one bad field.
 */
export function reportUnreachable(): void {
  setObserved(false);
}

function setObserved(next: boolean): void {
  if (observed === next) return;
  const was = isOnline();
  observed = next;
  if (isOnline() !== was) emit();
}

function emit(): void {
  const online = isOnline();
  for (const listener of listeners) {
    try {
      listener(online);
    } catch {
      // One bad subscriber must not stop the others being told, least of all
      // the flusher — it is what drains the queue when the network returns.
    }
  }
}

/** Called when the answer changes. Returns the unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

let started = false;

/**
 * Starts listening to the browser.
 *
 * Idempotent, because both the flusher and the sync banner want connectivity
 * and neither should have to know whether the other got there first.
 */
export function startConnectivity(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('online', () => {
    // The browser has a network again. Whatever the last request concluded was
    // about the old one, so it stops counting — otherwise a single failure
    // before the drop would keep the app in offline mode indefinitely.
    observed = null;
    emit();
  });

  window.addEventListener('offline', () => {
    observed = null;
    emit();
  });
}

/** Test seam: forget everything observed and every subscriber. */
export function resetConnectivity(): void {
  observed = null;
  listeners.clear();
  started = false;
}
