import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { nextInvoiceNumber } from "./queries";
import { setSetting } from "@/settings/store";
import { convertQuoteAction } from "@/app/actions/invoice-state";
import { seedInvoice, initTestDb } from "@/test/db";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(async () => ({ id: "owner-1", email: "owner@barebook.test" })),
}));

initTestDb();

function fd(id: string): FormData {
  const form = new FormData();
  form.set("id", id);
  return form;
}

async function row(id: string) {
  return getDb().select().from(invoices).where(eq(invoices.id, id)).get()!;
}

describe("convertQuoteAction", () => {
  it("turns a sent quote into an editable draft invoice with a fresh number", async () => {
    setSetting("invoice_prefix", "BB");
    const id = seedInvoice({ kind: "quote", status: "sent", number: "Q-0001" });

    await convertQuoteAction(fd(id));

    const r = await row(id);
    expect(r.kind).toBe("invoice");
    expect(r.status).toBe("draft");
    expect(r.number).toBe("BB-001");
  });

  it("continues the sequence for subsequent conversions", async () => {
    setSetting("invoice_prefix", "BB");
    const first = seedInvoice({ kind: "quote", status: "sent", number: "Q-0002" });
    const second = seedInvoice({ kind: "quote", status: "draft", number: "Q-0003" });

    await convertQuoteAction(fd(first));
    await convertQuoteAction(fd(second));

    expect((await row(first)).number).toBe("BB-002");
    expect((await row(second)).number).toBe("BB-003");
  });

  it("defaults the prefix to the current year when none is configured", async () => {
    setSetting("invoice_prefix", "");
    const year = String(new Date().getFullYear());
    const expected = nextInvoiceNumber(year); // before the action claims the number
    const id = seedInvoice({ kind: "quote", status: "draft", number: "Q-0009" });

    await convertQuoteAction(fd(id));

    expect((await row(id)).number).toBe(expected);
  });

  it("refuses paid, void, and non-quote documents", async () => {
    for (const opts of [
      { kind: "quote" as const, status: "paid" as const, paidAt: new Date() },
      { kind: "quote" as const, status: "void" as const },
      { kind: "invoice" as const, status: "draft" as const },
    ]) {
      const id = seedInvoice({ ...opts, number: "Q-0042" });

      await convertQuoteAction(fd(id));

      expect((await row(id)).kind).toBe(opts.kind);
      expect((await row(id)).number).toBe("Q-0042");
    }
  });
});

describe("nextInvoiceNumber", () => {
  it("starts the sequence at 001", () => {
    expect(nextInvoiceNumber("ZZZ")).toBe("ZZZ-001");
  });

  it("increments past the highest existing number in the prefix", () => {
    seedInvoice({ number: "2026-001" });
    seedInvoice({ number: "2026-003" });

    expect(nextInvoiceNumber("2026")).toBe("2026-004");
  });

  it("counts quotes toward the same number space as invoices", () => {
    seedInvoice({ kind: "quote", number: "2026-004" });

    expect(nextInvoiceNumber("2026")).toBe("2026-005");
  });

  it("ignores other prefixes and non-numeric suffixes", () => {
    seedInvoice({ number: "2025-009" });
    seedInvoice({ number: "2026-Q1" });

    expect(nextInvoiceNumber("2026")).toBe("2026-005");
  });

  it("pads only to three digits, not more", () => {
    seedInvoice({ number: "2026-999" });

    expect(nextInvoiceNumber("2026")).toBe("2026-1000");
  });
});
