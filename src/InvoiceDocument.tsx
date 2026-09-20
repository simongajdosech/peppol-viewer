import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT } from './fonts';
import { translation, type Locale, type Translation } from './i18n';
import type { Party, UblDocument } from './ubl';

const INK = '#1a1d24';
const MUTED = '#6b7280';
const RULE = '#d7dbe2';
const ACCENT = '#1e4fa3';
const BAND = '#f2f4f8';

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: PDF_FONT,
    color: INK,
    lineHeight: 1.45,
  },

  /* header */
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  supplierBlock: { width: '55%' },
  supplierName: { fontSize: 14, fontWeight: 'bold', color: ACCENT, marginBottom: 4 },
  titleBlock: { width: '40%', alignItems: 'flex-end' },
  title: { fontSize: 22, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  docId: { fontSize: 11, color: MUTED, marginTop: 2 },

  /* generic */
  muted: { color: MUTED },
  bold: { fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 5,
  },

  /* parties + meta */
  columns: { flexDirection: 'row', gap: 18, marginBottom: 22 },
  column: { flex: 1 },
  partyName: { fontWeight: 'bold', marginBottom: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
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
  headCell: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  colNo: { width: '6%' },
  colItem: { width: '40%', paddingRight: 8 },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colVat: { width: '9%', textAlign: 'right' },
  colAmount: { width: '15%', textAlign: 'right' },

  /* totals */
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totals: { width: '56%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 2.5 },
  totalLabel: { flexShrink: 1, color: MUTED },
  totalDivider: { borderTopWidth: 0.5, borderTopColor: RULE, marginTop: 3, paddingTop: 5 },
  payableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: ACCENT,
    color: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginTop: 7,
  },
  payableLabel: { fontWeight: 'bold', fontSize: 10, color: '#ffffff' },
  payableValue: { fontWeight: 'bold', fontSize: 12, color: '#ffffff' },

  /* footer blocks */
  band: { backgroundColor: BAND, padding: 10, marginTop: 18 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 6,
    fontSize: 7.5,
    color: MUTED,
  },
});

function PartyBlock({ label, party, t }: { label: string; party: Party; t: Translation }) {
  const identifiers = [
    party.legalName && party.legalName !== party.name ? party.legalName : '',
    party.vatId ? `${t.vatId} ${party.vatId}` : '',
    party.companyId ? `${t.companyId} ${party.companyId}` : '',
    party.endpointId ? `Peppol ${party.endpointScheme}:${party.endpointId}` : '',
    [party.contactName, party.phone, party.email].filter(Boolean).join(' · '),
  ].filter(Boolean);

  return (
    <View style={styles.column}>
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
      <Text style={styles.muted}>{label}</Text>
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

export function InvoiceDocument({
  invoice,
  locale,
}: {
  invoice: UblDocument;
  locale: Locale;
}) {
  const t = translation(locale);
  const { totals, currency } = invoice;
  const money = (amount: number) => t.money(amount, currency);
  const title = invoice.isCreditNote ? t.creditNote : t.invoice;
  const period = [invoice.periodStart, invoice.periodEnd].filter(Boolean).map(t.date).join(' – ');

  return (
    <Document
      title={`${title} ${invoice.id}`}
      author={invoice.supplier.name}
      subject={`Peppol BIS Billing 3.0 · ${title}`}
      language={locale}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.supplierBlock}>
            <Text style={styles.supplierName}>{invoice.supplier.name || '—'}</Text>
            {t.address(invoice.supplier.address).map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.docId}>{invoice.id || '—'}</Text>
          </View>
        </View>

        <View style={styles.columns}>
          <PartyBlock label={t.supplier} party={invoice.supplier} t={t} />
          <PartyBlock
            label={invoice.isCreditNote ? t.creditTo : t.billTo}
            party={invoice.customer}
            t={t}
          />
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.details}</Text>
            <MetaRow label={t.issued} value={t.date(invoice.issueDate)} />
            <MetaRow label={t.due} value={t.date(invoice.dueDate)} />
            <MetaRow label={t.delivered} value={t.date(invoice.deliveryDate)} />
            <MetaRow label={t.period} value={period} />
            <MetaRow label={t.currency} value={invoice.currency} />
            <MetaRow label={t.typeCode} value={invoice.typeCode} />
            <MetaRow label={t.buyerRef} value={invoice.buyerReference} />
            <MetaRow label={t.orderRef} value={invoice.orderReference} />
            <MetaRow label={t.contract} value={invoice.contractReference} />
            <MetaRow label={t.costCentre} value={invoice.accountingCost} />
          </View>
        </View>

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
              {!!line.description && <Text style={styles.muted}>{line.description}</Text>}
              {!!line.note && <Text style={styles.muted}>{line.note}</Text>}
            </View>
            <Text style={styles.colQty}>
              {t.quantity(line.quantity)}
              {line.unitCode ? ` ${line.unitCode}` : ''}
            </Text>
            <Text style={styles.colPrice}>{money(line.unitPrice)}</Text>
            <Text style={styles.colVat}>
              {line.taxCategory}
              {line.taxPercent ? ` ${t.percent(line.taxPercent)}` : ''}
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
                label={`${ac.isCharge ? t.charge : t.allowance}: ${ac.reason || '—'}`}
                value={money(ac.isCharge ? ac.amount : -ac.amount)}
              />
            ))}
            <TotalRow label={t.totalExclVat} value={money(totals.taxExclusive)} divider />
            {invoice.taxSubtotals.map((tax, index) => (
              <TotalRow
                key={`${tax.category}-${index}`}
                label={t.vatOn(tax.category, tax.percent ? t.percent(tax.percent) : '', money(tax.taxableAmount))}
                value={money(tax.taxAmount)}
              />
            ))}
            <TotalRow label={t.totalInclVat} value={money(totals.taxInclusive)} divider />
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

        {invoice.taxSubtotals.some((tax) => tax.exemptionReason) && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.vatExemption}</Text>
            {invoice.taxSubtotals
              .filter((tax) => tax.exemptionReason)
              .map((tax, index) => (
                <Text key={index}>
                  {tax.category}: {tax.exemptionReason}
                </Text>
              ))}
          </View>
        )}

        {(invoice.paymentMeans.length > 0 || !!invoice.paymentTerms) && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>{t.payment}</Text>
            {invoice.paymentMeans.map((pm, index) => (
              <View key={index}>
                {!!pm.account && (
                  <Text>
                    <Text style={styles.bold}>{t.account} </Text>
                    {pm.account}
                    {pm.bic ? ` · BIC ${pm.bic}` : ''}
                    {pm.accountName ? ` · ${pm.accountName}` : ''}
                  </Text>
                )}
                {!!pm.paymentId && (
                  <Text>
                    <Text style={styles.bold}>{t.paymentReference} </Text>
                    {pm.paymentId}
                  </Text>
                )}
                {!!pm.name && <Text style={styles.muted}>{`${pm.name} (${pm.code})`}</Text>}
              </View>
            ))}
            {!!invoice.paymentTerms && <Text style={styles.muted}>{invoice.paymentTerms}</Text>}
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

        <View style={styles.footer} fixed>
          <Text>
            {title} {invoice.id} · Peppol BIS Billing 3.0
          </Text>
          <Text render={({ pageNumber, totalPages }) => t.page(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}
