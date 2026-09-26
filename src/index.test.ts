import { describe, expect, it } from 'vitest';
import * as api from './index';

/**
 * The published surface, written out.
 *
 * Everything here is something a consumer can import by name, so dropping one is a
 * breaking change that this test makes deliberate rather than accidental. Adding an
 * export means adding it here too.
 */
const EXPECTED = [
  /* components */
  'PeppolViewer',
  'InvoiceDocument',
  'AttachmentList',
  'ValidationBadge',
  /* reading a document */
  'parseUbl',
  /* business rules */
  'validate',
  'errorsIn',
  /* attachments */
  'attachmentBytes',
  'decodeAttachment',
  'embeddedAttachments',
  'safeFilename',
  'safeMime',
  'saveAttachment',
  /* payment QR codes */
  'bySquarePayload',
  'epcPayload',
  'isIban',
  'normaliseIban',
  'paymentQrs',
  'paymentSymbols',
  'qrMatrix',
  /* highlighting */
  'ANCHOR_BY_RULE',
  'BLOCK_ANCHORS',
  'BUSINESS_TERMS',
  'collectAnchors',
  'layoutOf',
  'scaleRect',
  /* wording, fonts and code lists */
  'LOCALES',
  'translation',
  'PDF_FONT',
  'registerPdfFonts',
  'DOCUMENT_TYPE_CODES',
  'PAYMENT_MEANS_CODES',
  'UNIT_CODES',
  'VAT_CATEGORY_CODES',
].sort();

describe('the package entry', () => {
  it('exports exactly what it documents', () => {
    expect(Object.keys(api).sort()).toEqual(EXPECTED);
  });

  it('exports the components as components', () => {
    for (const name of ['PeppolViewer', 'InvoiceDocument', 'AttachmentList', 'ValidationBadge']) {
      expect(typeof api[name as keyof typeof api]).toBe('function');
    }
  });

  it('parses and validates through the entry alone', () => {
    // The shortest path a consumer can take: XML in, findings out, with nothing imported
    // from a deep path.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
               xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>TEST-1</cbc:ID>
      </Invoice>`;

    const invoice = api.parseUbl(xml);
    expect(invoice.id).toBe('TEST-1');
    // A document this bare breaks a good many rules, which is the point: the rules ran.
    expect(api.errorsIn(api.validate(invoice)).length).toBeGreaterThan(0);
  });
});
