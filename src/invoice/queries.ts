import { and, asc, desc, eq, isNull, isNotNull, like } from "drizzle-orm";
import { getDb } from "@/db";
import {
  clients,
  invoiceLines,
  invoices,
  payments,
  projects,
  timeEntries,
} from "@/db/schema";
import { invoiceTotals, lineAmountMinor, type InvoiceTotals } from "@/lib/money";
import { roundHalfUp } from "@/lib/money";

export interface InvoiceSummary {
  id: string;
  kind: string;
  status: string;
  number: string;
  clientName: string;
  clientId: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  shareToken: string | null;
}

/** List view rows with computed totals. "overdue" is derived, not stored. */
export function listInvoiceSummaries(): InvoiceSummary[] {
  const db = getDb();
  const rows = db
    .select({
      id: invoices.id,
      kind: invoices.kind,
      status: invoices.status,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      discountBps: invoices.discountBps,
      clientId: clients.id,
      clientName: clients.name,
      shareToken: invoices.shareToken,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .orderBy(desc(invoices.createdAt))
    .all();

  return rows.map((r) => {
    const lines = db
      .select({
        qtyMilli: invoiceLines.qtyMilli,
        rateMinor: invoiceLines.rateMinor,
        taxBps: invoiceLines.taxBps,
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, r.id))
      .all();

    const paidMinor = db
      .select({ amount: payments.amountMinor })
      .from(payments)
      .where(eq(payments.invoiceId, r.id))
      .all()
      .reduce((sum, p) => sum + p.amount, 0);

    const totals = invoiceTotals(
      lines.map((l) => ({
        qtyMilli: l.qtyMilli,
        rateMinor: l.rateMinor,
        taxBps: l.taxBps,
      })),
      r.discountBps,
    );

    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      number: r.number,
      clientName: r.clientName,
      clientId: r.clientId,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      currency: r.currency,
      totalMinor: totals.totalMinor,
      paidMinor,
      shareToken: r.shareToken,
    };
  });
}

export interface InvoiceLineDetail {
  id: string;
  description: string;
  qtyMilli: number;
  unit: string;
  rateMinor: number;
  taxBps: number;
  amountMinor: number;
}

export interface InvoiceDetail {
  id: string;
  kind: string;
  status: string;
  number: string;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  discountBps: number;
  notes: string | null;
  shareToken: string | null;
  clientId: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  clientTaxId: string | null;
  lines: InvoiceLineDetail[];
  totals: InvoiceTotals;
  paidMinor: number;
  balanceMinor: number;
  payments: {
    id: string;
    paidAt: Date;
    amountMinor: number;
    method: string | null;
    note: string | null;
  }[];
}

export function getInvoiceDetail(id: string): InvoiceDetail | null {
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

  const paymentRows = db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.paidAt))
    .all();

  const totals = invoiceTotals(
    lines.map((l) => ({
      qtyMilli: l.qtyMilli,
      rateMinor: l.rateMinor,
      taxBps: l.taxBps,
    })),
    invoice.discountBps,
  );

  const paidMinor = paymentRows.reduce((sum, p) => sum + p.amountMinor, 0);

  return {
    id: invoice.id,
    kind: invoice.kind,
    status: invoice.status,
    number: invoice.number,
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    discountBps: invoice.discountBps,
    notes: invoice.notes,
    shareToken: invoice.shareToken,
    clientId: client.id,
    clientName: client.name,
    clientCompany: client.company,
    clientEmail: client.email,
    clientAddress: client.address,
    clientTaxId: client.taxId,
    lines: lines.map((l) => ({
      id: l.id,
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
    payments: paymentRows.map((p) => ({
      id: p.id,
      paidAt: p.paidAt,
      amountMinor: p.amountMinor,
      method: p.method,
      note: p.note,
    })),
  };
}

export interface UninvoicedEntry {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  clientId: string;
  startedAt: Date;
  minutes: number;
  description: string | null;
  rateMinor: number | null;
}

/** Finished, billable, not-yet-invoiced entries with their project rate. */
export function listUninvoicedEntries(): UninvoicedEntry[] {
  const db = getDb();
  const rows = db
    .select({
      id: timeEntries.id,
      projectId: projects.id,
      projectName: projects.name,
      clientId: clients.id,
      clientName: clients.name,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      description: timeEntries.description,
      rateMinor: projects.hourlyRateMinor,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        eq(timeEntries.billable, true),
        isNotNull(timeEntries.endedAt),
        isNull(timeEntries.invoiceId),
      ),
    )
    .orderBy(asc(timeEntries.startedAt))
    .all();

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    clientId: r.clientId,
    clientName: r.clientName,
    startedAt: r.startedAt,
    minutes: Math.max(
      1,
      Math.round((r.endedAt!.getTime() - r.startedAt.getTime()) / 60000),
    ),
    description: r.description,
    rateMinor: r.rateMinor,
  }));
}

/** Next "prefix-00N" for the given prefix; inspects existing numbers. */
export function nextInvoiceNumber(prefix: string): string {
  const db = getDb();
  const rows = db
    .select({ number: invoices.number })
    .from(invoices)
    .where(like(invoices.number, `${prefix}-%`))
    .all();

  let max = 0;
  for (const r of rows) {
    const seq = Number(r.number.slice(prefix.length + 1));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Value of uninvoiced minutes for a set of entries at their project rates. */
export function uninvoicedValueMinor(
  entries: { minutes: number; rateMinor: number | null }[],
): number {
  return entries.reduce(
    (sum, e) =>
      sum + (e.rateMinor ? roundHalfUp((e.minutes * e.rateMinor) / 60) : 0),
    0,
  );
}
