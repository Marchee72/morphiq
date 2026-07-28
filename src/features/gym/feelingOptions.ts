import type { StaticKey } from '../../i18n/types';

/**
 * How the session felt. Ids match the `feelingTag` union on `WorkoutLog` and on
 * the store's `activeSession`, so they are persisted values — do not rename them.
 *
 * Labels are i18n keys rather than strings: this list renders inside the skins,
 * which follow the in-app language setting. Colours are tokens so the same list
 * reads correctly in both the light and dark palettes.
 */
export const FEELING_OPTIONS = [
  { id: 'feeling_100', emoji: '🔥', labelKey: 'feeling.feeling_100', color: 'var(--ui-success)', bg: 'var(--ui-success-bg)' },
  { id: 'good', emoji: '⚡', labelKey: 'feeling.good', color: 'var(--ui-primary)', bg: 'var(--ui-tonal)' },
  { id: 'sore', emoji: '⚠️', labelKey: 'feeling.sore', color: 'var(--ui-warning)', bg: 'var(--ui-warning-bg)' },
  { id: 'pain', emoji: '🩹', labelKey: 'feeling.pain', color: 'var(--ui-error)', bg: 'var(--ui-error-bg)' },
  { id: 'low_energy', emoji: '😴', labelKey: 'feeling.low_energy', color: 'var(--ui-accent-violet)', bg: 'var(--ui-accent-violet-bg)' },
] as const satisfies readonly { id: string; emoji: string; labelKey: StaticKey; color: string; bg: string }[];

export type FeelingOption = (typeof FEELING_OPTIONS)[number];
