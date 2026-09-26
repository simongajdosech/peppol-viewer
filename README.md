# peppol-viewer

Renders Peppol BIS Billing 3.0 (UBL) invoices and credit notes to PDF in the browser.
Feed it XML and you get a paginated document, a download button, buttons for whatever
files the sender embedded, EN 16931 validation, payment QR codes, and highlighting that
can point at any block, line or field of the rendered page.

English and Slovak, including the diacritics the built-in PDF fonts drop.

```tsx
import { PeppolViewer } from 'peppol-viewer';
import 'peppol-viewer/styles.css';

<PeppolViewer xml={xml} />;
```

## Install

```sh
npm install peppol-viewer
```

`react` and `react-dom` (18 or 19) are peer dependencies. Everything else — the PDF
renderer, pdf.js, the QR encoders — comes with the package.

### Two files you have to serve

Neither can be bundled for you, so both default to a path and can be pointed anywhere.

**The pdf.js worker.** With Vite, let your own bundler produce the URL:

```tsx
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

<PeppolViewer xml={xml} workerSrc={workerSrc} />;
```

Otherwise copy `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into your static
directory; the default expects it at `/pdf.worker.min.mjs`.

**The fonts.** Copy the two `.ttf` files the package ships with into your static
directory:

```sh
cp node_modules/peppol-viewer/fonts/*.ttf public/fonts/
```

The default expects them under `/fonts/`; `fontsUrl` moves that. They are PT Sans, under
the SIL Open Font License (`fonts/OFL.txt`). Without them the PDF still renders, but the
built-in typefaces are WinAnsi-encoded and Slovak text loses its č, ď, ľ, ň, ŕ and ť
silently.

## Highlighting

The point of the anchor system is that highlighting **never re-renders the PDF**. The
renderer reports where every marked block landed; the highlight is a positioned div over
a canvas nobody touched. Moving it costs one React render of a couple of divs, so it is
fast enough to drive from a hover.

Three kinds of anchor:

| Form | Example | Points at |
| --- | --- | --- |
| Block | `totals`, `supplier`, `payment` | A whole section. `BLOCK_ANCHORS` lists all eleven. |
| Line | `line:1`, `line:4` | One row of the line table, by the position it was printed at. |
| Business term | `bt-115`, `bt-31` | One field, by its EN 16931 term. `BUSINESS_TERMS` maps each to its name. |

Uncontrolled, the viewer manages the highlight itself: the reader opens the validation
badge and clicks a finding. Controlled, you decide:

```tsx
const [highlight, setHighlight] = useState<AnchorId | null>(null);

<PeppolViewer
  xml={xml}
  highlight={highlight}
  onHighlightChange={setHighlight}
/>;
```

Several at once, told apart by colour:

```tsx
<PeppolViewer
  xml={xml}
  highlight={[
    { anchor: 'bt-115', color: 'rgba(229, 72, 77, 0.4)' },
    { anchor: 'line:2' },
  ]}
/>;
```

To drive it from your own validator rather than the built-in rules, ask for the anchor
map and light up whatever you recognise:

```tsx
<PeppolViewer xml={xml} onAnchors={(anchors) => setAvailable(Object.keys(anchors))} />
```

An anchor the document did not print — `bt-9` on an invoice with no due date — is simply
absent from the map, and highlighting it shows nothing rather than failing.

## Props

Everything is optional except a source.

| Prop | Default | |
| --- | --- | --- |
| `xml` | — | UBL Invoice or CreditNote XML. |
| `document` | — | An already-parsed `UblDocument`. Wins over `xml`. |
| `locale` | `'en'` | `'en'` or `'sk'`, for the document and the controls. |
| `t` | — | Replaces the wording wholesale. |
| `fontsUrl` | `'/fonts/'` | Where the `.ttf` files are served. |
| `workerSrc` | `'/pdf.worker.min.mjs'` | Where the pdf.js worker is served. |
| `highlight` | — | Anchor, list of anchors, or `null`. Passing it takes control. |
| `onHighlightChange` | — | Fires when the reader picks or clears a finding. |
| `onAnchors` | — | Every anchor of the last render, with its boxes. |
| `onParseError` | — | Fires when `xml` will not parse. Without it the message is shown. |
| `scrollToHighlight` | `true` | Whether a new highlight scrolls itself into view. |
| `toolbar` `zoom` `download` `qrToggle` `validation` `attachments` | `true` | Parts of the chrome, each switchable off. |
| `defaultQr` | `true` | Whether payment QR codes are drawn to begin with. |
| `filename` | `invoice-<number>-<locale>.pdf` | Name offered for the download. |
| `className` | — | Added to the root element. |

## Styling

Every class is prefixed `pv-`, and every colour comes from a `--pv-*` custom property the
package defines itself, so it looks right with no theme and cannot collide with yours.
Override any of them on an ancestor:

```css
.my-app {
  --pv-accent: #0b7285;
  --pv-highlight: rgba(11, 114, 133, 0.35);
  --pv-radius: 4px;
}
```

It follows `prefers-color-scheme` out of the box and honours `prefers-reduced-motion`.

## Using the pieces

The viewer is assembled from parts that are all exported, so you can keep the ones you
want and build your own chrome around them:

```tsx
import {
  parseUbl,          // XML -> UblDocument
  validate,          // UblDocument -> Finding[], EN 16931 / Peppol BIS rules
  errorsIn,
  embeddedAttachments,
  saveAttachment,    // hands the reader a file; sanitises name and media type
  paymentQrs,        // EPC and PAY by square payloads
  qrMatrix,
  InvoiceDocument,   // the @react-pdf document, for rendering outside the browser
  collectAnchors,    // layout tree -> anchor boxes
  scaleRect,
  ANCHOR_BY_RULE,    // Finding.key -> the anchor it concerns
  translation,
} from 'peppol-viewer';
```

`InvoiceDocument` is the react-pdf document itself, so a server-side render is
`renderToBuffer(<InvoiceDocument invoice={parseUbl(xml)} locale="en" />)`.

`saveAttachment` treats the attachment as hostile input: an embedded file is named and
typed by whoever sent the invoice, so the filename is stripped of separators and control
characters, and any media type outside the Peppol list is served as
`application/octet-stream` rather than letting a sender hand the browser something it
would run as your origin.

## What it validates

The EN 16931 and Peppol BIS Billing 3.0 rules that can be checked from the document
alone, without a registry lookup or a code list that goes stale: the totals adding up
(BR-CO-10 … BR-CO-16), the VAT breakdown per category (BR-S, BR-Z, BR-E, BR-AE, BR-IC,
BR-G, BR-O), the mandatory fields, currency codes against ISO 4217, and a few advisory
checks beyond the standard. It is not a substitute for a full Schematron run — and if you
have one, `ANCHOR_BY_RULE` plus `highlight` is how you put its output on the page.

## Licence

LGPL-3.0-or-later. `LICENSE` is the Lesser GPL; `COPYING.GPL-3.0` is the GPL text it
incorporates by reference, and you need both to have the whole licence.

In practice: linking this package into a program of your own — importing it, bundling it,
shipping it — does not make that program subject to the LGPL. Modifying the package
itself does, and those changes have to go back out under the same terms.

The bundled typefaces are not covered by it. PT Sans is under the SIL Open Font License,
whose text travels with them as `fonts/OFL.txt`.

## Development

```sh
npm run dev         # the demo app in src/demo, with the sample invoices
npm test            # 231 tests, including PDF renders read back with pdf.js
npm run build       # the package, into dist/
npm run build:demo  # the demo, into dist-demo/
```

The demo consumes the package through its public entry, so anything missing from
`src/index.ts` breaks the demo first.

`src/lib/anchors.ts` explains the highlighting design, including why the obvious
implementation flickers and this one does not.
