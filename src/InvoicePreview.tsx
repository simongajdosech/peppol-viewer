import { useEffect, useState } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page } from 'react-pdf';
import { InvoiceDocument } from './InvoiceDocument';
import type { UblDocument } from './ubl';

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.25, 1.5];
const BASE_WIDTH = 720;

/**
 * Renders the invoice once with @react-pdf/renderer and shows those exact bytes
 * with react-pdf, so the preview and the downloaded file cannot drift apart.
 */
export function InvoicePreview({ invoice }: { invoice: UblDocument }) {
  const [instance, update] = usePDF({ document: <InvoiceDocument invoice={invoice} /> });
  const [pageCount, setPageCount] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(3);

  useEffect(() => {
    update(<InvoiceDocument invoice={invoice} />);
  }, [invoice, update]);

  const filename = `${invoice.isCreditNote ? 'creditnote' : 'invoice'}-${invoice.id || 'document'}.pdf`;

  if (instance.error) {
    return <p className="error">Could not render the PDF: {String(instance.error)}</p>;
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
          {instance.loading ? 'Rendering…' : pageCount > 0 ? `${pageCount} page(s)` : ''}
        </span>

        {instance.url && !instance.loading ? (
          <a className="download" href={instance.url} download={filename}>
            Download PDF
          </a>
        ) : (
          <span className="download disabled">Download PDF</span>
        )}
      </div>

      <div className="paper-scroll">
        {instance.url && (
          <Document
            file={instance.url}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            loading={<p className="muted">Loading document…</p>}
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
