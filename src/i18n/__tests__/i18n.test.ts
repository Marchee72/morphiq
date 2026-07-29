import { describe, expect, it } from 'vitest';
import { en } from '../en';
import { es } from '../es';
import { makeI18n, translate } from '../index';
import { makeFormatters } from '../format';

describe('dictionaries', () => {
  it('es covers exactly the en key set', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('leaves no key untranslated by accident', () => {
    // Some keys are legitimately identical across languages (units, brand names,
    // interpolation-only strings). Anything beyond a third of the dictionary
    // means a block was copied and never translated.
    const identical = Object.keys(en).filter(k => en[k as keyof typeof en] === es[k as keyof typeof es]);
    expect(identical.length / Object.keys(en).length).toBeLessThan(0.34);
  });

  it('keeps placeholders consistent between languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), `placeholders differ for "${key}"`).toEqual(placeholders(en[key]));
    }
  });

  it('has both plural forms wherever it has one', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('_one')) expect(en).toHaveProperty(`${key.slice(0, -4)}_other`);
      if (key.endsWith('_other')) expect(en).toHaveProperty(`${key.slice(0, -6)}_one`);
    }
  });
});

describe('translate', () => {
  it('returns the language-specific string', () => {
    expect(translate('en', 'nav.today')).toBe('Today');
    expect(translate('es', 'nav.today')).toBe('Hoy');
  });

  it('interpolates named placeholders', () => {
    expect(translate('en', 'today.greeting.evening', { name: 'Marc' })).toBe('Good evening, Marc.');
    expect(translate('es', 'today.nextIs', { name: 'Press', weight: 32.5 })).toBe('sigue Press con 32.5 kg');
  });

  it('leaves an unknown placeholder intact rather than printing undefined', () => {
    // @ts-expect-error — deliberately passing the wrong variable name
    expect(translate('en', 'today.greeting.evening', { nombre: 'Marc' })).toBe('Good evening, {name}.');
  });
});

describe('tp', () => {
  const { tp } = makeI18n('en');

  it('picks the singular form at exactly one', () => {
    expect(tp('today.setsLeft', 1)).toBe('1 set left');
  });

  it('picks the plural form otherwise', () => {
    expect(tp('today.setsLeft', 4)).toBe('4 sets left');
    expect(tp('today.setsLeft', 0)).toBe('0 sets left');
  });

  it('translates', () => {
    expect(makeI18n('es').tp('unit.sets', 1)).toBe('1 serie');
    expect(makeI18n('es').tp('unit.sets', 3)).toBe('3 series');
  });
});

describe('formatters', () => {
  const en_ = makeFormatters('en');
  const es_ = makeFormatters('es');

  it('formats durations as clock time', () => {
    expect(en_.duration(2047)).toBe('34:07');
    expect(en_.duration(59)).toBe('0:59');
    expect(en_.duration(3731)).toBe('1:02:11');
    expect(en_.duration(-5)).toBe('0:00');
  });

  it('signs deltas and uses a real minus sign', () => {
    expect(en_.signed(1.24)).toBe('+1.2');
    expect(en_.signed(-1.24)).toBe('−1.2');
    expect(en_.signed(0)).toBe('0.0');
  });

  it('uses locale thousands separators', () => {
    expect(en_.n(8420)).toBe('8,420');
    expect(en_.n(12500)).toBe('12,500');
    expect(es_.n(12500)).toBe('12.500');
  });

  it('follows the Spanish rule of no separator on four-digit integers', () => {
    // es-ES sets minimumGroupingDigits=2, so 8420 is bare while 12500 is grouped.
    // Worth pinning: the showcase hardcoded en-US, so this is a real rendering change.
    expect(es_.n(8420)).toBe('8420');
  });

  it('drops the decimal on whole-kilogram records', () => {
    expect(en_.kgReps(92.5, 3)).toBe('92.5 kg × 3');
    expect(en_.kgReps(90, 3)).toBe('90 kg × 3');
  });

  it('describes recent days relatively', () => {
    const now = new Date(2026, 6, 27, 12);
    expect(en_.relativeDay(new Date(2026, 6, 27, 8), now)).toBe('today');
    expect(en_.relativeDay(new Date(2026, 6, 26, 22), now)).toBe('yesterday');
    expect(en_.relativeDay(new Date(2026, 6, 24), now)).toBe('3 days ago');
    // Beyond a month it falls back to an absolute date.
    expect(en_.relativeDay(new Date(2026, 3, 2), now)).toMatch(/Apr/);
  });

  it('writes history dates as dd/mm/yyyy, padded, in both languages', () => {
    // The history screens name a specific day, so the format must not drift with
    // the locale: es-ES would render `9/7/2026` and en-US would flip the pair.
    expect(en_.dmy(new Date(2026, 6, 9))).toBe('09/07/2026');
    expect(es_.dmy(new Date(2026, 6, 9))).toBe('09/07/2026');
    expect(en_.dmy(new Date(2026, 11, 25))).toBe('25/12/2026');
  });

  it('keeps the local day when the clock is near midnight', () => {
    // `toISOString` would push a late-evening session onto the next day.
    expect(en_.dmy(new Date(2026, 6, 29, 23, 45))).toBe('29/07/2026');
  });
});

describe('upTo', () => {
  const en_ = makeFormatters('en');
  const es_ = makeFormatters('es');

  it('shows only the decimals a value actually needs', () => {
    // Fixed-digit formatting turned the dial's 1.25 kg step into "1.3".
    expect(en_.upTo(40)).toBe('40');
    expect(en_.upTo(2.5)).toBe('2.5');
    expect(en_.upTo(1.25)).toBe('1.25');
  });

  it('respects the locale separator', () => {
    expect(es_.upTo(1.25)).toBe('1,25');
  });

  it('caps at the requested precision', () => {
    expect(en_.upTo(1.23456)).toBe('1.23');
    expect(en_.upTo(1.23456, 3)).toBe('1.235');
  });
});
