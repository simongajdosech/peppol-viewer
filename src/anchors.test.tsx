// @vitest-environment node
//
// Same setup as `pdf.smoke.test.tsx`: @react-pdf only writes a PDF pdfjs can read back
// from the node environment, and DOMParser has to be supplied by hand there.
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANCHOR_BY_RULE, collectAnchors, scaleRect, type Anchor, type AnchorMap } from './anchors';
import { InvoiceDocument } from './InvoiceDocument';
import { parseUbl, type UblDocument } from './ubl';
import { validate } from './validate';

globalThis.DOMParser = new JSDOM().window.DOMParser;

const samples = import.meta.glob('../public/samples/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sample = (name: string) => parseUbl(samples[`../public/samples/${name}`]);

const ALL_ANCHORS: Anchor[] = [
  'header',
  'supplier',
  'customer',
  'details',
  'lines',
  'totals',
  'vat',
  'payable',
  'exemptions',
  'payment',
  'footer',
];

type Rendered = {
  anchors: AnchorMap;
  /** The text of every glyph run whose origin falls inside the given anchor's boxes. */
  textIn: (anchor: Anchor) => string;
};

/**
 * Renders the document, keeps the layout `onLayout` reports, and reads the text back out
 * of the finished file with its positions — so the anchors can be checked against where
 * the glyphs actually landed rather than against themselves.
 */
async function render(invoice: UblDocument, locale: 'en' | 'sk' = 'en'): Promise<Rendered> {
  let anchors: AnchorMap = {};
  const bytes = await renderToBuffer(
    <InvoiceDocument
      invoice={invoice}
      locale={locale}
      onLayout={(layout) => {
        anchors = collectAnchors(layout);
      }}
    />,
  );

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false })
    .promise;

  // One entry per page: the glyph runs, with their origin converted to the top-left
  // origin the layout boxes use. PDF user space measures up from the bottom instead.
  const runs: { x: number; y: number; str: string }[][] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const height = page.view[3];
    const content = await page.getTextContent();
    runs.push(
      content.items.flatMap((item) =>
        'str' in item && item.str.trim()
          ? [{ x: item.transform[4], y: height - item.transform[5], str: item.str }]
          : [],
      ),
    );
  }

  return {
    anchors,
    textIn: (anchor) =>
      (anchors[anchor] ?? [])
        .flatMap((rect) =>
          (runs[rect.page] ?? [])
            .filter(
              (run) =>
                run.x >= rect.x - 1 &&
                run.x <= rect.x + rect.width + 1 &&
                // A run's origin is its baseline, which sits below the top of the line
                // box it belongs to and inside the bottom of the block.
                run.y >= rect.y &&
                run.y <= rect.y + rect.height + 1,
            )
            .map((run) => run.str),
        )
        .join(' '),
  };
}

const squash = (text: string) => text.replace(/\s+/g, '').toUpperCase();

beforeAll(() => {
  Font.register({
    family: 'PT Sans',
    fonts: [
      { src: 'public/fonts/PTSans-Regular.ttf' },
      { src: 'public/fonts/PTSans-Bold.ttf', fontWeight: 'bold' },
    ],
  });
  Font.registerHyphenationCallback((word: string) => [word]);
});

describe('collectAnchors', () => {
  it('finds every block of a full document', async () => {
    const { anchors } = await render(sample('Norwegian-example-1.xml'));

    expect(Object.keys(anchors).sort()).toEqual([...ALL_ANCHORS].sort());
  });

  it('puts each anchor over the text it is meant to cover', async () => {
    const invoice = sample('base-example.xml');
    const { textIn } = await render(invoice);

    // The header carries the document number, and the title beside it — letter-spaced,
    // so it comes back out of the file with gaps between the glyphs.
    expect(squash(textIn('header'))).toContain('INVOICE');
    expect(textIn('header')).toContain(invoice.id);

    expect(textIn('supplier')).toContain(invoice.supplier.name);
    expect(textIn('customer')).toContain(invoice.customer.name);

    // ...and each party block covers its own party only.
    expect(textIn('supplier')).not.toContain(invoice.customer.name);
    expect(textIn('customer')).not.toContain(invoice.supplier.name);

    expect(squash(textIn('details'))).toContain(squash(invoice.currency));
    expect(textIn('lines')).toContain(invoice.lines[0].name);
    expect(squash(textIn('payable'))).toContain(squash(invoice.currency));
    expect(squash(textIn('vat'))).toContain('VAT');
  });

  it('repeats the fixed footer on every page and splits the line table across them', async () => {
    const { anchors } = await render(sample('Norwegian-example-1.xml'));
    const pages = Math.max(...(anchors.footer ?? []).map((rect) => rect.page)) + 1;

    expect(pages).toBeGreaterThan(1);
    // `fixed`, so it is laid out once per page.
    expect(anchors.footer).toHaveLength(pages);
    // The line table is long enough to break, and a broken block is laid out once per
    // page it reaches — never twice on the same one.
    expect((anchors.lines ?? []).length).toBeGreaterThan(1);
    expect(new Set((anchors.lines ?? []).map((rect) => rect.page)).size).toBe(
      (anchors.lines ?? []).length,
    );
  });

  it('leaves out a block that laid out empty', async () => {
    // Nothing in this one is exempt, so the exemption band is never rendered.
    const { anchors } = await render(sample('broken-example.xml'));

    expect(anchors.exemptions).toBeUndefined();
    expect(anchors.header).toBeDefined();
  });

  it('keeps every box inside its page', async () => {
    // The one that splits a block across pages: the halves have to be measured against
    // the page each lands on, not the page the block started on.
    const { anchors } = await render(sample('Norwegian-example-1.xml'));

    for (const rects of Object.values(anchors)) {
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(rect.pageWidth + 0.01);
        expect(rect.y + rect.height).toBeLessThanOrEqual(rect.pageHeight + 0.01);
      }
    }
  });
});

describe('scaleRect', () => {
  it('scales both axes by the width the page is drawn at', () => {
    const rect = {
      page: 0,
      x: 44,
      y: 100,
      width: 200,
      height: 50,
      pageWidth: 595.28,
      pageHeight: 841.89,
    };

    expect(scaleRect(rect, 595.28)).toEqual({ left: 44, top: 100, width: 200, height: 50 });

    const doubled = scaleRect(rect, 1190.56);
    expect(doubled.left).toBeCloseTo(88);
    expect(doubled.top).toBeCloseTo(200);
    expect(doubled.width).toBeCloseTo(400);
    expect(doubled.height).toBeCloseTo(100);
  });
});

describe('ANCHOR_BY_RULE', () => {
  it('covers every rule the samples can break', () => {
    const keys = new Set(
      Object.values(samples).flatMap((xml) => validate(parseUbl(xml)).map((f) => f.key)),
    );

    expect([...keys].filter((key) => !ANCHOR_BY_RULE[key])).toEqual([]);
  });

  it('points only at blocks the document can produce', () => {
    for (const anchor of Object.values(ANCHOR_BY_RULE)) {
      expect(ALL_ANCHORS).toContain(anchor);
    }
  });
});
