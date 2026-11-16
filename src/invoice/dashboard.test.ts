import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardStats } from "./queries";
import {
  seedClient,
  seedInvoice,
  seedPayment,
  seedProject,
  seedTimeEntry,
  initTestDb,
} from "@/test/db";

initTestDb();

// Frozen clock: dashboard "today" is always 2026-11-17.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

const TZ = "UTC";

describe("dashboardStats — outstanding", () => {
  it("sums only sent invoices with a balance", () => {
    const before = dashboardStats(TZ).outstandingMinor;
    seedInvoice({ status: "sent", dueDate: "2026-12-01", lines: [{ rateMinor: 10_000 }] });
    seedInvoice({ status: "draft", lines: [{ rateMinor: 50_000 }] });
    seedInvoice({ status: "paid", lines: [{ rateMinor: 20_000 }] });
    seedInvoice({ status: "void", lines: [{ rateMinor: 30_000 }] });
    seedInvoice({ kind: "quote", status: "sent", lines: [{ rateMinor: 40_000 }] });

    const after = dashboardStats(TZ).outstandingMinor;
    expect(after - before).toBe(10_000);
  });

  it("converts foreign-currency invoices at the captured fx rate", () => {
    const before = dashboardStats(TZ).outstandingMinor;
    // €100.00 at fx 1.1 -> $110.00 outstanding
    seedInvoice({
      status: "sent",
      currency: "EUR",
      fxRate: 1_100_000,
      dueDate: "2026-12-01",
      lines: [{ rateMinor: 10_000 }],
    });

    const after = dashboardStats(TZ).outstandingMinor;
    expect(after - before).toBe(11_000);
  });

  it("excludes fully-paid sent invoices from outstanding", () => {
    const before = dashboardStats(TZ).outstandingMinor;
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 10_000 }] });
    seedPayment(id, 10_000);

    const after = dashboardStats(TZ).outstandingMinor;
    expect(after - before).toBe(0);
  });
});

describe("dashboardStats — overdue", () => {
  it("lists sent past-due invoices with a balance, oldest due first", () => {
    const late = seedInvoice({
      status: "sent",
      dueDate: "2026-11-10",
      number: "2026-201",
      lines: [{ rateMinor: 10_000 }],
    });
    const later = seedInvoice({
      status: "sent",
      dueDate: "2026-11-15",
      number: "2026-202",
      lines: [{ rateMinor: 20_000 }],
    });
    // noise: paid past-due and future-due invoices are not overdue
    const paidLate = seedInvoice({
      status: "sent",
      dueDate: "2026-11-01",
      lines: [{ rateMinor: 5_000 }],
    });
    seedPayment(paidLate, 5_000);
    seedInvoice({ status: "sent", dueDate: "2026-12-01", lines: [{ rateMinor: 5_000 }] });

    const overdue = dashboardStats(TZ).overdue;
    const mine = overdue.filter((o) => o.id === late || o.id === later);
    expect(mine.map((o) => o.id)).toEqual([late, later]); // sorted by dueDate
    expect(overdue.find((o) => o.id === paidLate)).toBeUndefined();
  });

  it("does not list an invoice due today", () => {
    const dueToday = seedInvoice({
      status: "sent",
      dueDate: "2026-11-17",
      lines: [{ rateMinor: 10_000 }],
    });

    expect(dashboardStats(TZ).overdue.find((o) => o.id === dueToday)).toBeUndefined();
  });

  it("reports the overdue balance in the invoice's own currency", () => {
    const id = seedInvoice({
      status: "sent",
      currency: "EUR",
      fxRate: 1_100_000,
      dueDate: "2026-11-01",
      lines: [{ rateMinor: 10_000 }],
    });

    const row = dashboardStats(TZ).overdue.find((o) => o.id === id)!;
    // €100.00 invoice — the row is displayed with the invoice's currency
    expect(row.balanceMinor).toBe(10_000);
    expect(row.currency).toBe("EUR");
  });
});

describe("dashboardStats — revenue MTD", () => {
  it("counts payments received this month at the invoice's fx rate", () => {
    const before = dashboardStats(TZ).revenueMtdMinor;
    // $100 invoice, €payment recorded against it at fx 1.1 -> $110 revenue
    const eur = seedInvoice({ status: "paid", currency: "EUR", fxRate: 1_100_000 });
    seedPayment(eur, 100_000, new Date("2026-11-05T10:00:00Z"));
    const usd = seedInvoice({ status: "paid" });
    seedPayment(usd, 4_000, new Date("2026-11-10T10:00:00Z"));
    // last month's payment doesn't count
    const old = seedInvoice({ status: "paid" });
    seedPayment(old, 90_000, new Date("2026-10-20T10:00:00Z"));

    const after = dashboardStats(TZ).revenueMtdMinor;
    expect(after - before).toBe(114_000);
  });
});

describe("dashboardStats — uninvoiced rollup", () => {
  it("adds billable uninvoiced minutes across projects", () => {
    const before = dashboardStats(TZ);
    const clientId = seedClient();
    const project = seedProject(clientId, 6_000);
    seedTimeEntry(project, {
      startedAt: new Date("2026-11-01T09:00:00Z"),
      endedAt: new Date("2026-11-01T10:30:00Z"), // 90 min at 6000 -> 9000
    });

    const after = dashboardStats(TZ);
    expect(after.uninvoicedMinutes - before.uninvoicedMinutes).toBe(90);
    expect(after.uninvoicedValueMinor - before.uninvoicedValueMinor).toBe(9_000);
  });
});
