/**
 * The code lists a Peppol document speaks in. Each table maps the code as it appears in
 * the XML to a key looked up in the locale dictionaries — the tables stay language
 * neutral, the wording lives in `i18n.ts`.
 *
 * None of these lists is exhaustive: they cover what actually turns up in Peppol BIS
 * Billing 3.0 traffic. Anything unlisted falls back to the raw code rather than
 * disappearing, so an unusual document still prints what it said.
 */

/** UN/ECE Recommendation 20 / 21 unit codes (BT-130). */
export const UNIT_CODES: Record<string, string> = {
  // countable
  C62: 'unitPiece',
  H87: 'unitPiece',
  EA: 'unitPiece',
  NAR: 'unitPiece',
  SET: 'unitSet',
  PR: 'unitPair',
  XBX: 'unitBox',
  XPK: 'unitPackage',
  // time
  SEC: 'unitSecond',
  MIN: 'unitMinute',
  HUR: 'unitHour',
  DAY: 'unitDay',
  WEE: 'unitWeek',
  MON: 'unitMonth',
  ANN: 'unitYear',
  // mass
  GRM: 'unitGram',
  KGM: 'unitKilogram',
  TNE: 'unitTonne',
  // length, area, volume
  MMT: 'unitMillimetre',
  CMT: 'unitCentimetre',
  MTR: 'unitMetre',
  KMT: 'unitKilometre',
  MTK: 'unitSquareMetre',
  MTQ: 'unitCubicMetre',
  MLT: 'unitMillilitre',
  LTR: 'unitLitre',
  // energy
  KWH: 'unitKilowattHour',
  MWH: 'unitMegawattHour',
  // other
  P1: 'unitPercent',
};

/** UNTDID 1001 document type codes (BT-3). */
export const DOCUMENT_TYPE_CODES: Record<string, string> = {
  '71': 'typeRequestForPayment',
  '80': 'typeDebitNoteGoods',
  '82': 'typeMeteredServices',
  '84': 'typeDebitNoteFinancial',
  '102': 'typeTaxNotification',
  '218': 'typeFinalPayment',
  '219': 'typeProgressPayment',
  '326': 'typePartialInvoice',
  '380': 'typeCommercialInvoice',
  '381': 'typeCreditNote',
  '382': 'typeCommissionNote',
  '383': 'typeDebitNote',
  '384': 'typeCorrectedInvoice',
  '385': 'typeConsolidatedInvoice',
  '386': 'typePrepaymentInvoice',
  '387': 'typeHireInvoice',
  '388': 'typeTaxInvoice',
  '389': 'typeSelfBilledInvoice',
  '393': 'typeFactoredInvoice',
  '395': 'typeConsignmentInvoice',
  '875': 'typePartialConstructionInvoice',
  '876': 'typePartialFinalConstructionInvoice',
  '877': 'typeFinalConstructionInvoice',
};

/** UNTDID 4461 payment means codes (BT-81). */
export const PAYMENT_MEANS_CODES: Record<string, string> = {
  '1': 'meansNotDefined',
  '10': 'meansCash',
  '20': 'meansCheque',
  '30': 'meansCreditTransfer',
  '31': 'meansDebitTransfer',
  '42': 'meansBankAccount',
  '48': 'meansBankCard',
  '49': 'meansDirectDebit',
  '57': 'meansStandingAgreement',
  '58': 'meansSepaCreditTransfer',
  '59': 'meansSepaDirectDebit',
  '68': 'meansOnlinePayment',
  '97': 'meansClearing',
};

/** UNTDID 5305 VAT category codes (BT-95 / BT-102 / BT-118 / BT-151). */
export const VAT_CATEGORY_CODES: Record<string, string> = {
  S: 'vatStandard',
  Z: 'vatZeroRated',
  E: 'vatExempt',
  AE: 'vatReverseCharge',
  K: 'vatIntraCommunity',
  G: 'vatExport',
  O: 'vatOutOfScope',
  L: 'vatCanaryIslands',
  M: 'vatCeutaMelilla',
};
