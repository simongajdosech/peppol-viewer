const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';

/* ---------- namespace-aware, direct-child traversal ---------- */

function kids(el: Element | null, ns: string, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.childNodes).filter(
    (n): n is Element =>
      n.nodeType === 1 &&
      (n as Element).namespaceURI === ns &&
      (n as Element).localName === name,
  );
}

function kid(el: Element | null, ns: string, name: string): Element | null {
  return kids(el, ns, name)[0] ?? null;
}

/** Text of a direct child, e.g. val(party, CBC, 'EndpointID'). */
function val(el: Element | null, ns: string, name: string): string {
  return kid(el, ns, name)?.textContent?.trim() ?? '';
}

/** Text at a nested path of direct children, e.g. [[CAC,'Country'],[CBC,'IdentificationCode']]. */
function path(el: Element | null, steps: [string, string][]): string {
  let node = el;
  for (const [ns, name] of steps.slice(0, -1)) node = kid(node, ns, name);
  const [ns, name] = steps[steps.length - 1];
  return val(node, ns, name);
}

function num(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ---------- model ---------- */

export type Address = {
  lines: string[];
  city: string;
  postalZone: string;
  subentity: string;
  country: string;
};

export type Party = {
  name: string;
  legalName: string;
  companyId: string;
  vatId: string;
  endpointId: string;
  endpointScheme: string;
  address: Address;
  contactName: string;
  phone: string;
  email: string;
};

export type Line = {
  id: string;
  name: string;
  description: string;
  note: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  amount: number;
  taxCategory: string;
  taxPercent: number;
};

export type TaxSubtotal = {
  category: string;
  percent: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReason: string;
};

export type AllowanceCharge = {
  isCharge: boolean;
  reason: string;
  amount: number;
  taxPercent: number;
};

export type PaymentMeans = {
  code: string;
  name: string;
  paymentId: string;
  account: string;
  accountName: string;
  bic: string;
};

export type Totals = {
  lineExtension: number;
  allowanceTotal: number;
  chargeTotal: number;
  taxExclusive: number;
  taxAmount: number;
  taxInclusive: number;
  prepaid: number;
  rounding: number;
  payable: number;
};

export type UblDocument = {
  isCreditNote: boolean;
  title: string;
  id: string;
  issueDate: string;
  dueDate: string;
  typeCode: string;
  currency: string;
  buyerReference: string;
  orderReference: string;
  contractReference: string;
  accountingCost: string;
  periodStart: string;
  periodEnd: string;
  notes: string[];
  supplier: Party;
  customer: Party;
  deliveryDate: string;
  lines: Line[];
  taxSubtotals: TaxSubtotal[];
  allowanceCharges: AllowanceCharge[];
  paymentMeans: PaymentMeans[];
  paymentTerms: string;
  totals: Totals;
};

/* ---------- parsing ---------- */

function parseAddress(parent: Element | null): Address {
  const addr = kid(parent, CAC, 'PostalAddress') ?? kid(parent, CAC, 'Address');
  const lines = [
    val(addr, CBC, 'StreetName'),
    val(addr, CBC, 'AdditionalStreetName'),
    ...kids(addr, CAC, 'AddressLine').map((l) => val(l, CBC, 'Line')),
  ].filter(Boolean);

  return {
    lines,
    city: val(addr, CBC, 'CityName'),
    postalZone: val(addr, CBC, 'PostalZone'),
    subentity: val(addr, CBC, 'CountrySubentity'),
    country: path(addr, [
      [CAC, 'Country'],
      [CBC, 'IdentificationCode'],
    ]),
  };
}

function parseParty(root: Element, wrapper: string): Party {
  const party = kid(kid(root, CAC, wrapper), CAC, 'Party');
  const legal = kid(party, CAC, 'PartyLegalEntity');
  const contact = kid(party, CAC, 'Contact');

  // A party may carry several tax schemes; VAT is the one worth printing.
  const vatScheme = kids(party, CAC, 'PartyTaxScheme').find(
    (s) =>
      path(s, [
        [CAC, 'TaxScheme'],
        [CBC, 'ID'],
      ]).toUpperCase() === 'VAT',
  );

  return {
    name:
      path(party, [
        [CAC, 'PartyName'],
        [CBC, 'Name'],
      ]) || val(legal, CBC, 'RegistrationName'),
    legalName: val(legal, CBC, 'RegistrationName'),
    companyId: val(legal, CBC, 'CompanyID'),
    vatId: val(vatScheme ?? null, CBC, 'CompanyID'),
    endpointId: val(party, CBC, 'EndpointID'),
    endpointScheme: kid(party, CBC, 'EndpointID')?.getAttribute('schemeID') ?? '',
    address: parseAddress(party),
    contactName: val(contact, CBC, 'Name'),
    phone: val(contact, CBC, 'Telephone'),
    email: val(contact, CBC, 'ElectronicMail'),
  };
}

function parseLines(root: Element, isCreditNote: boolean): Line[] {
  const lineTag = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const qtyTag = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';

  return kids(root, CAC, lineTag).map((line) => {
    const item = kid(line, CAC, 'Item');
    const price = kid(line, CAC, 'Price');
    const category = kid(item, CAC, 'ClassifiedTaxCategory');
    const qtyEl = kid(line, CBC, qtyTag);

    // A price may be quoted per N units (BaseQuantity); normalise to per-unit.
    const baseQty = num(val(price, CBC, 'BaseQuantity')) || 1;

    return {
      id: val(line, CBC, 'ID'),
      name: val(item, CBC, 'Name'),
      description: val(item, CBC, 'Description'),
      note: val(line, CBC, 'Note'),
      quantity: num(qtyEl?.textContent ?? ''),
      unitCode: qtyEl?.getAttribute('unitCode') ?? '',
      unitPrice: num(val(price, CBC, 'PriceAmount')) / baseQty,
      amount: num(val(line, CBC, 'LineExtensionAmount')),
      taxCategory: val(category, CBC, 'ID'),
      taxPercent: num(val(category, CBC, 'Percent')),
    };
  });
}

function parseTaxSubtotals(root: Element): TaxSubtotal[] {
  return kids(root, CAC, 'TaxTotal').flatMap((total) =>
    kids(total, CAC, 'TaxSubtotal').map((sub) => {
      const category = kid(sub, CAC, 'TaxCategory');
      return {
        category: val(category, CBC, 'ID'),
        percent: num(val(category, CBC, 'Percent')),
        taxableAmount: num(val(sub, CBC, 'TaxableAmount')),
        taxAmount: num(val(sub, CBC, 'TaxAmount')),
        exemptionReason: val(category, CBC, 'TaxExemptionReason'),
      };
    }),
  );
}

export function parseUbl(xml: string): UblDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const failure = doc.getElementsByTagName('parsererror')[0];
  if (failure) throw new Error(failure.textContent?.trim() || 'Invalid XML');

  const root = doc.documentElement;
  const isCreditNote = root.localName === 'CreditNote';
  const totalsEl = kid(root, CAC, 'LegalMonetaryTotal');
  const period = kid(root, CAC, 'InvoicePeriod');
  const delivery = kid(root, CAC, 'Delivery');

  // A document may repeat TaxTotal in a second (tax) currency; the first is the document one.
  const taxTotals = kids(root, CAC, 'TaxTotal');
  const taxAmount = taxTotals.length ? num(val(taxTotals[0], CBC, 'TaxAmount')) : 0;

  return {
    isCreditNote,
    title: isCreditNote ? 'Credit Note' : 'Invoice',
    id: val(root, CBC, 'ID'),
    issueDate: val(root, CBC, 'IssueDate'),
    dueDate: val(root, CBC, 'DueDate'),
    typeCode: val(root, CBC, isCreditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'),
    currency: val(root, CBC, 'DocumentCurrencyCode'),
    buyerReference: val(root, CBC, 'BuyerReference'),
    orderReference: path(root, [
      [CAC, 'OrderReference'],
      [CBC, 'ID'],
    ]),
    contractReference: path(root, [
      [CAC, 'ContractDocumentReference'],
      [CBC, 'ID'],
    ]),
    accountingCost: val(root, CBC, 'AccountingCost'),
    periodStart: val(period, CBC, 'StartDate'),
    periodEnd: val(period, CBC, 'EndDate'),
    notes: kids(root, CBC, 'Note')
      .map((n) => n.textContent?.trim() ?? '')
      .filter(Boolean),
    supplier: parseParty(root, 'AccountingSupplierParty'),
    customer: parseParty(root, 'AccountingCustomerParty'),
    deliveryDate: val(delivery, CBC, 'ActualDeliveryDate'),
    lines: parseLines(root, isCreditNote),
    taxSubtotals: parseTaxSubtotals(root),
    allowanceCharges: kids(root, CAC, 'AllowanceCharge').map((ac) => ({
      isCharge: val(ac, CBC, 'ChargeIndicator') === 'true',
      reason: val(ac, CBC, 'AllowanceChargeReason'),
      amount: num(val(ac, CBC, 'Amount')),
      taxPercent: num(
        path(ac, [
          [CAC, 'TaxCategory'],
          [CBC, 'Percent'],
        ]),
      ),
    })),
    paymentMeans: kids(root, CAC, 'PaymentMeans').map((pm) => {
      const account = kid(pm, CAC, 'PayeeFinancialAccount');
      return {
        code: val(pm, CBC, 'PaymentMeansCode'),
        name: kid(pm, CBC, 'PaymentMeansCode')?.getAttribute('name') ?? '',
        paymentId: val(pm, CBC, 'PaymentID'),
        account: val(account, CBC, 'ID'),
        accountName: val(account, CBC, 'Name'),
        bic: path(account, [
          [CAC, 'FinancialInstitutionBranch'],
          [CBC, 'ID'],
        ]),
      };
    }),
    paymentTerms: path(root, [
      [CAC, 'PaymentTerms'],
      [CBC, 'Note'],
    ]),
    totals: {
      lineExtension: num(val(totalsEl, CBC, 'LineExtensionAmount')),
      allowanceTotal: num(val(totalsEl, CBC, 'AllowanceTotalAmount')),
      chargeTotal: num(val(totalsEl, CBC, 'ChargeTotalAmount')),
      taxExclusive: num(val(totalsEl, CBC, 'TaxExclusiveAmount')),
      taxAmount,
      taxInclusive: num(val(totalsEl, CBC, 'TaxInclusiveAmount')),
      prepaid: num(val(totalsEl, CBC, 'PrepaidAmount')),
      rounding: num(val(totalsEl, CBC, 'PayableRoundingAmount')),
      payable: num(val(totalsEl, CBC, 'PayableAmount')),
    },
  };
}

/* ---------- display helpers ---------- */

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: currency ? 'currency' : 'decimal',
    currency: currency || undefined,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(quantity);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function formatAddress(address: Address): string[] {
  const locality = [address.postalZone, address.city].filter(Boolean).join(' ');
  return [...address.lines, locality, address.subentity, address.country].filter(Boolean);
}
