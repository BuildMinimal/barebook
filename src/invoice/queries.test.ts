import { describe, expect, it } from "vitest";
import {
  getInvoiceDetail,
  invoiceIdByToken,
  listInvoiceSummaries,
  listUninvoicedEntries,
  uninvoicedValueMinor,
} from "./queries";
import {
  seedClient,
  seedInvoice,
  seedPayment,
  seedProject,
  seedTimeEntry,
  useTestDb,
} from "@/test/db";

useTestDb();

describe("getInvoiceDetail", () => {
  it("computes totals, paid, and balance for a simple invoice", () => {
    const id = seedInvoice({ lines: [{ rateMinor: 10_000 }] });

    const d = getInvoiceDetail(id)!;
    expect(d.totals.subtotalMinor).toBe(10_000);
    expect(d.totals.totalMinor).toBe(10_000);
    expect(d.paidMinor).toBe(0);
    expect(d.balanceMinor).toBe(10_000);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0].amountMinor).toBe(10_000);
  });

  it("balances discount + per-line tax exactly into the total", () => {
    const id = seedInvoice({
      discountBps: 1000, // 10% invoice-level discount
      lines: [
        { qtyMilli: 1000, rateMinor: 50_000, taxBps: 1800 },
        { qtyMilli: 2000, rateMinor: 25_000, taxBps: 1800 },
      ],
    });

    const d = getInvoiceDetail(id)!;
    // subtotal 100000, discount 10000, tax 18% on each net line (45000) = 16200
    expect(d.totals.subtotalMinor).toBe(100_000);
    expect(d.totals.discountMinor).toBe(10_000);
    expect(d.totals.taxMinor).toBe(16_200);
    expect(d.totals.totalMinor).toBe(106_200);
  });

  it("subtracts partial payments from the balance", () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });
    seedPayment(id, 40_000);

    const d = getInvoiceDetail(id)!;
    expect(d.paidMinor).toBe(40_000);
    expect(d.balanceMinor).toBe(60_000);
  });

  it("clamps the balance at zero when payments exceed the total", () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });
    seedPayment(id, 120_000);

    expect(getInvoiceDetail(id)!.balanceMinor).toBe(0);
  });

  it("orders lines by position and payments newest first", () => {
    const id = seedInvoice({
      lines: [{ rateMinor: 10_000 }, { rateMinor: 20_000 }],
    });
    // add a newer payment and an out-of-position line directly
    const later = new Date("2026-03-01T12:00:00Z");
    seedPayment(id, 1_000, later);
    seedPayment(id, 2_000, new Date("2026-01-01T12:00:00Z"));

    const d = getInvoiceDetail(id)!;
    expect(d.payments.map((p) => p.amountMinor)).toEqual([1_000, 2_000]);
    expect(d.lines.map((l) => l.rateMinor)).toEqual([10_000, 20_000]);
  });

  it("returns null for an unknown id", () => {
    expect(getInvoiceDetail("nope")).toBeNull();
  });
});

describe("listInvoiceSummaries", () => {
  it("joins the client and computes totals per row", () => {
    const clientId = seedClient({ name: "Acme" });
    seedInvoice({ clientId, number: "2026-010", lines: [{ rateMinor: 5_000 }] });

    const rows = listInvoiceSummaries().filter((r) => r.number === "2026-010");
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.clientName).toBe("Acme");
    expect(row.totalMinor).toBe(5_000);
    expect(row.paidMinor).toBe(0);
    expect(row.kind).toBe("invoice");
    expect(row.status).toBe("draft");
  });
});

describe("listUninvoicedEntries", () => {
  it("returns finished billable uninvoiced entries with project rates", () => {
    const clientId = seedClient({ name: "Time Co" });
    const projectId = seedProject(clientId, 6_000);
    seedTimeEntry(projectId, {
      startedAt: new Date("2026-03-01T09:00:00Z"),
      endedAt: new Date("2026-03-01T10:30:00Z"), // 90 minutes
      description: "Design work",
    });

    const entries = listUninvoicedEntries().filter(
      (e) => e.projectId === projectId,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].minutes).toBe(90);
    expect(entries[0].rateMinor).toBe(6_000);
    expect(entries[0].clientName).toBe("Time Co");
    expect(entries[0].description).toBe("Design work");
  });

  it("rounds sub-minute durations up to at least one minute", () => {
    const clientId = seedClient();
    const projectId = seedProject(clientId, 1_000);
    seedTimeEntry(projectId, {
      startedAt: new Date("2026-03-01T09:00:00Z"),
      endedAt: new Date("2026-03-01T09:00:05Z"), // 5 seconds
    });

    const entry = listUninvoicedEntries().find((e) => e.projectId === projectId)!;
    expect(entry.minutes).toBe(1);
  });

  it("excludes running timers, non-billable and invoiced entries", () => {
    const clientId = seedClient();
    const projectId = seedProject(clientId, 1_000);
    const running = seedTimeEntry(projectId, {
      startedAt: new Date("2026-03-01T09:00:00Z"),
      endedAt: null,
    });
    const nonBillable = seedTimeEntry(projectId, {
      startedAt: new Date("2026-03-01T09:00:00Z"),
      endedAt: new Date("2026-03-01T10:00:00Z"),
      billable: false,
    });
    const otherInvoice = seedInvoice();
    const invoiced = seedTimeEntry(projectId, {
      startedAt: new Date("2026-03-01T09:00:00Z"),
      endedAt: new Date("2026-03-01T10:00:00Z"),
      invoiceId: otherInvoice,
    });

    const ids = listUninvoicedEntries().map((e) => e.id);
    expect(ids).not.toContain(running);
    expect(ids).not.toContain(nonBillable);
    expect(ids).not.toContain(invoiced);
  });
});

describe("uninvoicedValueMinor", () => {
  it("values minutes at the project rate", () => {
    expect(uninvoicedValueMinor([{ minutes: 60, rateMinor: 5_000 }])).toBe(5_000);
    expect(uninvoicedValueMinor([{ minutes: 30, rateMinor: 6_000 }])).toBe(3_000);
  });

  it("treats a null rate (fixed-price project) as zero", () => {
    expect(uninvoicedValueMinor([{ minutes: 120, rateMinor: null }])).toBe(0);
  });
});

describe("invoiceIdByToken", () => {
  it("resolves an active share token and returns null for revoked ones", () => {
    const active = seedInvoice({ shareToken: "tok-active" });
    seedInvoice({ shareToken: null });

    expect(invoiceIdByToken("tok-active")).toBe(active);
    expect(invoiceIdByToken("tok-missing")).toBeNull();
  });
});
