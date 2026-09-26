import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPE_CODES,
  PAYMENT_MEANS_CODES,
  UNIT_CODES,
  VAT_CATEGORY_CODES,
} from './codes';
import { LOCALES, translation } from './i18n';

const TABLES = {
  units: UNIT_CODES,
  'document types': DOCUMENT_TYPE_CODES,
  'payment means': PAYMENT_MEANS_CODES,
  'VAT categories': VAT_CATEGORY_CODES,
};

describe('code tables', () => {
  // The tables hold keys, not wording; a key with no entry in a dictionary would
  // silently print the raw code instead of a label.
  it.each(LOCALES.map((l) => l.code))('%s has wording for every code', (locale) => {
    const { codes } = translation(locale);
    const missing: string[] = [];

    for (const table of Object.values(TABLES)) {
      for (const key of Object.values(table)) {
        if (!codes[key]) missing.push(key);
      }
    }

    expect(missing).toEqual([]);
  });

  it.each(LOCALES.map((l) => l.code))('%s carries no wording nothing maps to', (locale) => {
    const used = new Set(Object.values(TABLES).flatMap((table) => Object.values(table)));
    const orphans = Object.keys(translation(locale).codes).filter((key) => !used.has(key));

    expect(orphans).toEqual([]);
  });

  it.each(Object.entries(TABLES))('%s uses codes exactly as the XML writes them', (_name, table) => {
    // A stray lowercase or padded key would never match a document.
    for (const code of Object.keys(table)) {
      expect(code).toBe(code.trim());
      expect(code).toBe(code.toUpperCase());
    }
  });
});

describe('unit', () => {
  const en = translation('en');
  const sk = translation('sk');

  it('prints the label alone, with no code', () => {
    expect(en.unit('HUR')).toBe('h');
    expect(sk.unit('HUR')).toBe('hod.');
    expect(en.unit('C62')).toBe('pcs');
    expect(sk.unit('C62')).toBe('ks');
  });

  it('treats the interchangeable piece codes alike', () => {
    // C62, H87, EA and NAR all mean "a countable thing" across the samples.
    for (const code of ['C62', 'H87', 'EA', 'NAR']) {
      expect(en.unit(code)).toBe('pcs');
    }
  });

  it('keeps an unknown code rather than blanking the column', () => {
    expect(en.unit('ZZZ')).toBe('ZZZ');
  });

  it('stays empty when the document gave no unit', () => {
    expect(en.unit('')).toBe('');
  });
});

describe('documentType', () => {
  const en = translation('en');
  const sk = translation('sk');

  it('shows the code and its meaning', () => {
    expect(en.documentType('380')).toBe('380 - Commercial invoice');
    expect(sk.documentType('380')).toBe('380 - Obchodná faktúra');
    expect(en.documentType('381')).toBe('381 - Credit note');
  });

  it('falls back to the bare code when the list does not cover it', () => {
    expect(en.documentType('999')).toBe('999');
  });

  it('stays empty when the document gave no type code', () => {
    expect(en.documentType('')).toBe('');
  });
});

describe('paymentMeans', () => {
  const en = translation('en');
  const sk = translation('sk');

  it('shows the code and its meaning', () => {
    expect(en.paymentMeans('30', '')).toBe('30 - Credit transfer');
    expect(sk.paymentMeans('30', '')).toBe('30 - Prevodný príkaz');
    expect(en.paymentMeans('10', '')).toBe('10 - Cash');
  });

  it("prefers the sender's own name over the code list", () => {
    // BT-82: if the sender named the instrument, that is what they call it.
    expect(sk.paymentMeans('30', 'Prevodný príkaz')).toBe('30 - Prevodný príkaz');
    expect(en.paymentMeans('30', 'Bank giro')).toBe('30 - Bank giro');
  });

  it('uses the sender name even for a code the list does not cover', () => {
    expect(en.paymentMeans('ZZ', 'Barter')).toBe('ZZ - Barter');
  });

  it('falls back to the bare code', () => {
    expect(en.paymentMeans('77', '')).toBe('77');
  });
});

describe('vatCategory', () => {
  const en = translation('en');
  const sk = translation('sk');

  it('shows the code and its meaning', () => {
    expect(en.vatCategory('S')).toBe('S - Standard rate');
    expect(sk.vatCategory('S')).toBe('S - Základná sadzba');
    expect(en.vatCategory('AE')).toBe('AE - Reverse charge');
    expect(sk.vatCategory('AE')).toBe('AE - Prenesenie daňovej povinnosti');
  });

  it('covers every category EN 16931 allows', () => {
    for (const code of ['S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M']) {
      expect(en.vatCategory(code)).toMatch(new RegExp(`^${code} - .+`));
    }
  });

  it('falls back to the bare code', () => {
    expect(en.vatCategory('Q')).toBe('Q');
  });

  it('stays empty when the document gave no category', () => {
    expect(en.vatCategory('')).toBe('');
  });
});
