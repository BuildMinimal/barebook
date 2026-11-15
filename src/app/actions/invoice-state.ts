"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { getInvoiceDetail, nextInvoiceNumber } from "@/invoice/queries";
import { getSetting } from "@/settings/store";
import type { InvoiceActionState } from "./time-state";

function revalidateInvoice(id: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/i");
}

function loadInvoice(id: string) {
  if (!id) return null;
  return getDb().select().from(invoices).where(eq(invoices.id, id)).get() ?? null;
}

// ---------------------------------------------------------------------------
// state transitions
// ---------------------------------------------------------------------------

export async function markSentAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  if (!invoice || invoice.status !== "draft") return;

  getDb()
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .run();
  revalidateInvoice(id);
}

export async function markPaidAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  // paid only makes sense on sent invoices (drafts aren't real money yet)
  if (!invoice || invoice.status !== "sent") return;

  const detail = getInvoiceDetail(id);
  if (!detail || detail.balanceMinor <= 0) return;

  const now = new Date();
  getDb().transaction((tx) => {
    tx.insert(payments)
      .values({
        id: randomUUID(),
        invoiceId: id,
        paidAt: now,
        amountMinor: detail.balanceMinor,
        method: "manual",
        note: "Marked paid",
      })
      .run();
    tx.update(invoices)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(eq(invoices.id, id))
      .run();
  });
  revalidateInvoice(id);
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  if (!invoice || invoice.status === "paid" || invoice.status === "void") {
    return;
  }

  getDb()
    .update(invoices)
    .set({ status: "void", updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .run();
  revalidateInvoice(id);
}

/** Quote → invoice: re-numbers as an invoice and goes back to editable draft. */
export async function convertQuoteAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  if (!invoice || invoice.kind !== "quote" || invoice.status === "paid" || invoice.status === "void") {
    return;
  }

  const prefix = getSetting("invoice_prefix") || String(new Date().getFullYear());
  getDb()
    .update(invoices)
    .set({
      kind: "invoice",
      number: nextInvoiceNumber(prefix),
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id))
    .run();
  revalidateInvoice(id);
}

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.string().optional(),
  note: z.string().optional(),
});

export async function recordPaymentAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  if (!invoice) return { error: "Invoice not found", saved: false };
  if (invoice.status === "draft" || invoice.status === "void") {
    return { error: "Drafts and void invoices can't take payments", saved: false };
  }

  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    paidOn: formData.get("paidOn"),
    method: formData.get("method") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form",
      saved: false,
    };
  }

  const paidAt = new Date(`${parsed.data.paidOn}T12:00:00Z`);
  const amountMinor = Math.round(parsed.data.amount * 100);

  getDb()
    .insert(payments)
    .values({
      id: randomUUID(),
      invoiceId: id,
      paidAt,
      amountMinor,
      method: parsed.data.method?.trim() || null,
      note: parsed.data.note?.trim() || null,
    })
    .run();

  // fully paid? flip the status
  const detail = getInvoiceDetail(id);
  if (detail && detail.balanceMinor === 0) {
    getDb()
      .update(invoices)
      .set({ status: "paid", paidAt, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .run();
  }

  revalidateInvoice(id);
  return { error: null, saved: true };
}

export async function deletePaymentAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("invoiceId") ?? "");
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!id || !paymentId) return;

  getDb()
    .delete(payments)
    .where(eq(payments.id, paymentId))
    .run();

  // payment removal may un-pay the invoice
  const detail = getInvoiceDetail(id);
  const invoice = loadInvoice(id);
  if (detail && invoice?.status === "paid" && detail.balanceMinor > 0) {
    getDb()
      .update(invoices)
      .set({ status: "sent", paidAt: null, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .run();
  }
  revalidateInvoice(id);
}

// ---------------------------------------------------------------------------
// share links
// ---------------------------------------------------------------------------

export async function generateShareTokenAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const invoice = loadInvoice(id);
  if (!invoice || invoice.status === "void") return;

  getDb()
    .update(invoices)
    .set({ shareToken: randomUUID().replace(/-/g, "") })
    .where(eq(invoices.id, id))
    .run();
  revalidateInvoice(id);
}

export async function revokeShareTokenAction(formData: FormData): Promise<void> {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  getDb()
    .update(invoices)
    .set({ shareToken: null })
    .where(eq(invoices.id, id))
    .run();
  revalidateInvoice(id);
}
