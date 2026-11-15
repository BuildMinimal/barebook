"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { projects } from "@/db/schema";
import { requireOwner } from "@/lib/auth";

export interface ProjectFormState {
  error: string | null;
  saved: boolean;
}

/** "75" or "75.5" (major units) → 7500 / 7550 minor. Empty = no hourly rate. */
function parseRateMinor(input: FormDataEntryValue | null): number | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

const projectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Project name is required"),
  status: z.enum(["active", "archived"]),
  notes: z.string().optional(),
});

function revalidateClient(clientId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/time");
}

export async function createProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireOwner();

  const rateMinor = parseRateMinor(formData.get("hourlyRate"));
  if (Number.isNaN(rateMinor)) {
    return { error: "Hourly rate must be a number", saved: false };
  }

  const parsed = projectSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    status: "active",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", saved: false };
  }

  getDb()
    .insert(projects)
    .values({
      id: randomUUID(),
      clientId: parsed.data.clientId,
      name: parsed.data.name,
      hourlyRateMinor: rateMinor,
      status: parsed.data.status,
      notes: parsed.data.notes?.trim() || null,
    })
    .run();

  revalidateClient(parsed.data.clientId);
  return { error: null, saved: true };
}

export async function updateProjectAction(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!id || !clientId) {
    return { error: "Missing project id", saved: false };
  }

  const rateMinor = parseRateMinor(formData.get("hourlyRate"));
  if (Number.isNaN(rateMinor)) {
    return { error: "Hourly rate must be a number", saved: false };
  }

  const parsed = projectSchema.safeParse({
    clientId,
    name: formData.get("name"),
    status: formData.get("status") === "archived" ? "archived" : "active",
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", saved: false };
  }

  getDb()
    .update(projects)
    .set({
      name: parsed.data.name,
      hourlyRateMinor: rateMinor,
      status: parsed.data.status,
      notes: parsed.data.notes?.trim() || null,
    })
    .where(eq(projects.id, id))
    .run();

  revalidateClient(clientId);
  return { error: null, saved: true };
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (id) {
    getDb().delete(projects).where(eq(projects.id, id)).run();
  }
  revalidateClient(clientId);
  if (!clientId) redirect("/time");
}
