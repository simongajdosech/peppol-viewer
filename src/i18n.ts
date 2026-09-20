import type { Address } from './ubl';

export type Locale = 'en' | 'sk';

export const LOCALES: { code: Locale; label: string; tag: string }[] = [
  { code: 'en', label: 'English', tag: 'en-GB' },
  { code: 'sk', label: 'Slovenčina', tag: 'sk-SK' },
];

const TAG: Record<Locale, string> = { en: 'en-GB', sk: 'sk-SK' };

/* ---------- strings ---------- */

export type Strings = {
  // document
  invoice: string;
  creditNote: string;
  supplier: string;
  billTo: string;
  creditTo: string;
  details: string;
  issued: string;
  due: string;
  delivered: string;
  period: string;
  currency: string;
  typeCode: string;
  buyerRef: string;
  orderRef: string;
  contract: string;
  costCentre: string;
  companyId: string;
  vatId: string;
  // table
  colNo: string;
  colItem: string;
  colQty: string;
  colPrice: string;
  colVat: string;
  colAmount: string;
  // totals
  sumOfLines: string;
  allowance: string;
  charge: string;
  totalExclVat: string;
  totalInclVat: string;
  prepaid: string;
  rounding: string;
  amountDue: string;
  // blocks
  vatExemption: string;
  payment: string;
  account: string;
  paymentReference: string;
  notes: string;
  // functions
  vatOn: (category: string, percent: string, base: string) => string;
  page: (current: number, total: number) => string;
  // app chrome
  appTagline: string;
  openOwnFile: string;
  showXml: string;
  showDocument: string;
  download: string;
  rendering: string;
  loadingDocument: string;
  pageCount: (n: number) => string;
  language: string;
};

const en: Strings = {
  invoice: 'Invoice',
  creditNote: 'Credit Note',
  supplier: 'Supplier',
  billTo: 'Bill to',
  creditTo: 'Credit to',
  details: 'Details',
  issued: 'Issued',
  due: 'Due',
  delivered: 'Delivered',
  period: 'Period',
  currency: 'Currency',
  typeCode: 'Type code',
  buyerRef: 'Buyer ref.',
  orderRef: 'Order ref.',
  contract: 'Contract',
  costCentre: 'Cost centre',
  companyId: 'Company ID',
  vatId: 'VAT',
  colNo: '#',
  colItem: 'Description',
  colQty: 'Qty',
  colPrice: 'Unit price',
  colVat: 'VAT',
  colAmount: 'Amount',
  sumOfLines: 'Sum of line amounts',
  allowance: 'Allowance',
  charge: 'Charge',
  totalExclVat: 'Total excl. VAT',
  totalInclVat: 'Total incl. VAT',
  prepaid: 'Prepaid',
  rounding: 'Rounding',
  amountDue: 'Amount due',
  vatExemption: 'VAT exemption',
  payment: 'Payment',
  account: 'Account',
  paymentReference: 'Reference',
  notes: 'Notes',
  vatOn: (category, percent, base) => `VAT ${category}${percent ? ` ${percent}` : ''} on ${base}`,
  page: (current, total) => `Page ${current} of ${total}`,
  appTagline: 'UBL / Peppol BIS Billing 3.0 → printable document',
  openOwnFile: 'Open your own XML…',
  showXml: 'Show XML',
  showDocument: 'Show document',
  download: 'Download PDF',
  rendering: 'Rendering…',
  loadingDocument: 'Loading document…',
  pageCount: (n) => `${n} page${n === 1 ? '' : 's'}`,
  language: 'Language',
};

const sk: Strings = {
  invoice: 'Faktúra',
  creditNote: 'Dobropis',
  supplier: 'Dodávateľ',
  billTo: 'Odberateľ',
  creditTo: 'Odberateľ',
  details: 'Údaje o doklade',
  issued: 'Dátum vystavenia',
  due: 'Dátum splatnosti',
  delivered: 'Dátum dodania',
  period: 'Fakturované obdobie',
  currency: 'Mena',
  typeCode: 'Kód typu',
  buyerRef: 'Referencia odberateľa',
  orderRef: 'Objednávka',
  contract: 'Zmluva',
  costCentre: 'Nákladové stredisko',
  companyId: 'IČO',
  vatId: 'IČ DPH',
  colNo: 'Č.',
  colItem: 'Popis',
  colQty: 'Množstvo',
  colPrice: 'Jedn. cena',
  colVat: 'DPH',
  colAmount: 'Suma',
  sumOfLines: 'Súčet riadkov',
  allowance: 'Zľava',
  charge: 'Príplatok',
  totalExclVat: 'Základ dane',
  totalInclVat: 'Celkom s DPH',
  prepaid: 'Uhradené vopred',
  rounding: 'Zaokrúhlenie',
  amountDue: 'Na úhradu',
  vatExemption: 'Oslobodenie od DPH',
  payment: 'Platobné údaje',
  account: 'Účet',
  paymentReference: 'Variabilný symbol',
  notes: 'Poznámky',
  vatOn: (category, percent, base) =>
    `DPH ${category}${percent ? ` ${percent}` : ''} zo základu ${base}`,
  page: (current, total) => `Strana ${current} z ${total}`,
  appTagline: 'UBL / Peppol BIS Billing 3.0 → tlačový doklad',
  openOwnFile: 'Otvoriť vlastné XML…',
  showXml: 'Zobraziť XML',
  showDocument: 'Zobraziť doklad',
  download: 'Stiahnuť PDF',
  rendering: 'Generujem…',
  loadingDocument: 'Načítavam doklad…',
  pageCount: (n) => `${n} ${n === 1 ? 'strana' : n < 5 ? 'strany' : 'strán'}`,
  language: 'Jazyk',
};

const DICT: Record<Locale, Strings> = { en, sk };

/* ---------- locale-aware formatting ---------- */

export type Formatters = {
  money: (amount: number, currency: string) => string;
  quantity: (value: number) => string;
  percent: (value: number) => string;
  date: (iso: string) => string;
  address: (address: Address) => string[];
};

export type Translation = Strings & Formatters;

/**
 * Bundles the label dictionary with Intl formatters for one locale, so the
 * document component never has to know which language it is rendering.
 */
export function translation(locale: Locale): Translation {
  const tag = TAG[locale];
  const regions = new Intl.DisplayNames([tag], { type: 'region' });

  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(tag, {
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined,
      minimumFractionDigits: 2,
    }).format(amount);

  const quantity = (value: number) =>
    new Intl.NumberFormat(tag, { maximumFractionDigits: 4 }).format(value);

  // en writes "23%", sk writes "23 %" with a non-breaking space.
  const percent = (value: number) =>
    new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 2 }).format(value / 100);

  const date = (iso: string) => {
    if (!iso) return '';
    const parsed = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return iso;
    return new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeZone: 'UTC' }).format(parsed);
  };

  const address = (addr: Address) => {
    const locality = [addr.postalZone, addr.city].filter(Boolean).join(' ');
    // ISO country codes read better spelled out in the reader's language.
    let country = addr.country;
    if (country.length === 2) {
      try {
        country = regions.of(country.toUpperCase()) ?? country;
      } catch {
        /* unknown region code: keep the raw value */
      }
    }
    return [...addr.lines, locality, addr.subentity, country].filter(Boolean);
  };

  return { ...DICT[locale], money, quantity, percent, date, address };
}
