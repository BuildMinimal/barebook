import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { timeEntries } from "@/db/schema";
import { roundHalfUp } from "@/lib/money";

export interface UninvoicedSummary {
  /** Total duration in whole minutes. */
  minutes: number;
  /** Value at the project's hourly rate, minor units (0 when no rate). */
  valueMinor: number;
}

/**
 * Billable, not-yet-invoiced, finished time entries for a project.
 * Value = minutes × hourly rate, rounded once — no per-entry residue.
 */
export function projectUninvoiced(
  projectId: string,
  hourlyRateMinor: number | null,
): UninvoicedSummary {
  const entries = getDb()
    .select({
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.projectId, projectId),
        eq(timeEntries.billable, true),
        isNotNull(timeEntries.endedAt),
        isNull(timeEntries.invoiceId),
      ),
    )
    .all();

  const minutes = entries.reduce(
    (sum, e) =>
      sum + Math.max(0, Math.round((e.endedAt!.getTime() - e.startedAt.getTime()) / 60000)),
    0,
  );

  return {
    minutes,
    valueMinor:
      hourlyRateMinor && minutes > 0
        ? roundHalfUp((minutes * hourlyRateMinor) / 60)
        : 0,
  };
}
