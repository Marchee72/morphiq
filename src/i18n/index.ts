import { useMemo } from 'react';
import { useStore } from '../presentation/state/store';
import type { Lang } from '../presentation/state/preferences';
import { en } from './en';
import { es } from './es';
import { makeFormatters, type Formatters } from './format';
import type { TArgs, TFn, TKey, TpFn, Translations } from './types';

export type { Lang, Dictionary, TKey, TFn, TpFn } from './types';
export type { Formatters } from './format';

const DICTIONARIES: Record<Lang, Translations> = { en, es };

/** Replaces `{name}` placeholders. Unknown placeholders are left intact so they surface in review. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * Non-hook translation, for the few places that render outside React —
 * the Android live-workout notification, and error paths above the tree.
 */
export function translate<K extends TKey>(lang: Lang, key: K, ...args: TArgs<K>): string {
  const dict = DICTIONARIES[lang] ?? en;
  const template = dict[key] ?? en[key] ?? String(key);
  return interpolate(template, args[0] as Record<string, string | number> | undefined);
}

export interface I18n {
  t: TFn;
  tp: TpFn;
  fmt: Formatters;
  lang: Lang;
}

export function makeI18n(lang: Lang): I18n {
  const t = ((key, ...args) => translate(lang, key, ...args)) as TFn;

  // English and Spanish share the same one/other split, so two forms cover both.
  const tp = ((base, count, vars) => {
    const key = `${base}_${count === 1 ? 'one' : 'other'}` as TKey;
    return interpolate(
      (DICTIONARIES[lang] ?? en)[key] ?? en[key] ?? String(key),
      { n: count, ...vars },
    );
  }) as TpFn;

  return { t, tp, fmt: makeFormatters(lang), lang };
}

/** The hook every component uses. Rebuilds only when the language actually changes. */
export function useT(): I18n {
  const lang = useStore(s => s.language);
  return useMemo(() => makeI18n(lang), [lang]);
}
