import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatMoney, formatQty } from "@/lib/money";
import type { InvoicePdfData } from "./data";

/*
 * Barebook invoice PDF — A4, Inter, hairline rules, no decoration.
 * The numbers and the names are the design.
 */

const INK = "#18181b";
const MUTED = "#71717a";
const FAINT = "#a1a1aa";
const HAIRLINE = "#e4e4e7";

const styles = StyleSheet.create({
  page: {
    paddingVertical: 48,
    paddingHorizontal: 56,
    fontFamily: "Inter",
    fontSize: 9.5,
    color: INK,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  businessName: { fontSize: 13, fontWeight: 600 },
  businessMeta: { marginTop: 4, color: MUTED, lineHeight: 1.45 },
  docKind: { fontSize: 20, fontWeight: 700, letterSpacing: 2, textAlign: "right" },
  docNumber: { marginTop: 2, fontSize: 10, fontWeight: 600, textAlign: "right" },
  docDates: { marginTop: 6, color: MUTED, textAlign: "right", lineHeight: 1.45 },

  partyBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 24,
  },
  partyLabel: {
    fontSize: 7.5,
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  clientName: { fontSize: 11, fontWeight: 600 },
  clientMeta: { marginTop: 3, color: MUTED, lineHeight: 1.45 },

  tableHeader: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    color: FAINT,
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: HAIRLINE,
  },
  colDescription: { flex: 5, paddingRight: 12 },
  colQty: { flex: 1.2, textAlign: "right" },
  colRate: { flex: 1.6, textAlign: "right" },
  colTax: { flex: 1.2, textAlign: "right" },
  colAmount: { flex: 1.8, textAlign: "right", fontWeight: 600 },

  totalsBlock: {
    marginTop: 18,
    marginLeft: "auto",
    width: "45%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    color: MUTED,
  },
  totalsLabel: {},
  totalsValue: { color: INK },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: INK,
    fontWeight: 700,
    fontSize: 12,
    color: INK,
  },
  footnotes: {
    marginTop: 40,
    color: MUTED,
    lineHeight: 1.5,
    fontSize: 9,
  },
});

function metaLine(invoice: InvoicePdfData): string[] {
  const out: string[] = [];
  if (invoice.issueDate) out.push(`Issued ${invoice.issueDate}`);
  if (invoice.dueDate) out.push(`Due ${invoice.dueDate}`);
  return out;
}

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const kindLabel = data.kind === "quote" ? "QUOTE" : "INVOICE";
  const showPayments = data.kind === "invoice" && data.paidMinor > 0;

  return (
    <Document
      title={`${kindLabel} ${data.number}`}
      author={data.business.name}
    >
      <Page size="A4" style={styles.page}>
        {/* header: business | doc kind + number */}
        <View style={styles.header}>
          <View>
            <Text style={styles.businessName}>{data.business.name}</Text>
            {data.business.address ? (
              <Text style={styles.businessMeta}>{data.business.address}</Text>
            ) : null}
            {data.business.taxId ? (
              <Text style={styles.businessMeta}>Tax ID {data.business.taxId}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.docKind}>{kindLabel}</Text>
            <Text style={styles.docNumber}>{data.number}</Text>
            {metaLine(data).map((line) => (
              <Text key={line} style={styles.docDates}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        {/* billed to */}
        <View style={styles.partyBlock}>
          <View>
            <Text style={styles.partyLabel}>Billed to</Text>
            <Text style={styles.clientName}>
              {data.client.company ?? data.client.name}
            </Text>
            {data.client.company ? (
              <Text style={styles.clientMeta}>{data.client.name}</Text>
            ) : null}
            {data.client.address ? (
              <Text style={styles.clientMeta}>{data.client.address}</Text>
            ) : null}
            {data.client.email ? (
              <Text style={styles.clientMeta}>{data.client.email}</Text>
            ) : null}
            {data.client.taxId ? (
              <Text style={styles.clientMeta}>Tax ID {data.client.taxId}</Text>
            ) : null}
          </View>
        </View>

        {/* lines */}
        <View style={styles.tableHeader}>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colTax}>Tax</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {data.lines.map((line, i) => (
          <View key={i} style={styles.lineRow}>
            <Text style={styles.colDescription}>{line.description}</Text>
            <Text style={styles.colQty}>
              {formatQty(line.qtyMilli)} {line.unit}
            </Text>
            <Text style={styles.colRate}>
              {formatMoney(line.rateMinor, data.currency)}
            </Text>
            <Text style={styles.colTax}>
              {line.taxBps ? `${(line.taxBps / 100).toFixed(2)}%` : "—"}
            </Text>
            <Text style={styles.colAmount}>
              {formatMoney(line.amountMinor, data.currency)}
            </Text>
          </View>
        ))}

        {/* totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>
              {formatMoney(data.totals.subtotalMinor, data.currency)}
            </Text>
          </View>
          {data.totals.discountMinor > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>
                −{formatMoney(data.totals.discountMinor, data.currency)}
              </Text>
            </View>
          ) : null}
          {data.totals.taxMinor > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>
                {formatMoney(data.totals.taxMinor, data.currency)}
              </Text>
            </View>
          ) : null}
          {showPayments ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Amount paid</Text>
              <Text style={styles.totalsValue}>
                −{formatMoney(data.paidMinor, data.currency)}
              </Text>
            </View>
          ) : null}
          <View style={styles.balanceRow}>
            <Text>
              {showPayments ? "Balance due" : "Total due"}
            </Text>
            <Text>
              {formatMoney(
                showPayments ? data.balanceMinor : data.totals.totalMinor,
                data.currency,
              )}
            </Text>
          </View>
        </View>

        {/* notes */}
        {data.notes ? <Text style={styles.footnotes}>{data.notes}</Text> : null}
      </Page>
    </Document>
  );
}
