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

const samples = import.meta.glob('../public/samples/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sample = (name: string) => parseUbl(samples[`../public/samples/${name}`]);

/** Renders the document and reads the text back out, one entry per page. */
async function render(invoice: UblDocument, locale: 'en' | 'sk' = 'en'): Promise<string[]> {
  const bytes = await renderToBuffer(<InvoiceDocument invoice={invoice} locale={locale} />);

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

    expect(pages).toHaveLength(1);
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

  it('keeps Slovak diacritics, which the built-in PDF fonts would drop', async () => {
    const pages = await render(sample('SK-full-example.xml'), 'sk');

    expect(squash(pages[0])).toContain(squash('Faktúra'));
    expect(pages.join(' ')).toMatch(/[čďľňŕšťžý]/);
  });
});
