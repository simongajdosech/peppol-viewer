import { Font } from '@react-pdf/renderer';

/**
 * The built-in PDF fonts are WinAnsi-encoded and carry no č/ď/ľ/ň/ŕ/ť, so Slovak
 * text would silently lose its diacritics. PT Sans covers Latin Extended-A and is
 * shipped locally, which also keeps rendering working offline.
 *
 * Registration is an explicit entry-point step rather than an import side effect,
 * so a non-browser caller (a Node render script) can point it at local files.
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
