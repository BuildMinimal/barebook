"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  clients,
  invoiceLines,
  invoices,
  projects,
  timeEntries,
} from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { nextInvoiceNumber } from "@/invoice/queries";
import { getSetting } from "@/settings/store";
import type { InvoiceFormState } from "./invoice-form-state-types";

function revalidateInvoice(id: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/time");
  revalidatePath("/clients");
}

/** Can lines/meta still be edited? Drafts and quotes are living documents. */
function isEditable(kind: string, status: string): boolean {
  return kind === "quote" || status === "draft";
}

// ---------------------------------------------------------------------------
// creation
// ---------------------------------------------------------------------------

const createSchema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  kind: z.enum(["invoice", "quote"]),
});

export async function createInvoiceAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireOwner();

  const parsed = createSchema.safeParse({
    clientId: formData.get("clientId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const db = getDb();
  const client = db
    .select({ id: clients.id, currency: clients.currency })
    .from(clients)
    .where(eq(clients.id, parsed.data.clientId))
    .get();
  if (!client) return { error: "Client not found" };

  // selected uninvoiced entries (checkboxes named "entryIds")
  const entryIds = formData
    .getAll("entryIds")
    .map(String)
    .filter((v) => v.length > 0);

  const defaultTaxBps = Number(getSetting("tax_default_bps") ?? 0) || 0;
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const prefix = getSetting("invoice_prefix") || String(new Date().getFullYear());
  const number = nextInvoiceNumber(prefix);
  const invoiceId = randomUUID();

  const entries =
    entryIds.length > 0
      ? db
          .select({
            id: timeEntries.id,
            startedAt: timeEntries.startedAt,
            endedAt: timeEntries.endedAt,
            description: timeEntries.description,
            rateMinor: projects.hourlyRateMinor,
            projectName: projects.name,
          })
          .from(timeEntries)
          .innerJoin(projects, eq(projects.id, timeEntries.projectId))
          .where(
            and(
              inArray(timeEntries.id, entryIds),
              eq(timeEntries.billable, true),
              isNull(timeEntries.invoiceId),
              isNotNull(timeEntries.endedAt),
            ),
          )
          .all()
      : [];

  db.transaction((tx) => {
    tx.insert(invoices)
      .values({
        id: invoiceId,
        clientId: parsed.data.clientId,
        kind: parsed.data.kind,
        status: "draft",
        number,
        currency: client.currency ?? getSetting("currency") ?? "USD",
        issueDate: today,
        dueDate: dueDate,
      })
      .run();

    if (entries.length > 0) {
      tx.insert(invoiceLines)
        .values(
          entries.map((e, i) => {
            const minutes = Math.max(
              1,
              Math.round(
                (e.endedAt!.getTime() - e.startedAt.getTime()) / 60000,
              ),
            );
            return {
              id: randomUUID(),
              invoiceId,
              description: e.description ?? `${e.projectName} — work session`,
              qtyMilli: Math.round((minutes / 60) * 1000),
              unit: "hr",
              rateMinor: e.rateMinor ?? 0,
              taxBps: defaultTaxBps,
              position: i,
            };
          }),
        )
        .run();

      tx.update(timeEntries)
        .set({ invoiceId })
        .where(inArray(timeEntries.id, entries.map((e) => e.id)))
        .run();
    }
  });

  revalidateInvoice(invoiceId);
  redirect(`/invoices/${invoiceId}`);
}

// ---------------------------------------------------------------------------
// meta + lines (drafts and quotes only)
// ---------------------------------------------------------------------------

const metaSchema = z.object({
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discountPct: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
});

export async function updateInvoiceMetaAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const invoice = id ? getDb().select().from(invoices).where(eq(invoices.id, id)).get() : null;
  if (!invoice) return { error: "Invoice not found" };
  if (!isEditable(invoice.kind, invoice.status)) {
    return { error: "Sent invoices are locked" };
  }

  const parsed = metaSchema.safeParse({
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    discountPct: formData.get("discountPct") ?? "0",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  getDb()
    .update(invoices)
    .set({
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      discountBps: Math.round(parsed.data.discountPct * 100),
      notes: parsed.data.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id))
    .run();

  revalidateInvoice(id);
  return { error: null };
}

const lineSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  qty: z.coerce.number().min(0.001, "Quantity must be positive").max(100000),
  unit: z.string().trim().min(1).max(12),
  rate: z.coerce.number().min(0, "Rate can't be negative"),
  taxPct: z.coerce.number().min(0).max(100),
});

interface LineValues {
  description: string;
  qtyMilli: number;
  unit: string;
  rateMinor: number;
  taxBps: number;
}

type ParsedLine = { error: string } | { values: LineValues };

function lineInputToValues(formData: FormData): ParsedLine {
  const parsed = lineSchema.safeParse({
    description: formData.get("description"),
    qty: formData.get("qty"),
    unit: formData.get("unit"),
    rate: formData.get("rate"),
    taxPct: formData.get("taxPct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  return {
    values: {
      description: parsed.data.description,
      qtyMilli: Math.round(parsed.data.qty * 1000),
      unit: parsed.data.unit,
      rateMinor: Math.round(parsed.data.rate * 100),
      taxBps: Math.round(parsed.data.taxPct * 100),
    },
  };
}

export async function addInvoiceLineAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const invoice = id ? getDb().select().from(invoices).where(eq(invoices.id, id)).get() : null;
  if (!invoice) return { error: "Invoice not found" };
  if (!isEditable(invoice.kind, invoice.status)) {
    return { error: "Sent invoices are locked" };
  }

  const parsed = lineInputToValues(formData);
  if ("error" in parsed) return { error: parsed.error };

  const existing = getDb()
    .select({ position: invoiceLines.position })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id))
    .all();
  const nextPosition = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;

  getDb()
    .insert(invoiceLines)
    .values({ id: randomUUID(), invoiceId: id, ...parsed.values, position: nextPosition })
    .run();

  revalidateInvoice(id);
  return { error: null };
}

export async function updateInvoiceLineAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const invoice = id ? getDb().select().from(invoices).where(eq(invoices.id, id)).get() : null;
  if (!invoice) return { error: "Invoice not found" };
  if (!isEditable(invoice.kind, invoice.status)) {
    return { error: "Sent invoices are locked" };
  }

  const parsed = lineInputToValues(formData);
  if ("error" in parsed) return { error: parsed.error };

  getDb()
    .update(invoiceLines)
    .set(parsed.values)
    .where(and(eq(invoiceLines.id, lineId), eq(invoiceLines.invoiceId, id)))
    .run();

  revalidateInvoice(id);
  return { error: null };
}

export async function deleteInvoiceLineAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const invoice = id ? getDb().select().from(invoices).where(eq(invoices.id, id)).get() : null;
  if (!invoice || !isEditable(invoice.kind, invoice.status)) return;

  getDb()
    .delete(invoiceLines)
    .where(and(eq(invoiceLines.id, lineId), eq(invoiceLines.invoiceId, id)))
    .run();

  revalidateInvoice(id);
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const invoice = id ? getDb().select().from(invoices).where(eq(invoices.id, id)).get() : null;
  if (!invoice) return;
  if (!isEditable(invoice.kind, invoice.status)) return;

  // release any linked time entries before the cascade takes the invoice
  getDb()
    .update(timeEntries)
    .set({ invoiceId: null })
    .where(eq(timeEntries.invoiceId, id))
    .run();

  getDb().delete(invoices).where(eq(invoices.id, id)).run();

  revalidateInvoice(id);
  redirect("/invoices");
}
