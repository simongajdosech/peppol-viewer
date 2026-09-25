import { describe, expect, it } from 'vitest';
import { decode } from 'bysquare/pay';
import qrcode from 'qrcode-generator';
import {
  bySquarePayload,
  epcPayload,
  isIban,
  normaliseIban,
  paymentQrs,
  paymentSymbols,
  qrMatrix,
} from './qr';
import { parseUbl, type UblDocument } from './ubl';

const samples = import.meta.glob('../public/samples/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sample = (name: string) => parseUbl(samples[`../public/samples/${name}`]);

/** The one bundled document that earns both codes: a Slovak IBAN, a VS, and euro. */
const slovak = () => sample('SK-full-example.xml');

describe('isIban', () => {
  it('accepts real IBANs of several lengths', () => {
    expect(isIban('SK3112000000198742637541')).toBe(true); // 24, the SK sample
    expect(isIban('NO9386011117947')).toBe(true); // 15, the shortest there is
    expect(isIban('MT84MALT011000012345MTLCAST001S')).toBe(true); // 31
  });

  it('ignores the grouping a human types', () => {
    expect(isIban('sk31 1200 0000 1987 4263 7541')).toBe(true);
    expect(normaliseIban('sk31 1200 0000 1987 4263 7541')).toBe('SK3112000000198742637541');
  });

  it('rejects a wrong check digit', () => {
    expect(isIban('SK3212000000198742637541')).toBe(false);
  });

  it('rejects the right shape at the wrong length for the country', () => {
    // Drop a digit: still letters-digits-alphanumerics, but SK is 24 characters.
    expect(isIban('SK311200000019874263754')).toBe(false);
  });

  it('rejects the placeholders the upstream Peppol test files carried', () => {
    // These are the values the OpenPEPPOL samples ship with, and what the bundled
    // copies under public/samples/ were given real IBANs in place of.
    expect(isIban('IBAN32423940')).toBe(false);
    expect(isIban('SE1212341234123412')).toBe(false); // SE is 24, this is 18
    expect(isIban('')).toBe(false);
    expect(isIban('NO93')).toBe(false);
  });
});

describe('paymentSymbols', () => {
  it('reads a bare run of digits as the variable symbol', () => {
    expect(paymentSymbols(['2026000042'])).toEqual({
      variable: '2026000042',
      constant: '',
      specific: '',
    });
  });

  it('reads the named forms, with or without a separator', () => {
    expect(paymentSymbols(['VS 1234', 'KS-0308', 'ss:99'])).toEqual({
      variable: '1234',
      constant: '0308',
      specific: '99',
    });
  });

  it('leaves free text out, so a bank never sees it in a symbol field', () => {
    // base-example and friends carry "Snippet1" in BT-83.
    expect(paymentSymbols(['Snippet1'])).toEqual({ variable: '', constant: '', specific: '' });
  });

  it('drops an over-long value rather than truncating it', () => {
    // The Norwegian sample's KID is 16 digits; half a symbol matches no payment.
    expect(paymentSymbols(['0003434323213231']).variable).toBe('');
    expect(paymentSymbols(['KS12345']).constant).toBe('');
  });

  it('keeps the first of each kind', () => {
    expect(paymentSymbols(['111', 'VS222']).variable).toBe('111');
  });
});

/**
 * The fields both payload builders take. Built on the SK sample's account and amount,
 * with a constant symbol added — no bundled document carries one, and the point of the
 * convention is that it reaches the payload.
 */
const transfer = {
  iban: 'SK3112000000198742637541',
  bic: 'TATRSKBX',
  beneficiary: 'Slovenské softvérové riešenia, s. r. o.',
  amount: 2017,
  currency: 'EUR',
  dueDate: '2026-09-29',
  reference: '2026000042',
  symbols: { variable: '2026000042', constant: '0308', specific: '' },
};

describe('epcPayload', () => {
  it('writes the twelve-line EPC069-12 record', () => {
    expect(epcPayload(transfer)).toBe(
      [
        'BCD',
        '002',
        '1',
        'SCT',
        'TATRSKBX',
        'Slovenské softvérové riešenia, s. r. o.',
        'SK3112000000198742637541',
        'EUR2017.00',
        '',
        '',
        '2026000042',
      ].join('\n'),
    );
  });

  it('drops a BIC that is not one', () => {
    // The line is left empty rather than filled with something a bank cannot route;
    // version 002 of the standard makes the BIC optional anyway.
    expect(epcPayload({ ...transfer, bic: 'BIC324098' })?.split('\n')[4]).toBe('');
  });

  it('omits the trailing empty lines the standard allows to be left off', () => {
    const payload = epcPayload({ ...transfer, reference: '' });

    expect(payload?.endsWith('EUR2017.00')).toBe(true);
  });

  it('refuses anything but euro, which is the only currency SCT settles in', () => {
    expect(epcPayload({ ...transfer, currency: 'NOK' })).toBeNull();
    expect(epcPayload({ ...transfer, currency: 'CZK' })).toBeNull();
  });

  it('refuses an amount outside the range the standard states', () => {
    expect(epcPayload({ ...transfer, amount: 0.004 })).toBeNull();
    expect(epcPayload({ ...transfer, amount: 1_000_000_000 })).toBeNull();
    expect(epcPayload({ ...transfer, amount: 0.01 })).not.toBeNull();
    expect(epcPayload({ ...transfer, amount: 999_999_999.99 })).not.toBeNull();
  });

  it('stays inside the 331-byte cap, counting the accents as the bytes they are', () => {
    const payload = epcPayload(transfer) ?? '';

    expect(new TextEncoder().encode(payload).length).toBeLessThanOrEqual(331);
    // Each field is capped on its own, so only their sum can overflow — and a name in
    // Slovak costs two bytes a letter against a cap that is counted in bytes.
    const long = { ...transfer, beneficiary: 'š'.repeat(70), reference: 'x'.repeat(140) };

    expect(epcPayload(long)).toBeNull();
  });
});

describe('bySquarePayload', () => {
  it('encodes to one exact string', () => {
    // Pinned so a change in the field order, the defaults or the compressor shows up.
    // It is an opaque LZMA stream, so when this moves, read the round-trip test below
    // to see what actually changed — and note that a `bysquare` upgrade may move it
    // legitimately.
    expect(bySquarePayload(transfer)).toBe(
      '080960005QLP5G1VHVV1N8SO1KSSOM1UFB9MBAKH7HH511R57TA4CVN14K2PBBCH5VOBF1M8H8' +
        'AHP4UMB7P99ME9FAQ371A47KK2GR8OIVOQJQLS501KE1GURMCIFR0EEJCAUI0SKFQSPCRAG55' +
        'DLAL0B2UB0CC2C08BFV1LSU62S1L18ACOHTSM7BFFF5P10FVI59G000',
    );
  });

  it('round-trips through the decoder with every field intact', () => {
    const [payment] = decode(bySquarePayload(transfer) ?? '').payments;

    expect(payment.bankAccounts[0]).toEqual({ iban: transfer.iban, bic: transfer.bic });
    expect(payment.amount).toBe(2017);
    expect(payment.currencyCode).toBe('EUR');
    expect(payment.paymentDueDate).toBe('20260929');
    expect(payment.variableSymbol).toBe('2026000042');
    expect(payment.constantSymbol).toBe('0308');
    // The encoder strips diacritics: most Slovak banking apps mis-decode them.
    expect(payment.beneficiary?.name).toBe('Slovenske softverove riesenia, s. r. o.');
  });

  it('takes a currency other than euro, unlike the EPC code', () => {
    expect(bySquarePayload({ ...transfer, currency: 'CZK' })).not.toBeNull();
  });

  it('yields nothing rather than a code a bank would reject', () => {
    expect(bySquarePayload({ ...transfer, iban: 'IBAN32423940' })).toBeNull();
    expect(bySquarePayload({ ...transfer, beneficiary: '' })).toBeNull();
  });

  it('leaves an over-long invoice number out of the capped field', () => {
    // Field #1 holds 10 characters; the reference still travels as the payment note.
    const payload = bySquarePayload({ ...transfer, reference: 'INV-2026-000042' });

    expect(decode(payload ?? '').invoiceId).toBeUndefined();
  });
});

describe('paymentQrs', () => {
  it('offers both standards for a Slovak euro invoice', () => {
    expect(paymentQrs(slovak()).map((code) => code.kind)).toEqual(['bysquare', 'epc']);
  });

  it('builds both payloads out of the document itself', () => {
    const [bysquare, epc] = paymentQrs(slovak());
    const [payment] = decode(bysquare.payload).payments;

    expect(payment.bankAccounts[0].iban).toBe('SK3112000000198742637541'); // BT-84
    expect(payment.amount).toBe(2017); // BT-115
    expect(payment.paymentDueDate).toBe('20260929'); // BT-9
    expect(payment.variableSymbol).toBe('2026000042'); // BT-83, the one that matters
    expect(payment.paymentNote).toBe('FA2026-0042'); // BT-1

    expect(epc.payload.split('\n')).toEqual([
      'BCD',
      '002',
      '1',
      'SCT',
      'TATRSKBX',
      'Slovenské softvérové riešenia, s. r. o.',
      'SK3112000000198742637541',
      'EUR2017.00',
      '',
      '',
      'FA2026-0042',
    ]);
  });

  it('offers the EPC code alone to a euro invoice from outside Slovakia', () => {
    // base-example bills in euro from a GB account: SEPA, but no reason for the
    // Slovak code.
    const codes = paymentQrs(sample('base-example.xml'));

    expect(codes.map((code) => code.kind)).toEqual(['epc']);
    expect(codes[0].payload.split('\n').slice(4, 8)).toEqual([
      'WESTGB2L',
      'AccountName',
      'GB82WEST12345698765432',
      'EUR1656.25',
    ]);
  });

  it('offers nothing for a real IBAN billed in another currency', () => {
    // Both have a valid IBAN, and in both the currency rules the EPC code out while
    // nothing makes the document Slovak.
    expect(paymentQrs(sample('Norwegian-example-1.xml'))).toEqual([]); // NOK
    expect(paymentQrs(sample('vat-category-E.xml'))).toEqual([]); // GBP
  });

  it('offers nothing on the credit note, whatever its account says', () => {
    expect(paymentQrs(sample('base-creditnote-correction.xml'))).toEqual([]);
  });

  it('never puts a payment code on a credit note', () => {
    const creditNote: UblDocument = { ...slovak(), isCreditNote: true };

    expect(paymentQrs(creditNote)).toEqual([]);
  });

  it('needs an amount to pay', () => {
    const invoice = slovak();

    expect(paymentQrs({ ...invoice, totals: { ...invoice.totals, payable: 0 } })).toEqual([]);
    expect(paymentQrs({ ...invoice, totals: { ...invoice.totals, payable: -5 } })).toEqual([]);
  });

  it('falls back to the supplier when the account carries no holder name', () => {
    const invoice = slovak();
    const stripped: UblDocument = {
      ...invoice,
      paymentMeans: invoice.paymentMeans.map((pm) => ({ ...pm, accountName: '' })),
    };
    const [, epc] = paymentQrs(stripped);

    expect(epc.payload.split('\n')[5]).toBe(invoice.supplier.name);
  });

  it('offers PAY by square to a Slovak supplier holding a foreign account', () => {
    const invoice = slovak();
    const austrian: UblDocument = {
      ...invoice,
      paymentMeans: invoice.paymentMeans.map((pm) => ({
        ...pm,
        account: 'AT611904300234573201',
        bic: '',
      })),
    };

    expect(paymentQrs(austrian).map((code) => code.kind)).toEqual(['bysquare', 'epc']);
  });
});

describe('qrMatrix', () => {
  it('encodes a base32hex payload in alphanumeric mode', () => {
    const payload = bySquarePayload(transfer) ?? '';
    const alphanumeric = qrMatrix(payload);
    // The same characters forced through byte mode need a larger symbol; that the
    // alphanumeric one is smaller is the proof the mode was actually chosen.
    const asBytes = qrMatrix(`${payload.toLowerCase()}`);

    expect(alphanumeric.count).toBeLessThan(asBytes.count);
  });

  it('carries multi-byte characters through as UTF-8, not as truncated code units', () => {
    // qrcode-generator's byte mode keeps the low byte of each code unit, so "š" would
    // otherwise become 0x61 and the payload would decode to the wrong name.
    const one = qrMatrix('š');
    const other = qrMatrix('a');

    expect(one.path).not.toBe(other.path);
  });

  it('gives back a path over a square grid of odd side', () => {
    const { count, path } = qrMatrix(epcPayload(transfer) ?? '');

    // Every QR version is (4v + 17) modules a side, which is always odd.
    expect(count % 2).toBe(1);
    expect(count).toBeGreaterThanOrEqual(21);
    expect(path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });

  it('draws the top-left finder pattern, which is the same in every code', () => {
    const { path } = qrMatrix('anything');

    // Row 0 opens with the seven dark modules of the finder.
    expect(path.startsWith('M0 0h7v1h-7z')).toBe(true);
  });

  it('loses no module when the grid is folded into runs', () => {
    // The path packs each horizontal run of dark modules into one rectangle. Read it
    // back into a grid and compare against the generator, which is the only thing
    // standing between a subtle off-by-one and a code that scans as something else.
    const { count, path } = qrMatrix(epcPayload(transfer) ?? '');
    const grid = Array.from({ length: count }, () => Array<boolean>(count).fill(false));

    for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let col = Number(x); col < Number(x) + Number(width); col += 1) {
        grid[Number(y)][col] = true;
      }
    }

    const reference = qrcode(0, 'M');
    reference.addData(
      String.fromCharCode(...new TextEncoder().encode(epcPayload(transfer) ?? '')),
      'Byte',
    );
    reference.make();

    expect(reference.getModuleCount()).toBe(count);
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        expect(grid[row][col]).toBe(reference.isDark(row, col));
      }
    }
  });

  it('is stable for the same payload', () => {
    expect(qrMatrix('BCD').path).toBe(qrMatrix('BCD').path);
  });
});
