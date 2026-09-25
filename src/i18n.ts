import {
  DOCUMENT_TYPE_CODES,
  PAYMENT_MEANS_CODES,
  UNIT_CODES,
  VAT_CATEGORY_CODES,
} from './codes';
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
  /** Names of the two payment QR standards; brand names, so not translated. */
  qrBySquare: string;
  qrEpc: string;
  notes: string;
  attachments: string;
  embedded: string;
  embeddedAttachments: string;
  attachmentDownload: string;
  attachmentBroken: (name: string) => string;
  // functions
  vatOn: (category: string, percent: string, base: string) => string;
  vatIn: (currency: string) => string;
  pricePer: (quantity: string, unit: string) => string;
  // app chrome
  appTagline: string;
  openOwnFile: string;
  dropHint: string;
  showXml: string;
  showDocument: string;
  paymentQr: string;
  download: string;
  rendering: string;
  loadingDocument: string;
  /**
   * "page" in each form the language has, keyed by CLDR plural category. `Intl` picks
   * the category; this is only the wording, which is the part a dictionary owns.
   */
  pageForms: Partial<Record<Intl.LDMLPluralRule, string>>;
  language: string;
  // code list wording, keyed by the semantic keys in codes.ts
  codes: Record<string, string>;
  // business rule wording, keyed by Finding.key in validate.ts
  rules: Record<string, string>;
  // validation panel
  checks: string;
  checksPassed: string;
  checksFailed: (errors: number) => string;
  checksAdvisory: (warnings: number) => string;
  ruleExpected: string;
  ruleStated: string;
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
  qrBySquare: 'PAY by square',
  qrEpc: 'SEPA QR',
  notes: 'Notes',
  attachments: 'Attachments & references',
  embedded: 'embedded',
  embeddedAttachments: 'Attached files',
  attachmentDownload: 'Save this file',
  attachmentBroken: (name) => `${name} could not be decoded: the sender's base64 is malformed.`,
  vatOn: (category, percent, base) => `VAT ${category}${percent ? ` ${percent}` : ''} on ${base}`,
  vatIn: (currency) => `VAT total in ${currency}`,
  pricePer: (quantity, unit) => `per ${quantity}${unit ? ` ${unit}` : ''}`,
  appTagline: 'UBL / Peppol BIS Billing 3.0 → printable document',
  openOwnFile: 'Open your own XML…',
  dropHint: 'Drop an XML file to open it',
  showXml: 'Show XML',
  showDocument: 'Show document',
  paymentQr: 'Payment QR',
  download: 'Download PDF',
  rendering: 'Rendering…',
  loadingDocument: 'Loading document…',
  pageForms: { one: 'page', other: 'pages' },
  language: 'Language',
  codes: {
    // units — the label stands alone, the code itself says nothing to a reader
    unitPiece: 'pcs',
    unitSet: 'sets',
    unitPair: 'pairs',
    unitBox: 'boxes',
    unitPackage: 'packages',
    unitSecond: 's',
    unitMinute: 'min',
    unitHour: 'h',
    unitDay: 'days',
    unitWeek: 'weeks',
    unitMonth: 'months',
    unitYear: 'years',
    unitGram: 'g',
    unitKilogram: 'kg',
    unitTonne: 't',
    unitMillimetre: 'mm',
    unitCentimetre: 'cm',
    unitMetre: 'm',
    unitKilometre: 'km',
    unitSquareMetre: 'm²',
    unitCubicMetre: 'm³',
    unitMillilitre: 'ml',
    unitLitre: 'l',
    unitKilowattHour: 'kWh',
    unitMegawattHour: 'MWh',
    unitPercent: '%',
    // document types
    typeRequestForPayment: 'Request for payment',
    typeDebitNoteGoods: 'Debit note (goods)',
    typeMeteredServices: 'Metered services invoice',
    typeDebitNoteFinancial: 'Debit note (financial)',
    typeTaxNotification: 'Tax notification',
    typeFinalPayment: 'Final payment request',
    typeProgressPayment: 'Progress payment request',
    typePartialInvoice: 'Partial invoice',
    typeCommercialInvoice: 'Commercial invoice',
    typeCreditNote: 'Credit note',
    typeCommissionNote: 'Commission note',
    typeDebitNote: 'Debit note',
    typeCorrectedInvoice: 'Corrected invoice',
    typeConsolidatedInvoice: 'Consolidated invoice',
    typePrepaymentInvoice: 'Prepayment invoice',
    typeHireInvoice: 'Hire invoice',
    typeTaxInvoice: 'Tax invoice',
    typeSelfBilledInvoice: 'Self-billed invoice',
    typeFactoredInvoice: 'Factored invoice',
    typeConsignmentInvoice: 'Consignment invoice',
    typePartialConstructionInvoice: 'Partial construction invoice',
    typePartialFinalConstructionInvoice: 'Partial final construction invoice',
    typeFinalConstructionInvoice: 'Final construction invoice',
    // payment means
    meansNotDefined: 'Not defined',
    meansCash: 'Cash',
    meansCheque: 'Cheque',
    meansCreditTransfer: 'Credit transfer',
    meansDebitTransfer: 'Debit transfer',
    meansBankAccount: 'Payment to bank account',
    meansBankCard: 'Bank card',
    meansDirectDebit: 'Direct debit',
    meansStandingAgreement: 'Standing agreement',
    meansSepaCreditTransfer: 'SEPA credit transfer',
    meansSepaDirectDebit: 'SEPA direct debit',
    meansOnlinePayment: 'Online payment service',
    meansClearing: 'Clearing between partners',
    // VAT categories
    vatStandard: 'Standard rate',
    vatZeroRated: 'Zero rated',
    vatExempt: 'Exempt from VAT',
    vatReverseCharge: 'Reverse charge',
    vatIntraCommunity: 'Intra-community supply',
    vatExport: 'Export, VAT not charged',
    vatOutOfScope: 'Outside the scope of VAT',
    vatCanaryIslands: 'Canary Islands indirect tax',
    vatCeutaMelilla: 'Ceuta and Melilla tax',
  },
  rules: {
    // totals
    sumOfLines: 'The line amounts do not add up to the stated sum of lines',
    allowanceTotal: 'The document allowances do not add up to the stated allowance total',
    chargeTotal: 'The document charges do not add up to the stated charge total',
    taxExclusiveTotal: 'Sum of lines less allowances plus charges is not the total excl. VAT',
    vatTotal: 'The VAT breakdown does not add up to the stated VAT total',
    taxInclusiveTotal: 'Total excl. VAT plus VAT is not the stated total incl. VAT',
    payableTotal: 'Total incl. VAT less prepaid plus rounding is not the amount due',
    // VAT breakdown
    vatCalculation: 'The rate applied to the taxable amount does not give the stated VAT',
    vatRateNotZero: 'A category that charges no VAT must state a rate of zero',
    vatRateZero: 'Standard rated VAT must state a rate above zero',
    vatExemptionReason: 'A category that charges no VAT must give an exemption reason',
    vatBreakdownMissingCategory: 'This category is used in the document but has no VAT breakdown',
    missingVatBreakdown: 'The document has no VAT breakdown at all',
    // required fields
    missingCustomizationId: 'The specification identifier is missing',
    missingId: 'The document number is missing',
    missingIssueDate: 'The issue date is missing',
    missingTypeCode: 'The document type code is missing',
    missingCurrency: 'The document currency is missing',
    missingSellerName: "The seller's name is missing",
    missingBuyerName: "The buyer's name is missing",
    missingSellerAddress: "The seller's postal address is missing",
    missingSellerCountry: "The seller's country code is missing",
    missingBuyerAddress: "The buyer's postal address is missing",
    missingBuyerCountry: "The buyer's country code is missing",
    missingLines: 'The document has no lines',
    missingSellerEndpointScheme: "The seller's electronic address has no scheme identifier",
    missingBuyerEndpointScheme: "The buyer's electronic address has no scheme identifier",
    // code lists
    invalidCurrency: 'The document currency is not an ISO 4217 code',
    invalidTaxCurrency: 'The VAT accounting currency is not an ISO 4217 code',
    // payment
    missingPaymentTerms: 'An amount is payable but there is no due date and no payment terms',
    missingAccount: 'A credit transfer names no account to pay into',
    // advisory
    dueBeforeIssue: 'The due date falls before the issue date',
    noPaymentMeans: 'An amount is payable but the document names no payment means',
  },
  checks: 'Checks',
  checksPassed: 'All checks passed',
  checksFailed: (errors) => `${errors} rule${errors === 1 ? '' : 's'} broken`,
  checksAdvisory: (warnings) => `${warnings} to look at`,
  ruleExpected: 'expected',
  ruleStated: 'document states',
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
  qrBySquare: 'PAY by square',
  qrEpc: 'SEPA QR',
  notes: 'Poznámky',
  attachments: 'Prílohy a odkazy',
  embedded: 'vložená príloha',
  embeddedAttachments: 'Priložené súbory',
  attachmentDownload: 'Uložiť súbor',
  attachmentBroken: (name) => `${name} sa nepodarilo dekódovať: odosielateľov base64 je poškodený.`,
  vatOn: (category, percent, base) =>
    `DPH ${category}${percent ? ` ${percent}` : ''} zo základu ${base}`,
  vatIn: (currency) => `DPH celkom v ${currency}`,
  pricePer: (quantity, unit) => `za ${quantity}${unit ? ` ${unit}` : ''}`,
  appTagline: 'UBL / Peppol BIS Billing 3.0 → tlačový doklad',
  openOwnFile: 'Otvoriť vlastné XML…',
  dropHint: 'Pustite sem XML súbor',
  showXml: 'Zobraziť XML',
  showDocument: 'Zobraziť doklad',
  paymentQr: 'QR platba',
  download: 'Stiahnuť PDF',
  rendering: 'Generujem…',
  loadingDocument: 'Načítavam doklad…',
  // few is 2-4; many is the fractional form, which a page count never reaches;
  // other covers 0 and 5 upwards — the zero the hand-rolled rule used to get wrong.
  pageForms: { one: 'strana', few: 'strany', many: 'strany', other: 'strán' },
  language: 'Jazyk',
  codes: {
    // units — the label stands alone, the code itself says nothing to a reader
    unitPiece: 'ks',
    unitSet: 'súprav',
    unitPair: 'párov',
    unitBox: 'krabíc',
    unitPackage: 'balení',
    unitSecond: 's',
    unitMinute: 'min',
    unitHour: 'hod.',
    unitDay: 'dní',
    unitWeek: 'týždňov',
    unitMonth: 'mesiacov',
    unitYear: 'rokov',
    unitGram: 'g',
    unitKilogram: 'kg',
    unitTonne: 't',
    unitMillimetre: 'mm',
    unitCentimetre: 'cm',
    unitMetre: 'm',
    unitKilometre: 'km',
    unitSquareMetre: 'm²',
    unitCubicMetre: 'm³',
    unitMillilitre: 'ml',
    unitLitre: 'l',
    unitKilowattHour: 'kWh',
    unitMegawattHour: 'MWh',
    unitPercent: '%',
    // document types
    typeRequestForPayment: 'Žiadosť o platbu',
    typeDebitNoteGoods: 'Ťarchopis za tovar',
    typeMeteredServices: 'Faktúra za meranú spotrebu',
    typeDebitNoteFinancial: 'Finančný ťarchopis',
    typeTaxNotification: 'Daňové oznámenie',
    typeFinalPayment: 'Konečná žiadosť o platbu',
    typeProgressPayment: 'Priebežná žiadosť o platbu',
    typePartialInvoice: 'Čiastková faktúra',
    typeCommercialInvoice: 'Obchodná faktúra',
    typeCreditNote: 'Dobropis',
    typeCommissionNote: 'Provízna faktúra',
    typeDebitNote: 'Ťarchopis',
    typeCorrectedInvoice: 'Opravná faktúra',
    typeConsolidatedInvoice: 'Súhrnná faktúra',
    typePrepaymentInvoice: 'Zálohová faktúra',
    typeHireInvoice: 'Faktúra za prenájom',
    typeTaxInvoice: 'Daňový doklad',
    typeSelfBilledInvoice: 'Samofakturácia',
    typeFactoredInvoice: 'Faktoringová faktúra',
    typeConsignmentInvoice: 'Konsignačná faktúra',
    typePartialConstructionInvoice: 'Čiastková stavebná faktúra',
    typePartialFinalConstructionInvoice: 'Čiastková konečná stavebná faktúra',
    typeFinalConstructionInvoice: 'Konečná stavebná faktúra',
    // payment means
    meansNotDefined: 'Neurčené',
    meansCash: 'Hotovosť',
    meansCheque: 'Šek',
    meansCreditTransfer: 'Prevodný príkaz',
    meansDebitTransfer: 'Inkasný prevod',
    meansBankAccount: 'Úhrada na bankový účet',
    meansBankCard: 'Platobná karta',
    meansDirectDebit: 'Inkaso',
    meansStandingAgreement: 'Trvalá dohoda',
    meansSepaCreditTransfer: 'SEPA prevod',
    meansSepaDirectDebit: 'SEPA inkaso',
    meansOnlinePayment: 'Online platba',
    meansClearing: 'Zápočet medzi partnermi',
    // VAT categories
    vatStandard: 'Základná sadzba',
    vatZeroRated: 'Nulová sadzba',
    vatExempt: 'Oslobodené od DPH',
    vatReverseCharge: 'Prenesenie daňovej povinnosti',
    vatIntraCommunity: 'Dodanie do EÚ',
    vatExport: 'Vývoz, DPH sa neúčtuje',
    vatOutOfScope: 'Mimo rozsahu DPH',
    vatCanaryIslands: 'Nepriama daň Kanárskych ostrovov',
    vatCeutaMelilla: 'Daň Ceuty a Melilly',
  },
  rules: {
    // totals
    sumOfLines: 'Súčet súm riadkov nezodpovedá uvedenému súčtu riadkov',
    allowanceTotal: 'Zľavy na doklade nezodpovedajú uvedenému súčtu zliav',
    chargeTotal: 'Príplatky na doklade nezodpovedajú uvedenému súčtu príplatkov',
    taxExclusiveTotal: 'Súčet riadkov mínus zľavy plus príplatky nedáva základ dane',
    vatTotal: 'Rozpis DPH nezodpovedá uvedenej celkovej DPH',
    taxInclusiveTotal: 'Základ dane plus DPH nedáva uvedenú sumu s DPH',
    payableTotal: 'Suma s DPH mínus uhradené vopred plus zaokrúhlenie nedáva sumu na úhradu',
    // VAT breakdown
    vatCalculation: 'Sadzba použitá na základ dane nedáva uvedenú DPH',
    vatRateNotZero: 'Kategória bez DPH musí mať nulovú sadzbu',
    vatRateZero: 'Základná sadzba DPH musí byť vyššia ako nula',
    vatExemptionReason: 'Kategória bez DPH musí uviesť dôvod oslobodenia',
    vatBreakdownMissingCategory: 'Táto kategória je v doklade použitá, ale chýba v rozpise DPH',
    missingVatBreakdown: 'Doklad neobsahuje žiadny rozpis DPH',
    // required fields
    missingCustomizationId: 'Chýba identifikátor špecifikácie',
    missingId: 'Chýba číslo dokladu',
    missingIssueDate: 'Chýba dátum vystavenia',
    missingTypeCode: 'Chýba kód typu dokladu',
    missingCurrency: 'Chýba mena dokladu',
    missingSellerName: 'Chýba názov dodávateľa',
    missingBuyerName: 'Chýba názov odberateľa',
    missingSellerAddress: 'Chýba poštová adresa dodávateľa',
    missingSellerCountry: 'Chýba kód krajiny dodávateľa',
    missingBuyerAddress: 'Chýba poštová adresa odberateľa',
    missingBuyerCountry: 'Chýba kód krajiny odberateľa',
    missingLines: 'Doklad neobsahuje žiadne riadky',
    missingSellerEndpointScheme: 'Elektronická adresa dodávateľa nemá identifikátor schémy',
    missingBuyerEndpointScheme: 'Elektronická adresa odberateľa nemá identifikátor schémy',
    // code lists
    invalidCurrency: 'Mena dokladu nie je kód podľa ISO 4217',
    invalidTaxCurrency: 'Mena DPH nie je kód podľa ISO 4217',
    // payment
    missingPaymentTerms: 'Suma je splatná, ale chýba dátum splatnosti aj platobné podmienky',
    missingAccount: 'Prevodný príkaz neuvádza účet na úhradu',
    // advisory
    dueBeforeIssue: 'Dátum splatnosti je skôr ako dátum vystavenia',
    noPaymentMeans: 'Suma je splatná, ale doklad neuvádza spôsob úhrady',
  },
  checks: 'Kontroly',
  checksPassed: 'Všetky kontroly prešli',
  checksFailed: (errors) =>
    `${errors} ${errors === 1 ? 'porušené pravidlo' : errors < 5 ? 'porušené pravidlá' : 'porušených pravidiel'}`,
  checksAdvisory: (warnings) => `${warnings} na pozretie`,
  ruleExpected: 'očakávané',
  ruleStated: 'doklad uvádza',
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
  /** A file size, scaled to B / kB / MB. */
  bytes: (size: number) => string;
  /** "3 pages" / "3 strany", with the plural form `Intl` says the language wants. */
  pageCount: (n: number) => string;
  /** BT-130 unit: the label alone — "C62" tells a reader nothing, "pcs" does. */
  unit: (code: string) => string;
  /** BT-3 document type, as "380 - Commercial invoice". */
  documentType: (code: string) => string;
  /** BT-81 payment means; the sender's own BT-82 name wins over the code list. */
  paymentMeans: (code: string, name: string) => string;
  /** BT-95 VAT category, as "S - Standard rate". */
  vatCategory: (code: string) => string;
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

  // The unit stays SI in both languages; only the number is formatted, so Slovak gets
  // its decimal comma. Anything under a kilobyte is a whole number of bytes.
  const bytes = (size: number) => {
    const [scaled, unit, decimals] =
      size < 1000
        ? [size, 'B', 0]
        : size < 1000 * 1000
          ? [size / 1000, 'kB', 1]
          : [size / 1000 / 1000, 'MB', 1];

    const formatted = new Intl.NumberFormat(tag, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(scaled);

    return `${formatted} ${unit}`;
  };

  // Slovak has three forms and picks "strán" for both zero and five upwards, which a
  // hand-rolled `n < 5` rule gets wrong at zero. CLDR already knows all of this.
  const plurals = new Intl.PluralRules(tag);
  const pageCount = (n: number) => {
    const forms = DICT[locale].pageForms;
    return `${n} ${forms[plurals.select(n)] ?? forms.other ?? ''}`;
  };

  const address = (addr: Address) => {
    const locality = [addr.postalZone, addr.city].filter(Boolean).join(' ');
    return [...addr.lines, locality, addr.subentity, country(addr.country)].filter(Boolean);
  };

  const strings = DICT[locale];

  /** The wording for a code, or '' when this code list does not cover it. */
  const label = (table: Record<string, string>, code: string) =>
    (code && strings.codes[table[code]]) || '';

  // An unknown code always survives as itself — a document must not lose what it said
  // just because a list here is incomplete.
  const unit = (code: string) => label(UNIT_CODES, code) || code;

  /** "380 - Commercial invoice", keeping the code the sender actually wrote. */
  const withCode = (table: Record<string, string>, code: string, name = '') => {
    const text = name || label(table, code);
    if (!code) return text;
    return text ? `${code} - ${text}` : code;
  };

  const documentType = (code: string) => withCode(DOCUMENT_TYPE_CODES, code);
  const paymentMeans = (code: string, name: string) =>
    withCode(PAYMENT_MEANS_CODES, code, name);
  const vatCategory = (code: string) => withCode(VAT_CATEGORY_CODES, code);

  return {
    ...strings,
    money,
    quantity,
    percent,
    date,
    country,
    address,
    bytes,
    pageCount,
    unit,
    documentType,
    paymentMeans,
    vatCategory,
  };
}
