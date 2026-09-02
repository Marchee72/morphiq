import type { Lang } from '../presentation/state/preferences';

/**
 * Locale-aware formatters. These exist because the design concepts were built
 * against pre-formatted mock strings (`'5d ago'`, `'34:07'`, `'92.5 kg × 3'`).
 * The view-model carries real values instead, and every one of those strings is
 * produced here at the render edge — which is the only reason a language switch
 * is possible at all.
 */
export interface Formatters {
  /** Locale thousands separator, fixed decimals. */
  n(value: number, digits?: number): string;
  /** Always carries a sign, for deltas. */
  signed(value: number, digits?: number): string;
  /**
   * As many decimals as the value needs, up to `max`, with none padded on.
   * 40 → "40", 2.5 → "2,5", 1.25 → "1,25". Fixed-digit formatting turned the
   * 1.25 kg step on the weight dial into "1.3".
   */
  upTo(value: number, max?: number): string;
  kg(value: number, digits?: number): string;
  kcal(value: number): string;
  g(value: number): string;
  /** Tonnes, for session volume. */
  tonnes(kg: number): string;
  /** 18:12 */
  clock(date: Date): string;
  /** 34:07, or 1:02:11 past an hour. */
  duration(seconds: number): string;
  /** '24 Jul' / '24 jul' */
  shortDate(date: Date): string;
  /**
   * '29/07/2026' — zero-padded day/month/year, identical in every language.
   *
   * History screens name a specific day and have to be unambiguous about which
   * one. `shortDate` drops the year and `relativeDay` stops being a date at all
   * past a week ("3 weeks ago"), which is no use when you are looking for what
   * you did on the 14th.
   */
  dmy(date: Date): string;
  /** 'Wed' / 'mié' */
  weekdayShort(date: Date): string;
  /** 'Jul' / 'jul' — chart axis labels. */
  monthShort(date: Date): string;
  /** 'today' / '3 days ago', localised. */
  relativeDay(date: Date, now?: Date): string;
  /** '92.5 kg × 3' */
  kgReps(weightKg: number, reps: number): string;
  /** '5.21 km' */
  km(value: number): string;
  /**
   * Minutes per kilometre, as '5:42 /km'. Null when it cannot be computed —
   * a treadmill run with no distance, or a zero-length record.
   */
  pace(distanceKm: number | undefined, minutes: number): string | null;
  /** Kilometres per hour, as '24.3 km/h'. Null under the same conditions as `pace`. */
  speed(distanceKm: number | undefined, minutes: number): string | null;
  /** '148 bpm' */
  bpm(value: number): string;
}

const LOCALE: Record<Lang, string> = { en: 'en-GB', es: 'es-ES' };

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function makeFormatters(lang: Lang): Formatters {
  const locale = LOCALE[lang];

  const num = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const month = new Intl.DateTimeFormat(locale, { month: 'short' });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const n: Formatters['n'] = (value, digits = 0) => num(value, digits);

  return {
    n,
    upTo: (value, max = 2) =>
      new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: max }).format(value),
    signed: (value, digits = 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${num(Math.abs(value), digits)}`,
    kg: (value, digits = 1) => `${num(value, digits)} kg`,
    kcal: value => `${num(value)} kcal`,
    g: value => `${num(value)} g`,
    tonnes: kg => `${num(kg / 1000, 1)} t`,
    clock: date => time.format(date),
    duration: seconds => {
      const s = Math.max(0, Math.floor(seconds));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      const pad = (v: number) => String(v).padStart(2, '0');
      return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
    },
    shortDate: date => dayMonth.format(date),
    // Built by hand rather than through `Intl`: es-ES renders `29/7/2026`
    // unpadded and en-US would flip the day and month outright.
    dmy: date => `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`,
    weekdayShort: date => weekday.format(date),
    monthShort: date => month.format(date),
    relativeDay: (date, now = new Date()) => {
      const days = Math.round((startOfDay(date) - startOfDay(now)) / MS_PER_DAY);
      // `numeric: 'auto'` turns -1/0/1 into yesterday/today/tomorrow for free.
      if (Math.abs(days) < 7) return relative.format(days, 'day');
      if (Math.abs(days) < 31) return relative.format(Math.round(days / 7), 'week');
      return dayMonth.format(date);
    },
    // As many decimals as the weight needs, up to 3. A fixed 1 turned the
    // dial's 80.125 into '80.1 kg', so the set list disagreed with the set.
    kgReps: (weightKg, reps) =>
      `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(weightKg)} kg × ${num(reps)}`,
    km: value => `${num(value, 2)} km`,
    // Both guard against a zero on either side: a record with no distance or no
    // duration divides to Infinity, which renders as '∞ /km'.
    pace: (distanceKm, minutes) => {
      if (!distanceKm || distanceKm <= 0 || !minutes || minutes <= 0) return null;
      const perKm = minutes / distanceKm;
      const mins = Math.floor(perKm);
      const secs = Math.round((perKm - mins) * 60);
      // 4:60 is 5:00. Rounding the seconds up to a full minute has to carry.
      const [m, s] = secs === 60 ? [mins + 1, 0] : [mins, secs];
      return `${m}:${String(s).padStart(2, '0')} /km`;
    },
    speed: (distanceKm, minutes) => {
      if (!distanceKm || distanceKm <= 0 || !minutes || minutes <= 0) return null;
      return `${num(distanceKm / (minutes / 60), 1)} km/h`;
    },
    bpm: value => `${num(value)} bpm`,
  };
}
