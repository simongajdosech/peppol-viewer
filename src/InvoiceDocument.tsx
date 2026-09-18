import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  formatAddress,
  formatDate,
  formatMoney,
  formatQuantity,
  type Party,
  type UblDocument,
} from './ubl';

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
    fontFamily: 'Helvetica',
    color: INK,
    lineHeight: 1.45,
  },

  /* header */
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  supplierBlock: { width: '55%' },
  supplierName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 4 },
  titleBlock: { width: '40%', alignItems: 'flex-end' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5, textTransform: 'uppercase' },
  docId: { fontSize: 11, color: MUTED, marginTop: 2 },

  /* generic */
  muted: { color: MUTED },
  bold: { fontFamily: 'Helvetica-Bold' },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: MUTED,
    marginBottom: 5,
  },

  /* parties + meta */
  columns: { flexDirection: 'row', gap: 18, marginBottom: 22 },
  column: { flex: 1 },
  partyName: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },

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
  headCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  colNo: { width: '6%' },
  colItem: { width: '40%', paddingRight: 8 },
  colQty: { width: '15%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colVat: { width: '9%', textAlign: 'right' },
  colAmount: { width: '15%', textAlign: 'right' },

  /* totals */
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totals: { width: '52%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
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
  payableLabel: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#ffffff' },
  payableValue: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#ffffff' },

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

function PartyBlock({ label, party }: { label: string; party: Party }) {
  const identifiers = [
    party.legalName && party.legalName !== party.name ? party.legalName : '',
    party.vatId ? `VAT ${party.vatId}` : '',
    party.companyId ? `Company ID ${party.companyId}` : '',
    party.endpointId ? `Peppol ${party.endpointScheme}:${party.endpointId}` : '',
    [party.contactName, party.phone, party.email].filter(Boolean).join(' · '),
  ].filter(Boolean);

  return (
    <View style={styles.column}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.partyName}>{party.name || '—'}</Text>
      {formatAddress(party.address).map((line) => (
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
      <Text style={styles.bold}>{value}</Text>
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
      <Text style={styles.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

export function InvoiceDocument({ invoice }: { invoice: UblDocument }) {
  const { totals, currency } = invoice;
  const money = (amount: number) => formatMoney(amount, currency);
  const period = [invoice.periodStart, invoice.periodEnd].filter(Boolean).map(formatDate).join(' – ');

  return (
    <Document
      title={`${invoice.title} ${invoice.id}`}
      author={invoice.supplier.name}
      subject={`Peppol BIS Billing 3.0 ${invoice.title}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.supplierBlock}>
            <Text style={styles.supplierName}>{invoice.supplier.name || '—'}</Text>
            {formatAddress(invoice.supplier.address).map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{invoice.title}</Text>
            <Text style={styles.docId}>{invoice.id || '—'}</Text>
          </View>
        </View>

        <View style={styles.columns}>
          <PartyBlock label="Supplier" party={invoice.supplier} />
          <PartyBlock label={invoice.isCreditNote ? 'Credit to' : 'Bill to'} party={invoice.customer} />
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Details</Text>
            <MetaRow label="Issued" value={formatDate(invoice.issueDate)} />
            <MetaRow label="Due" value={formatDate(invoice.dueDate)} />
            <MetaRow label="Delivered" value={formatDate(invoice.deliveryDate)} />
            <MetaRow label="Period" value={period} />
            <MetaRow label="Currency" value={invoice.currency} />
            <MetaRow label="Type code" value={invoice.typeCode} />
            <MetaRow label="Buyer ref." value={invoice.buyerReference} />
            <MetaRow label="Order ref." value={invoice.orderReference} />
            <MetaRow label="Contract" value={invoice.contractReference} />
            <MetaRow label="Cost centre" value={invoice.accountingCost} />
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.headCell, styles.colNo]}>#</Text>
          <Text style={[styles.headCell, styles.colItem]}>Description</Text>
          <Text style={[styles.headCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.headCell, styles.colPrice]}>Unit price</Text>
          <Text style={[styles.headCell, styles.colVat]}>VAT</Text>
          <Text style={[styles.headCell, styles.colAmount]}>Amount</Text>
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
              {formatQuantity(line.quantity)}
              {line.unitCode ? ` ${line.unitCode}` : ''}
            </Text>
            <Text style={styles.colPrice}>{money(line.unitPrice)}</Text>
            <Text style={styles.colVat}>
              {line.taxCategory}
              {line.taxPercent ? ` ${line.taxPercent}%` : ''}
            </Text>
            <Text style={styles.colAmount}>{money(line.amount)}</Text>
          </View>
        ))}

        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totals}>
            <TotalRow label="Sum of line amounts" value={money(totals.lineExtension)} />
            {invoice.allowanceCharges.map((ac, index) => (
              <TotalRow
                key={`${ac.reason}-${index}`}
                label={`${ac.isCharge ? 'Charge' : 'Allowance'}: ${ac.reason || '—'}`}
                value={money(ac.isCharge ? ac.amount : -ac.amount)}
              />
            ))}
            <TotalRow label="Total excl. VAT" value={money(totals.taxExclusive)} divider />
            {invoice.taxSubtotals.map((tax, index) => (
              <TotalRow
                key={`${tax.category}-${index}`}
                label={`VAT ${tax.category}${tax.percent ? ` ${tax.percent}%` : ''} on ${money(tax.taxableAmount)}`}
                value={money(tax.taxAmount)}
              />
            ))}
            <TotalRow label="Total incl. VAT" value={money(totals.taxInclusive)} divider />
            {totals.prepaid !== 0 && <TotalRow label="Prepaid" value={money(-totals.prepaid)} />}
            {totals.rounding !== 0 && <TotalRow label="Rounding" value={money(totals.rounding)} />}
            <View style={styles.payableRow}>
              <Text style={styles.payableLabel}>Amount due ({currency})</Text>
              <Text style={styles.payableValue}>{money(totals.payable)}</Text>
            </View>
          </View>
        </View>

        {invoice.taxSubtotals.some((t) => t.exemptionReason) && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>VAT exemption</Text>
            {invoice.taxSubtotals
              .filter((t) => t.exemptionReason)
              .map((t, index) => (
                <Text key={index}>
                  {t.category}: {t.exemptionReason}
                </Text>
              ))}
          </View>
        )}

        {(invoice.paymentMeans.length > 0 || !!invoice.paymentTerms) && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>Payment</Text>
            {invoice.paymentMeans.map((pm, index) => (
              <View key={index}>
                {!!pm.account && (
                  <Text>
                    <Text style={styles.bold}>Account </Text>
                    {pm.account}
                    {pm.bic ? ` · BIC ${pm.bic}` : ''}
                    {pm.accountName ? ` · ${pm.accountName}` : ''}
                  </Text>
                )}
                {!!pm.paymentId && (
                  <Text>
                    <Text style={styles.bold}>Reference </Text>
                    {pm.paymentId}
                  </Text>
                )}
                {!!pm.name && <Text style={styles.muted}>{`${pm.name} (code ${pm.code})`}</Text>}
              </View>
            ))}
            {!!invoice.paymentTerms && <Text style={styles.muted}>{invoice.paymentTerms}</Text>}
          </View>
        )}

        {invoice.notes.length > 0 && (
          <View style={styles.band} wrap={false}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {invoice.notes.map((note, index) => (
              <Text key={index}>{note}</Text>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            {invoice.title} {invoice.id} · Peppol BIS Billing 3.0
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
