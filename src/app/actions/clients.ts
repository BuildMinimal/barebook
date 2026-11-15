"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { requireOwner } from "@/lib/auth";

export interface ClientFormState {
  error: string | null;
}

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Enter a valid email or leave it empty",
  });

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  company: z.string().optional(),
  email: optionalEmail,
  address: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().trim().length(3),
  notes: z.string().optional(),
});

function revalidateClients(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireOwner();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    taxId: formData.get("taxId") ?? "",
    currency: formData.get("currency"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const id = randomUUID();
  getDb()
    .insert(clients)
    .values({
      id,
      name: parsed.data.name,
      company: parsed.data.company?.trim() || null,
      email: parsed.data.email || null,
      address: parsed.data.address?.trim() || null,
      taxId: parsed.data.taxId?.trim() || null,
      currency: parsed.data.currency,
      notes: parsed.data.notes?.trim() || null,
    })
    .run();

  revalidateClients(id);
  redirect(`/clients/${id}`);
}

export async function updateClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing client id" };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    taxId: formData.get("taxId") ?? "",
    currency: formData.get("currency"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  getDb()
    .update(clients)
    .set({
      name: parsed.data.name,
      company: parsed.data.company?.trim() || null,
      email: parsed.data.email || null,
      address: parsed.data.address?.trim() || null,
      taxId: parsed.data.taxId?.trim() || null,
      currency: parsed.data.currency,
      notes: parsed.data.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .run();

  revalidateClients(id);
  return { error: null };
}

/**
 * Cascades: projects → time entries, invoices → lines/payments. The UI must
 * confirm (this is the whole client history leaving the book).
 */
export async function deleteClientAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (id) {
    getDb().delete(clients).where(eq(clients.id, id)).run();
  }
  revalidateClients();
  redirect("/clients");
}
