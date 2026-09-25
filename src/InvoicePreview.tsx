import { useEffect, useMemo, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import { InvoiceDocument } from './InvoiceDocument';
import { ValidationBadge } from './Validation';
import { registerPdfFonts } from './fonts';
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
  const [instance, update] = usePDF({
    document: <InvoiceDocument invoice={invoice} locale={locale} />,
  });
  const [pageCount, setPageCount] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(3);

  // Pure and cheap, but the document only changes when a new file is loaded.
  const findings = useMemo(() => validate(invoice), [invoice]);

  useEffect(() => {
    update(<InvoiceDocument invoice={invoice} locale={locale} />);
  }, [invoice, locale, update]);

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

        <ValidationBadge findings={findings} currency={invoice.currency} t={t} />

        {instance.url && !instance.loading ? (
          <a className="download" href={instance.url} download={filename}>
            {t.download}
          </a>
        ) : (
          <span className="download disabled">{t.download}</span>
        )}
      </div>

      <div className="paper-scroll">
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
                width={BASE_WIDTH * ZOOM_STEPS[zoomIndex]}
                renderAnnotationLayer={false}
                className="paper"
              />
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
