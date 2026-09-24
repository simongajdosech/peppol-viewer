import { describe, expect, it } from 'vitest';
import { LOCALES, translation } from './i18n';
import type { Address } from './ubl';

const en = translation('en');
const sk = translation('sk');

/**
 * Intl picks its own space characters — a non-breaking space between "23" and
 * "%", a narrow one between thousands — and which one it picks moves with the
 * bundled ICU. The test is about the format, not about that choice.
 */
const spaces = (text: string) => text.replace(/[   ]/g, ' ');

const address = (over: Partial<Address> = {}): Address => ({
  lines: ['Hlavná 47'],
  city: 'Košice',
  postalZone: '040 01',
  subentity: 'Košický kraj',
  country: 'SK',
  ...over,
});

describe('money', () => {
  it('formats in the document currency per locale', () => {
    expect(spaces(en.money(1234.5, 'EUR'))).toBe('€1,234.50');
    expect(spaces(sk.money(1234.5, 'EUR'))).toBe('1 234,50 €');
  });

  it('always shows two fraction digits', () => {
    expect(spaces(en.money(7, 'EUR'))).toBe('€7.00');
    expect(spaces(sk.money(7, 'EUR'))).toBe('7,00 €');
  });

  it('keeps negative amounts signed, for allowances and prepayments', () => {
    expect(spaces(en.money(-40, 'EUR'))).toBe('-€40.00');
    expect(spaces(sk.money(-40, 'EUR'))).toBe('-40,00 €');
  });

  it('falls back to a plain decimal when the document names no currency', () => {
    expect(spaces(en.money(1234.5, ''))).toBe('1,234.50');
    expect(spaces(sk.money(1234.5, ''))).toBe('1 234,50');
  });

  it('honours a non-EUR currency', () => {
    expect(spaces(en.money(9324, 'SEK'))).toContain('9,324.00');
  });
});

describe('percent', () => {
  it('takes a whole-number rate, not a fraction', () => {
    expect(spaces(en.percent(23))).toBe('23%');
    expect(spaces(sk.percent(23))).toBe('23 %');
  });

  it('keeps a fractional rate', () => {
    expect(spaces(en.percent(7.5))).toBe('7.5%');
    expect(spaces(sk.percent(7.5))).toBe('7,5 %');
  });

  it('formats a zero rate rather than dropping it', () => {
    expect(spaces(en.percent(0))).toBe('0%');
  });
});

describe('quantity', () => {
  it('formats up to four fraction digits without padding', () => {
    expect(spaces(en.quantity(2.5))).toBe('2.5');
    expect(spaces(sk.quantity(2.5))).toBe('2,5');
    expect(spaces(en.quantity(10))).toBe('10');
  });

  it('keeps a negative credited quantity signed', () => {
    expect(spaces(en.quantity(-3))).toBe('-3');
  });
});

describe('date', () => {
  it('formats an ISO date in the sk numeric style', () => {
    expect(spaces(sk.date('2026-09-24'))).toBe('24. 9. 2026');
  });

  it('formats an ISO date in the en style', () => {
    // The month abbreviation moves with ICU, so assert the parts, not the spelling.
    const formatted = en.date('2026-09-24');
    expect(formatted).toMatch(/24/);
    expect(formatted).toMatch(/2026/);
    expect(formatted).not.toBe('2026-09-24');
  });

  it('does not shift the day across a timezone boundary', () => {
    // A bare date parsed as local time would render 1 January as 31 December
    // for anyone west of UTC.
    expect(spaces(sk.date('2026-01-01'))).toBe('1. 1. 2026');
    expect(en.date('2026-01-01')).toMatch(/\b1\b/);
    expect(en.date('2026-01-01')).toMatch(/2026/);
  });

  it('passes an unparseable value through untouched', () => {
    expect(en.date('not-a-date')).toBe('not-a-date');
  });

  it('returns nothing for an absent date', () => {
    expect(en.date('')).toBe('');
  });
});

describe('country', () => {
  it('spells the code out in the reader’s language', () => {
    expect(en.country('NO')).toBe('Norway');
    expect(sk.country('NO')).toBe('Nórsko');
  });

  it('accepts a lowercase code', () => {
    expect(en.country('no')).toBe('Norway');
  });

  it('keeps anything that is not a two-letter code', () => {
    expect(en.country('')).toBe('');
    expect(en.country('NOR')).toBe('NOR');
  });

  it('keeps an unassigned two-letter code as written', () => {
    // ZZ is not in this set: ICU defines it as "Unknown Region" and names it.
    expect(en.country('QQ')).toBe('QQ');
  });
});

describe('address', () => {
  it('joins the postal code and city into one line and spells the country out', () => {
    expect(sk.address(address())).toEqual([
      'Hlavná 47',
      '040 01 Košice',
      'Košický kraj',
      'Slovensko',
    ]);
  });

  it('drops the parts the document does not carry', () => {
    expect(
      en.address(address({ lines: [], subentity: '', postalZone: '', country: '' })),
    ).toEqual(['Košice']);
  });

  it('returns nothing for an empty address', () => {
    expect(
      en.address({ lines: [], city: '', postalZone: '', subentity: '', country: '' }),
    ).toEqual([]);
  });
});

describe('page count', () => {
  it('uses the English singular and plural', () => {
    expect(en.pageCount(1)).toBe('1 page');
    expect(en.pageCount(3)).toBe('3 pages');
  });

  it('uses the Slovak one/few/many forms', () => {
    expect(sk.pageCount(1)).toBe('1 strana');
    expect(sk.pageCount(3)).toBe('3 strany');
    expect(sk.pageCount(7)).toBe('7 strán');
  });

  // Phase 3.6: the hand-rolled rule reads 0 as "few" and says "0 strany".
  it.todo('uses the Slovak many form for zero');
});

describe('dictionaries', () => {
  it('covers every advertised locale', () => {
    for (const { code } of LOCALES) {
      expect(() => translation(code)).not.toThrow();
    }
  });

  it('leaves no label empty in any locale', () => {
    for (const { code } of LOCALES) {
      const t = translation(code) as unknown as Record<string, unknown>;
      const blank = Object.keys(t).filter((key) => t[key] === '');
      expect(blank).toEqual([]);
    }
  });
});
