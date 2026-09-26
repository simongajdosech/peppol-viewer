export type Sample = {
  file: string;
  label: string;
  note: string;
};

/** Peppol BIS Billing 3.0 examples from OpenPEPPOL/peppol-bis-invoice-3 (served from /samples). */
export const SAMPLES: Sample[] = [
  { file: 'base-example.xml', label: 'Base invoice', note: 'Minimal conformant BIS 3 invoice' },
  { file: 'Allowance-example.xml', label: 'Allowances & charges', note: 'Document- and line-level allowances' },
  { file: 'Vat-category-S.xml', label: 'VAT category S', note: 'Standard rated VAT' },
  { file: 'vat-category-E.xml', label: 'VAT category E', note: 'Exempt from VAT' },
  { file: 'base-creditnote-correction.xml', label: 'Credit note', note: 'CreditNote with credited quantities' },
  { file: 'Norwegian-example-1.xml', label: 'Norwegian invoice', note: 'Multi-page, mixed VAT, prepaid + rounding' },
  { file: 'SK-full-example.xml', label: 'Slovenská faktúra', note: 'SK diacritics, 23 % + 5 % DPH, IBAN, prepaid' },
  { file: 'SK-validation-example.xml', label: 'SK validation stub', note: 'Minimal SK sample from epostak.sk' },
  { file: 'broken-example.xml', label: 'Non-conformant invoice', note: 'Deliberately breaks several EN 16931 rules' },
];
