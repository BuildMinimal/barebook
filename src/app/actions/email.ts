"use server";

import * as React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { sendMail, verifySmtp } from "@/lib/mail";
import { loadInvoiceForPdf } from "@/invoice/data";
import { getInvoiceDetail } from "@/invoice/queries";
import { ensureFontsRegistered } from "@/invoice/fonts";
import { InvoicePdfDocument } from "@/invoice/template";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile } from "@/settings/store";
import type { InvoiceActionState } from "./time-state";

export async function testSmtpAction(
  _prev: InvoiceActionState,
  _formData: FormData,
): Promise<InvoiceActionState> {
  await requireOwner();
  const result = await verifySmtp();
  return result.ok
    ? { error: null, saved: true }
    : { error: result.error, saved: false };
}

const emailSchema = z.object({ id: z.string().min(1) });

/**
 * Emails the invoice to the client: PDF attached, share link included.
 * Generates a share token if the invoice doesn't have one yet.
 */
export async function emailInvoiceAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireOwner();

  const parsed = emailSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Missing invoice", saved: false };

  const detail = getInvoiceDetail(parsed.data.id);
  if (!detail) return { error: "Invoice not found", saved: false };
  if (!detail.clientEmail) {
    return { error: "The client has no email address on file", saved: false };
  }

  // ensure a share link exists so the body can include it
  let token = detail.shareToken;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    getDb()
      .update(invoices)
      .set({ shareToken: token })
      .where(eq(invoices.id, detail.id))
      .run();
    revalidatePath(`/invoices/${detail.id}`);
  }

  const data = loadInvoiceForPdf(detail.id);
  if (!data) return { error: "Invoice not found", saved: false };

  ensureFontsRegistered();
  const element = React.createElement(InvoicePdfDocument, {
    data,
  }) as unknown as React.ReactElement<DocumentProps>;
  const pdf = await renderToBuffer(element);

  const business = getBusinessProfile();
  const kindLabel = detail.kind === "quote" ? "Quote" : "Invoice";
  const amountLabel =
    detail.paidMinor > 0
      ? `Balance due: ${formatMoney(detail.balanceMinor, detail.currency)}`
      : `Total due: ${formatMoney(detail.totals.totalMinor, detail.currency)}`;

  const result = await sendMail({
    to: detail.clientEmail,
    subject: `${kindLabel} ${detail.number} from ${business.name}`,
    text: [
      `Hi ${detail.clientName},`,
      "",
      `${kindLabel} ${detail.number} is ready.`,
      amountLabel,
      detail.dueDate ? `Due by ${detail.dueDate}.` : "",
      "",
      `View online: /i/${token}`,
      "",
      "The PDF is attached. Thank you!",
      business.name,
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: `${detail.number}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  return result.ok
    ? { error: null, saved: true }
    : { error: result.error, saved: false };
}

/** Manual reminder from the editor: polite nudge with balance + link. */
export async function sendReminderAction(
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireOwner();

  const parsed = emailSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Missing invoice", saved: false };

  const detail = getInvoiceDetail(parsed.data.id);
  if (!detail) return { error: "Invoice not found", saved: false };
  if (!detail.clientEmail) {
    return { error: "The client has no email address on file", saved: false };
  }
  if (detail.balanceMinor <= 0) {
    return { error: "Nothing is outstanding on this invoice", saved: false };
  }

  const business = getBusinessProfile();
  const result = await sendMail({
    to: detail.clientEmail,
    subject: `Reminder: ${kindLabelFor(detail.kind)} ${detail.number} from ${business.name}`,
    text: [
      `Hi ${detail.clientName},`,
      "",
      `A friendly reminder that ${detail.number} has a balance of ${formatMoney(detail.balanceMinor, detail.currency)}.`,
      detail.shareToken ? `View or pay online: /i/${detail.shareToken}` : "",
      "",
      "If you've already sent payment, please disregard this note.",
      business.name,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return result.ok
    ? { error: null, saved: true }
    : { error: result.error, saved: false };
}

function kindLabelFor(kind: string): string {
  return kind === "quote" ? "quote" : "invoice";
}
