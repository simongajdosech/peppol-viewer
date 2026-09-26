import { describe, expect, it } from 'vitest';
import { parseUbl } from './ubl';

/* ---------- the shipped samples, parsed end to end ---------- */

// Resolved by Vite at transform time, so the fixtures are found regardless of
// the working directory the suite is started from.
const sampleFiles = Object.entries(
  import.meta.glob('../../public/samples/*.xml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
)
  .map(([path, xml]) => [path.slice(path.lastIndexOf('/') + 1), xml] as const)
  .sort(([a], [b]) => a.localeCompare(b));

describe('sample documents', () => {
  it('finds the sample files', () => {
    // A mistyped glob would otherwise turn the whole suite into a silent no-op.
    expect(sampleFiles.length).toBeGreaterThan(0);
  });

  // One snapshot per sample: a new sample under public/samples is covered
  // automatically, and any parser change shows up as a reviewable diff.
  it.each(sampleFiles)('parses %s', (_name, xml) => {
    expect(parseUbl(xml)).toMatchSnapshot();
  });
});

/* ---------- focused cases, where a snapshot would not explain a regression ---------- */

const NS = {
  invoice: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  creditNote: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
};

/** Wraps a document body in the namespace declarations every sample carries. */
function doc(body: string, root: 'Invoice' | 'CreditNote' = 'Invoice'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<${root} xmlns="${root === 'Invoice' ? NS.invoice : NS.creditNote}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  ${body}
</${root}>`;
}

const line = (body: string) => parseUbl(doc(`<cac:InvoiceLine>${body}</cac:InvoiceLine>`)).lines[0];

describe('price normalisation', () => {
  it('divides BaseQuantity out of the quoted price', () => {
    const result = line(`
      <cbc:InvoicedQuantity unitCode="C62">25</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount>62.50</cbc:LineExtensionAmount>
      <cac:Price>
        <cbc:PriceAmount>25.00</cbc:PriceAmount>
        <cbc:BaseQuantity unitCode="C62">10</cbc:BaseQuantity>
      </cac:Price>`);

    expect(result.unitPrice).toBe(2.5);
    expect(result.baseQuantity).toBe(10);
    expect(result.baseQuantityUnit).toBe('C62');
  });

  it('treats a missing BaseQuantity as 1', () => {
    const result = line(`
      <cac:Price><cbc:PriceAmount>25.00</cbc:PriceAmount></cac:Price>`);

    expect(result.unitPrice).toBe(25);
    expect(result.baseQuantity).toBe(1);
  });

  it('treats a zero BaseQuantity as 1 rather than dividing by it', () => {
    const result = line(`
      <cac:Price>
        <cbc:PriceAmount>25.00</cbc:PriceAmount>
        <cbc:BaseQuantity>0</cbc:BaseQuantity>
      </cac:Price>`);

    expect(result.unitPrice).toBe(25);
    expect(Number.isFinite(result.unitPrice)).toBe(true);
  });
});

describe('gross price and item price discount', () => {
  it('reads BT-147/BT-148 off the price-level allowance', () => {
    const result = line(`
      <cac:Price>
        <cbc:PriceAmount>20.00</cbc:PriceAmount>
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
          <cbc:Amount>5.00</cbc:Amount>
          <cbc:BaseAmount>25.00</cbc:BaseAmount>
        </cac:AllowanceCharge>
      </cac:Price>`);

    expect(result.grossPrice).toBe(25);
    expect(result.priceDiscount).toBe(5);
  });

  it('ignores a price-level charge, which is not a discount off a list price', () => {
    const result = line(`
      <cac:Price>
        <cbc:PriceAmount>20.00</cbc:PriceAmount>
        <cac:AllowanceCharge>
          <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
          <cbc:Amount>5.00</cbc:Amount>
          <cbc:BaseAmount>15.00</cbc:BaseAmount>
        </cac:AllowanceCharge>
      </cac:Price>`);

    expect(result.grossPrice).toBe(0);
    expect(result.priceDiscount).toBe(0);
  });
});

describe('party tax schemes', () => {
  const party = (schemes: string) =>
    parseUbl(
      doc(`<cac:AccountingSupplierParty><cac:Party>
        <cac:PartyName><cbc:Name>Seller</cbc:Name></cac:PartyName>
        ${schemes}
      </cac:Party></cac:AccountingSupplierParty>`),
    ).supplier;

  it('picks the VAT scheme for the VAT identifier', () => {
    const result = party(`
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2020123456</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`);

    expect(result.vatId).toBe('SK2020123456');
    expect(result.taxRegistration).toBe('');
  });

  it('keeps a non-VAT scheme separate as BT-32', () => {
    const result = party(`
      <cac:PartyTaxScheme>
        <cbc:CompanyID>SK2020123456</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>Local 12345</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>TAX</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`);

    expect(result.vatId).toBe('SK2020123456');
    expect(result.taxRegistration).toBe('Local 12345');
  });

  it('matches the VAT scheme case-insensitively', () => {
    expect(
      party(`
        <cac:PartyTaxScheme>
          <cbc:CompanyID>NO999888777MVA</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>vat</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>`).vatId,
    ).toBe('NO999888777MVA');
  });
});

describe('repeated TaxTotal', () => {
  const twoTotals = doc(`
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>SEK</cbc:TaxCurrencyCode>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="EUR">1225.00</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="EUR">4900.00</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="EUR">1225.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID>
          <cbc:Percent>25</cbc:Percent>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SEK">9324.00</cbc:TaxAmount>
    </cac:TaxTotal>`);

  it('takes the document-currency total from the first TaxTotal', () => {
    expect(parseUbl(twoTotals).totals.taxAmount).toBe(1225);
  });

  it('restates the second one as BT-111', () => {
    const result = parseUbl(twoTotals);
    expect(result.taxCurrency).toBe('SEK');
    expect(result.taxAmountInTaxCurrency).toBe(9324);
  });

  it('leaves BT-111 null when there is only one TaxTotal', () => {
    const result = parseUbl(doc(`
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">10.00</cbc:TaxAmount></cac:TaxTotal>`));

    expect(result.taxAmountInTaxCurrency).toBeNull();
  });

  it('reads the VAT breakdown once', () => {
    expect(parseUbl(twoTotals).taxSubtotals).toHaveLength(1);
  });

  it('ignores a breakdown repeated in the accounting currency', () => {
    // BIS says the second TaxTotal carries only TaxAmount, but a sender that also
    // restates the subtotals must not make the VAT rows print twice.
    const result = parseUbl(doc(`
      <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
      <cbc:TaxCurrencyCode>SEK</cbc:TaxCurrencyCode>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">1225.00</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="EUR">4900.00</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="EUR">1225.00</cbc:TaxAmount>
          <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>25</cbc:Percent></cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SEK">9324.00</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="SEK">37296.00</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="SEK">9324.00</cbc:TaxAmount>
          <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>25</cbc:Percent></cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>`));

    expect(result.taxSubtotals).toHaveLength(1);
    expect(result.taxSubtotals[0].taxableAmount).toBe(4900);
  });
});

describe('credit notes', () => {
  const creditNote = parseUbl(
    doc(
      `<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>
       <cac:CreditNoteLine>
         <cbc:ID>1</cbc:ID>
         <cbc:CreditedQuantity unitCode="C62">3</cbc:CreditedQuantity>
         <cbc:LineExtensionAmount>30.00</cbc:LineExtensionAmount>
         <cac:Item><cbc:Name>Returned goods</cbc:Name></cac:Item>
       </cac:CreditNoteLine>`,
      'CreditNote',
    ),
  );

  it('switches to the credit note line and quantity tags', () => {
    expect(creditNote.isCreditNote).toBe(true);
    expect(creditNote.lines).toHaveLength(1);
    expect(creditNote.lines[0].quantity).toBe(3);
    expect(creditNote.lines[0].unitCode).toBe('C62');
  });

  it('reads the type code from CreditNoteTypeCode', () => {
    expect(creditNote.typeCode).toBe('381');
  });

  it('finds no lines when an invoice body is read as a credit note', () => {
    // Guards the tag switch itself: InvoiceLine must not be picked up here.
    const mismatched = parseUbl(
      doc('<cac:InvoiceLine><cbc:ID>1</cbc:ID></cac:InvoiceLine>', 'CreditNote'),
    );
    expect(mismatched.lines).toHaveLength(0);
  });
});

describe('namespace-aware traversal', () => {
  it('ignores same-named elements from another namespace', () => {
    const result = parseUbl(
      doc(`<cbc:ID>INV-1</cbc:ID>
           <other:ID xmlns:other="urn:example:other">SHOULD-NOT-WIN</other:ID>`),
    );
    expect(result.id).toBe('INV-1');
  });

  it('only descends into direct children', () => {
    // A nested cbc:ID inside a line must not be mistaken for the document ID.
    const result = parseUbl(
      doc('<cac:InvoiceLine><cbc:ID>line-id</cbc:ID></cac:InvoiceLine>'),
    );
    expect(result.id).toBe('');
  });
});

describe('malformed input', () => {
  it('throws on XML that does not parse', () => {
    expect(() => parseUbl('<Invoice><cbc:ID>unclosed')).toThrow();
  });

  it('throws on empty input', () => {
    expect(() => parseUbl('')).toThrow();
  });

});

describe('root element guard', () => {
  it('accepts an Invoice and a CreditNote', () => {
    expect(parseUbl(doc('<cbc:ID>1</cbc:ID>')).isCreditNote).toBe(false);
    expect(parseUbl(doc('<cbc:ID>1</cbc:ID>', 'CreditNote')).isCreditNote).toBe(true);
  });

  it('rejects another UBL document type', () => {
    // Would otherwise parse to an empty document and render as a blank invoice.
    const order = `<?xml version="1.0" encoding="UTF-8"?>
      <Order xmlns="urn:oasis:names:specification:ubl:schema:xsd:Order-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>ORD-1</cbc:ID>
      </Order>`;

    expect(() => parseUbl(order)).toThrow(/Order/);
  });

  it('rejects a CII invoice, which uses a different root entirely', () => {
    const cii = `<?xml version="1.0" encoding="UTF-8"?>
      <rsm:CrossIndustryInvoice
        xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
        <rsm:ExchangedDocument/>
      </rsm:CrossIndustryInvoice>`;

    expect(() => parseUbl(cii)).toThrow(/CrossIndustryInvoice/);
  });

  it('rejects an Invoice element that is not in the UBL namespace', () => {
    expect(() => parseUbl('<Invoice><ID>1</ID></Invoice>')).toThrow(/namespace/);
  });

  it('rejects an Invoice carrying the CreditNote namespace', () => {
    const swapped = `<?xml version="1.0" encoding="UTF-8"?>
      <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"/>`;

    expect(() => parseUbl(swapped)).toThrow(/namespace/);
  });

  it('names what it found, so the message is actionable', () => {
    expect(() => parseUbl('<Order/>')).toThrow(/expected <Invoice> or <CreditNote>/);
  });
});
