import { getBusinessProfile } from "@/settings/store";
import { getInvoiceDetail, type InvoiceDetail } from "@/invoice/queries";
import type { InvoiceTotals } from "@/lib/money";

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

/** Maps the shared InvoiceDetail into the shape the PDF template needs. */
export function toPdfData(
  detail: InvoiceDetail,
  business: { name: string; address: string; taxId: string },
): InvoicePdfData {
  return {
    id: detail.id,
    kind: detail.kind as InvoicePdfData["kind"],
    number: detail.number,
    issueDate: detail.issueDate,
    dueDate: detail.dueDate,
    currency: detail.currency,
    notes: detail.notes,
    client: {
      name: detail.clientName,
      company: detail.clientCompany,
      email: detail.clientEmail,
      address: detail.clientAddress,
      taxId: detail.clientTaxId,
    },
    business,
    lines: detail.lines.map((l) => ({
      description: l.description,
      qtyMilli: l.qtyMilli,
      unit: l.unit,
      rateMinor: l.rateMinor,
      taxBps: l.taxBps,
      amountMinor: l.amountMinor,
    })),
    totals: detail.totals,
    paidMinor: detail.paidMinor,
    balanceMinor: detail.balanceMinor,
  };
}

/** Everything the PDF needs, in one call. */
export function loadInvoiceForPdf(id: string): InvoicePdfData | null {
  const detail = getInvoiceDetail(id);
  if (!detail) return null;
  return toPdfData(detail, getBusinessProfile());
}
