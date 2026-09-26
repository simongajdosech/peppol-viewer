/**
 * peppol-viewer — the public surface.
 *
 * The short version:
 *
 *   import { PeppolViewer } from 'peppol-viewer';
 *   import 'peppol-viewer/styles.css';
 *
 *   <PeppolViewer xml={xml} fontsUrl="/fonts/" />
 *
 * Everything the viewer is built from is exported too, so a caller who wants their own
 * chrome can keep the parsing, the rendering, the validation or the anchor maths and
 * drop the rest. See README.md.
 */

/* ---------- components ---------- */

export { PeppolViewer, type PeppolViewerProps, type HighlightSpec } from './lib/PeppolViewer';
/** The react-pdf document itself, for rendering outside this viewer (`renderToBuffer`, a print job). */
export { InvoiceDocument } from './lib/InvoiceDocument';
/** The download buttons for embedded attachments, usable on its own. */
export { AttachmentList } from './lib/AttachmentList';
/** The pass/fail badge and the panel of findings, usable on its own. */
export { ValidationBadge } from './lib/Validation';

/* ---------- reading a document ---------- */

export { parseUbl } from './lib/ubl';
export type {
  Address,
  AllowanceCharge,
  Delivery,
  DocumentReference,
  ItemProperty,
  Line,
  Party,
  PaymentMeans,
  TaxSubtotal,
  Totals,
  UblDocument,
} from './lib/ubl';

/* ---------- the business rules ---------- */

export { validate, errorsIn, type Finding, type Severity } from './lib/validate';

/* ---------- embedded attachments ---------- */

export {
  attachmentBytes,
  decodeAttachment,
  embeddedAttachments,
  safeFilename,
  safeMime,
  saveAttachment,
} from './lib/attachments';

/* ---------- payment QR codes ---------- */

export {
  bySquarePayload,
  epcPayload,
  isIban,
  normaliseIban,
  paymentQrs,
  paymentSymbols,
  qrMatrix,
  type PaymentQr,
  type PaymentQrKind,
  type PaymentSymbols,
  type QrMatrix,
} from './lib/qr';

/* ---------- highlighting ---------- */

export {
  ANCHOR_BY_RULE,
  BLOCK_ANCHORS,
  BUSINESS_TERMS,
  collectAnchors,
  layoutOf,
  scaleRect,
  type AnchorId,
  type AnchorMap,
  type AnchorRect,
  type BlockAnchor,
  type LayoutNode,
  type LineAnchor,
  type TermAnchor,
} from './lib/anchors';

/* ---------- wording and fonts ---------- */

export {
  LOCALES,
  translation,
  type Formatters,
  type Locale,
  type Strings,
  type Translation,
} from './lib/i18n';
export { PDF_FONT, registerPdfFonts } from './lib/fonts';
export {
  DOCUMENT_TYPE_CODES,
  PAYMENT_MEANS_CODES,
  UNIT_CODES,
  VAT_CATEGORY_CODES,
} from './lib/codes';
