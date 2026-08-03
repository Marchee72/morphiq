/**
 * MorphIQ's service worker — what makes the web build installable and usable
 * on gym wifi.
 *
 * Hand-written rather than generated. The app has exactly three kinds of
 * request and each wants a different rule, which is about twenty lines of
 * policy; a plugin would bring a build step and a config file to express the
 * same thing less clearly.
 *
 * The rule that matters most is the one about `/api/`: those responses carry
 * one account's training history, and a cache is shared by everyone who uses
 * the browser. They are never stored, at all.
 */

/** Bump to retire the shell cache. Hashed assets are keyed by name and survive. */
const VERSION = 'v1';
const SHELL = `morphiq-shell-${VERSION}`;
/**
 * Immutable build output. Deliberately *not* versioned: filenames carry a
 * content hash, so two deploys can never collide, and keeping the old entries
 * means a tab left open across a deploy can still fetch the lazy chunk it was
 * built against.
 */
const ASSETS = 'morphiq-assets';

/** Kept from growing without bound as deploys accumulate. */
const ASSET_LIMIT = 80;

/** The least that has to be there for the app to open offline. */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // Individually, so one 404 does not abandon the whole install.
      .then(cache => Promise.all(SHELL_URLS.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('morphiq-shell-') && key !== SHELL)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Build output and bundled fonts: content-addressed, so safe to keep forever. */
function isImmutable(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/');
}

async function trimAssets() {
  const cache = await caches.open(ASSETS);
  const keys = await cache.keys();
  // `keys()` is insertion-ordered, so the front of the list is the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ASSET_LIMIT)).map(key => cache.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    await cache.put(request, response.clone());
    void trimAssets();
  }
  return response;
}

/**
 * Fresh when possible, last-known when not.
 *
 * Navigations go to the network first so a deploy is picked up on the next
 * launch rather than whenever the cache happens to expire. Offline, the cached
 * shell is served and the app boots against IndexedDB.
 */
async function networkFirstDocument(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match('/index.html') ?? await caches.match('/');
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Other origins — Google's sign-in script, avatar images — are left alone.
  // They have their own caching rules and none of them are ours to keep.
  if (url.origin !== self.location.origin) return;

  /**
   * Never cache the API.
   *
   * These responses are one account's profiles, sessions and measurements. The
   * HTTP cache is per-browser, not per-account: storing them would let the next
   * person to sign in on this device be served the previous one's data from
   * disk. Answering stale training data would be wrong even for a single user.
   */
  if (url.pathname.startsWith('/api/')) return;

  // The installable APKs live in the same folder and are tens of megabytes.
  if (url.pathname.endsWith('.apk')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * A partner started training, or sent a message — the server's `web-push`
 * payload is `{ title, body, data }`, `data` carrying just enough to route the
 * tap (see `notificationclick`). Never a weight or a rep: the payload is
 * exactly what the server already shows in-app, nothing added for the banner.
 */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* malformed payload, show nothing extra */ }

  const title = payload.title || 'MorphIQ';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.type, // a second "started training" replaces the first rather than stacking
    data: payload.data || {},
  }));
});

/** Opens the app on the Buddies tab — on the sender's thread, for a message. */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const target = data.type === 'message' && data.linkId
    ? `/?buddyLinkId=${encodeURIComponent(data.linkId)}`
    : '/?buddies=1';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clientsArr => {
      const existing = clientsArr.find(c => 'focus' in c);
      if (existing) {
        if ('navigate' in existing) await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
