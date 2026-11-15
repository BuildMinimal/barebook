"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { timeEntries } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { getSetting } from "@/settings/store";
import { zonedToUtc } from "@/lib/datetime";
import type { TimeEntryState } from "./time-state";

function revalidateTime() {
  revalidatePath("/time");
  revalidatePath("/clients");
}

function getRunningEntry() {
  return getDb()
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.endedAt))
    .get();
}

/** Starts the one allowed running timer. */
export async function startTimerAction(formData: FormData): Promise<void> {
  await requireOwner();

  const projectId = String(formData.get("projectId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!projectId) return;

  if (getRunningEntry()) return; // already running — no-op

  getDb()
    .insert(timeEntries)
    .values({
      id: randomUUID(),
      projectId,
      startedAt: new Date(),
      endedAt: null,
      description: description || null,
      billable: true,
    })
    .run();

  revalidateTime();
}

export async function stopTimerAction(): Promise<void> {
  await requireOwner();

  const running = getRunningEntry();
  if (!running) return;

  const endedAt = new Date();
  // sub-minute work is still work: round up to at least one minute
  const seconds = (endedAt.getTime() - running.startedAt.getTime()) / 1000;
  const ended = seconds < 60
    ? new Date(running.startedAt.getTime() + 60_000)
    : endedAt;

  getDb()
    .update(timeEntries)
    .set({ endedAt: ended })
    .where(eq(timeEntries.id, running.id))
    .run();

  revalidateTime();
}

const manualSchema = z.object({
  projectId: z.string().min(1, "Pick a project"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a start time"),
  minutes: z.coerce
    .number()
    .int("Whole minutes")
    .min(1, "At least one minute")
    .max(24 * 60, "That's more than a day"),
  description: z.string().optional(),
  billable: z.enum(["on", "off"]).optional(),
});

/** Manual entry: date + start time + duration in the business timezone. */
export async function createTimeEntryAction(
  _prev: TimeEntryState,
  formData: FormData,
): Promise<TimeEntryState> {
  await requireOwner();

  const parsed = manualSchema.safeParse({
    projectId: formData.get("projectId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    minutes: formData.get("minutes"),
    description: formData.get("description") ?? "",
    billable: formData.get("billable") ? "on" : "off",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form", saved: false };
  }

  let startedAt: Date;
  try {
    startedAt = zonedToUtc(
      parsed.data.date,
      parsed.data.startTime,
      getSetting("timezone") ?? undefined,
    );
  } catch {
    return { error: "Invalid date or time", saved: false };
  }

  getDb()
    .insert(timeEntries)
    .values({
      id: randomUUID(),
      projectId: parsed.data.projectId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + parsed.data.minutes * 60000),
      description: parsed.data.description?.trim() || null,
      billable: parsed.data.billable === "on",
    })
    .run();

  revalidateTime();
  return { error: null, saved: true };
}

export async function deleteTimeEntryAction(formData: FormData): Promise<void> {
  await requireOwner();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Invoiced entries are locked — deleting would silently un-invoice time.
  const entry = getDb()
    .select({ id: timeEntries.id, invoiceId: timeEntries.invoiceId })
    .from(timeEntries)
    .where(eq(timeEntries.id, id))
    .get();
  if (entry?.invoiceId) return;

  getDb().delete(timeEntries).where(eq(timeEntries.id, id)).run();
  revalidateTime();
}
