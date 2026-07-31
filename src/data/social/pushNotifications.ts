import { Capacitor } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from '../database/apiClient';

/**
 * Push registration and delivery, for the two events a partner can raise
 * while this device is not looking: they started training, or they sent a
 * message. Everything here is best-effort — a registration failing (denied
 * permission, an unconfigured server) leaves the rest of the app untouched,
 * the same way a partner's presence not loading does.
 */

/** Where a device's own registration is kept, so disabling knows what to unregister. */
const TOKEN_KEY = 'morphiq.pushToken';

interface StoredToken {
  profileId: string;
  platform: 'android' | 'web';
  token: string;
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch { return null; }
}

function writeStoredToken(value: StoredToken | null) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, JSON.stringify(value));
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private browsing, or storage full — registration still worked server-side */ }
}

/** Whether this device has a channel push could use at all. */
export function isPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Whether *this* profile, on *this* device, has already opted in. */
export function isPushEnabledFor(profileId: string): boolean {
  return readStoredToken()?.profileId === profileId;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registerAndroid(profileId: string): Promise<void> {
  const granted = await PushNotifications.requestPermissions();
  if (granted.receive !== 'granted') throw new Error('Notifications permission was not granted');

  const token = await new Promise<string>((resolve, reject) => {
    let settled = false;
    void PushNotifications.addListener('registration', result => {
      if (settled) return;
      settled = true;
      resolve(result.value);
    });
    void PushNotifications.addListener('registrationError', err => {
      if (settled) return;
      settled = true;
      reject(new Error(err.error));
    });
    void PushNotifications.register();
  });

  await api('/api/social/push/register', {
    method: 'POST',
    body: JSON.stringify({ profileId, platform: 'android', token }),
  });
  writeStoredToken({ profileId, platform: 'android', token });
}

async function registerWeb(profileId: string): Promise<void> {
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notifications permission was not granted');
  }

  const { publicKey } = await api<{ publicKey: string | null }>('/api/social/push/vapid-public-key');
  if (!publicKey) throw new Error('Push is not configured on the server yet');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const token = JSON.stringify(subscription.toJSON());
  await api('/api/social/push/register', {
    method: 'POST',
    body: JSON.stringify({ profileId, platform: 'web', token }),
  });
  writeStoredToken({ profileId, platform: 'web', token });
}

/** Asks for permission and registers this device against the given profile. */
export async function enablePush(profileId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await registerAndroid(profileId);
  else await registerWeb(profileId);
}

/** Reverses `enablePush` — the device stops being a target for this profile. */
export async function disablePush(profileId: string): Promise<void> {
  const stored = readStoredToken();

  if (Capacitor.isNativePlatform()) {
    await PushNotifications.unregister().catch(() => { /* best-effort */ });
  } else if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => {});
  }

  if (stored && stored.profileId === profileId) {
    await api('/api/social/push/register', {
      method: 'DELETE',
      body: JSON.stringify({ profileId, token: stored.token }),
    }).catch(() => { /* the row expires on its own if this fails offline */ });
    writeStoredToken(null);
  }
}

/**
 * Where a tap on a notification, or its foreground arrival, should land —
 * supplied by whoever mounts `watchPushNotifications` so this module stays
 * free of the store/router it would otherwise have to import directly.
 */
export interface PushRoute {
  toBuddiesTab(): void;
  toBuddyLink(linkId: string): void;
}

function routeFor(data: unknown, route: PushRoute) {
  const typed = data as { type?: string; linkId?: string } | null | undefined;
  if (typed?.type === 'message' && typed.linkId) route.toBuddyLink(typed.linkId);
  else route.toBuddiesTab();
}

let foregroundId = 20_000;

/**
 * Native push does not banner a foregrounded app by itself, so a received
 * notification is mirrored through `LocalNotifications` — the same mechanism
 * `ActiveWorkoutNotification` already uses for the app's own banner.
 */
function showForeground(notification: PushNotificationSchema) {
  void LocalNotifications.schedule({
    notifications: [{
      id: foregroundId++,
      title: notification.title || 'MorphIQ',
      body: notification.body || '',
      schedule: { at: new Date(Date.now() + 20) },
    }],
  }).catch(() => {});
}

/**
 * Wires the native listeners for a notification arriving or being tapped.
 * A no-op on web — the service worker (`public/sw.js`) owns both there,
 * since it has to run even while no tab is open.
 */
export function watchPushNotifications(route: PushRoute): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  const received = PushNotifications.addListener('pushNotificationReceived', showForeground);
  const tapped = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => routeFor(action.notification.data, route),
  );

  return () => {
    void received.then(handle => handle.remove());
    void tapped.then(handle => handle.remove());
  };
}
