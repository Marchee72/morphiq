/**
 * Durable UI preferences (language, colour mode).
 *
 * Read synchronously at module-init time so the first paint already has the
 * right palette — mirroring the existing `getInitialTheme()` pattern rather than
 * introducing zustand `persist`, which the store has never used and which would
 * fight the manual localStorage handling already here.
 */

export const PREF_KEYS = {
  language: 'morphiq_lang',
  /** Historical key name, kept so the value survives across versions. */
  mode: 'morphiq_theme',
} as const;

export const LANGUAGES = ['en', 'es'] as const;
export const MODES = ['system', 'dark', 'light'] as const;

export type Lang = (typeof LANGUAGES)[number];
export type Mode = (typeof MODES)[number];

/** The page background per resolved mode. Kept in step with the palettes in `atlas.css`. */
export const SURFACE: Record<'light' | 'dark', string> = {
  light: '#f3ece2',
  dark: '#1a1512',
};

/** Reads a preference, falling back whenever storage is empty, unreadable or holds a stale value. */
export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    return allowed.includes(saved as T) ? (saved as T) : fallback;
  } catch {
    // Private-mode Safari and some WebViews throw on access rather than returning null.
    return fallback;
  }
}

export function writePref(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // A failed write costs the user their preference next launch, nothing more.
  }
}

export function initialLanguage(): Lang {
  const saved = readPref(PREF_KEYS.language, LANGUAGES, '' as Lang);
  if (saved) return saved;
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function initialMode(): Mode {
  return readPref(PREF_KEYS.mode, MODES, 'system');
}

/** Resolves `system` against the OS preference. */
export function resolveMode(mode: Mode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Paints the page background on <html> before React mounts.
 *
 * Without this the launch splash renders on the browser default and the first
 * frame of every cold start is the wrong colour.
 */
export function applySurface(mode: Mode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.backgroundColor = SURFACE[resolveMode(mode)];
}
