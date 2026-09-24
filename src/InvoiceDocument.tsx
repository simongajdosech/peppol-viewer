import type { ReactNode } from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT } from './fonts';
import { translation, type Locale, type Translation } from './i18n';
import type { AllowanceCharge, Line, Party, UblDocument } from './ubl';

const INK = '#1a1d24';
const MUTED = '#6b7280';
const RULE = '#d7dbe2';
const ACCENT = '#1e4fa3';
const BAND = '#f2f4f8';

const BODY = 9;
const LEADING = 1.45;

/**
 * @react-pdf resolves a unitless `lineHeight` against the `fontSize` of the *same*
 * style object and then passes the absolute result down to children. So every style
 * that changes the font size has to restate its own leading, or it would inherit the
 * page's 9pt line box and collide with the text below it.
 */
const sized = (fontSize: number, leading = LEADING) => ({
  fontSize,
  lineHeight: leading,
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 44,
    ...sized(BODY),
    fontFamily: PDF_FONT,
    color: INK,
  },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingBottom: 6,
    marginBottom: 18,
  },
  title: {
    ...sized(21, 1.15),
    fontWeight: 'bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  docNumber: { ...sized(13, 1.15), fontWeight: 'bold', textAlign: 'right' },
  docNumberLabel: { ...sized(7.5, 1.2), color: MUTED, textAlign: 'right' },

  /* generic */
  muted: { color: MUTED },
  bold: { fontWeight: 'bold' },
  sectionTitle: {
    ...sized(8, 1.3),
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 5,
  },

  /* parties + meta */
  columns: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  partyName: { fontWeight: 'bold', marginBottom: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metaLabel: { color: MUTED },
  metaValue: { fontWeight: 'bold', textAlign: 'right' },

  /* line table */
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 5,
  },
  headCell: { ...sized(8, 1.3), fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  detail: { ...sized(7.5, 1.4), color: MUTED },
  colNo: { width: '5%' },
  colItem: { width: '41%', paddingRight: 8 },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colVat: { width: '9%', textAlign: 'right' },
  colAmount: { width: '15%', textAlign: 'right' },

  /* totals */
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totals: { width: '58%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 2.5 },
  totalLabel: { flexShrink: 1, color: MUTED },
  totalDivider: { borderTopWidth: 0.5, borderTopColor: RULE, marginTop: 3, paddingTop: 5 },
  payableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginTop: 7,
  },
  payableLabel: { ...sized(10, 1.2), fontWeight: 'bold', color: '#ffffff' },
  payableValue: { ...sized(12, 1.2), fontWeight: 'bold', color: '#ffffff' },

  /* footer blocks */
  band: { backgroundColor: BAND, padding: 10, marginTop: 14 },
  footer: {
    position: 'absolute',
    bottom: 22,
    height: 28,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 6,
    ...sized(7.5, 1.3),
    color: MUTED,
  },
  /**
   * Inside the absolutely positioned footer a row has no definite height to flex
   * against and collapses, dropping its text from the page — so state it outright.
   */
  footerMain: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, height: 11 },
  footerSpec: { ...sized(6.5, 1.3), color: RULE },
});

/** Joins the parts of a one-line detail, dropping the empty ones. */
const join = (parts: (string | false | undefined)[], separator = ' · ') =>
  parts.filter(Boolean).join(separator);

/**
 * Widths of the three document columns. The meta list holds the longest label/value
 * pairs there are — "Fakturované obdobie" beside a date range — and a Text refuses to
 * shrink below its measured width, so that column is given the room outright rather
 * than left to wrap out of the page. Both column rows share the ratios so the blocks
 * in the second row line up under those in the first.
 */
const COLUMN_FLEX = [1, 1, 1.45];

function Columns({ slots }: { slots: (ReactNode | null)[] }) {
  return (
    <View style={styles.columns}>
      {COLUMN_FLEX.map((flex, index) => (
        <View key={index} style={{ flex }}>
          {slots[index] ?? null}
        </View>
      ))}
    </View>
  );
}

function PartyBlock({
  label,
  party,
  t,
}: {
  label: string;
  party: Party;
  t: Translation;
}) {
  const endpoint = party.endpointId
    ? join([party.endpointScheme, party.endpointId], ':')
    : '';
  const identifiers = [
    party.legalName && party.legalName !== party.name ? party.legalName : '',
    party.vatId && `${t.vatId} ${party.vatId}`,
    party.companyId && `${t.companyId} ${party.companyId}`,
    party.taxRegistration && `${t.taxRegistration} ${party.taxRegistration}`,
    party.legalForm && `${t.legalForm} ${party.legalForm}`,
    // A party identifier that just repeats the Peppol endpoint adds no information.
    ...party.identifiers
      .filter((id) => id !== endpoint)
      .map((id) => `${t.partyId} ${id}`),
    endpoint && `Peppol ${endpoint}`,
    join([party.contactName, party.phone, party.email]),
  ].filter(Boolean);

  return (
    <View>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.partyName}>{party.name || '—'}</Text>
      {t.address(party.address).map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      {identifiers.map((line) => (
        <Text key={line} style={styles.muted}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function TotalRow({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.totalRow, ...(divider ? [styles.totalDivider] : [])]}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

/** "Charge: Cleaning (CG) · 20% × €1,000.00 · VAT S 25%" — the whole BG-20/BG-21 story. */
function allowanceLabel(ac: AllowanceCharge, t: Translation, currency: string): string {
  const reason = ac.reason || ac.reasonCode || '—';
  return join([
    `${ac.isCharge ? t.charge : t.allowance}: ${reason}${
      ac.reason && ac.reasonCode ? ` (${ac.reasonCode})` : ''
    }`,
    join(
      [ac.factor ? t.percent(ac.factor) : '', ac.baseAmount ? t.money(ac.baseAmount, currency) : ''],
      ' × ',
    ),
    ac.taxCategory &&
      `${t.colVat} ${join([ac.taxCategory, ac.taxPercent ? t.percent(ac.taxPercent) : ''], ' ')}`,
  ]);
}

/** The muted sub-lines under an item name: identifiers, classification, references. */
function lineDetails(line: Line, t: Translation, currency: string): string[] {
  const period = join([line.periodStart, line.periodEnd].filter(Boolean).map(t.date), ' – ');

  return [
    line.description,
    line.note,
    join([
      line.sellerItemId && `${t.itemSellerId} ${line.sellerItemId}`,
      line.standardItemId && `${t.itemStandardId} ${line.standardItemId}`,
      line.originCountry && `${t.itemOrigin} ${t.country(line.originCountry)}`,
    ]),
    line.classifications.length > 0 &&
      `${t.itemClassification}: ${line.classifications.join(', ')}`,
    ...line.properties.map((p) => `${p.name}: ${p.value}`),
    // The gross price lives here rather than in the narrow price column, where the
    // label plus two amounts would wrap onto three lines.
    line.grossPrice > 0 &&
      join([
        `${t.grossPrice} ${t.money(line.grossPrice, currency)}`,
        line.priceDiscount > 0 && `−${t.money(line.priceDiscount, currency)}`,
      ]),
    join([
      period && `${t.period} ${period}`,
      line.orderLineReference && `${t.lineOrderRef} ${line.orderLineReference}`,
      line.objectId && `${t.lineObjectRef} ${line.objectId}`,
      line.accountingCost && `${t.costCentre} ${line.accountingCost}`,
    ]),
  ].filter((entry): entry is string => Boolean(entry));
}

export function InvoiceDocument({
  invoice,
  locale,
}: {
  invoice: UblDocument;
  locale: Locale;
}) {
  const t = translation(locale);
  const { totals, currency, delivery } = invoice;
  const money = (amount: number) => t.money(amount, currency);
  const title = invoice.isCreditNote ? t.creditNote : t.invoice;
  const period = join([invoice.periodStart, invoice.periodEnd].filter(Boolean).map(t.date), ' – ');
  const exemptions = invoice.taxSubtotals.filter(
    (tax) => tax.exemptionReason || tax.exemptionReasonCode,
  );

  // Payee, tax representative and the delivery address are optional roles. They share
  // a second row of columns that only exists when the document names at least one.
  const deliveryLines = delivery
    ? [
        delivery.locationId && `${t.locationId} ${delivery.locationId}`,
        ...(delivery.hasAddress ? t.address(delivery.address) : []),
      ].filter((line): line is string => Boolean(line))
    : [];
  const extraParties: ReactNode[] = [
    invoice.payee && <PartyBlock key="payee" label={t.payee} party={invoice.payee} t={t} />,
    invoice.taxRepresentative && (
      <PartyBlock
        key="taxrep"
        label={t.taxRepresentative}
        party={invoice.taxRepresentative}
        t={t}
      />
    ),
    delivery && (delivery.partyName || deliveryLines.length > 0) && (
      <View key="delivery">
        <Text style={styles.sectionTitle}>{t.deliverTo}</Text>
        {!!delivery.partyName && <Text style={styles.partyName}>{delivery.partyName}</Text>}
        {deliveryLines.map((line) => (
          <Text key={line} style={styles.muted}>
            {line}
          </Text>
        ))}
      </View>
    ),
  ].filter(Boolean);

  return (
    <Document
      title={`${title} ${invoice.id}`}
      author={invoice.supplier.name}
      subject={`Peppol BIS Billing 3.0 · ${title}`}
      language={locale}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View>
            <Text style={styles.docNumberLabel}>{t.documentNo}</Text>
            <Text style={styles.docNumber}>{invoice.id || '—'}</Text>
          </View>
        </View>

        <Columns
          slots={[
            <PartyBlock key="supplier" label={t.supplier} party={invoice.supplier} t={t} />,
            <PartyBlock
              key="customer"
              label={invoice.isCreditNote ? t.creditTo : t.billTo}
              party={invoice.customer}
              t={t}
            />,
            <View key="details">
              <Text style={styles.sectionTitle}>{t.details}</Text>
              <MetaRow label={t.issued} value={t.date(invoice.issueDate)} />
              <MetaRow label={t.due} value={t.date(invoice.dueDate)} />
              <MetaRow label={t.delivered} value={t.date(delivery?.date ?? '')} />
              <MetaRow label={t.taxPoint} value={t.date(invoice.taxPointDate)} />
              <MetaRow label={t.period} value={period} />
              <MetaRow label={t.currency} value={invoice.currency} />
              <MetaRow label={t.taxCurrency} value={invoice.taxCurrency} />
              <MetaRow label={t.typeCode} value={invoice.typeCode} />
              <MetaRow label={t.buyerRef} value={invoice.buyerReference} />
              <MetaRow label={t.orderRef} value={invoice.orderReference} />
              <MetaRow label={t.salesOrderRef} value={invoice.salesOrderReference} />
              <MetaRow label={t.contract} value={invoice.contractReference} />
              <MetaRow label={t.project} value={invoice.projectReference} />
              <MetaRow label={t.despatchAdvice} value={invoice.despatchReference} />
              <MetaRow label={t.receiptAdvice} value={invoice.receiptReference} />
              <MetaRow label={t.originatorRef} value={invoice.originatorReference} />
              {invoice.precedingInvoices.map((ref) => (
                <MetaRow
                  key={ref.id}
                  label={t.precedingInvoice}
                  value={join([ref.id, t.date(ref.issueDate)], ' · ')}
                />
              ))}
              <MetaRow label={t.costCentre} value={invoice.accountingCost} />
            </View>,
          ]}
        />

        {extraParties.length > 0 && <Columns slots={extraParties} />}

        <View style={styles.tableHead}>
          <Text style={[styles.headCell, styles.colNo]}>{t.colNo}</Text>
          <Text style={[styles.headCell, styles.colItem]}>{t.colItem}</Text>
          <Text style={[styles.headCell, styles.colQty]}>{t.colQty}</Text>
          <Text style={[styles.headCell, styles.colPrice]}>{t.colPrice}</Text>
          <Text style={[styles.headCell, styles.colVat]}>{t.colVat}</Text>
          <Text style={[styles.headCell, styles.colAmount]}>{t.colAmount}</Text>
        </View>

        {invoice.lines.map((line, index) => (
          <View key={line.id || index} style={styles.row} wrap={false}>
            <Text style={styles.colNo}>{line.id || index + 1}</Text>
            <View style={styles.colItem}>
              <Text>{line.name || '—'}</Text>
              {lineDetails(line, t, currency).map((detail) => (
                <Text key={detail} style={styles.detail}>
                  {detail}
                </Text>
              ))}
              {line.allowanceCharges.map((ac, acIndex) => (
                <Text key={`${ac.reason}-${acIndex}`} style={styles.detail}>
                  {join([
                    allowanceLabel(ac, t, currency),
                    money(ac.isCharge ? ac.amount : -ac.amount),
                  ])}
                </Text>
              ))}
            </View>
            <Text style={styles.colQty}>
              {join([t.quantity(line.quantity), line.unitCode], ' ')}
            </Text>
            <View style={styles.colPrice}>
              <Text>{money(line.unitPrice)}</Text>
              {line.baseQuantity !== 1 && (
                <Text style={styles.detail}>
                  {t.pricePer(t.quantity(line.baseQuantity), line.baseQuantityUnit)}
                </Text>
              )}
            </View>
            <Text style={styles.colVat}>
              {join([line.taxCategory, line.taxPercent ? t.percent(line.taxPercent) : ''], ' ')}
            </Text>
            <Text style={styles.colAmount}>{money(line.amount)}</Text>
          </View>
        ))}

        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totals}>
            <TotalRow label={t.sumOfLines} value={money(totals.lineExtension)} />
            {invoice.allowanceCharges.map((ac, index) => (
              <TotalRow
                key={`${ac.reason}-${index}`}
                label={allowanceLabel(ac, t, currency)}
                value={money(ac.isCharge ? ac.amount : -ac.amount)}
              />
            ))}
            <TotalRow label={t.totalExclVat} value={money(totals.taxExclusive)} divider />
            {invoice.taxSubtotals.map((tax, index) => (
              <TotalRow
                key={`${tax.category}-${index}`}
                label={t.vatOn(
                  tax.category,
                  tax.percent ? t.percent(tax.percent) : '',
                  money(tax.taxableAmount),
                )}
                value={money(tax.taxAmount)}
              />
            ))}
            <TotalRow label={t.totalInclVat} value={money(totals.taxInclusive)} divider />
            {invoice.taxAmountInTaxCurrency !== null && (
              <TotalRow
                label={t.vatIn(invoice.taxCurrency)}
                value={t.money(invoice.taxAmountInTaxCurrency, invoice.taxCurrency)}
              />
            )}
            {totals.prepaid !== 0 && <TotalRow label={t.prepaid} value={money(-totals.prepaid)} />}
            {totals.rounding !== 0 && <TotalRow label={t.rounding} value={money(totals.rounding)} />}
            <View style={styles.payableRow}>
              <Text style={styles.payableLabel}>
                {t.amountDue} ({currency})
              </Text>
              <Text style={styles.payableValue}>{money(totals.payable)}</Text>
            </View>
          </View>
        </View>

        {exemptions.length > 0 && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.vatExemption}</Text>
            {exemptions.map((tax, index) => (
              <Text key={index}>
                {tax.category}: {join([tax.exemptionReason, tax.exemptionReasonCode], ' · ')}
              </Text>
            ))}
          </View>
        )}

        {(invoice.paymentMeans.length > 0 || invoice.paymentTerms.length > 0) && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.payment}</Text>
            {invoice.paymentMeans.map((pm, index) => (
              <View key={index}>
                {!!pm.account && (
                  <Text>
                    <Text style={styles.bold}>{t.account} </Text>
                    {join([pm.account, pm.bic && `BIC ${pm.bic}`, pm.accountName])}
                  </Text>
                )}
                {!!pm.cardId && (
                  <Text>
                    <Text style={styles.bold}>{t.card} </Text>
                    {join([pm.cardId, pm.cardNetwork, pm.cardHolder])}
                  </Text>
                )}
                {!!pm.mandateId && (
                  <Text>
                    <Text style={styles.bold}>{t.directDebit} </Text>
                    {join([
                      `${t.mandate} ${pm.mandateId}`,
                      pm.debitedAccount && `${t.debitedAccount} ${pm.debitedAccount}`,
                    ])}
                  </Text>
                )}
                {!!pm.paymentId && (
                  <Text>
                    <Text style={styles.bold}>{t.paymentReference} </Text>
                    {pm.paymentId}
                  </Text>
                )}
                {!!pm.code && (
                  <Text style={styles.muted}>
                    {t.paymentMeansCode} {pm.name ? `${pm.name} (${pm.code})` : pm.code}
                  </Text>
                )}
              </View>
            ))}
            {invoice.paymentTerms.map((term, index) => (
              <Text key={index} style={styles.muted}>
                {term}
              </Text>
            ))}
          </View>
        )}

        {invoice.additionalDocuments.length > 0 && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.attachments}</Text>
            {invoice.additionalDocuments.map((ref, index) => (
              <Text key={index}>
                <Text style={styles.bold}>{join([ref.scheme, ref.id], ':') || '—'} </Text>
                <Text style={styles.muted}>
                  {join([
                    ref.description,
                    ref.typeCode,
                    ref.uri,
                    ref.attachmentFilename &&
                      `${t.embedded}: ${join([ref.attachmentFilename, ref.attachmentMime], ' · ')}`,
                  ])}
                </Text>
              </Text>
            ))}
          </View>
        )}

        {invoice.notes.length > 0 && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.notes}</Text>
            {invoice.notes.map((note, index) => (
              <Text key={index}>{note}</Text>
            ))}
          </View>
        )}

        {/*
          A "page n of m" counter would need <Text render>, whose output @react-pdf
          4.9.0 drops from the page — anywhere in the document, fixed or not. The
          viewer reports the page count instead.
        */}
        <View style={styles.footer} fixed>
          <View style={styles.footerMain}>
            <Text>{join([title, invoice.id], ' · ')}</Text>
            <Text>{invoice.supplier.name}</Text>
          </View>
          <Text style={styles.footerSpec}>
            {join([invoice.customizationId, invoice.profileId]) || 'Peppol BIS Billing 3.0'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
