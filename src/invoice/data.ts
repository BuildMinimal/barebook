import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoiceLines, invoices, payments } from "@/db/schema";
import { getAllSettings } from "@/settings/store";
import {
  invoiceTotals,
  lineAmountMinor,
  type InvoiceTotals,
} from "@/lib/money";

export interface InvoicePdfLine {
  description: string;
  qtyMilli: number;
  unit: string;
  rateMinor: number;
  taxBps: number;
  amountMinor: number;
}

export interface InvoicePdfData {
  id: string;
  kind: "draft" | "quote" | "invoice";
  number: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  notes: string | null;
  client: {
    name: string;
    company: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
  };
  business: { name: string; address: string; taxId: string };
  lines: InvoicePdfLine[];
  totals: InvoiceTotals;
  /** Sum of recorded payments against this invoice, minor units. */
  paidMinor: number;
  /** total − paid, floored at 0. */
  balanceMinor: number;
}

/** Loads everything the PDF (and later the share page) needs, in one go. */
export function loadInvoiceForPdf(id: string): InvoicePdfData | null {
  const db = getDb();

  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return null;

  const client = db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .get();
  if (!client) return null;

  const lines = db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .orderBy(asc(invoiceLines.position))
    .all();

  const paidMinor = db
    .select({ amount: payments.amountMinor })
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .all()
    .reduce((sum, p) => sum + p.amount, 0);

  const lineInputs = lines.map((l) => ({
    qtyMilli: l.qtyMilli,
    rateMinor: l.rateMinor,
    taxBps: l.taxBps,
  }));
  const totals = invoiceTotals(lineInputs, invoice.discountBps);

  const business = getAllSettings();

  return {
    id: invoice.id,
    kind: invoice.kind,
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    notes: invoice.notes,
    client: {
      name: client.name,
      company: client.company,
      email: client.email,
      address: client.address,
      taxId: client.taxId,
    },
    business: {
      name: business["business_name"] ?? "Your business",
      address: business["business_address"] ?? "",
      taxId: business["business_tax_id"] ?? "",
    },
    lines: lines.map((l) => ({
      description: l.description,
      qtyMilli: l.qtyMilli,
      unit: l.unit,
      rateMinor: l.rateMinor,
      taxBps: l.taxBps,
      amountMinor: lineAmountMinor(l.qtyMilli, l.rateMinor),
    })),
    totals,
    paidMinor,
    balanceMinor: Math.max(0, totals.totalMinor - paidMinor),
  };
}
