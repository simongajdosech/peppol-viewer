import { Font } from '@react-pdf/renderer';

/**
 * The built-in PDF fonts are WinAnsi-encoded and carry no č/ď/ľ/ň/ŕ/ť, so Slovak
 * text would silently lose its diacritics. PT Sans covers Latin Extended-A and is
 * shipped locally, which also keeps rendering working offline.
 *
 * Registration takes the base URL as an argument rather than reaching for one itself,
 * so a non-browser caller (a Node render script, the PDF tests) can point it at local
 * files. The browser call sits in InvoicePreview, the lazily loaded entry to the PDF
 * stack — calling it from main.tsx instead would pull that whole stack into the entry
 * chunk.
 */
export const PDF_FONT = 'PT Sans';

export function registerPdfFonts(baseUrl: string) {
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: `${baseUrl}PTSans-Regular.ttf` },
      { src: `${baseUrl}PTSans-Bold.ttf`, fontWeight: 'bold' },
    ],
  });

  // Default hyphenation splits Slovak words at implausible points; keep words whole.
  Font.registerHyphenationCallback((word) => [word]);
}
