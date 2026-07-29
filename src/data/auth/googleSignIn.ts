import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { setSession, clearSession, type AuthUser } from './session';
import { apiBaseUrl } from '../database/mode';

/**
 * Google sign-in, on web and on device.
 *
 * Both paths end the same way: a Google ID token goes to `/api/auth/google`,
 * the server verifies it against Google's keys and returns an app session. The
 * client never decides who you are — it only carries the proof.
 */
/**
 * Only the web client id is used at runtime, on both platforms.
 *
 * On Android the token is still minted for the *web* client — that is the
 * audience the backend verifies. The separate Android client exists purely to
 * tie the request to this app's package and signing certificate, and Google
 * resolves it from those; the plugin never takes it as a parameter.
 */
const WEB_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined;


export function isGoogleConfigured(): boolean {
  return Boolean(WEB_CLIENT_ID);
}

let nativeReady = false;

async function initNative(): Promise<void> {
  if (nativeReady) return;
  await SocialLogin.initialize({
    google: { webClientId: WEB_CLIENT_ID },
  });
  nativeReady = true;
}

/** Loads Google Identity Services once, on demand. */
function loadGis(): Promise<void> {
  if (document.getElementById('gis-script')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services failed to load'));
    document.head.appendChild(script);
  });
}

interface GoogleCredentialResponse { credential: string }

async function webIdToken(): Promise<string> {
  await loadGis();
  const google = (window as unknown as { google?: { accounts: { id: {
    initialize(config: Record<string, unknown>): void;
    prompt(listener?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
  } } } }).google;
  if (!google) throw new Error('Google Identity Services unavailable');

  return new Promise<string>((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: WEB_CLIENT_ID,
      callback: (response: GoogleCredentialResponse) =>
        response.credential ? resolve(response.credential) : reject(new Error('No credential returned')),
      auto_select: false,
      use_fedcm_for_prompt: true,
    });
    google.accounts.id.prompt(notification => {
      // The One Tap prompt can be suppressed by browser settings or a previous
      // dismissal; without this the promise would hang with nothing on screen.
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        reject(new Error('Google did not show the sign-in prompt'));
      }
    });
  });
}

async function nativeIdToken(): Promise<string> {
  await initNative();
  const result = await SocialLogin.login({ provider: 'google', options: {} });
  const token = (result?.result as { idToken?: string } | undefined)?.idToken;
  if (!token) throw new Error('Google returned no id token');
  return token;
}

export interface SignInResult {
  user: AuthUser;
  /** How many previously unowned profiles this account just claimed. */
  adoptedProfiles: number;
}

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!WEB_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set');

  const idToken = Capacitor.isNativePlatform() ? await nativeIdToken() : await webIdToken();

  const res = await fetch(`${apiBaseUrl()}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Sign-in failed (${res.status})`);
  }

  const data = await res.json() as { token: string; user: AuthUser; adoptedProfiles: number };
  setSession({ token: data.token, user: data.user });
  return { user: data.user, adoptedProfiles: data.adoptedProfiles ?? 0 };
}

export async function signOut(): Promise<void> {
  clearSession();
  if (Capacitor.isNativePlatform()) {
    await SocialLogin.logout({ provider: 'google' }).catch(() => { /* already signed out */ });
  }
}
