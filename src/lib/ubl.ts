const CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';

/** The two document types this parser understands, by root element and namespace. */
const ROOTS = {
  Invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  CreditNote: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
} as const;

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

/** An attribute of a direct child, e.g. attr(party, CBC, 'EndpointID', 'schemeID'). */
function attr(el: Element | null, ns: string, name: string, attribute: string): string {
  return kid(el, ns, name)?.getAttribute(attribute) ?? '';
}

/** Descends through direct children, e.g. [[CAC,'Attachment'],[CAC,'ExternalReference']]. */
function down(el: Element | null, steps: [string, string][]): Element | null {
  let node = el;
  for (const [ns, name] of steps) node = kid(node, ns, name);
  return node;
}

/** Text at a nested path of direct children, e.g. [[CAC,'Country'],[CBC,'IdentificationCode']]. */
function path(el: Element | null, steps: [string, string][]): string {
  const [ns, name] = steps[steps.length - 1];
  return val(down(el, steps.slice(0, -1)), ns, name);
}

function num(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** "0088:7300010000001" when a scheme is present, otherwise the bare identifier. */
function qualified(id: string, scheme: string): string {
  if (!id) return '';
  return scheme ? `${scheme}:${id}` : id;
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
  legalForm: string;
  vatId: string;
  /** BT-32: registration in a non-VAT scheme, e.g. a trade register. */
  taxRegistration: string;
  /** BT-29 / BT-46 / BT-60 / BT-71: additional party identifiers. */
  identifiers: string[];
  endpointId: string;
  endpointScheme: string;
  address: Address;
  hasAddress: boolean;
  contactName: string;
  phone: string;
  email: string;
};

export type ItemProperty = {
  name: string;
  value: string;
};

export type Line = {
  id: string;
  name: string;
  description: string;
  note: string;
  quantity: number;
  unitCode: string;
  /** Net price per single unit — BaseQuantity has already been divided out. */
  unitPrice: number;
  /** BT-149/BT-150: the quantity the quoted price applies to. */
  baseQuantity: number;
  baseQuantityUnit: string;
  /** BT-148: list price before the item price discount. */
  grossPrice: number;
  /** BT-147: discount off the gross price. */
  priceDiscount: number;
  amount: number;
  taxCategory: string;
  taxPercent: number;
  accountingCost: string;
  periodStart: string;
  periodEnd: string;
  orderLineReference: string;
  objectId: string;
  sellerItemId: string;
  standardItemId: string;
  /** BT-158: commodity classifications, each prefixed with its list id. */
  classifications: string[];
  originCountry: string;
  properties: ItemProperty[];
  allowanceCharges: AllowanceCharge[];
};

export type TaxSubtotal = {
  category: string;
  percent: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReason: string;
  exemptionReasonCode: string;
};

export type AllowanceCharge = {
  isCharge: boolean;
  reason: string;
  reasonCode: string;
  amount: number;
  baseAmount: number;
  /** BT-94/BT-101: percentage applied to the base amount. */
  factor: number;
  taxCategory: string;
  taxPercent: number;
};

export type PaymentMeans = {
  code: string;
  name: string;
  /**
   * BT-83. UBL lets the element repeat, and Slovak senders use the extra ones to carry
   * the constant and specific symbols — see `paymentSymbols` in `qr.ts`.
   */
  paymentIds: string[];
  account: string;
  accountName: string;
  bic: string;
  /** BG-18: payment card. */
  cardId: string;
  cardHolder: string;
  cardNetwork: string;
  /** BG-19: direct debit. */
  mandateId: string;
  debitedAccount: string;
};

export type DocumentReference = {
  id: string;
  scheme: string;
  typeCode: string;
  description: string;
  uri: string;
  attachmentFilename: string;
  attachmentMime: string;
  /**
   * BT-125, still base64. Kept encoded: decoding it here would hold a second copy of
   * every embedded file for as long as the document is open, and nothing needs the
   * bytes until someone asks to save them. `attachments.ts` decodes on the click.
   */
  attachmentContent: string;
};

export type Delivery = {
  date: string;
  locationId: string;
  partyName: string;
  address: Address;
  hasAddress: boolean;
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
  customizationId: string;
  profileId: string;
  id: string;
  issueDate: string;
  dueDate: string;
  taxPointDate: string;
  typeCode: string;
  currency: string;
  /** BT-6: currency the VAT total is additionally stated in. */
  taxCurrency: string;
  buyerReference: string;
  orderReference: string;
  salesOrderReference: string;
  contractReference: string;
  projectReference: string;
  despatchReference: string;
  receiptReference: string;
  originatorReference: string;
  /** BT-25/BT-26: invoices this document corrects. */
  precedingInvoices: { id: string; issueDate: string }[];
  accountingCost: string;
  periodStart: string;
  periodEnd: string;
  notes: string[];
  supplier: Party;
  customer: Party;
  payee: Party | null;
  taxRepresentative: Party | null;
  delivery: Delivery | null;
  lines: Line[];
  taxSubtotals: TaxSubtotal[];
  /** BT-111: VAT total restated in the accounting currency. */
  taxAmountInTaxCurrency: number | null;
  allowanceCharges: AllowanceCharge[];
  paymentMeans: PaymentMeans[];
  paymentTerms: string[];
  additionalDocuments: DocumentReference[];
  totals: Totals;
};

/* ---------- parsing ---------- */

function parseAddress(parent: Element | null): { address: Address; present: boolean } {
  const addr = kid(parent, CAC, 'PostalAddress') ?? kid(parent, CAC, 'Address');
  const lines = [
    val(addr, CBC, 'StreetName'),
    val(addr, CBC, 'AdditionalStreetName'),
    ...kids(addr, CAC, 'AddressLine').map((l) => val(l, CBC, 'Line')),
  ].filter(Boolean);

  const address = {
    lines,
    city: val(addr, CBC, 'CityName'),
    postalZone: val(addr, CBC, 'PostalZone'),
    subentity: val(addr, CBC, 'CountrySubentity'),
    country: path(addr, [
      [CAC, 'Country'],
      [CBC, 'IdentificationCode'],
    ]),
  };

  return { address, present: addr !== null };
}

/** Reads a cac:Party element; `parseParty` unwraps the surrounding role element first. */
function parsePartyElement(party: Element | null): Party {
  const legal = kid(party, CAC, 'PartyLegalEntity');
  const contact = kid(party, CAC, 'Contact');
  const { address, present } = parseAddress(party);

  // A party may carry several tax schemes; VAT is the one worth printing as such.
  const schemes = kids(party, CAC, 'PartyTaxScheme');
  const schemeId = (s: Element) =>
    path(s, [
      [CAC, 'TaxScheme'],
      [CBC, 'ID'],
    ]).toUpperCase();
  const vatScheme = schemes.find((s) => schemeId(s) === 'VAT');
  const otherScheme = schemes.find((s) => schemeId(s) !== 'VAT');

  return {
    name:
      path(party, [
        [CAC, 'PartyName'],
        [CBC, 'Name'],
      ]) || val(legal, CBC, 'RegistrationName'),
    legalName: val(legal, CBC, 'RegistrationName'),
    companyId: val(legal, CBC, 'CompanyID'),
    legalForm: val(legal, CBC, 'CompanyLegalForm'),
    vatId: val(vatScheme ?? null, CBC, 'CompanyID'),
    taxRegistration: val(otherScheme ?? null, CBC, 'CompanyID'),
    identifiers: kids(party, CAC, 'PartyIdentification')
      .map((pi) => qualified(val(pi, CBC, 'ID'), attr(pi, CBC, 'ID', 'schemeID')))
      .filter(Boolean),
    endpointId: val(party, CBC, 'EndpointID'),
    endpointScheme: attr(party, CBC, 'EndpointID', 'schemeID'),
    address,
    hasAddress: present,
    contactName: val(contact, CBC, 'Name'),
    phone: val(contact, CBC, 'Telephone'),
    email: val(contact, CBC, 'ElectronicMail'),
  };
}

function parseParty(root: Element, wrapper: string): Party {
  return parsePartyElement(kid(kid(root, CAC, wrapper), CAC, 'Party'));
}

/** PayeeParty and TaxRepresentativeParty are cac:Party content without the wrapper. */
function parseOptionalParty(root: Element, name: string): Party | null {
  const el = kid(root, CAC, name);
  return el ? parsePartyElement(el) : null;
}

function parseAllowanceCharge(ac: Element): AllowanceCharge {
  const category = kid(ac, CAC, 'TaxCategory');
  return {
    isCharge: val(ac, CBC, 'ChargeIndicator') === 'true',
    reason: val(ac, CBC, 'AllowanceChargeReason'),
    reasonCode: val(ac, CBC, 'AllowanceChargeReasonCode'),
    amount: num(val(ac, CBC, 'Amount')),
    baseAmount: num(val(ac, CBC, 'BaseAmount')),
    factor: num(val(ac, CBC, 'MultiplierFactorNumeric')),
    taxCategory: val(category, CBC, 'ID'),
    taxPercent: num(val(category, CBC, 'Percent')),
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
    const period = kid(line, CAC, 'InvoicePeriod');

    // A price may be quoted per N units (BaseQuantity); normalise to per-unit.
    const baseQuantity = num(val(price, CBC, 'BaseQuantity')) || 1;
    const priceAmount = num(val(price, CBC, 'PriceAmount'));

    // BT-147/BT-148: the gross price is carried as an allowance off the list price.
    const priceAllowance = kids(price, CAC, 'AllowanceCharge').find(
      (ac) => val(ac, CBC, 'ChargeIndicator') !== 'true',
    );

    return {
      id: val(line, CBC, 'ID'),
      name: val(item, CBC, 'Name'),
      description: val(item, CBC, 'Description'),
      note: val(line, CBC, 'Note'),
      quantity: num(qtyEl?.textContent ?? ''),
      unitCode: qtyEl?.getAttribute('unitCode') ?? '',
      unitPrice: priceAmount / baseQuantity,
      baseQuantity,
      baseQuantityUnit: attr(price, CBC, 'BaseQuantity', 'unitCode'),
      grossPrice: num(val(priceAllowance ?? null, CBC, 'BaseAmount')),
      priceDiscount: num(val(priceAllowance ?? null, CBC, 'Amount')),
      amount: num(val(line, CBC, 'LineExtensionAmount')),
      taxCategory: val(category, CBC, 'ID'),
      taxPercent: num(val(category, CBC, 'Percent')),
      accountingCost: val(line, CBC, 'AccountingCost'),
      periodStart: val(period, CBC, 'StartDate'),
      periodEnd: val(period, CBC, 'EndDate'),
      orderLineReference: path(line, [
        [CAC, 'OrderLineReference'],
        [CBC, 'LineID'],
      ]),
      objectId: path(line, [
        [CAC, 'DocumentReference'],
        [CBC, 'ID'],
      ]),
      sellerItemId: path(item, [
        [CAC, 'SellersItemIdentification'],
        [CBC, 'ID'],
      ]),
      standardItemId: path(item, [
        [CAC, 'StandardItemIdentification'],
        [CBC, 'ID'],
      ]),
      classifications: kids(item, CAC, 'CommodityClassification')
        .map((cc) => {
          const code = val(cc, CBC, 'ItemClassificationCode');
          const list = attr(cc, CBC, 'ItemClassificationCode', 'listID');
          return code ? (list ? `${list} ${code}` : code) : '';
        })
        .filter(Boolean),
      originCountry: path(item, [
        [CAC, 'OriginCountry'],
        [CBC, 'IdentificationCode'],
      ]),
      properties: kids(item, CAC, 'AdditionalItemProperty')
        .map((p) => ({ name: val(p, CBC, 'Name'), value: val(p, CBC, 'Value') }))
        .filter((p) => p.name || p.value),
      allowanceCharges: kids(line, CAC, 'AllowanceCharge').map(parseAllowanceCharge),
    };
  });
}

function parseTaxSubtotals(total: Element | null): TaxSubtotal[] {
  return kids(total, CAC, 'TaxSubtotal').map((sub) => {
    const category = kid(sub, CAC, 'TaxCategory');
    return {
      category: val(category, CBC, 'ID'),
      percent: num(val(category, CBC, 'Percent')),
      taxableAmount: num(val(sub, CBC, 'TaxableAmount')),
      taxAmount: num(val(sub, CBC, 'TaxAmount')),
      exemptionReason: val(category, CBC, 'TaxExemptionReason'),
      exemptionReasonCode: val(category, CBC, 'TaxExemptionReasonCode'),
    };
  });
}

function parsePaymentMeans(pm: Element): PaymentMeans {
  const account = kid(pm, CAC, 'PayeeFinancialAccount');
  const card = kid(pm, CAC, 'CardAccount');
  const mandate = kid(pm, CAC, 'PaymentMandate');

  return {
    code: val(pm, CBC, 'PaymentMeansCode'),
    name: attr(pm, CBC, 'PaymentMeansCode', 'name'),
    paymentIds: kids(pm, CBC, 'PaymentID')
      .map((id) => id.textContent?.trim() ?? '')
      .filter(Boolean),
    account: val(account, CBC, 'ID'),
    accountName: val(account, CBC, 'Name'),
    bic: path(account, [
      [CAC, 'FinancialInstitutionBranch'],
      [CBC, 'ID'],
    ]),
    cardId: val(card, CBC, 'PrimaryAccountNumberID'),
    cardHolder: val(card, CBC, 'HolderName'),
    cardNetwork: val(card, CBC, 'NetworkID'),
    mandateId: val(mandate, CBC, 'ID'),
    debitedAccount: path(mandate, [
      [CAC, 'PayerFinancialAccount'],
      [CBC, 'ID'],
    ]),
  };
}

function parseDelivery(root: Element): Delivery | null {
  const delivery = kid(root, CAC, 'Delivery');
  if (!delivery) return null;

  const location = kid(delivery, CAC, 'DeliveryLocation');
  const { address, present } = parseAddress(location);

  return {
    date: val(delivery, CBC, 'ActualDeliveryDate'),
    locationId: qualified(val(location, CBC, 'ID'), attr(location, CBC, 'ID', 'schemeID')),
    partyName: path(kid(delivery, CAC, 'DeliveryParty'), [
      [CAC, 'PartyName'],
      [CBC, 'Name'],
    ]),
    address,
    hasAddress: present,
  };
}

function parseDocumentReference(ref: Element): DocumentReference {
  const attachment = kid(ref, CAC, 'Attachment');
  const binary = kid(attachment, CBC, 'EmbeddedDocumentBinaryObject');

  return {
    id: val(ref, CBC, 'ID'),
    scheme: attr(ref, CBC, 'ID', 'schemeID'),
    typeCode: val(ref, CBC, 'DocumentTypeCode'),
    description: val(ref, CBC, 'DocumentDescription'),
    uri: path(attachment, [
      [CAC, 'ExternalReference'],
      [CBC, 'URI'],
    ]),
    attachmentFilename: binary?.getAttribute('filename') ?? '',
    attachmentMime: binary?.getAttribute('mimeCode') ?? '',
    // A writer is free to wrap base64 across lines, and `atob` rejects whitespace, so
    // it comes out of the XML normalised rather than at the point of use.
    attachmentContent: (binary?.textContent ?? '').replace(/\s+/g, ''),
  };
}

/** cac:<name>/cbc:ID — the shape shared by the single-reference document links. */
function referenceId(root: Element, name: string): string {
  return path(root, [
    [CAC, name],
    [CBC, 'ID'],
  ]);
}

export function parseUbl(xml: string): UblDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const failure = doc.getElementsByTagName('parsererror')[0];
  if (failure) throw new Error(failure.textContent?.trim() || 'Invalid XML');

  const root = doc.documentElement;

  // Without this guard any well-formed XML — an Order, a CII invoice, an unrelated
  // document — parses to an empty UblDocument and renders as a blank invoice, because
  // every lookup below simply finds nothing.
  if (!(root.localName in ROOTS)) {
    throw new Error(
      `Not a UBL invoice: expected <Invoice> or <CreditNote>, found <${root.localName}>.`,
    );
  }
  const expectedNamespace = ROOTS[root.localName as keyof typeof ROOTS];
  if (root.namespaceURI !== expectedNamespace) {
    throw new Error(
      `<${root.localName}> is not in the UBL namespace: expected ${expectedNamespace}, ` +
        `found ${root.namespaceURI ?? 'no namespace'}.`,
    );
  }

  const isCreditNote = root.localName === 'CreditNote';
  const totalsEl = kid(root, CAC, 'LegalMonetaryTotal');
  const period = kid(root, CAC, 'InvoicePeriod');
  const currency = val(root, CBC, 'DocumentCurrencyCode');
  const taxCurrency = val(root, CBC, 'TaxCurrencyCode');

  // A document may repeat TaxTotal in the accounting currency; the first one,
  // which carries the breakdown, is the document currency total.
  const taxTotals = kids(root, CAC, 'TaxTotal');
  const taxAmount = taxTotals.length ? num(val(taxTotals[0], CBC, 'TaxAmount')) : 0;
  const secondaryTotal = taxTotals
    .slice(1)
    .find((t) => attr(t, CBC, 'TaxAmount', 'currencyID') !== currency);

  return {
    isCreditNote,
    customizationId: val(root, CBC, 'CustomizationID'),
    profileId: val(root, CBC, 'ProfileID'),
    id: val(root, CBC, 'ID'),
    issueDate: val(root, CBC, 'IssueDate'),
    dueDate: val(root, CBC, 'DueDate'),
    taxPointDate: val(root, CBC, 'TaxPointDate'),
    typeCode: val(root, CBC, isCreditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'),
    currency,
    taxCurrency,
    buyerReference: val(root, CBC, 'BuyerReference'),
    orderReference: referenceId(root, 'OrderReference'),
    salesOrderReference: path(root, [
      [CAC, 'OrderReference'],
      [CBC, 'SalesOrderID'],
    ]),
    contractReference: referenceId(root, 'ContractDocumentReference'),
    projectReference: referenceId(root, 'ProjectReference'),
    despatchReference: referenceId(root, 'DespatchDocumentReference'),
    receiptReference: referenceId(root, 'ReceiptDocumentReference'),
    originatorReference: referenceId(root, 'OriginatorDocumentReference'),
    precedingInvoices: kids(root, CAC, 'BillingReference')
      .map((br) => {
        const ref = kid(br, CAC, 'InvoiceDocumentReference');
        return { id: val(ref, CBC, 'ID'), issueDate: val(ref, CBC, 'IssueDate') };
      })
      .filter((ref) => ref.id),
    accountingCost: val(root, CBC, 'AccountingCost'),
    periodStart: val(period, CBC, 'StartDate'),
    periodEnd: val(period, CBC, 'EndDate'),
    notes: kids(root, CBC, 'Note')
      .map((n) => n.textContent?.trim() ?? '')
      .filter(Boolean),
    supplier: parseParty(root, 'AccountingSupplierParty'),
    customer: parseParty(root, 'AccountingCustomerParty'),
    payee: parseOptionalParty(root, 'PayeeParty'),
    taxRepresentative: parseOptionalParty(root, 'TaxRepresentativeParty'),
    delivery: parseDelivery(root),
    lines: parseLines(root, isCreditNote),
    // Only the first TaxTotal's breakdown belongs to the document currency; folding in
    // the accounting-currency restatement would print the VAT rows twice.
    taxSubtotals: parseTaxSubtotals(taxTotals[0] ?? null),
    taxAmountInTaxCurrency: secondaryTotal ? num(val(secondaryTotal, CBC, 'TaxAmount')) : null,
    allowanceCharges: kids(root, CAC, 'AllowanceCharge').map(parseAllowanceCharge),
    paymentMeans: kids(root, CAC, 'PaymentMeans').map(parsePaymentMeans),
    paymentTerms: kids(root, CAC, 'PaymentTerms')
      .map((pt) => val(pt, CBC, 'Note'))
      .filter(Boolean),
    additionalDocuments: kids(root, CAC, 'AdditionalDocumentReference').map(parseDocumentReference),
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
