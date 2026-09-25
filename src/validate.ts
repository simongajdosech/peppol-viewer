import type { TaxSubtotal, UblDocument } from './ubl';

/**
 * EN 16931 / Peppol BIS Billing 3.0 business rules, checked against a parsed document.
 *
 * Pure functions over `UblDocument` and free of any locale: a finding carries the rule
 * id and the numbers, and `i18n.ts` supplies the wording. That keeps the rule set
 * readable as rules, and lets the same finding be shown in either language.
 *
 * This is not the full rule set — it is the part that can be checked from the document
 * alone, without a registry lookup or a code list that goes stale.
 */

export type Severity = 'error' | 'warning';

export type Finding = {
  /** The rule id as the standard writes it, shown verbatim: 'BR-CO-10', 'BR-E-10'. */
  rule: string;
  /** Key into the rule wording in `i18n.ts`; several rule ids share one description. */
  key: string;
  severity: Severity;
  /** Set when the finding is about one VAT breakdown row. */
  vat?: { category: string; percent: number };
  /** What the document's own parts add up to. */
  expected?: number;
  /** What the document states instead. */
  found?: number;
};

/** Half the smallest unit of a two-decimal currency: the most a stated total may round. */
const TOTALS_TOLERANCE = 0.005;

/**
 * VAT per breakdown row is computed from amounts that were each already rounded, so the
 * error accumulates a little further than a single rounding step.
 */
const VAT_TOLERANCE = 0.02;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Categories that carry no VAT, and so must state why. */
const EXEMPTION_RULES: Record<string, string> = {
  E: 'BR-E',
  AE: 'BR-AE',
  K: 'BR-IC',
  G: 'BR-G',
  O: 'BR-O',
};

/** Rule id prefix per category, for the rules that exist once per VAT category. */
const CATEGORY_RULES: Record<string, string> = {
  S: 'BR-S',
  Z: 'BR-Z',
  ...EXEMPTION_RULES,
};

/**
 * ISO 4217 membership, not just shape. `Intl.NumberFormat` accepts any three letters —
 * "XYZ" included — so it cannot answer this; `DisplayNames` with no fallback returns a
 * name only for a code CLDR actually knows, and throws on a malformed one.
 */
const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency', fallback: 'none' });

const isValidCurrency = (code: string) => {
  try {
    return currencyNames.of(code.toUpperCase()) !== undefined;
  } catch {
    return false; /* not three ASCII letters */
  }
};

export function validate(doc: UblDocument): Finding[] {
  const findings: Finding[] = [];
  const { totals } = doc;

  const add = (rule: string, key: string, extra: Partial<Finding> = {}) =>
    findings.push({ rule, key, severity: 'error', ...extra });

  /** Reports when the parts do not add up to the stated total. */
  const total = (
    rule: string,
    key: string,
    expected: number,
    found: number,
    tolerance = TOTALS_TOLERANCE,
  ) => {
    if (Math.abs(expected - found) > tolerance) add(rule, key, { expected, found });
  };

  const must = (rule: string, key: string, present: unknown) => {
    if (!present) add(rule, key);
  };

  /* ---------- the totals must add up ---------- */

  const allowances = doc.allowanceCharges.filter((ac) => !ac.isCharge);
  const charges = doc.allowanceCharges.filter((ac) => ac.isCharge);

  total('BR-CO-10', 'sumOfLines', sum(doc.lines.map((line) => line.amount)), totals.lineExtension);
  total('BR-CO-11', 'allowanceTotal', sum(allowances.map((a) => a.amount)), totals.allowanceTotal);
  total('BR-CO-12', 'chargeTotal', sum(charges.map((c) => c.amount)), totals.chargeTotal);
  total(
    'BR-CO-13',
    'taxExclusiveTotal',
    totals.lineExtension - totals.allowanceTotal + totals.chargeTotal,
    totals.taxExclusive,
  );
  total(
    'BR-CO-14',
    'vatTotal',
    sum(doc.taxSubtotals.map((tax) => tax.taxAmount)),
    totals.taxAmount,
  );
  total(
    'BR-CO-15',
    'taxInclusiveTotal',
    totals.taxExclusive + totals.taxAmount,
    totals.taxInclusive,
  );
  total(
    'BR-CO-16',
    'payableTotal',
    totals.taxInclusive - totals.prepaid + totals.rounding,
    totals.payable,
  );

  /* ---------- the VAT breakdown ---------- */

  const vatOf = (tax: TaxSubtotal) => ({ category: tax.category, percent: tax.percent });

  for (const tax of doc.taxSubtotals) {
    const prefix = CATEGORY_RULES[tax.category];
    const vat = vatOf(tax);

    // BR-x-08: the rate applied to the taxable amount is the VAT amount.
    if (prefix) {
      const expected = (tax.taxableAmount * tax.percent) / 100;
      if (Math.abs(expected - tax.taxAmount) > VAT_TOLERANCE) {
        add(`${prefix}-08`, 'vatCalculation', { vat, expected, found: tax.taxAmount });
      }
    }

    // BR-x-05: a category that charges no VAT must state a rate of zero, and standard
    // rated VAT must state one above zero.
    if (tax.category in EXEMPTION_RULES || tax.category === 'Z') {
      if (tax.percent !== 0) {
        add(`${CATEGORY_RULES[tax.category]}-05`, 'vatRateNotZero', { vat });
      }
    } else if (tax.category === 'S' && tax.percent <= 0) {
      add('BR-S-05', 'vatRateZero', { vat });
    }

    // BR-x-10: no VAT charged means the document has to say why.
    if (tax.category in EXEMPTION_RULES && !tax.exemptionReason && !tax.exemptionReasonCode) {
      add(`${EXEMPTION_RULES[tax.category]}-10`, 'vatExemptionReason', { vat });
    }
  }

  // BR-x-01: a category used on a line or an allowance needs a breakdown row of its own.
  const breakdownCategories = new Set(doc.taxSubtotals.map((tax) => tax.category));
  const usedCategories = new Set(
    [
      ...doc.lines.map((line) => line.taxCategory),
      ...doc.allowanceCharges.map((ac) => ac.taxCategory),
    ].filter(Boolean),
  );
  for (const category of usedCategories) {
    if (!breakdownCategories.has(category) && CATEGORY_RULES[category]) {
      add(`${CATEGORY_RULES[category]}-01`, 'vatBreakdownMissingCategory', {
        vat: { category, percent: 0 },
      });
    }
  }

  /* ---------- the fields a document cannot do without ---------- */

  must('BR-01', 'missingCustomizationId', doc.customizationId);
  must('BR-02', 'missingId', doc.id);
  must('BR-03', 'missingIssueDate', doc.issueDate);
  must('BR-04', 'missingTypeCode', doc.typeCode);
  must('BR-05', 'missingCurrency', doc.currency);
  must('BR-06', 'missingSellerName', doc.supplier.name);
  must('BR-07', 'missingBuyerName', doc.customer.name);
  must('BR-08', 'missingSellerAddress', doc.supplier.hasAddress);
  must('BR-09', 'missingSellerCountry', doc.supplier.address.country);
  must('BR-10', 'missingBuyerAddress', doc.customer.hasAddress);
  must('BR-11', 'missingBuyerCountry', doc.customer.address.country);
  must('BR-16', 'missingLines', doc.lines.length > 0);
  must('BR-CO-18', 'missingVatBreakdown', doc.taxSubtotals.length > 0);

  // An electronic address is only addressable with the scheme that qualifies it.
  if (doc.supplier.endpointId && !doc.supplier.endpointScheme) {
    add('BR-62', 'missingSellerEndpointScheme');
  }
  if (doc.customer.endpointId && !doc.customer.endpointScheme) {
    add('BR-63', 'missingBuyerEndpointScheme');
  }

  /* ---------- code lists ---------- */

  if (doc.currency && !isValidCurrency(doc.currency)) add('BR-CL-04', 'invalidCurrency');
  if (doc.taxCurrency && !isValidCurrency(doc.taxCurrency)) {
    add('BR-CL-05', 'invalidTaxCurrency');
  }

  /* ---------- payment ---------- */

  // BR-CO-25: something has to tell the buyer when to pay.
  if (totals.payable > 0 && !doc.dueDate && doc.paymentTerms.length === 0) {
    add('BR-CO-25', 'missingPaymentTerms');
  }

  // BR-50: a credit transfer the buyer cannot address is not a payment instruction.
  const CREDIT_TRANSFER = new Set(['30', '58']);
  for (const means of doc.paymentMeans) {
    if (CREDIT_TRANSFER.has(means.code) && !means.account) {
      add('BR-50', 'missingAccount');
    }
  }

  /* ---------- advisory, beyond the standard ---------- */

  if (doc.dueDate && doc.issueDate && doc.dueDate < doc.issueDate) {
    findings.push({ rule: 'DUE-BEFORE-ISSUE', key: 'dueBeforeIssue', severity: 'warning' });
  }
  if (totals.payable > 0 && doc.paymentMeans.length === 0) {
    findings.push({ rule: 'NO-PAYMENT-MEANS', key: 'noPaymentMeans', severity: 'warning' });
  }

  return findings;
}

export const errorsIn = (findings: Finding[]) => findings.filter((f) => f.severity === 'error');
