import { describe, expect, it } from 'vitest';
import { translation } from './i18n';
import { parseUbl, type UblDocument } from './ubl';
import { errorsIn, validate } from './validate';

const samples = Object.fromEntries(
  Object.entries(
    import.meta.glob('../public/samples/*.xml', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  ).map(([path, xml]) => [path.slice(path.lastIndexOf('/') + 1), xml]),
);

const base = () => parseUbl(samples['base-example.xml']);
const rules = (doc: UblDocument) => validate(doc).map((f) => f.rule);

/** The sample with one edited branch; the rest of the document stays conformant. */
const edited = (change: (doc: UblDocument) => UblDocument) => rules(change(base()));

/** broken-example.xml exists to fail; every other sample is conformant BIS 3. */
const BROKEN = 'broken-example.xml';

describe('the shipped samples', () => {
  it.each(Object.keys(samples).filter((name) => name !== BROKEN))(
    '%s raises nothing',
    (name) => {
      expect(validate(parseUbl(samples[name]))).toEqual([]);
    },
  );

  it('flags every fault built into the non-conformant sample', () => {
    const findings = validate(parseUbl(samples[BROKEN]));

    expect(findings.map((f) => f.rule)).toEqual([
      'BR-CO-10', // lines total 900, document says 1000
      'BR-S-08', // 20% of 1000 is 200, document says 50
      'BR-E-10', // exempt row with no reason
      'BR-11', // buyer address has no country
      'BR-62', // seller endpoint has no scheme
      'BR-50', // credit transfer with no account
      'DUE-BEFORE-ISSUE',
    ]);
    expect(errorsIn(findings)).toHaveLength(6);
  });
});

describe('totals arithmetic', () => {
  it('catches a line sum that does not match BT-106', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, lineExtension: 1 } }))).toContain(
      'BR-CO-10',
    );
  });

  it('reports what the parts add up to against what the document states', () => {
    const doc = base();
    const stated = 1;
    const finding = validate({ ...doc, totals: { ...doc.totals, lineExtension: stated } }).find(
      (f) => f.rule === 'BR-CO-10',
    );

    expect(finding?.found).toBe(stated);
    expect(finding?.expected).toBeCloseTo(
      doc.lines.reduce((total, line) => total + line.amount, 0),
      2,
    );
  });

  it('catches a document allowance total that does not match its allowances', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, allowanceTotal: 99 } }))).toContain(
      'BR-CO-11',
    );
  });

  it('catches a charge total that does not match its charges', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, chargeTotal: 99 } }))).toContain(
      'BR-CO-12',
    );
  });

  it('catches a tax-exclusive total that ignores the allowances', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, taxExclusive: 1 } }))).toContain(
      'BR-CO-13',
    );
  });

  it('catches a VAT total that does not match the breakdown', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, taxAmount: 1 } }))).toContain('BR-CO-14');
  });

  it('catches a tax-inclusive total that is not the sum of the two', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, taxInclusive: 1 } }))).toContain(
      'BR-CO-15',
    );
  });

  it('catches a payable amount that ignores the prepayment', () => {
    expect(edited((d) => ({ ...d, totals: { ...d.totals, payable: 1 } }))).toContain('BR-CO-16');
  });

  it('tolerates a half-cent rounding, which conformant documents do carry', () => {
    const doc = base();
    const nudged = { ...doc.totals, lineExtension: doc.totals.lineExtension + 0.004 };
    expect(rules({ ...doc, totals: nudged })).not.toContain('BR-CO-10');
  });

  it('does not tolerate a whole cent', () => {
    const doc = base();
    const nudged = { ...doc.totals, lineExtension: doc.totals.lineExtension + 0.01 };
    expect(rules({ ...doc, totals: nudged })).toContain('BR-CO-10');
  });
});

describe('VAT breakdown', () => {
  const withVat = (tax: Partial<UblDocument['taxSubtotals'][number]>) => (doc: UblDocument) => ({
    ...doc,
    taxSubtotals: [
      {
        category: 'S',
        percent: 25,
        taxableAmount: 100,
        taxAmount: 25,
        exemptionReason: '',
        exemptionReasonCode: '',
        ...tax,
      },
    ],
  });

  it('catches a VAT amount that is not the rate applied to the base', () => {
    expect(edited(withVat({ taxAmount: 10 }))).toContain('BR-S-08');
  });

  it('names the breakdown row the finding is about', () => {
    const finding = validate(withVat({ taxAmount: 10 })(base())).find((f) => f.rule === 'BR-S-08');
    expect(finding?.vat).toEqual({ category: 'S', percent: 25 });
    expect(finding?.expected).toBeCloseTo(25, 2);
    expect(finding?.found).toBe(10);
  });

  it('allows the rounding that accumulates across already-rounded lines', () => {
    expect(edited(withVat({ taxAmount: 25.02 }))).not.toContain('BR-S-08');
    expect(edited(withVat({ taxAmount: 25.05 }))).toContain('BR-S-08');
  });

  it('requires a zero rate where no VAT is charged', () => {
    expect(edited(withVat({ category: 'E', percent: 25, taxAmount: 0 }))).toContain('BR-E-05');
    expect(edited(withVat({ category: 'AE', percent: 25, taxAmount: 0 }))).toContain('BR-AE-05');
    expect(edited(withVat({ category: 'Z', percent: 25, taxAmount: 0 }))).toContain('BR-Z-05');
  });

  it('uses the intra-community rule id for category K', () => {
    expect(edited(withVat({ category: 'K', percent: 25, taxAmount: 0 }))).toContain('BR-IC-05');
  });

  it('requires a rate above zero for standard rated VAT', () => {
    expect(edited(withVat({ percent: 0, taxAmount: 0 }))).toContain('BR-S-05');
  });

  it('requires a reason where no VAT is charged', () => {
    expect(edited(withVat({ category: 'E', percent: 0, taxAmount: 0 }))).toContain('BR-E-10');
    expect(edited(withVat({ category: 'AE', percent: 0, taxAmount: 0 }))).toContain('BR-AE-10');
    expect(edited(withVat({ category: 'G', percent: 0, taxAmount: 0 }))).toContain('BR-G-10');
    expect(edited(withVat({ category: 'O', percent: 0, taxAmount: 0 }))).toContain('BR-O-10');
  });

  it('accepts an exemption code alone, without prose', () => {
    expect(
      edited(withVat({ category: 'E', percent: 0, taxAmount: 0, exemptionReasonCode: 'VATEX-EU-O' })),
    ).not.toContain('BR-E-10');
  });

  it('catches a category used on a line but absent from the breakdown', () => {
    expect(
      edited((doc) => ({
        ...doc,
        lines: doc.lines.map((line) => ({ ...line, taxCategory: 'AE' })),
      })),
    ).toContain('BR-AE-01');
  });

  it('catches a category used by a document allowance but absent from the breakdown', () => {
    const doc = base();
    const allowance = {
      isCharge: false,
      reason: 'Discount',
      reasonCode: '',
      amount: 0,
      baseAmount: 0,
      factor: 0,
      taxCategory: 'Z',
      taxPercent: 0,
    };
    expect(rules({ ...doc, allowanceCharges: [...doc.allowanceCharges, allowance] })).toContain(
      'BR-Z-01',
    );
  });

  it('wants at least one breakdown row', () => {
    expect(edited((d) => ({ ...d, taxSubtotals: [] }))).toContain('BR-CO-18');
  });
});

describe('required fields', () => {
  it.each([
    ['BR-01', (d: UblDocument) => ({ ...d, customizationId: '' })],
    ['BR-02', (d: UblDocument) => ({ ...d, id: '' })],
    ['BR-03', (d: UblDocument) => ({ ...d, issueDate: '' })],
    ['BR-04', (d: UblDocument) => ({ ...d, typeCode: '' })],
    ['BR-05', (d: UblDocument) => ({ ...d, currency: '' })],
    ['BR-06', (d: UblDocument) => ({ ...d, supplier: { ...d.supplier, name: '' } })],
    ['BR-07', (d: UblDocument) => ({ ...d, customer: { ...d.customer, name: '' } })],
    ['BR-08', (d: UblDocument) => ({ ...d, supplier: { ...d.supplier, hasAddress: false } })],
    ['BR-16', (d: UblDocument) => ({ ...d, lines: [] })],
  ])('%s fires when the field is missing', (rule, change) => {
    expect(edited(change)).toContain(rule);
  });

  it('wants a country on both postal addresses', () => {
    expect(
      edited((d) => ({
        ...d,
        supplier: { ...d.supplier, address: { ...d.supplier.address, country: '' } },
      })),
    ).toContain('BR-09');
    expect(
      edited((d) => ({
        ...d,
        customer: { ...d.customer, address: { ...d.customer.address, country: '' } },
      })),
    ).toContain('BR-11');
  });

  it('wants a scheme on an electronic address that is present', () => {
    expect(
      edited((d) => ({ ...d, supplier: { ...d.supplier, endpointScheme: '' } })),
    ).toContain('BR-62');
    expect(
      edited((d) => ({ ...d, customer: { ...d.customer, endpointScheme: '' } })),
    ).toContain('BR-63');
  });

  it('says nothing about a scheme when there is no electronic address at all', () => {
    // That absence is a different complaint; this rule is about qualifying one.
    expect(
      edited((d) => ({
        ...d,
        supplier: { ...d.supplier, endpointId: '', endpointScheme: '' },
      })),
    ).not.toContain('BR-62');
  });
});

describe('code lists', () => {
  it('catches a currency that is not ISO 4217', () => {
    expect(edited((d) => ({ ...d, currency: 'XYZ' }))).toContain('BR-CL-04');
    expect(edited((d) => ({ ...d, currency: 'EURO' }))).toContain('BR-CL-04');
  });

  it('accepts a real currency that is not the euro', () => {
    expect(edited((d) => ({ ...d, currency: 'NOK' }))).not.toContain('BR-CL-04');
  });

  it('checks the VAT accounting currency too', () => {
    expect(edited((d) => ({ ...d, taxCurrency: 'XYZ' }))).toContain('BR-CL-05');
    expect(edited((d) => ({ ...d, taxCurrency: '' }))).not.toContain('BR-CL-05');
  });
});

describe('payment', () => {
  it('wants a due date or payment terms when something is payable', () => {
    expect(edited((d) => ({ ...d, dueDate: '', paymentTerms: [] }))).toContain('BR-CO-25');
  });

  it('is satisfied by payment terms alone', () => {
    expect(edited((d) => ({ ...d, dueDate: '', paymentTerms: ['Net 30'] }))).not.toContain(
      'BR-CO-25',
    );
  });

  it('wants an account for a credit transfer', () => {
    expect(
      edited((d) => ({
        ...d,
        paymentMeans: d.paymentMeans.map((m) => ({ ...m, code: '30', account: '' })),
      })),
    ).toContain('BR-50');
  });

  it('leaves other payment means alone', () => {
    expect(
      edited((d) => ({
        ...d,
        paymentMeans: d.paymentMeans.map((m) => ({ ...m, code: '10', account: '' })),
      })),
    ).not.toContain('BR-50');
  });
});

describe('advisory warnings', () => {
  it('flags a due date before the issue date', () => {
    const findings = validate({ ...base(), issueDate: '2026-02-01', dueDate: '2026-01-01' });
    const warning = findings.find((f) => f.rule === 'DUE-BEFORE-ISSUE');

    expect(warning?.severity).toBe('warning');
    expect(errorsIn(findings).map((f) => f.rule)).not.toContain('DUE-BEFORE-ISSUE');
  });

  it('flags a payable amount with no way to pay it', () => {
    const findings = validate({ ...base(), paymentMeans: [] });
    expect(findings.find((f) => f.rule === 'NO-PAYMENT-MEANS')?.severity).toBe('warning');
  });

  it('says nothing when there is nothing left to pay', () => {
    const doc = base();
    const settled = { ...doc, paymentMeans: [], totals: { ...doc.totals, payable: 0 } };
    expect(rules(settled)).not.toContain('NO-PAYMENT-MEANS');
  });
});

describe('rule wording', () => {
  const vat = (over: Partial<UblDocument['taxSubtotals'][number]>) => ({
    category: 'S',
    percent: 25,
    taxableAmount: 100,
    taxAmount: 25,
    exemptionReason: '',
    exemptionReasonCode: '',
    ...over,
  });

  /** One document per finding the rule set can produce. */
  const battery: ((d: UblDocument) => UblDocument)[] = [
    (d) => ({ ...d, totals: { ...d.totals, lineExtension: 1 } }),
    (d) => ({ ...d, totals: { ...d.totals, allowanceTotal: 99 } }),
    (d) => ({ ...d, totals: { ...d.totals, chargeTotal: 99 } }),
    (d) => ({ ...d, totals: { ...d.totals, taxExclusive: 1 } }),
    (d) => ({ ...d, totals: { ...d.totals, taxAmount: 1 } }),
    (d) => ({ ...d, totals: { ...d.totals, taxInclusive: 1 } }),
    (d) => ({ ...d, totals: { ...d.totals, payable: 1 } }),
    (d) => ({ ...d, taxSubtotals: [vat({ taxAmount: 10 })] }),
    (d) => ({ ...d, taxSubtotals: [vat({ category: 'E', percent: 25, taxAmount: 0 })] }),
    (d) => ({ ...d, taxSubtotals: [vat({ percent: 0, taxAmount: 0 })] }),
    (d) => ({ ...d, taxSubtotals: [vat({ category: 'E', percent: 0, taxAmount: 0 })] }),
    (d) => ({ ...d, lines: d.lines.map((l) => ({ ...l, taxCategory: 'AE' })) }),
    (d) => ({ ...d, taxSubtotals: [] }),
    (d) => ({ ...d, customizationId: '' }),
    (d) => ({ ...d, id: '' }),
    (d) => ({ ...d, issueDate: '' }),
    (d) => ({ ...d, typeCode: '' }),
    (d) => ({ ...d, currency: '' }),
    (d) => ({ ...d, supplier: { ...d.supplier, name: '' } }),
    (d) => ({ ...d, customer: { ...d.customer, name: '' } }),
    (d) => ({ ...d, supplier: { ...d.supplier, hasAddress: false } }),
    (d) => ({
      ...d,
      supplier: { ...d.supplier, address: { ...d.supplier.address, country: '' } },
    }),
    (d) => ({ ...d, customer: { ...d.customer, hasAddress: false } }),
    (d) => ({
      ...d,
      customer: { ...d.customer, address: { ...d.customer.address, country: '' } },
    }),
    (d) => ({ ...d, lines: [] }),
    (d) => ({ ...d, supplier: { ...d.supplier, endpointScheme: '' } }),
    (d) => ({ ...d, customer: { ...d.customer, endpointScheme: '' } }),
    (d) => ({ ...d, currency: 'XYZ' }),
    (d) => ({ ...d, taxCurrency: 'XYZ' }),
    (d) => ({ ...d, dueDate: '', paymentTerms: [] }),
    (d) => ({ ...d, paymentMeans: d.paymentMeans.map((m) => ({ ...m, code: '30', account: '' })) }),
    (d) => ({ ...d, issueDate: '2026-02-01', dueDate: '2026-01-01' }),
    (d) => ({ ...d, paymentMeans: [] }),
  ];

  const emitted = new Set(
    battery.flatMap((change) => validate(change(base())).map((f) => f.key)),
  );

  it('the battery reaches every rule the dictionaries describe', () => {
    // Both directions: wording with no rule behind it is dead, and a rule with no
    // wording would print its bare key to the reader.
    for (const locale of ['en', 'sk'] as const) {
      const described = new Set(Object.keys(translation(locale).rules));
      expect([...emitted].filter((key) => !described.has(key)).sort()).toEqual([]);
      expect([...described].filter((key) => !emitted.has(key)).sort()).toEqual([]);
    }
  });
});

describe('errorsIn', () => {
  it('keeps errors and drops warnings', () => {
    const findings = validate({ ...base(), paymentMeans: [], id: '' });

    expect(findings.map((f) => f.rule)).toContain('NO-PAYMENT-MEANS');
    expect(errorsIn(findings).map((f) => f.rule)).toEqual(['BR-02']);
  });
});
