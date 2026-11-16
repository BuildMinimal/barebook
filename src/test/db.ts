import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll } from "vitest";
import { closeDb, getDb } from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  clients,
  invoiceLines,
  invoices,
  payments,
  projects,
  timeEntries,
} from "@/db/schema";

type InvoiceKind = typeof invoices.$inferInsert["kind"];
type InvoiceStatus = typeof invoices.$inferInsert["status"];

/**
 * Test harness: a fresh SQLite database per test file.
 *
 * Call useTestDb() at the top level of a *.test.ts file. It points DATA_DIR at
 * a throwaway temp dir and runs the real migrations before the tests run —
 * every getDb() in the code under test then hits that database.
 */

/** Minimal shape for seeding invoice lines (omittable fields get defaults). */
export interface SeedLine {
  description?: string;
  qtyMilli?: number;
  unit?: string;
  rateMinor: number;
  taxBps?: number;
}

export interface SeedInvoice {
  clientId?: string;
  kind?: InvoiceKind;
  status?: InvoiceStatus;
  number?: string;
  currency?: string;
  /** Exchange rate in millionths (1100000 = 1.1). */
  fxRate?: number;
  discountBps?: number;
  issueDate?: string | null;
  dueDate?: string | null;
  shareToken?: string | null;
  paidAt?: Date | null;
  lines?: SeedLine[];
}

export function useTestDb(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "barebook-test-"));

  beforeAll(() => {
    // Vitest may reuse a worker process across files — drop any db the
    // previous file left open before pointing at our own data dir.
    closeDb();
    process.env.DATA_DIR = dir;
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });
}

// ---------------------------------------------------------------------------
// seed helpers — insert directly through drizzle, return generated ids
// ---------------------------------------------------------------------------

export function seedClient(overrides: Partial<typeof clients.$inferInsert> = {}): string {
  const id = overrides.id ?? randomUUID();
  getDb()
    .insert(clients)
    .values({ id, name: overrides.name ?? "Test Client", ...overrides })
    .run();
  return id;
}

export function seedProject(
  clientId: string,
  hourlyRateMinor: number | null,
  overrides: Partial<typeof projects.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  getDb()
    .insert(projects)
    .values({ id, clientId, name: "Test project", hourlyRateMinor, ...overrides })
    .run();
  return id;
}

export function seedTimeEntry(
  projectId: string,
  opts: {
    startedAt: Date;
    endedAt: Date | null;
    billable?: boolean;
    invoiceId?: string | null;
    description?: string | null;
  },
): string {
  const id = randomUUID();
  getDb()
    .insert(timeEntries)
    .values({
      id,
      projectId,
      startedAt: opts.startedAt,
      endedAt: opts.endedAt,
      billable: opts.billable ?? true,
      invoiceId: opts.invoiceId ?? null,
      description: opts.description ?? null,
    })
    .run();
  return id;
}

export function seedInvoice(opts: SeedInvoice = {}): string {
  const id = randomUUID();
  getDb()
    .insert(invoices)
    .values({
      id,
      clientId: opts.clientId ?? seedClient(),
      kind: opts.kind ?? "invoice",
      status: opts.status ?? "draft",
      number: opts.number ?? `2026-${String(Math.floor(Math.random() * 899) + 100)}`,
      currency: opts.currency ?? "USD",
      fxRate: opts.fxRate ?? 1_000_000,
      issueDate: opts.issueDate ?? null,
      dueDate: opts.dueDate ?? null,
      discountBps: opts.discountBps ?? 0,
      shareToken: opts.shareToken ?? null,
      paidAt: opts.paidAt ?? null,
    })
    .run();

  (opts.lines ?? []).forEach((line, i) => {
    getDb()
      .insert(invoiceLines)
      .values({
        id: randomUUID(),
        invoiceId: id,
        description: line.description ?? `Line ${i + 1}`,
        qtyMilli: line.qtyMilli ?? 1000,
        unit: line.unit ?? "item",
        rateMinor: line.rateMinor,
        taxBps: line.taxBps ?? 0,
        position: i,
      })
      .run();
  });

  return id;
}

export function seedPayment(
  invoiceId: string,
  amountMinor: number,
  paidAt: Date = new Date(),
): string {
  const id = randomUUID();
  getDb()
    .insert(payments)
    .values({ id, invoiceId, paidAt, amountMinor, method: null, note: null })
    .run();
  return id;
}
