/**
 * Where each block of the invoice landed on the page, so the viewer can draw a
 * highlight over it without re-rendering the PDF.
 *
 * `@react-pdf/renderer` lays the document out with yoga and then hands the finished
 * tree to the `onRender` prop of `<Document>` as `_INTERNAL__LAYOUT__DATA_`: every node
 * with its computed box, and its props still attached. Marking a block with `id` in
 * `InvoiceDocument` is therefore all it takes to learn where that block ended up. The
 * prop costs nothing in the output — the browser build has no named-destination
 * handling, so it never reaches the bytes and exists only to be read back here.
 *
 * The alternative was to bake the highlight into the document and re-render on every
 * change, which cannot help flashing: a new blob url makes react-pdf's `<Document>`
 * restart its loader, and while it loads it replaces every `<Page>` with the loading
 * message — the canvases unmount, the scroll box collapses to one line, and the reader
 * loses their place. Reading coordinates out instead keeps the bytes fixed, so the
 * highlight is a plain div over a canvas nobody touched.
 *
 * `_INTERNAL__LAYOUT__DATA_` is internal and says so, which is why the dependency is
 * pinned and `anchors.test.ts` checks these boxes against the text positions pdfjs
 * reads back out of the finished file.
 */

/** A block of the rendered document a highlight can point at. */
export type Anchor =
  | 'header'
  | 'supplier'
  | 'customer'
  | 'details'
  | 'lines'
  | 'totals'
  | 'vat'
  | 'payable'
  | 'exemptions'
  | 'payment'
  | 'footer';

const ANCHORS = new Set<string>([
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
] satisfies Anchor[]);

const isAnchor = (id: string | undefined): id is Anchor => !!id && ANCHORS.has(id);

/** One laid-out box, in PDF points measured from the top-left corner of its page. */
export type AnchorRect = {
  /** Zero-based, matching how the viewer indexes the pages it renders. */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The page's own size, so a reader of this rect can scale without knowing the paper. */
  pageWidth: number;
  pageHeight: number;
};

/**
 * Every anchor that made it onto a page, and where.
 *
 * A list rather than a single rect for two reasons: a block long enough to break across
 * pages is laid out once per page it touches, and a `fixed` block — the footer — is laid
 * out again on every page.
 */
export type AnchorMap = Partial<Record<Anchor, AnchorRect[]>>;

/** The shape of `_INTERNAL__LAYOUT__DATA_`, narrowed to the parts used here. */
export type LayoutNode = {
  type: string;
  /** Absent on text instances, which carry their own glyph positions instead. */
  box?: { top: number; left: number; width: number; height: number };
  props?: { id?: string };
  children?: LayoutNode[];
};

/** Reads the layout tree out of whatever `onRender` was called with. */
export function layoutOf(params: unknown): LayoutNode | null {
  const layout = (params as { _INTERNAL__LAYOUT__DATA_?: LayoutNode })._INTERNAL__LAYOUT__DATA_;
  return layout?.children ? layout : null;
}

/**
 * Collects the anchored boxes out of a laid-out document.
 *
 * A node's `box.top`/`box.left` are relative to the border box of its parent, so the
 * walk carries the running offset down and the page itself starts at the origin. That
 * makes the accumulated pair page coordinates, top-left origin — already the direction
 * CSS wants, and the opposite of the bottom-left origin the PDF itself uses.
 */
export function collectAnchors(layout: LayoutNode): AnchorMap {
  const found: AnchorMap = {};

  (layout.children ?? []).forEach((page, index) => {
    const size = page.box;
    if (!size) return;

    const visit = (node: LayoutNode, parentX: number, parentY: number) => {
      const { box } = node;
      // Text instances have no box of their own, and nothing below them can be anchored.
      if (!box) return;

      const x = parentX + box.left;
      const y = parentY + box.top;
      const id = node.props?.id;

      // A block whose content was all empty lays out flat, and a highlight over nothing
      // would just be a line across the page. Skip it: the finding pointing at it stays
      // in the panel, only without somewhere to send the reader.
      if (isAnchor(id) && box.width > 0 && box.height > 0) {
        (found[id] ??= []).push({
          page: index,
          x,
          y,
          width: box.width,
          height: box.height,
          pageWidth: size.width,
          pageHeight: size.height,
        });
      }

      (node.children ?? []).forEach((child) => visit(child, x, y));
    };

    // The page's own box positions it within the document, not its content within it.
    (page.children ?? []).forEach((child) => visit(child, 0, 0));
  });

  return found;
}

/**
 * The rect in CSS pixels, for a page drawn `renderedWidth` wide.
 *
 * The viewer sets a width and lets react-pdf derive the height, so one ratio scales
 * both axes.
 */
export function scaleRect(rect: AnchorRect, renderedWidth: number) {
  const scale = renderedWidth / rect.pageWidth;
  return {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/**
 * Which block each business rule is about, keyed by `Finding.key` from `validate.ts`.
 *
 * Keyed by the wording key rather than the rule id because the ids are generated per
 * VAT category — `BR-S-08`, `BR-E-08`, `BR-Z-08` are one rule about one block.
 *
 * Rules that fire *because* something is missing point at the block that should have
 * contained it, never at the block that would have been built from it: that one does
 * not exist on a document breaking the rule. So a missing VAT breakdown points at the
 * totals, and missing payment terms at the document details, where the due date sits.
 */
export const ANCHOR_BY_RULE: Record<string, Anchor> = {
  /* totals that do not add up */
  sumOfLines: 'lines',
  allowanceTotal: 'totals',
  chargeTotal: 'totals',
  taxExclusiveTotal: 'totals',
  vatTotal: 'vat',
  taxInclusiveTotal: 'totals',
  payableTotal: 'payable',

  /* the VAT breakdown */
  vatCalculation: 'vat',
  vatRateNotZero: 'vat',
  vatRateZero: 'vat',
  vatExemptionReason: 'vat',
  vatBreakdownMissingCategory: 'vat',
  missingVatBreakdown: 'totals',

  /* fields the document cannot do without */
  missingCustomizationId: 'footer',
  missingId: 'header',
  missingIssueDate: 'details',
  missingTypeCode: 'details',
  missingCurrency: 'details',
  missingSellerName: 'supplier',
  missingSellerAddress: 'supplier',
  missingSellerCountry: 'supplier',
  missingSellerEndpointScheme: 'supplier',
  missingBuyerName: 'customer',
  missingBuyerAddress: 'customer',
  missingBuyerCountry: 'customer',
  missingBuyerEndpointScheme: 'customer',
  missingLines: 'lines',

  /* code lists */
  invalidCurrency: 'details',
  invalidTaxCurrency: 'details',

  /* payment */
  missingPaymentTerms: 'details',
  missingAccount: 'payment',

  /* advisory */
  dueBeforeIssue: 'details',
  noPaymentMeans: 'payable',
};
