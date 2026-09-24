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
  documentNo: string;
  supplier: string;
  billTo: string;
  creditTo: string;
  payee: string;
  taxRepresentative: string;
  deliverTo: string;
  details: string;
  issued: string;
  due: string;
  delivered: string;
  taxPoint: string;
  period: string;
  currency: string;
  taxCurrency: string;
  typeCode: string;
  buyerRef: string;
  orderRef: string;
  salesOrderRef: string;
  contract: string;
  project: string;
  despatchAdvice: string;
  receiptAdvice: string;
  originatorRef: string;
  precedingInvoice: string;
  costCentre: string;
  companyId: string;
  vatId: string;
  taxRegistration: string;
  legalForm: string;
  partyId: string;
  locationId: string;
  // table
  colNo: string;
  colItem: string;
  colQty: string;
  colPrice: string;
  colVat: string;
  colAmount: string;
  // line detail labels
  itemSellerId: string;
  itemStandardId: string;
  itemClassification: string;
  itemOrigin: string;
  lineOrderRef: string;
  lineObjectRef: string;
  grossPrice: string;
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
  card: string;
  directDebit: string;
  mandate: string;
  debitedAccount: string;
  paymentMeansCode: string;
  paymentReference: string;
  notes: string;
  attachments: string;
  embedded: string;
  // functions
  vatOn: (category: string, percent: string, base: string) => string;
  vatIn: (currency: string) => string;
  pricePer: (quantity: string, unit: string) => string;
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
  documentNo: 'No.',
  supplier: 'Supplier',
  billTo: 'Bill to',
  creditTo: 'Credit to',
  payee: 'Payee',
  taxRepresentative: 'Tax representative',
  deliverTo: 'Deliver to',
  details: 'Details',
  issued: 'Issued',
  due: 'Due',
  delivered: 'Delivered',
  taxPoint: 'Tax point',
  period: 'Period',
  currency: 'Currency',
  taxCurrency: 'VAT currency',
  typeCode: 'Type code',
  buyerRef: 'Buyer ref.',
  orderRef: 'Order ref.',
  salesOrderRef: 'Sales order',
  contract: 'Contract',
  project: 'Project',
  despatchAdvice: 'Despatch advice',
  receiptAdvice: 'Receipt advice',
  originatorRef: 'Originator ref.',
  precedingInvoice: 'Corrects invoice',
  costCentre: 'Cost centre',
  companyId: 'Company ID',
  vatId: 'VAT',
  taxRegistration: 'Tax reg.',
  legalForm: 'Legal form',
  partyId: 'ID',
  locationId: 'Location',
  colNo: '#',
  colItem: 'Description',
  colQty: 'Qty',
  colPrice: 'Unit price',
  colVat: 'VAT',
  colAmount: 'Amount',
  itemSellerId: "Seller's item no.",
  itemStandardId: 'Item no.',
  itemClassification: 'Classification',
  itemOrigin: 'Origin',
  lineOrderRef: 'Order line',
  lineObjectRef: 'Object ref.',
  grossPrice: 'Gross',
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
  card: 'Card',
  directDebit: 'Direct debit',
  mandate: 'Mandate',
  debitedAccount: 'Debited account',
  paymentMeansCode: 'Payment means',
  paymentReference: 'Reference',
  notes: 'Notes',
  attachments: 'Attachments & references',
  embedded: 'embedded',
  vatOn: (category, percent, base) => `VAT ${category}${percent ? ` ${percent}` : ''} on ${base}`,
  vatIn: (currency) => `VAT total in ${currency}`,
  pricePer: (quantity, unit) => `per ${quantity}${unit ? ` ${unit}` : ''}`,
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
  documentNo: 'Číslo',
  supplier: 'Dodávateľ',
  billTo: 'Odberateľ',
  creditTo: 'Odberateľ',
  payee: 'Príjemca platby',
  taxRepresentative: 'Daňový zástupca',
  deliverTo: 'Miesto dodania',
  details: 'Údaje o doklade',
  issued: 'Dátum vystavenia',
  due: 'Dátum splatnosti',
  delivered: 'Dátum dodania',
  taxPoint: 'Dátum daňovej povinnosti',
  period: 'Fakturované obdobie',
  currency: 'Mena',
  taxCurrency: 'Mena DPH',
  typeCode: 'Kód typu',
  buyerRef: 'Referencia odberateľa',
  orderRef: 'Objednávka',
  salesOrderRef: 'Predajná objednávka',
  contract: 'Zmluva',
  project: 'Projekt',
  despatchAdvice: 'Dodací list',
  receiptAdvice: 'Príjemka',
  originatorRef: 'Referencia zadávateľa',
  precedingInvoice: 'Opravovaná faktúra',
  costCentre: 'Nákladové stredisko',
  companyId: 'IČO',
  vatId: 'IČ DPH',
  taxRegistration: 'Daňová registrácia',
  legalForm: 'Právna forma',
  partyId: 'Identifikátor',
  locationId: 'Miesto',
  colNo: 'Č.',
  colItem: 'Popis',
  colQty: 'Množstvo',
  colPrice: 'Jedn. cena',
  colVat: 'DPH',
  colAmount: 'Suma',
  itemSellerId: 'Kód dodávateľa',
  itemStandardId: 'Štandardný kód',
  itemClassification: 'Klasifikácia',
  itemOrigin: 'Krajina pôvodu',
  lineOrderRef: 'Riadok objednávky',
  lineObjectRef: 'Referencia objektu',
  grossPrice: 'Cenníková cena',
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
  card: 'Karta',
  directDebit: 'Inkaso',
  mandate: 'Mandát',
  debitedAccount: 'Zaťažovaný účet',
  paymentMeansCode: 'Spôsob úhrady',
  paymentReference: 'Variabilný symbol',
  notes: 'Poznámky',
  attachments: 'Prílohy a odkazy',
  embedded: 'vložená príloha',
  vatOn: (category, percent, base) =>
    `DPH ${category}${percent ? ` ${percent}` : ''} zo základu ${base}`,
  vatIn: (currency) => `DPH celkom v ${currency}`,
  pricePer: (quantity, unit) => `za ${quantity}${unit ? ` ${unit}` : ''}`,
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
  country: (code: string) => string;
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

  // ISO country codes read better spelled out in the reader's language.
  const country = (code: string) => {
    if (code.length !== 2) return code;
    try {
      return regions.of(code.toUpperCase()) ?? code;
    } catch {
      return code; /* unknown region code: keep the raw value */
    }
  };

  const address = (addr: Address) => {
    const locality = [addr.postalZone, addr.city].filter(Boolean).join(' ');
    return [...addr.lines, locality, addr.subentity, country(addr.country)].filter(Boolean);
  };

  return { ...DICT[locale], money, quantity, percent, date, country, address };
}
