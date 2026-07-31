/**
 * Push delivery: Android via Firebase Cloud Messaging, web via the standard
 * Push API (VAPID).
 *
 * Both backends are configured lazily from environment variables, and both
 * fail closed rather than throwing: a partner starting a session or sending a
 * message must never 500 because a notification could not go out. Until
 * `FIREBASE_SERVICE_ACCOUNT_JSON` / the `VAPID_*` vars are set, sends for that
 * platform are silently skipped — the rest of the app works unaffected.
 */
// firebase-admin v14 dropped the classic `admin.credential.cert(...)` shape in
// favour of these modular entry points — `admin.credential` is `undefined` on
// this version, so importing the old way initializes nothing and fails silent
// until the first send.
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import webpush from 'web-push';

let messaging; // undefined = not yet tried, false = tried and unavailable
let vapidReady; // undefined = not yet tried, false = tried and unavailable

function firebase() {
  if (messaging !== undefined) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) { messaging = false; return messaging; }
  try {
    const app = initializeApp({ credential: cert(JSON.parse(json)) });
    messaging = getMessaging(app);
  } catch (err) {
    console.error('[push] Firebase Admin init failed, Android push disabled:', err.message);
    messaging = false;
  }
  return messaging;
}

function vapid() {
  if (vapidReady !== undefined) return vapidReady;
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv || !subject) { vapidReady = false; return vapidReady; }
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return vapidReady;
}

/** The public half of the VAPID pair, for the client's `PushManager.subscribe`. */
export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/**
 * A registration is dead — the app was uninstalled, the subscription expired
 * — versus merely unreachable right now. Only the former is worth pruning;
 * the token is otherwise good and the device may simply be offline.
 */
function isGoneError(err) {
  const code = err?.code ?? err?.errorInfo?.code;
  if (code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token') return true;
  const status = err?.statusCode;
  return status === 404 || status === 410;
}

/**
 * Fans a notification out to every device registered for the given profiles.
 *
 * Deliberately minimal: `title`/`body` are the only fields either platform
 * gets, matching the privacy contract `live_sessions` already enforces — a
 * notification is not one more place a weight or a rep could leak through.
 */
export async function sendPushToProfiles(pool, profileIds, { title, body, data = {} }) {
  const ids = [...new Set(profileIds.map(String))];
  if (ids.length === 0) return;

  const { rows } = await pool.query(
    'SELECT id, platform, token FROM push_tokens WHERE "profileId" = ANY($1)',
    [ids],
  );
  if (rows.length === 0) return;

  const stale = [];

  await Promise.all(rows.map(async row => {
    try {
      if (row.platform === 'android') {
        const fcm = firebase();
        if (!fcm) return;
        await fcm.send({
          token: row.token,
          notification: { title, body },
          data,
        });
      } else {
        if (!vapid()) return;
        await webpush.sendNotification(
          JSON.parse(row.token),
          JSON.stringify({ title, body, data }),
        );
      }
    } catch (err) {
      if (isGoneError(err)) stale.push(row.id);
      else console.error(`[push] send failed (${row.platform}):`, err.message);
    }
  }));

  if (stale.length > 0) {
    await pool.query('DELETE FROM push_tokens WHERE id = ANY($1)', [stale]);
  }
}
