import type { StaticKey } from '../../i18n/types';

/**
 * How the session felt. Ids match the `feelingTag` union on `WorkoutLog` and on
 * the store's `activeSession`, so they are persisted values — do not rename them.
 *
 * Labels are i18n keys rather than strings: this list renders inside the skins,
 * which follow the in-app language setting. Colours are tokens so the same list
 * reads correctly in both the light and dark palettes.
 *
 * Those tokens used to be `--ui-success`, `--ui-warning`, `--ui-error` and
 * friends, left behind when the `src/ui` design system was deleted. None of them
 * resolved to anything, so a selected chip was styled with three empty values
 * and looked exactly like an unselected one — the question had no visible
 * answer. The palette here is the Atlas one, which is the only one that exists.
 */
export const FEELING_OPTIONS = [
  { id: 'feeling_100', emoji: '🔥', labelKey: 'feeling.feeling_100', color: 'var(--sage)', bg: 'var(--at-tonal)' },
  { id: 'good', emoji: '⚡', labelKey: 'feeling.good', color: 'var(--clay)', bg: 'var(--at-tonal)' },
  { id: 'sore', emoji: '⚠️', labelKey: 'feeling.sore', color: 'var(--clay-strong)', bg: 'var(--at-tonal)' },
  { id: 'pain', emoji: '🩹', labelKey: 'feeling.pain', color: 'var(--clay-strong)', bg: 'var(--at-tonal)' },
  { id: 'low_energy', emoji: '😴', labelKey: 'feeling.low_energy', color: 'var(--muted)', bg: 'var(--at-tonal)' },
] as const satisfies readonly { id: string; emoji: string; labelKey: StaticKey; color: string; bg: string }[];

export type FeelingOption = (typeof FEELING_OPTIONS)[number];
