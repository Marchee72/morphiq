import { Capacitor } from '@capacitor/core';

/**
 * Installing the web app to the home screen.
 *
 * Chrome fires `beforeinstallprompt` once, early, and usually before any React
 * component that would want it has mounted — so the event is captured at module
 * load and held. A button that appears three seconds after the browser was
 * ready is a button most people never see.
 *
 * iOS implements none of this. Safari installs through Share → Add to Home
 * Screen and offers no API at all, which is why `canPrompt` and `isIos` are
 * separate questions: one gets a button, the other gets instructions.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of [...listeners]) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    // Without this Chrome shows its own mini-infobar and the event is spent.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    announce();
  });

  // Installed from the browser's own menu rather than our button; the offer has
  // to come down either way.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    announce();
  });
}

/** Subscribe to changes in whether an install can be offered. */
export function onInstallabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function canPrompt(): boolean {
  return deferred !== null;
}

/** True when the app is already running from the home screen. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    // Safari's own, non-standard flag — the only signal iOS gives.
    || (window.navigator as { standalone?: boolean }).standalone === true;
}

/** iOS can install, but only by hand, and only from Safari's share sheet. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS 13+ reports itself as a Mac; the touch points give it away.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Whether to show anything about installing at all.
 *
 * Never inside the Android app — it *is* the installed app, and offering to
 * install it again is nonsense.
 */
export function canOfferInstall(): boolean {
  if (Capacitor.isNativePlatform() || isStandalone()) return false;
  return canPrompt() || isIos();
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';

  // Spent once used, whatever the answer — Chrome will not replay it.
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  announce();
  return outcome;
}
