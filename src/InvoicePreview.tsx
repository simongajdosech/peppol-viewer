import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  collectAnchors,
  scaleRect,
  type Anchor,
  type AnchorMap,
  type LayoutNode,
} from './anchors';
import { InvoiceDocument } from './InvoiceDocument';
import { ValidationBadge } from './Validation';
import { registerPdfFonts } from './fonts';
import { paymentQrs } from './qr';
import { validate } from './validate';
import type { Locale, Translation } from './i18n';
import type { UblDocument } from './ubl';

/**
 * This module is the single entry to the PDF stack, and App loads it lazily — both
 * libraries together are the bulk of the bundle and neither is needed to show the
 * sidebar or the XML view. So the one-time setup they need lives here rather than in
 * main.tsx, where importing either one would pull the whole stack back into the
 * entry chunk.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

registerPdfFonts(`${import.meta.env.BASE_URL}fonts/`);

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.25, 1.5];
const BASE_WIDTH = 720;

/**
 * Renders the invoice once with @react-pdf/renderer and shows those exact bytes
 * with react-pdf, so the preview and the downloaded file cannot drift apart.
 */
export function InvoicePreview({
  invoice,
  locale,
  t,
}: {
  invoice: UblDocument;
  locale: Locale;
  t: Translation;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(3);
  const [showQr, setShowQr] = useState(true);
  const qrToggleId = useId();
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * Where the document's blocks landed, and which of them is lit up.
   *
   * The highlight is drawn over the page rather than rendered into it, so moving it costs
   * one React render of a couple of divs — the PDF, the blob url and every canvas stay
   * exactly as they were. Rendering it into the document would mean new bytes, and
   * react-pdf blanks the entire viewer while it loads a new file. See `anchors.ts`.
   */
  const [anchors, setAnchors] = useState<AnchorMap>({});
  const [highlight, setHighlight] = useState<Anchor | null>(null);

  // Stable, because `usePDF` reads this back off the element it was last handed, long
  // after the render that passed it in.
  const onLayout = useCallback((layout: LayoutNode) => setAnchors(collectAnchors(layout)), []);

  const [instance, update] = usePDF({
    document: (
      <InvoiceDocument invoice={invoice} locale={locale} showQr={showQr} onLayout={onLayout} />
    ),
  });

  // Both pure and cheap, but they only change when a new file is loaded.
  const findings = useMemo(() => validate(invoice), [invoice]);
  // There is nothing to offer a switch for on a document that yields no codes —
  // a credit note, or one without a usable IBAN.
  const hasQr = useMemo(() => paymentQrs(invoice).length > 0, [invoice]);

  /**
   * What `usePDF` was constructed with, and therefore what it has already rendered.
   *
   * The effect below only has work to do once one of these actually changes. Without
   * the comparison, mounting rendered the same invoice twice: `usePDF` once from its
   * initial document, then the effect again from a freshly created element, throwing
   * away a PDF that was already correct along with the blob the viewer had started
   * loading. Comparing values rather than counting runs also keeps StrictMode's second
   * mount from re-rendering in development.
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

  /**
   * Brings a new highlight into view, which is the point of it on a document whose totals
   * sit a page below the fold.
   *
   * `pageCount` is a dependency because the pages have to exist before there is anything
   * to scroll to: a re-render of the document remounts them, and the box the reader was
   * sent to goes with them.
   */
  useEffect(() => {
    if (!highlight) return;

    const box = scroller.current?.querySelector('.anchor-highlight');
    box?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [highlight, pageCount]);

  const pageWidth = BASE_WIDTH * ZOOM_STEPS[zoomIndex];
  const highlighted = (highlight && anchors[highlight]) || [];

  const kind = invoice.isCreditNote ? 'creditnote' : 'invoice';
  const filename = `${kind}-${invoice.id || 'document'}-${locale}.pdf`;

  if (instance.error) {
    return <p className="error">{String(instance.error)}</p>;
  }

  return (
    <div className="preview">
      <div className="toolbar">
        <div className="zoom">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            −
          </button>
          <span>{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <span className="status">
          {instance.loading ? t.rendering : pageCount > 0 ? t.pageCount(pageCount) : ''}
        </span>

        {hasQr && (
          <label className="qr-toggle" htmlFor={qrToggleId}>
            <input
              id={qrToggleId}
              type="checkbox"
              checked={showQr}
              onChange={(event) => setShowQr(event.target.checked)}
            />
            {t.paymentQr}
          </label>
        )}

        <ValidationBadge
          findings={findings}
          currency={invoice.currency}
          anchors={anchors}
          highlight={highlight}
          onHighlight={setHighlight}
          t={t}
        />

        {instance.url && !instance.loading ? (
          <a className="download" href={instance.url} download={filename}>
            {t.download}
          </a>
        ) : (
          <span className="download disabled">{t.download}</span>
        )}
      </div>

      <div className="paper-scroll" ref={scroller}>
        {instance.url && (
          <Document
            file={instance.url}
            // react-pdf 11 defaults to suspense={true}, where the document loads through
            // `use()` and the component suspends. This viewer reports progress with the
            // `loading` and `error` props below, which only apply in the effect-based
            // mode — and the App-level Suspense boundary that loads this chunk would
            // otherwise catch the document's own suspension and flicker its fallback.
            suspense={false}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            loading={<p className="muted">{t.loadingDocument}</p>}
            error={<p className="error">Failed to open the generated PDF.</p>}
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <Page
                key={i}
                pageNumber={i + 1}
                width={pageWidth}
                renderAnnotationLayer={false}
                className="paper"
              >
                {/*
                  The highlight. A <Page> renders its children over its own layers, and
                  positions itself, so these are absolute boxes in the page's own space —
                  scaled from points to the width the page is drawn at. A block long
                  enough to break across pages, and the repeated footer, are anchored once
                  per page, hence the filter rather than a single box.
                */}
                {highlighted
                  .filter((rect) => rect.page === i)
                  .map((rect, index) => (
                    <div
                      key={index}
                      className="anchor-highlight"
                      style={scaleRect(rect, pageWidth)}
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
