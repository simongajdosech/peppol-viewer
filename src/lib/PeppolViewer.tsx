import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import './styles.css';
import {
  collectAnchors,
  scaleRect,
  type AnchorId,
  type AnchorMap,
  type LayoutNode,
} from './anchors';
import { AttachmentList } from './AttachmentList';
import { InvoiceDocument } from './InvoiceDocument';
import { ValidationBadge } from './Validation';
import { registerPdfFonts } from './fonts';
import { paymentQrs } from './qr';
import { parseUbl, type UblDocument } from './ubl';
import { validate } from './validate';
import { translation, type Locale, type Translation } from './i18n';

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.25, 1.5];
const DEFAULT_ZOOM = 3;
const BASE_WIDTH = 720;

/** Where the package assumes an app serves the files it cannot bundle for it. */
const DEFAULT_FONTS_URL = '/fonts/';
const DEFAULT_WORKER_SRC = '/pdf.worker.min.mjs';

/**
 * The one-time global setup the PDF stack needs: which worker pdfjs runs, and where the
 * typefaces are fetched from.
 *
 * Both are process-wide settings in libraries that expose no per-instance equivalent, so
 * this runs once per distinct value rather than once per mounted viewer. It is called
 * from a component body rather than at module scope so that a consumer can point these
 * at wherever they serve the files, and so that merely importing this module registers
 * nothing.
 *
 * Neither default reaches for the bundler. Writing the usual
 * new URL(<worker>, import.meta.url) here would make Vite weld a megabyte of base64 into
 * the published entry — library mode inlines every asset it can see and ignores
 * assetsInlineLimit — and it would be paid for by consumers who never open a document.
 * So both default to a path an app serves, and both can be replaced with a URL the
 * consumer's own bundler produced. README.md has the one-liner.
 */
let configuredFonts: string | null = null;
let configuredWorker: string | null = null;

function configure(fontsUrl: string, workerSrc: string) {
  if (configuredWorker !== workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    configuredWorker = workerSrc;
  }

  if (configuredFonts !== fontsUrl) {
    registerPdfFonts(fontsUrl);
    configuredFonts = fontsUrl;
  }
}

/**
 * One thing to light up on the page.
 *
 * A bare anchor takes the default tint; the object form is for a caller showing several
 * at once who wants them told apart — an error in red beside the field it refers to.
 */
export type HighlightSpec =
  | AnchorId
  | {
      anchor: AnchorId;
      /** Any CSS colour. Overrides `--pv-highlight` for this box alone. */
      color?: string;
      /** Added to `pv-highlight`, for a caller who would rather style it in their own sheet. */
      className?: string;
    };

type Spec = Exclude<HighlightSpec, string>;

const toSpecs = (value: HighlightSpec | HighlightSpec[] | null | undefined): Spec[] =>
  value == null
    ? []
    : (Array.isArray(value) ? value : [value]).map((spec) =>
        typeof spec === 'string' ? { anchor: spec } : spec,
      );

/** The parts of the viewer a caller can switch off. All are on by default. */
type Chrome = {
  /** The bar above the page. `false` hides it and everything in it. */
  toolbar?: boolean;
  zoom?: boolean;
  download?: boolean;
  /** The switch for the payment QR codes, offered only when the document yields any. */
  qrToggle?: boolean;
  validation?: boolean;
  /** The download buttons for embedded attachments, above the toolbar. */
  attachments?: boolean;
};

type ViewerOptions = Chrome & {
  /** Language of the rendered document and of the controls around it. Default `'en'`. */
  locale?: Locale;
  /** Replaces the wording wholesale, for a caller who wants their own strings. */
  t?: Translation;

  /**
   * Base URL the PT Sans files are served from, ending in a slash. Default `'/fonts/'`.
   *
   * The package ships them under `peppol-viewer/fonts/`; copy them somewhere your app
   * serves and point this at it. Without the right files the Slovak diacritics are the
   * first thing to go.
   */
  fontsUrl?: string;
  /**
   * URL of the pdfjs worker. Default `'/pdf.worker.min.mjs'`.
   *
   * With Vite the tidiest source for it is your own bundler:
   * `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`. Otherwise copy the
   * file out of `node_modules/pdfjs-dist/build/` into whatever you serve statically.
   */
  workerSrc?: string;

  /**
   * What to light up, as an anchor id or a list of them. `anchors.ts` has the vocabulary:
   * blocks (`totals`), line rows (`line:2`), business terms (`bt-115`).
   *
   * Passing this prop at all makes the highlight controlled — the validation panel then
   * only reports what the reader picked, through `onHighlightChange`, and changes nothing
   * by itself. Leave it out to let the viewer keep that state.
   */
  highlight?: HighlightSpec | HighlightSpec[] | null;
  /** Called when the reader picks a finding, with `null` when they clear it. */
  onHighlightChange?: (anchor: AnchorId | null) => void;
  /** Every anchor the last render produced, with its boxes. Fires on each render of the PDF. */
  onAnchors?: (anchors: AnchorMap) => void;
  /** Whether a new highlight scrolls itself into view. Default `true`. */
  scrollToHighlight?: boolean;

  /** Are the payment QR codes drawn to begin with. Default `true`. */
  defaultQr?: boolean;
  /** Name offered for the downloaded file. Defaults to `invoice-<number>-<locale>.pdf`. */
  filename?: string;
  className?: string;
};

export type PeppolViewerProps = ViewerOptions & {
  /** UBL Invoice or CreditNote XML. Parsed here; pass `document` to parse it yourself. */
  xml?: string;
  /** An already-parsed document, from `parseUbl`. Takes precedence over `xml`. */
  document?: UblDocument;
  /** Called when `xml` cannot be parsed. Without it the message is shown in place of the viewer. */
  onParseError?: (error: Error) => void;
};

/**
 * A Peppol BIS Billing 3.0 invoice, rendered to PDF and shown.
 *
 * The document is rendered once with @react-pdf/renderer, and those exact bytes are what
 * both the viewer draws and the download button hands over — so the preview and the file
 * cannot drift apart.
 *
 * Highlighting never re-renders the PDF. The renderer reports where each marked block
 * landed and the highlight is a positioned div over an untouched canvas; `anchors.ts`
 * explains why that is worth the trouble.
 */
export function PeppolViewer({
  xml,
  document: given,
  onParseError,
  ...options
}: PeppolViewerProps) {
  const [invoice, parseError] = useMemo((): [UblDocument | null, Error | null] => {
    if (given) return [given, null];
    if (!xml) return [null, null];
    try {
      return [parseUbl(xml), null];
    } catch (err) {
      return [null, err instanceof Error ? err : new Error(String(err))];
    }
  }, [given, xml]);

  useEffect(() => {
    if (parseError) onParseError?.(parseError);
  }, [parseError, onParseError]);

  if (!invoice) {
    return (
      <div className={classes('pv-root', 'pv-viewer', options.className)}>
        {/* A caller handling the error itself gets an empty frame rather than two reports. */}
        {parseError && !onParseError && <p className="pv-error">{parseError.message}</p>}
      </div>
    );
  }

  return <InvoiceView invoice={invoice} {...options} />;
}

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/**
 * The viewer proper, which only exists once there is a document to draw.
 *
 * Splitting it this way keeps every hook below out of the parse path — `usePDF` starts
 * rendering the moment it is constructed, and there is nothing to render until the XML
 * has turned into a document.
 */
function InvoiceView({
  invoice,
  locale = 'en',
  t: strings,
  fontsUrl = DEFAULT_FONTS_URL,
  workerSrc = DEFAULT_WORKER_SRC,
  highlight,
  onHighlightChange,
  onAnchors,
  scrollToHighlight = true,
  toolbar = true,
  zoom = true,
  download = true,
  qrToggle = true,
  validation = true,
  attachments = true,
  defaultQr = true,
  filename,
  className,
}: ViewerOptions & { invoice: UblDocument }) {
  configure(fontsUrl, workerSrc);

  const t = strings ?? translation(locale);

  const [pageCount, setPageCount] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM);
  const [showQr, setShowQr] = useState(defaultQr);
  const qrToggleId = useId();
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * Where the document's blocks landed, and — when the caller has not taken it over —
   * which of them is lit up.
   *
   * The highlight is drawn over the page rather than rendered into it, so moving it costs
   * one React render of a couple of divs: the PDF, the blob url and every canvas stay
   * exactly as they were. Rendering it into the document would mean new bytes, and
   * react-pdf blanks the whole viewer while it loads a new file. See `anchors.ts`.
   */
  const [anchors, setAnchors] = useState<AnchorMap>({});
  const [ownHighlight, setOwnHighlight] = useState<AnchorId | null>(null);

  // Read through a ref so a caller passing an inline arrow does not have to memoise it:
  // `onLayout` has to stay stable, because `usePDF` reads it back off the element it was
  // last handed, long after the render that passed it in. The ref starts out holding the
  // callback from the first render, so the initial PDF reports to the right place even
  // though the effect below has not run yet.
  const onAnchorsRef = useRef(onAnchors);
  useEffect(() => {
    onAnchorsRef.current = onAnchors;
  }, [onAnchors]);

  const onLayout = useCallback((layout: LayoutNode) => {
    const found = collectAnchors(layout);
    setAnchors(found);
    onAnchorsRef.current?.(found);
  }, []);

  const [instance, update] = usePDF({
    document: (
      <InvoiceDocument invoice={invoice} locale={locale} showQr={showQr} onLayout={onLayout} />
    ),
  });

  // Both pure and cheap, but they only change when a new document is loaded.
  const findings = useMemo(() => validate(invoice), [invoice]);
  // There is nothing to offer a switch for on a document that yields no codes —
  // a credit note, or one without a usable IBAN.
  const hasQr = useMemo(() => paymentQrs(invoice).length > 0, [invoice]);

  /**
   * What `usePDF` was constructed with, and therefore what it has already rendered.
   *
   * The effect below only has work to do once one of these actually changes. Without the
   * comparison, mounting rendered the same invoice twice: `usePDF` once from its initial
   * document, then the effect again from a freshly created element, throwing away a PDF
   * that was already correct along with the blob the viewer had started loading.
   * Comparing values rather than counting runs also keeps StrictMode's second mount from
   * re-rendering in development.
   */
  const renderedFrom = useRef({ invoice, locale, showQr });

  useEffect(() => {
    const previous = renderedFrom.current;
    if (previous.invoice === invoice && previous.locale === locale && previous.showQr === showQr) {
      return;
    }

    renderedFrom.current = { invoice, locale, showQr };
    update(
      <InvoiceDocument invoice={invoice} locale={locale} showQr={showQr} onLayout={onLayout} />,
    );
  }, [invoice, locale, showQr, update, onLayout]);

  // Controlled as soon as the caller passes the prop at all, `null` included.
  const controlled = highlight !== undefined;
  const specs = useMemo(
    () => toSpecs(controlled ? highlight : ownHighlight),
    [controlled, highlight, ownHighlight],
  );

  const select = (anchor: AnchorId | null) => {
    if (!controlled) setOwnHighlight(anchor);
    onHighlightChange?.(anchor);
  };

  /**
   * Brings a new highlight into view, which is the point of it on a document whose totals
   * sit a page below the fold.
   *
   * `pageCount` is a dependency because the pages have to exist before there is anything
   * to scroll to: a re-render of the document remounts them, and the box the reader was
   * sent to goes with them.
   */
  const firstAnchor = specs[0]?.anchor ?? null;

  useEffect(() => {
    if (!scrollToHighlight || !firstAnchor) return;

    const box = scroller.current?.querySelector('.pv-highlight');
    box?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [firstAnchor, pageCount, scrollToHighlight]);

  const pageWidth = BASE_WIDTH * ZOOM_STEPS[zoomIndex];
  // Flattened to one box per page per spec, which is what a page can actually draw.
  const boxes = specs.flatMap((spec) =>
    (anchors[spec.anchor] ?? []).map((rect) => ({ ...spec, rect })),
  );

  const kind = invoice.isCreditNote ? 'creditnote' : 'invoice';
  const downloadName = filename ?? `${kind}-${invoice.id || 'document'}-${locale}.pdf`;

  if (instance.error) {
    return (
      <div className={classes('pv-root', 'pv-viewer', className)}>
        <p className="pv-error">{String(instance.error)}</p>
      </div>
    );
  }

  return (
    <div className={classes('pv-root', 'pv-viewer', className)}>
      {attachments && <AttachmentList invoice={invoice} t={t} />}

      {toolbar && (
        <div className="pv-toolbar">
          {zoom && (
            <div className="pv-zoom">
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
                disabled={zoomIndex === 0}
                aria-label={t.zoomOut}
              >
                −
              </button>
              <span>{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                aria-label={t.zoomIn}
              >
                +
              </button>
            </div>
          )}

          <span className="pv-status">
            {instance.loading ? t.rendering : pageCount > 0 ? t.pageCount(pageCount) : ''}
          </span>

          {qrToggle && hasQr && (
            <label className="pv-qr-toggle" htmlFor={qrToggleId}>
              <input
                id={qrToggleId}
                type="checkbox"
                checked={showQr}
                onChange={(event) => setShowQr(event.target.checked)}
              />
              {t.paymentQr}
            </label>
          )}

          {validation && (
            <ValidationBadge
              findings={findings}
              currency={invoice.currency}
              anchors={anchors}
              highlight={firstAnchor}
              onHighlight={select}
              t={t}
            />
          )}

          {download &&
            (instance.url && !instance.loading ? (
              <a className="pv-download" href={instance.url} download={downloadName}>
                {t.download}
              </a>
            ) : (
              <span className="pv-download pv-disabled">{t.download}</span>
            ))}
        </div>
      )}

      <div className="pv-scroll" ref={scroller}>
        {instance.url && (
          <Document
            file={instance.url}
            // react-pdf 11 defaults to suspense={true}, where the document loads through
            // `use()` and the component suspends. This viewer reports progress with the
            // `loading` and `error` props below, which only apply in the effect-based
            // mode — and a Suspense boundary in the host app would otherwise catch the
            // document's own suspension and flicker its fallback.
            suspense={false}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            loading={<p className="pv-muted">{t.loadingDocument}</p>}
            error={<p className="pv-error">{t.openFailed}</p>}
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                className="pv-paper"
              >
                {/*
                  The highlights. A <Page> renders its children over its own layers, and
                  positions itself, so these are absolute boxes in the page's own space —
                  scaled from points to the width the page is drawn at. A block long
                  enough to break across pages, and the repeated footer, are anchored once
                  per page, hence the filter rather than a single box.
                */}
                {boxes
                  .filter(({ rect }) => rect.page === i)
                  .map(({ rect, color, className: highlightClass }, index) => (
                    <div
                      key={index}
                      className={classes('pv-highlight', highlightClass)}
                      style={{ ...scaleRect(rect, pageWidth), background: color }}
                      aria-hidden
                    />
                  ))}
              </Page>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
