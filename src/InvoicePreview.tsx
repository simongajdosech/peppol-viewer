import { useEffect, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page } from 'react-pdf';
import { InvoiceDocument } from './InvoiceDocument';
import type { Locale, Translation } from './i18n';
import type { UblDocument } from './ubl';

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
