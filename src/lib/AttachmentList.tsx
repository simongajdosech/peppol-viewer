import { useState } from 'react';
import { attachmentBytes, embeddedAttachments, saveAttachment } from './attachments';
import type { Translation } from './i18n';
import type { UblDocument } from './ubl';

/**
 * The embedded attachments, offered as downloads.
 *
 * This sits in the app shell rather than in the document, for two reasons. An
 * attachment is a file, and a file cannot be handed over by a printed page — the PDF
 * names it, and this saves it. And living outside the lazily loaded PDF chunk means it
 * is there in the XML view too, which is where someone inspecting a document is most
 * likely to want the thing that came with it.
 */
export function AttachmentList({ invoice, t }: { invoice: UblDocument; t: Translation }) {
  const [failed, setFailed] = useState<string | null>(null);
  const files = embeddedAttachments(invoice);

  if (files.length === 0) return null;

  return (
    <section className="pv-root pv-attachments">
      <h3>{t.embeddedAttachments}</h3>
      <ul>
        {files.map((ref, index) => (
          <li key={`${ref.id}-${index}`}>
            <button
              type="button"
              title={t.attachmentDownload}
              onClick={() => {
                try {
                  saveAttachment(ref);
                  setFailed(null);
                } catch {
                  // Malformed base64 is the sender's mistake, and the only way to find
                  // out is to try: say so rather than save a corrupt file.
                  setFailed(ref.attachmentFilename || ref.id);
                }
              }}
            >
              <strong>{ref.attachmentFilename || ref.id || '—'}</strong>
              <span>
                {[ref.attachmentMime, t.bytes(attachmentBytes(ref.attachmentContent))]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {failed !== null && <p className="pv-error">{t.attachmentBroken(failed)}</p>}
    </section>
  );
}
