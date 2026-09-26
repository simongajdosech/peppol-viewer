import { describe, expect, it } from 'vitest';
import {
  attachmentBytes,
  decodeAttachment,
  embeddedAttachments,
  safeFilename,
  safeMime,
} from './attachments';
import { parseUbl } from './ubl';

const samples = import.meta.glob('../../public/samples/*.xml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sample = (name: string) => parseUbl(samples[`../../public/samples/${name}`]);

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('safeMime', () => {
  it('keeps the types Peppol BIS allows an attachment to be', () => {
    expect(safeMime('application/pdf')).toBe('application/pdf');
    expect(safeMime('image/png')).toBe('image/png');
    expect(safeMime('text/csv')).toBe('text/csv');
    expect(safeMime('application/vnd.oasis.opendocument.spreadsheet')).toBe(
      'application/vnd.oasis.opendocument.spreadsheet',
    );
  });

  it('is not case- or whitespace-sensitive about them', () => {
    expect(safeMime('  Application/PDF  ')).toBe('application/pdf');
  });

  it('refuses to hand the browser anything it would run', () => {
    // A blob URL inherits this page's origin, so a sender-chosen text/html would be a
    // script running as the app. Everything unlisted is served as a plain download.
    expect(safeMime('text/html')).toBe('application/octet-stream');
    expect(safeMime('image/svg+xml')).toBe('application/octet-stream');
    expect(safeMime('application/javascript')).toBe('application/octet-stream');
    expect(safeMime('')).toBe('application/octet-stream');
  });
});

describe('safeFilename', () => {
  it('leaves an ordinary name alone', () => {
    expect(safeFilename('Hours-spent.csv')).toBe('Hours-spent.csv');
    expect(safeFilename('faktúra príloha.pdf')).toBe('faktúra príloha.pdf');
  });

  it('will not let a sender steer where the file lands', () => {
    expect(safeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(safeFilename('C:\\Windows\\System32\\evil.dll')).toBe('CWindowsSystem32evil.dll');
    expect(safeFilename('.bashrc')).toBe('bashrc');
  });

  it('strips control characters, which can hide the real extension', () => {
    expect(safeFilename('report\u0000.pdf')).toBe('report.pdf');
    expect(safeFilename('a\u001fb.csv')).toBe('ab.csv');
  });

  it('falls back when nothing usable is left', () => {
    expect(safeFilename('')).toBe('attachment');
    expect(safeFilename('///')).toBe('attachment');
    expect(safeFilename('', 'Doc2')).toBe('Doc2');
  });
});

describe('attachmentBytes', () => {
  it('gives the decoded size without decoding', () => {
    // "Test base 64 encoding" — 21 bytes, 28 base64 characters, no padding.
    expect(attachmentBytes('VGVzdCBiYXNlIDY0IGVuY29kaW5n')).toBe(21);
  });

  it('accounts for each amount of padding', () => {
    expect(attachmentBytes(btoa('abc'))).toBe(3); // none
    expect(attachmentBytes(btoa('ab'))).toBe(2); // '='
    expect(attachmentBytes(btoa('a'))).toBe(1); // '=='
  });

  it('is zero for no attachment at all', () => {
    expect(attachmentBytes('')).toBe(0);
  });
});

describe('decodeAttachment', () => {
  it('returns the bytes the sender encoded', () => {
    expect(text(decodeAttachment('VGVzdCBiYXNlIDY0IGVuY29kaW5n'))).toBe('Test base 64 encoding');
  });

  it('survives a byte that is not valid text', () => {
    const bytes = decodeAttachment(btoa('\u0000\u00ff\u0080'));

    expect(Array.from(bytes)).toEqual([0, 255, 128]);
  });

  it('throws on base64 the sender got wrong', () => {
    // The caller turns this into a message; it must not quietly save a broken file.
    expect(() => decodeAttachment('not base64!!')).toThrow();
  });
});

describe('the parsed document', () => {
  it('keeps the embedded content, normalised out of its line wrapping', () => {
    const [attachment] = embeddedAttachments(sample('Norwegian-example-1.xml'));

    expect(attachment.id).toBe('Doc2');
    expect(attachment.attachmentFilename).toBe('Hours-spent.csv');
    expect(attachment.attachmentMime).toBe('application/pdf');
    expect(text(decodeAttachment(attachment.attachmentContent))).toBe('Test base 64 encoding');
  });

  it('un-wraps base64 a writer split across lines, which atob would reject', () => {
    const wrapped = samples['../../public/samples/Norwegian-example-1.xml'].replace(
      'VGVzdCBiYXNlIDY0IGVuY29kaW5n',
      'VGVzdCBiYXNl\n\t\tIDY0IGVuY29k\n\t\taW5n',
    );
    const [attachment] = embeddedAttachments(parseUbl(wrapped));

    expect(attachment.attachmentContent).toBe('VGVzdCBiYXNlIDY0IGVuY29kaW5n');
    expect(text(decodeAttachment(attachment.attachmentContent))).toBe('Test base 64 encoding');
  });

  it('leaves a reference with no file out of the list', () => {
    // Allowance-example carries four AdditionalDocumentReferences — an ID, a URL, and
    // no embedded bytes anywhere.
    const invoice = sample('Allowance-example.xml');

    expect(invoice.additionalDocuments.length).toBeGreaterThan(0);
    expect(embeddedAttachments(invoice)).toEqual([]);
  });

  it('has nothing to offer on a document without references at all', () => {
    expect(embeddedAttachments(sample('SK-full-example.xml'))).toEqual([]);
  });
});
