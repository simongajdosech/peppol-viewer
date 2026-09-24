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

Two `it.todo` markers are parked in the suite for work scheduled below — the root-element
guard (Phase 2) and the Slovak zero plural (Phase 3.6). Turn each into a real test when
the fix lands.

---

## Phase 2 - Correctness fixes

**Priority: high.** All four are small and independent.

- [ ] **Root-element guard** - `src/ubl.ts:481`.
      `parseUbl` only checks for a `parsererror`. Any other well-formed XML (an `Order`,
      a CII invoice, an unrelated document) makes every `kid()` lookup return null and
      yields an empty `UblDocument` that renders as a blank invoice. Assert that
      `root.localName` is `Invoice` or `CreditNote` **and** that the root namespace is the
      matching UBL one; throw a readable error otherwise.

- [ ] **VAT breakdown can print twice** - `src/ubl.ts:536`.
      `taxTotals.flatMap(parseTaxSubtotals)` folds in subtotals from *every* `TaxTotal`,
      but the second one is the accounting-currency restatement whose `TaxAmount` is
      already handled separately. BIS says it carries only `TaxAmount`, so this is latent
      rather than visible - take the breakdown from `taxTotals[0]` only.

- [ ] **Repeat the table header across pages** - `src/InvoiceDocument.tsx:385`.
      `Norwegian-example-1.xml` is multi-page, so page 2 currently shows bare columns of
      numbers. Add `fixed` to the `tableHead` view. Note that `fixed` re-renders the node
      on every page, so keep it free of per-row state.

- [ ] **Declare `pdfjs-dist`** - imported directly at `src/App.tsx:10` but resolved from a
      transitive dependency of `react-pdf`. A react-pdf bump can swap the pdfjs major
      underneath and break the worker URL silently. Add it to `dependencies`, pinned to
      the version react-pdf 11 expects (currently 6.3.x).

---

## Phase 3 - Features

### 3.1 Lazy-load the PDF stack - **priority: high**

Current production build is one 2.08 MB chunk (712 kB gzipped) plus a 1.27 MB pdf worker,
all eager. Neither `@react-pdf/renderer` nor `react-pdf` is needed to show the sidebar,
the sample list or the XML view.

- [ ] `React.lazy` + `Suspense` around `InvoicePreview`, so both PDF libraries land in a
      separate chunk fetched only when the document view is actually shown.
- [ ] Move the `pdfjs.GlobalWorkerOptions.workerSrc` assignment (`src/App.tsx:10`) out of
      `App.tsx` and into the lazily loaded module - otherwise importing `pdfjs` from
      `react-pdf` at the top level drags the whole chunk back into the entry bundle.
- [ ] Same treatment for `registerPdfFonts` in `src/main.tsx`, which imports
      `@react-pdf/renderer` at the entry point.
- [ ] Verify with `npm run build` that the entry chunk actually shrank; the point is the
      first paint, so check what the *entry* pulls, not just the total.

### 3.2 Decode the code lists - **priority: high**

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

- [ ] `src/codes.ts` with lookup tables keyed by code:
  - **Unit codes** (UN/ECE Rec 20): `C62`, `HUR`, `KGM`, `MTR`, `LTR`, `DAY`, `MON`, ...
    Label only. Fall back to the raw code when unknown.
  - **Invoice / credit note type code** (UNTDID 1001): `380`, `381`, `384`, `389`, `326`.
    `code - label`.
  - **Payment means code** (UNTDID 4461): `30`, `31`, `42`, `48`, `58`, `59`, `68`, `97`.
    `code - label`, but keep preferring the `@name` attribute when the sender supplied one
    (already parsed as `PaymentMeans.name`).
  - **VAT category code** (UNTDID 5305): `S`, `Z`, `E`, `AE`, `K`, `G`, `O`, `L`, `M`.
    `code - label`; in the narrow VAT table column keep the bare code plus percentage as
    today, and put the expansion in the VAT breakdown and exemption band where there is
    room.
  - **Country codes** already handled by `Intl.DisplayNames` in `i18n.ts` - leave as is.
- [ ] Route the labels through `src/i18n.ts` so both `en` and `sk` are covered. Keep the
      tables themselves language-neutral (code -> key) and the wording in the dictionaries.
- [ ] Unknown code must always degrade to the raw code, never to an empty cell.

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
