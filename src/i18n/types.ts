import type { en } from './en';

export type { Lang } from '../presentation/state/preferences';

/**
 * The English dictionary is the source of truth. Keys are flat and dotted rather
 * than nested: `keyof typeof en` then yields a string-literal union directly, so
 * a typo in `t()` is a compile error and `es: Dictionary` fails on any missing
 * *or* extra key. Nesting would need a recursive `Paths<T>` that checks slowly
 * and produces unreadable errors.
 */
export type Dictionary = typeof en;
export type TKey = keyof Dictionary;

/**
 * The shape a translated dictionary must satisfy: the same keys, any strings.
 *
 * Not `Dictionary` itself — `as const` narrows every English value to its own
 * literal type, so typing `es` as `Dictionary` would demand the *English text*.
 * A missing or extra key is still a compile error, which is the point.
 */
export type Translations = Record<TKey, string>;

/** Extracts `{name}` placeholders from a template literal type. */
export type Vars<S extends string> = S extends `${string}{${infer K}}${infer R}`
  ? K | Vars<R>
  : never;

/** No placeholders → no second argument allowed. Placeholders → all of them required. */
export type TArgs<K extends TKey> = Vars<Dictionary[K]> extends never
  ? []
  : [vars: Record<Vars<Dictionary[K]>, string | number>];

export type TFn = <K extends TKey>(key: K, ...args: TArgs<K>) => string;

/**
 * Keys whose text carries no `{placeholder}`.
 *
 * View models store label keys as data (`MetricPointVM.labelKey`,
 * `SCREENS[].labelKey`), and calling `t(someKey)` with a plain `TKey` is a type
 * error — the compiler cannot know whether that particular key needs variables.
 * Typing those fields as `StaticKey` narrows the union to keys that provably
 * take none, so the call resolves without weakening `t` for everyone else.
 */
export type StaticKey = { [K in TKey]: Vars<Dictionary[K]> extends never ? K : never }[TKey];

/**
 * Plural keys come in `<base>_one` / `<base>_other` pairs. English and Spanish
 * share the same one/other split, so two forms cover both languages we ship.
 */
/**
 * Written through a helper with a naked type parameter so the conditional
 * *distributes* over the key union — inlining it as `TKey extends ...` tests the
 * whole union at once and silently collapses to `never`.
 */
type PluralBaseOf<K> = K extends `${infer B}_one` ? B : never;
export type PluralBase = PluralBaseOf<TKey>;
export type TpFn = <B extends PluralBase>(
  base: B,
  count: number,
  vars?: Record<string, string | number>,
) => string;
