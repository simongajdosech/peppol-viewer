// @vitest-environment node
//
// The rest of the suite runs under jsdom for DOMParser, but @react-pdf takes a
// browser code path there and emits flate streams pdfjs cannot read back. Rendering
// has to happen in the node environment, with DOMParser supplied by hand.
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { InvoiceDocument } from './InvoiceDocument';
import { parseUbl, type UblDocument } from './ubl';

globalThis.DOMParser = new JSDOM().window.DOMParser;

const samples = import.meta.glob('../../public/samples/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sample = (name: string) => parseUbl(samples[`../../public/samples/${name}`]);

/** Renders the document and reads the text back out, one entry per page. */
async function render(
  invoice: UblDocument,
  locale: 'en' | 'sk' = 'en',
  showQr = true,
): Promise<string[]> {
  const bytes = await renderToBuffer(
    <InvoiceDocument invoice={invoice} locale={locale} showQr={showQr} />,
  );

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // renderToBuffer hands back a Node Buffer; pdfjs insists on a plain Uint8Array.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false })
    .promise;

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages;
}

/**
 * Headings are letter-spaced, so "Unit price" comes back out of the PDF as
 * "U N I T   P R I C E". Compare with the whitespace taken out.
 */
const squash = (text: string) => text.replace(/\s+/g, '').toUpperCase();

beforeAll(() => {
  // The app registers these from a URL; in Node they come off disk.
  Font.register({
    family: 'PT Sans',
    fonts: [
      { src: 'public/fonts/PTSans-Regular.ttf' },
      { src: 'public/fonts/PTSans-Bold.ttf', fontWeight: 'bold' },
    ],
  });
  Font.registerHyphenationCallback((word: string) => [word]);
});

describe('rendered PDF', () => {
  it('puts the document on a page at all', async () => {
    const pages = await render(sample('base-example.xml'));

    expect(pages.length).toBeGreaterThan(0);
    expect(squash(pages[0])).toContain('INVOICE');
  });

  it('repeats the line table header on every page', async () => {
    // Norwegian-example-1 is the multi-page sample; without `fixed` on the table
    // head, page 2 continues into bare columns of numbers.
    const pages = await render(sample('Norwegian-example-1.xml'));

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(squash(page)).toContain('UNITPRICE');
      expect(squash(page)).toContain('DESCRIPTION');
    }
  });

  it('repeats the fixed footer on every page', async () => {
    const invoice = sample('Norwegian-example-1.xml');
    const pages = await render(invoice);

    for (const page of pages) {
      expect(squash(page)).toContain(squash(invoice.id));
      expect(squash(page)).toContain(squash(invoice.supplier.name));
    }
  });

  it('decodes the code lists into the document', async () => {
    const pages = await render(sample('base-example.xml'));
    const text = squash(pages.join(' '));

    expect(text).toContain(squash('380 - Commercial invoice')); // BT-3 type code
    expect(text).toContain(squash('30 - Credit transfer')); // BT-81 payment means
    expect(text).toContain(squash('S - Standard rate')); // BT-95 in the VAT breakdown
    expect(text).toContain(squash('7 days')); // BT-130 unit DAY, label only
  });

  it('replaces the unit code rather than printing it alongside', async () => {
    // Vat-category-S quotes its quantities in C62, which must not reach the page.
    const text = squash((await render(sample('Vat-category-S.xml'))).join(' '));

    expect(text).toContain(squash('10 pcs'));
    expect(text).not.toContain('C62');
  });

  it('decodes them in Slovak too', async () => {
    const pages = await render(sample('SK-full-example.xml'), 'sk');
    const text = squash(pages.join(' '));

    expect(text).toContain(squash('380 - Obchodná faktúra'));
    expect(text).toContain(squash('30 - Prevodný príkaz')); // sender's own BT-82 name
    expect(text).toContain(squash('S - Základná sadzba'));
    expect(text).toContain(squash('12 hod.')); // HUR
    expect(text).toContain(squash('3 ks')); // H87
  });

  it('keeps an unknown code rather than dropping it', async () => {
    const invoice = sample('base-example.xml');
    const odd = {
      ...invoice,
      typeCode: '999',
      lines: invoice.lines.map((line) => ({ ...line, unitCode: 'ZZZ' })),
    };
    const text = squash((await render(odd)).join(' '));

    expect(text).toContain('999');
    expect(text).toContain('ZZZ');
  });

  it('puts the payment QR codes on the page, and only where there are any', async () => {
    // The matrix itself is vector art with no text to read back, so the caption under
    // each code stands in for it; `qr.test.ts` pins what the codes actually encode.
    const withCodes = squash((await render(sample('SK-full-example.xml'))).join(' '));

    expect(withCodes).toContain(squash('PAY by square'));
    expect(withCodes).toContain(squash('SEPA QR'));

    // base-example is a GB account billing in euro: the SEPA code on its own.
    const one = squash((await render(sample('base-example.xml'))).join(' '));

    expect(one).toContain(squash('SEPA QR'));
    expect(one).not.toContain(squash('PAY by square'));

    // A credit note is money going the other way, so it gets no code at all.
    const without = squash((await render(sample('base-creditnote-correction.xml'))).join(' '));

    expect(without).toContain(squash('Payment')); // the band is still there
    expect(without).not.toContain(squash('PAY by square'));
    expect(without).not.toContain(squash('SEPA QR'));
  });

  it('leaves the codes out when the caller turns them off', async () => {
    const invoice = sample('SK-full-example.xml');
    const text = squash((await render(invoice, 'en', false)).join(' '));

    expect(text).toContain(squash('Payment'));
    expect(text).not.toContain(squash('PAY by square'));
    expect(text).not.toContain(squash('SEPA QR'));
  });

  it('keeps the Slovak sample on one page, QR codes and all', async () => {
    // The payment band grew by the height of a code, and this is the fullest document
    // that still has to fit. base-example does gain a page, which is what the toolbar
    // switch is there for.
    expect(await render(sample('SK-full-example.xml'))).toHaveLength(1);
  });

  it('keeps Slovak diacritics, which the built-in PDF fonts would drop', async () => {
    const pages = await render(sample('SK-full-example.xml'), 'sk');

    expect(squash(pages[0])).toContain(squash('Faktúra'));
    expect(pages.join(' ')).toMatch(/[čďľňŕšťžý]/);
  });
});
