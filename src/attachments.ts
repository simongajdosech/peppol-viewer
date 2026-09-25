import type { DocumentReference, UblDocument } from './ubl';

/**
 * Turning an embedded BT-125 attachment back into a file the reader can save.
 *
 * The parsed document keeps the attachment as the base64 the XML wrote, and nothing
 * here runs until someone clicks: a five-megabyte PDF would otherwise sit in memory
 * twice for as long as the invoice is open, once encoded and once decoded.
 *
 * Everything in this file treats the attachment as **untrusted input**. The filename
 * and the media type are attributes a sender chose, so neither reaches the browser
 * unexamined.
 */

/**
 * The media types Peppol BIS Billing 3.0 allows an attachment to carry.
 *
 * Anything else is served as `application/octet-stream`. That is not pedantry: a blob
 * URL inherits the page's origin, so handing the browser a sender-supplied
 * `text/html` would be handing it a script that runs as this app.
 */
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

/** The declared type when the standard permits it, `application/octet-stream` otherwise. */
export function safeMime(declared: string): string {
  const mime = declared.trim().toLowerCase();
  return ALLOWED_MIME.has(mime) ? mime : 'application/octet-stream';
}

/** Control characters, the path separators, and what Windows reserves in a filename. */
// oxlint-disable-next-line no-control-regex -- matching them is the whole point
const UNSAFE_IN_FILENAME = /[\u0000-\u001f\u007f\\/<>:"|?*]/g;

/**
 * A single, ordinary filename.
 *
 * A download lands wherever the browser puts downloads, and a sender-chosen name must
 * not try to steer that — so separators, a leading `..`, control characters and the
 * reserved punctuation all come out. An empty result falls back to `fallback`.
 */
export function safeFilename(name: string, fallback = 'attachment'): string {
  const cleaned = name.replace(UNSAFE_IN_FILENAME, '').replace(/^\.+/, '').trim();

  return cleaned || fallback;
}

/** Decoded size in bytes, worked out from the base64 length without decoding it. */
export function attachmentBytes(base64: string): number {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(base64.length / 4) * 3 - padding);
}

/** The attachments that carry a file, as opposed to a bare reference or a URL. */
export function embeddedAttachments(invoice: UblDocument): DocumentReference[] {
  return invoice.additionalDocuments.filter((ref) => ref.attachmentContent !== '');
}

/**
 * The bytes of one attachment. Throws on base64 the sender got wrong, which is the
 * caller's cue to say so rather than to save a broken file.
 */
export function decodeAttachment(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  // Backed by a plain ArrayBuffer rather than the default ArrayBufferLike, which is
  // what Blob will take.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Hands the decoded attachment to the browser as a download.
 *
 * The blob and its URL live only for this call: the URL is revoked on the next turn of
 * the event loop, once the click has been dispatched, so nothing keeps a second copy
 * of the file alive afterwards.
 */
export function saveAttachment(ref: DocumentReference): void {
  const blob = new Blob([decodeAttachment(ref.attachmentContent)], {
    type: safeMime(ref.attachmentMime),
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = safeFilename(ref.attachmentFilename, ref.id || 'attachment');
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
