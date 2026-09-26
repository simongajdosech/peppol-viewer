import { encode as encodeBySquare, PaymentOptions } from 'bysquare/pay';
import qrcode from 'qrcode-generator';
import type { UblDocument } from './ubl';

/**
 * Payment QR codes for the payment band.
 *
 * Two standards, picked by what the document actually supports:
 *
 * - **PAY by square** (Slovak Banking Association) — the code every Slovak banking app
 *   reads. Any currency, any IBAN, but only useful to an SK/CZ payer.
 * - **EPC069-12** ("SEPA QR", "GiroCode") — a SEPA credit transfer. Euro only, by the
 *   standard's own definition, so it is offered whenever the document is in EUR.
 *
 * A Slovak euro invoice therefore offers both, which is the common case here.
 *
 * Everything in this module is pure and **locale-free on purpose**. `i18n.ts` labels
 * the codes, but nothing inside a payload may change with the viewer's language — the
 * payer would otherwise scan a different transfer depending on which language the
 * document happened to be shown in.
 *
 * Nothing here guesses. A payload is built only from fields the document states, and
 * if any part of it would be invalid the whole QR is dropped: a code that scans into
 * an incomplete transfer is worse than no code at all.
 */

/* ---------- IBAN ---------- */

/**
 * IBAN length by country, ISO 13616. Only the length is listed — the national
 * structure (which positions are letters) is not checked, because the mod-97 check
 * digits already catch a mistyped account and the structure table is the part that
 * goes stale.
 */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21,
  LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28,
  NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
};

/** Upper-cased with the grouping spaces a human writes taken out. */
export function normaliseIban(text: string): string {
  return text.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * ISO 13616: two letters, two check digits, a national part of the length this
 * country uses, and a mod-97 remainder of 1 over the rotated, alphabet-expanded form.
 *
 * Several of the bundled samples carry placeholders like `IBAN32423940` in
 * `PayeeFinancialAccount/ID`, which is exactly what this has to reject.
 */
export function isIban(text: string): boolean {
  const iban = normaliseIban(text);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (iban.length !== IBAN_LENGTHS[iban.slice(0, 2)]) return false;

  const rotated = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rotated) {
    // 'A' expands to 10 … 'Z' to 35; the running remainder keeps this inside Number.
    const value = character >= 'A' ? character.charCodeAt(0) - 55 : Number(character);
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

/** ISO 9362: 4 letters bank, 2 letters country, 2 alphanumeric location, optional branch. */
const isBic = (text: string) => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(text);

/* ---------- the Slovak payment symbols ---------- */

export type PaymentSymbols = {
  /** VS — what a Slovak payer is actually matched on. */
  variable: string;
  /** KS — a four-digit purpose code defined by the National Bank of Slovakia. */
  constant: string;
  /** SS — a secondary reference, by agreement between the two parties. */
  specific: string;
};

/**
 * Slovak payments are reconciled on three numeric symbols, and EN 16931 has a field
 * for none of them: BIS carries only BT-83, `cbc:PaymentID`. UBL does allow that
 * element to repeat, and that is where SK senders put the rest. The convention read
 * here, which is what they write:
 *
 * ```xml
 * <cbc:PaymentID>2026000042</cbc:PaymentID>    <!-- bare digits: variable symbol -->
 * <cbc:PaymentID>VS2026000042</cbc:PaymentID>  <!-- variable symbol, named -->
 * <cbc:PaymentID>KS0308</cbc:PaymentID>        <!-- constant symbol -->
 * <cbc:PaymentID>SS123456</cbc:PaymentID>      <!-- specific symbol -->
 * ```
 *
 * A prefix may be followed by a space, colon, dot or dash. Anything that fits none of
 * these shapes — a free-text reference such as `Snippet1` — is left out of the QR and
 * only printed in the payment band, because a bank would reject it in a symbol field.
 */
export function paymentSymbols(paymentIds: string[]): PaymentSymbols {
  const symbols: PaymentSymbols = { variable: '', constant: '', specific: '' };
  const limits = { variable: 10, constant: 4, specific: 10 };
  const named: Record<string, keyof PaymentSymbols> = {
    VS: 'variable',
    KS: 'constant',
    SS: 'specific',
  };

  for (const raw of paymentIds) {
    const id = raw.trim();
    const match = /^(VS|KS|SS)[\s:.-]*(\d+)$/i.exec(id);
    const field = match ? named[match[1].toUpperCase()] : /^\d+$/.test(id) ? 'variable' : null;
    if (!field) continue;

    const digits = match ? match[2] : id;
    // The first one of each kind wins, and an over-long value is dropped rather than
    // truncated — half a symbol matches nothing.
    if (!symbols[field] && digits.length <= limits[field]) symbols[field] = digits;
  }

  return symbols;
}

/* ---------- the payloads ---------- */

export type PaymentQrKind = 'bysquare' | 'epc';

export type PaymentQr = {
  kind: PaymentQrKind;
  /** The exact string encoded into the matrix. */
  payload: string;
};

/** What both payloads are built from, once the document has been found usable. */
type Transfer = {
  iban: string;
  bic: string;
  beneficiary: string;
  amount: number;
  currency: string;
  /** ISO date, as the document writes it. */
  dueDate: string;
  reference: string;
  symbols: PaymentSymbols;
};

/** Both standards cap the beneficiary name at 70 characters. */
const NAME_LIMIT = 70;

/**
 * EPC069-12 version 002: twelve LF-separated lines, at most 331 bytes in total.
 *
 * Line 3 declares the character set, and `1` is UTF-8, so the accented forms of a
 * name survive. Trailing empty lines are omitted, which the standard permits and
 * which buys back room against the byte cap.
 */
export function epcPayload(transfer: Transfer): string | null {
  // The scheme is a SEPA credit transfer, which is settled in euro and nothing else.
  if (transfer.currency !== 'EUR') return null;
  if (transfer.amount < 0.01 || transfer.amount > 999999999.99) return null;

  const lines = [
    'BCD',
    '002',
    '1',
    'SCT',
    isBic(transfer.bic) ? transfer.bic : '',
    transfer.beneficiary.slice(0, NAME_LIMIT),
    transfer.iban,
    `EUR${transfer.amount.toFixed(2)}`,
    '', // purpose (AT-44), which a Peppol invoice does not carry
    '', // structured creditor reference; this viewer has nothing to put in it
    transfer.reference.slice(0, 140),
    '', // beneficiary-to-originator information
  ];

  while (lines[lines.length - 1] === '') lines.pop();
  const payload = lines.join('\n');

  return new TextEncoder().encode(payload).length <= 331 ? payload : null;
}

/**
 * PAY by square, through the `bysquare` package: CRC32, LZMA, then base32hex over a
 * tab-separated record. The result is the compact upper-case string in the QR.
 *
 * `deburr` is left at its default. Diacritics are stripped from the payload because a
 * good few Slovak banking apps mis-decode them; the band beside the code still prints
 * the name in full.
 */
export function bySquarePayload(transfer: Transfer): string | null {
  try {
    return encodeBySquare({
      // Field #1 is capped at 10 characters, and an invoice number is often longer.
      invoiceId: transfer.reference.length <= 10 ? transfer.reference : undefined,
      payments: [
        {
          type: PaymentOptions.PaymentOrder,
          amount: transfer.amount,
          currencyCode: transfer.currency,
          paymentDueDate: transfer.dueDate.replace(/-/g, ''),
          variableSymbol: transfer.symbols.variable,
          constantSymbol: transfer.symbols.constant,
          specificSymbol: transfer.symbols.specific,
          paymentNote: transfer.reference.slice(0, 140),
          bankAccounts: [
            { iban: transfer.iban, ...(isBic(transfer.bic) ? { bic: transfer.bic } : {}) },
          ],
          beneficiary: { name: transfer.beneficiary.slice(0, NAME_LIMIT) },
        },
      ],
    });
  } catch {
    // encode() validates the model and throws on anything a bank would reject. The
    // document simply goes without a code.
    return null;
  }
}

/**
 * The QR codes this document supports, in the order they should be shown.
 *
 * Empty when there is nothing safe to encode: a credit note (the money moves the other
 * way, so a payment code would be a lie), no payable amount, no usable IBAN, or no
 * beneficiary name — which both standards require.
 */
export function paymentQrs(invoice: UblDocument): PaymentQr[] {
  if (invoice.isCreditNote) return [];

  const amount = invoice.totals.payable;
  if (!(amount > 0)) return [];

  const means = invoice.paymentMeans.find((pm) => isIban(pm.account));
  if (!means) return [];

  const beneficiary = means.accountName || invoice.supplier.name;
  if (!beneficiary) return [];

  const symbols = paymentSymbols(means.paymentIds);
  const transfer: Transfer = {
    iban: normaliseIban(means.account),
    bic: means.bic.toUpperCase(),
    beneficiary,
    amount,
    currency: invoice.currency,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(invoice.dueDate) ? invoice.dueDate : '',
    // BT-1 is what the seller and the payer both call this document; the symbols carry
    // the machine-readable side of the same thing.
    reference: invoice.id,
    symbols,
  };

  const slovak =
    transfer.iban.startsWith('SK') || invoice.supplier.address.country.toUpperCase() === 'SK';

  const codes: PaymentQr[] = [];
  const add = (kind: PaymentQrKind, payload: string | null) => {
    if (payload) codes.push({ kind, payload });
  };

  if (slovak) add('bysquare', bySquarePayload(transfer));
  add('epc', epcPayload(transfer));

  return codes;
}

/* ---------- the matrix ---------- */

export type QrMatrix = {
  /** Modules per side, quiet zone excluded. */
  count: number;
  /** SVG path data, one module to one unit, origin at the top-left module. */
  path: string;
};

/** The characters QR alphanumeric mode can hold; base32hex is a subset of them. */
const ALPHANUMERIC = /^[0-9A-Z $%*+\-./:]*$/;

/**
 * The module grid for a payload, as a single SVG path.
 *
 * One path rather than a few thousand rects: `@react-pdf` turns every element into its
 * own drawing operation, and a 57-module code is 3,249 of them.
 *
 * Error correction level M for both standards, which is what each recommends and what
 * survives a phone camera held over a printed page.
 */
export function qrMatrix(payload: string): QrMatrix {
  const qr = qrcode(0, 'M');

  if (ALPHANUMERIC.test(payload)) {
    // A base32hex PAY by square string is ~40% smaller in this mode than as bytes.
    qr.addData(payload, 'Alphanumeric');
  } else {
    // qrcode-generator's byte mode takes the low byte of each code unit, so anything
    // outside Latin-1 has to arrive already encoded. EPC line 3 declares UTF-8.
    const utf8 = new TextEncoder().encode(payload);
    qr.addData(String.fromCharCode(...utf8), 'Byte');
  }
  qr.make();

  const count = qr.getModuleCount();
  const parts: string[] = [];

  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        // One run of dark modules as a rectangle a module high.
        parts.push(`M${start} ${row}h${col - start}v1h-${col - start}z`);
        start = -1;
      }
    }
  }

  return { count, path: parts.join('') };
}
