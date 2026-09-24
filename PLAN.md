# Upgrade plan

Ordered roughly by the order of work, not by size. Priorities are marked per item.
Phase 1 exists so that phases 2-4 can rewrite `src/ubl.ts` without fear.

---

## Phase 1 - Tests — **DONE**

**Priority: first, blocking.** Everything in phases 2 and 3 edits the parser. There was
no safety net at all.

`src/ubl.ts` is 556 lines of pure, dependency-free `string -> object` logic with eight
sample documents already sitting in `public/samples/`. That is the ideal test target.

- [x] Added `vitest` + `jsdom` (for `DOMParser`), `npm test` / `npm run test:watch`.
      Config lives in the `test` block of `vite.config.ts`.
- [x] Snapshot `parseUbl()` over every file in `public/samples/`. The fixtures are pulled
      in with `import.meta.glob('../public/samples/*.xml', { query: '?raw' })`, so a new
      sample under that directory is covered automatically with no edit to the test, and
      the path does not depend on the working directory.
- [x] Targeted unit tests for the parts with real logic, where a snapshot would not
      explain a regression:
  - `BaseQuantity` normalisation to a per-unit price, including the zero case
  - gross price / price discount from the `Price/AllowanceCharge`, and that a price-level
    *charge* is correctly ignored
  - VAT vs. non-VAT `PartyTaxScheme` selection, including case-insensitive matching
  - the second `TaxTotal` as `taxAmountInTaxCurrency`, and that the VAT breakdown is read
    once (this test is what will catch the Phase 2 `flatMap` fix regressing)
  - credit note tag switching (`CreditNoteLine` / `CreditedQuantity` / `CreditNoteTypeCode`)
  - namespace-aware, direct-child-only traversal (a nested `cbc:ID` must not win)
- [x] Failure cases: malformed and empty XML.
- [x] Formatter tests in `src/i18n.ts` (money, percent, quantity, date, country, address,
      plurals) pinned per locale, with `Intl`'s choice of space character normalised so
      an ICU update does not break the suite. Includes an explicit test that a bare date
      does not shift a day across the timezone boundary.

**Test layout note.** Test files are excluded from `tsconfig.app.json` and covered by a
new `tsconfig.test.json` (referenced from `tsconfig.json`), so `tsc -b` still type-checks
them without leaking Node globals into the app sources.

One `it.todo` marker is parked in the suite for work scheduled below — the Slovak zero
plural (Phase 3.6). Turn it into a real test when the fix lands. (The root-element guard
todo became a real `describe` block when Phase 2 landed.)

---

## Phase 2 - Correctness fixes — **DONE**

**Priority: high.** All four were small and independent.

- [x] **Root-element guard** - `src/ubl.ts`.
      `parseUbl` only checked for a `parsererror`. Any other well-formed XML (an `Order`,
      a CII invoice, an unrelated document) made every `kid()` lookup return null and
      yielded an empty `UblDocument` that rendered as a blank invoice. It now asserts both
      the root element (`Invoice` / `CreditNote`, from the new `ROOTS` table) and its
      namespace, and throws a message naming what it actually found. `App.tsx` already
      catches parse errors, so the user now sees that message instead of a blank page.

- [x] **VAT breakdown can print twice** - `src/ubl.ts`.
      `taxTotals.flatMap(parseTaxSubtotals)` folded in subtotals from *every* `TaxTotal`;
      now reads `taxTotals[0]` only. No snapshot changed, confirming the bug was latent —
      a regression test with a subtotal deliberately repeated in the accounting currency
      covers it.

- [x] **Repeat the table header across pages** - `src/InvoiceDocument.tsx`.
      `fixed` added to the `tableHead` view. Verified by rendering
      `Norwegian-example-1.xml` and reading the text back off both pages; before the fix,
      page 2 began at `4 Returned IBM 5150 desktop` with no header at all.

- [x] **Declare `pdfjs-dist`** - pinned to exactly `6.3.289`, which is what `react-pdf`
      itself pins (not a range), so there is one copy and no drift.

**Also added: `src/pdf.smoke.test.tsx`.** Renders documents with
`@react-pdf/renderer` and reads the text back with `pdfjs-dist`, covering the repeating
table header, the fixed footer, and that Slovak diacritics survive into the PDF. Two
things to know about it:

- It must run under `// @vitest-environment node`. Under jsdom, `@react-pdf` takes its
  browser code path and emits flate streams `pdfjs` cannot read back (`Bad FCHECK in
  flate stream`), so every page comes out with zero text items. The file supplies
  `DOMParser` from jsdom by hand instead.
- Headings are letter-spaced, so `Unit price` comes back as `U N I T   P R I C E`. The
  helper compares with whitespace removed.

---

## Phase 3 - Features

### 3.1 Lazy-load the PDF stack - **priority: high** — **DONE**

The production build was one 2.08 MB chunk (712 kB gzipped) plus a 1.27 MB pdf worker,
all eager. Neither `@react-pdf/renderer` nor `react-pdf` is needed to show the sidebar,
the sample list or the XML view.

- [x] `React.lazy` + `Suspense` around `InvoicePreview`, with `t.loadingDocument` as the
      fallback.
- [x] Moved the `pdfjs.GlobalWorkerOptions.workerSrc` assignment out of `App.tsx` and
      into `InvoicePreview.tsx`, along with the `react-pdf` TextLayer stylesheet.
- [x] Moved the `registerPdfFonts` call out of `src/main.tsx` for the same reason, into
      `InvoicePreview.tsx`. `registerPdfFonts` still takes its base URL as an argument, so
      the Node render path (and `pdf.smoke.test.tsx`) can point it at local files.
- [x] `InvoicePreview.tsx` is now the single entry to the PDF stack and carries a comment
      saying so, because importing any part of it from `main.tsx` or `App.tsx` silently
      undoes the split.
- [x] Added a prefetch: `App` kicks off the dynamic import on mount, unawaited, so the
      chunk downloads in parallel with the first sample fetch. React reuses the same
      module promise when Suspense resolves the component, so this costs nothing and
      keeps time-to-document roughly where it was while the shell paints immediately.

**Regression found and fixed after the fact: the preview flickered.** Worth recording,
because the cause is not obvious and it only showed up in the running app.

react-pdf 11's `<Document>` defaults to **`suspense={true}`**: it loads through
`use(resource.promise)` and genuinely suspends. The original code had no Suspense
boundary anywhere, so React simply waited at the root and committed once the promise
resolved — the default was invisible. Adding a boundary for the lazy chunk put one in the
path of the *document's own* suspension: React hid the subtree
(`style="display: none !important"`) and showed the fallback, the resource never
committed, and the retry cycle regenerated the PDF about once a second. That is the
flicker, and the blob churn that came with it.

The fix is `suspense={false}` on `<Document>` in `InvoicePreview.tsx`. It restores the
effect-based load this viewer was written against — the `loading` and `error` props it
already passes only apply in that mode, and were dead props under the v11 default.

A second, separate dev-server effect contributed to what was on screen: editing
`vite.config.ts` and `package.json` while a dev server was running made Vite re-optimise
dependencies mid-session and serve a second copy of React, so `usePDF` threw
"Invalid hook call". A cold `npm run dev` does not reproduce it, but naming the PDF
packages in `optimizeDeps.include` keeps them off the discovered-late path. Production
builds were never affected by either problem.

**Checked in the browser after the fix:** no console errors, the preview stable with zero
PDF regenerations over 10 s idle, and sample switching, locale switching and the Slovak
document (diacritics intact) all working.

**Result.** Entry chunk **2,083.65 kB → 237.68 kB**, gzipped **711.66 kB → 75.33 kB**
(-89%). The PDF stack is a 1,845.88 kB (638.12 kB gzipped) chunk, and the react-pdf CSS
split out with it. Verified in a browser against `npm run preview`: no console errors,
and the network log shows the entry chunk and CSS first, then the preview chunk in
parallel with the sample fetch, then fonts, worker, and the PDF blob.

### 3.2 Decode the code lists - **priority: high** — **DONE**

Everything is currently printed raw. Anyone who is not a Peppol implementer cannot read
the output.

**Display rule: keep the code visible where the code itself is meaningful to the reader,
and show it as `code - label`.** For example:

```
Type code   380 - Invoice
VAT         S 23 % (Standard rated)
Payment     30 - Credit transfer
```

Where the code is pure machine plumbing and the label is what a human wants, show the
label alone - unit codes are the main case: `10 C62` reads better as `10 pcs`.

- [x] `src/codes.ts` with lookup tables keyed by code:
  - **Unit codes** (UN/ECE Rec 20/21), 27 entries covering countables, time, mass,
    length/area/volume and energy. Label only. `C62`, `H87`, `EA` and `NAR` all map to
    the same "pcs"/"ks" label — every sample uses them interchangeably for countables.
  - **Document type code** (UNTDID 1001), 23 entries. `code - label`.
  - **Payment means code** (UNTDID 4461), 13 entries. `code - label`, with the sender's
    own BT-82 `@name` preferred over the code list when supplied.
  - **VAT category code** (UNTDID 5305), all 9 EN 16931 allows. `code - label`.
  - **Country codes** left to `Intl.DisplayNames` in `i18n.ts`, as planned.
- [x] Wording routed through `src/i18n.ts` (`Strings.codes`, keyed by the semantic keys in
      `codes.ts`) for both `en` and `sk`; the tables stay language-neutral.
- [x] Unknown codes degrade to the raw code — `unit('ZZZ') === 'ZZZ'`,
      `documentType('999') === '999'` — and an absent code stays empty rather than
      printing a stray separator.

**Where each one lands.** Type code in the details meta row; unit in the quantity column
and in the "per N unit" price note; payment means in the payment band; VAT category in the
totals VAT breakdown and in the exemption band. The narrow VAT column in the line table
keeps the bare code plus percentage, as planned.

**The width risk was measured, not eyeballed.** Every decoded string renders as a single
text run with no wrapping, checked by pulling text item positions out of the rendered PDF
for the worst cases. The longest is Slovak on the Norwegian sample —
"DPH S - Základná sadzba 25 % zo základu 1 460,50 NOK" at 215pt inside the 294pt totals
column, leaving ~39pt before the right-aligned amount.

**Tests.** `src/codes.test.ts` asserts every table key has wording in both locales, that
no dictionary entry is orphaned, that codes are stored exactly as the XML writes them, and
the fallback behaviour per formatter. `pdf.smoke.test.tsx` gains assertions that the
decoding actually reaches the rendered page in both locales, that a raw unit code never
appears beside its label, and that an unknown code still prints.

### 3.3 Validation - **priority: high** (the feature that changes what the tool is)

A viewer that cannot say whether the document is *correct* is doing half the job. Two
tiers; ship the first one alone if needed.

- [ ] **Tier 1 - arithmetic (no dependencies, ~50 lines).** Every number is already
      parsed. Check, with a tolerance of half the currency's smallest unit:
  - sum of `Line.amount` == `totals.lineExtension` (BR-CO-10)
  - `lineExtension - allowanceTotal + chargeTotal` == `totals.taxExclusive` (BR-CO-13)
  - sum of `TaxSubtotal.taxAmount` == `totals.taxAmount` (BR-CO-14)
  - `taxExclusive + taxAmount` == `taxInclusive` (BR-CO-15)
  - each subtotal's `taxableAmount x percent` == its `taxAmount` (BR-S-08 and friends)
  - `taxInclusive - prepaid + rounding` == `payable` (BR-CO-16)
- [ ] **Tier 2 - cardinality and code lists.** Required fields present; category `E`
      requires an exemption reason or code; `AE` requires reverse-charge payment terms;
      `EndpointID/@schemeID` is a real EAS code; currency codes are ISO 4217.
- [ ] **Surfacing:** a pass/fail badge in the preview toolbar with a detail panel listing
      each failed rule, the expected value and the found value. Consider an optional band
      on the PDF itself, off by default - the printed document should not shout at the
      reader unless asked.
- [ ] Put the rules in their own module with their own tests; they are pure functions over
      `UblDocument` and every sample should pass tier 1.

### 3.4 Payment QR code - **priority: medium-high**

All the inputs are already parsed. Render into the existing payment band.

- [ ] **PAY by square** for the Slovak audience, **EPC/SEPA QR** (EPC069-12) for the rest.
      Pick by supplier country / IBAN prefix, or offer both when the data supports it.
- [ ] The payload must carry, at minimum:
  - IBAN (`PaymentMeans.account`) and BIC (`PaymentMeans.bic`)
  - amount (`totals.payable`) and currency (`invoice.currency`)
  - **variable symbol** - this is `cbc:PaymentID` (BT-83), parsed as
    `PaymentMeans.paymentId`; `SK-full-example.xml` carries `2026000042`. It is the field
    Slovak payers actually match the payment on, so it must never be dropped.
  - constant symbol and specific symbol when present (SK practice; not in BIS core, so
    they arrive either in `PaymentID` variants or in payment terms text - decide a
    convention and document it here once implemented)
  - due date (`invoice.dueDate`), beneficiary name (`PaymentMeans.accountName` falling
    back to `supplier.name`), and the payment note / reference
- [ ] Skip the QR entirely when there is no IBAN or no payable amount - a QR that scans
      into an incomplete transfer is worse than none.
- [ ] Rendering: generate the matrix and draw it as SVG inside `@react-pdf` rather than
      rasterising, so it stays sharp in print.
- [ ] Test the payload encoding directly - build the string/binary payload from a known
      `UblDocument` and assert on it, rather than trying to assert on the rendered QR.

### 3.5 Embedded attachments - **priority: medium**

`src/ubl.ts:464` keeps an attachment's `filename` and `mimeCode` but throws away the
base64 body in `EmbeddedDocumentBinaryObject`. Attachments are often where the real detail
sits.

- [ ] Parse the base64 content into the `DocumentReference` model.
- [ ] Offer it as a download in the app UI (not in the PDF) next to the attachment entry.
- [ ] Guard the size - a large embedded PDF should not be held in state twice.

### 3.6 Smaller items - **priority: low-medium**

- [ ] Drag-and-drop a file onto the page; `src/App.tsx:120` is a file input only.
- [ ] Put the selected sample and locale in the URL hash so a link reproduces a view.
- [ ] Remove the unreferenced `src/assets/hero.png` and `src/assets/vite.svg`.
- [ ] `pageCount` hand-rolls Slovak plurals in `src/i18n.ts` and gets zero wrong -
      "0 strany" should be "0 strán". Use `Intl.PluralRules`.
- [ ] Double PDF render on mount - `src/InvoicePreview.tsx:29-31`. `usePDF` renders the
      document it was constructed with, then the effect immediately calls `update()` with a
      freshly created element. Skip the first effect run.

---

## Phase 4 - Larger, later

### 4.1 CII support - **priority: low**

Peppol BIS 3.0 is defined over both UBL and UN/CEFACT CII, and most of what circulates in
DE/FR (XRechnung, ZUGFeRD, Factur-X) is CII. Worth doing eventually, not now.

- [ ] Rename `UblDocument` to a syntax-neutral name; the model already has the right shape.
- [ ] Add `parseCii` producing the same type; dispatch on the root element (which the
      Phase 2 guard already has to identify).
- [ ] Nothing downstream of the parser should need to change - that is the test of whether
      the model was genuinely syntax-neutral.

### 4.2 PDF/A-3 with the source XML embedded - **priority: low**

Would turn the output into a hybrid Factur-X-style invoice. `@react-pdf` cannot attach
files, so this needs a `pdf-lib` post-processing pass over the generated bytes plus
PDF/A-3 conformance work (output intent, embedded fonts, XMP metadata). Largest effort of
anything here.

---

## Housekeeping (any time)

- [ ] Replace the Vite template `README.md` - it describes plugin choices, not the project.
- [ ] CI: build + lint + test on push (`npm run build && npm run lint && npm test`).
      `npm run lint` currently reports one pre-existing warning at `src/App.tsx:41`
      (`react(set-state-in-effect)`); decide whether to fix it or waive it before CI
      starts failing on it.
- [ ] A formatter (the repo has no config; the code is consistently formatted by hand).
- [ ] Enable the type-aware oxlint rules the template README itself recommends
      (`oxlint-tsgolint` + `"typeAware": true` in `.oxlintrc.json`).
