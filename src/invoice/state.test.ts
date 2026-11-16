import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { getInvoiceDetail } from "./queries";
import {
  deletePaymentAction,
  generateShareTokenAction,
  markPaidAction,
  markSentAction,
  recordPaymentAction,
  revokeShareTokenAction,
  voidInvoiceAction,
} from "@/app/actions/invoice-state";
import { seedInvoice, seedPayment, useTestDb } from "@/test/db";

// Server actions touch Next request scope; the state machine under test
// doesn't need real auth or revalidation.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(async () => ({ id: "owner-1", email: "owner@barebook.test" })),
}));

useTestDb();

function fd(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.set(k, v);
  return form;
}

async function row(id: string) {
  return getDb().select().from(invoices).where(eq(invoices.id, id)).get()!;
}

async function paymentsOf(id: string) {
  return getDb().select().from(payments).where(eq(payments.invoiceId, id)).all();
}

describe("markSentAction", () => {
  it("moves a draft to sent", async () => {
    const id = seedInvoice({ status: "draft" });

    await markSentAction(fd({ id }));

    expect((await row(id)).status).toBe("sent");
  });

  it("sends a quote (quotes carry their own draft → sent flow)", async () => {
    const id = seedInvoice({ kind: "quote", status: "draft" });

    await markSentAction(fd({ id }));

    expect((await row(id)).status).toBe("sent");
  });

  it("is a no-op on non-draft invoices", async () => {
    for (const status of ["sent", "paid", "void"] as const) {
      const id = seedInvoice({ status });

      await markSentAction(fd({ id }));

      expect((await row(id)).status).toBe(status);
    }
  });
});

describe("markPaidAction", () => {
  it("pays the remaining balance and flips a sent invoice to paid", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });
    seedPayment(id, 30_000);

    await markPaidAction(fd({ id }));

    const r = await row(id);
    expect(r.status).toBe("paid");
    expect(r.paidAt).toBeInstanceOf(Date);
    const pays = await paymentsOf(id);
    expect(pays).toHaveLength(2);
    expect(pays.reduce((s, p) => s + p.amountMinor, 0)).toBe(100_000);
    expect(pays.some((p) => p.note === "Marked paid" && p.method === "manual")).toBe(true);
  });

  it("is a no-op on drafts, paid and void invoices", async () => {
    for (const status of ["draft", "paid", "void"] as const) {
      const id = seedInvoice({ status, lines: [{ rateMinor: 100_000 }] });

      await markPaidAction(fd({ id }));

      expect((await row(id)).status).toBe(status);
      expect(await paymentsOf(id)).toHaveLength(0);
    }
  });
});

describe("voidInvoiceAction", () => {
  it("voids drafts and sent invoices", async () => {
    const draft = seedInvoice({ status: "draft" });
    const sent = seedInvoice({ status: "sent" });

    await voidInvoiceAction(fd({ id: draft }));
    await voidInvoiceAction(fd({ id: sent }));

    expect((await row(draft)).status).toBe("void");
    expect((await row(sent)).status).toBe("void");
  });

  it("is a no-op on paid and void invoices", async () => {
    for (const status of ["paid", "void"] as const) {
      const id = seedInvoice({ status });

      await voidInvoiceAction(fd({ id }));

      expect((await row(id)).status).toBe(status);
    }
  });
});

describe("recordPaymentAction", () => {
  it("records a partial payment on a sent invoice and keeps it sent", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });

    const result = await recordPaymentAction(
      { error: null, saved: false },
      fd({ id, amount: "40", paidOn: "2026-11-15" }),
    );

    expect(result).toEqual({ error: null, saved: true });
    expect((await row(id)).status).toBe("sent");
    // amount "40" -> 4000 minor; 100000 total leaves 96000 outstanding
    expect((await getInvoiceDetail(id))!.paidMinor).toBe(4_000);
    expect((await getInvoiceDetail(id))!.balanceMinor).toBe(96_000);
  });

  it("flips the invoice to paid when the balance reaches zero", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });

    await recordPaymentAction(
      { error: null, saved: false },
      fd({ id, amount: "1000", paidOn: "2026-11-15", method: "bank_transfer", note: "wire" }),
    );

    const r = await row(id);
    expect(r.status).toBe("paid");
    expect(r.paidAt!.toISOString()).toBe("2026-11-15T12:00:00.000Z");
    const pays = await paymentsOf(id);
    expect(pays[0].method).toBe("bank_transfer");
    expect(pays[0].note).toBe("wire");
  });

  it("rejects payments on drafts and void invoices", async () => {
    for (const status of ["draft", "void"] as const) {
      const id = seedInvoice({ status, lines: [{ rateMinor: 100_000 }] });

      const result = await recordPaymentAction(
        { error: null, saved: false },
        fd({ id, amount: "50", paidOn: "2026-11-15" }),
      );

      expect(result.saved).toBe(false);
      expect(result.error).toBe("Drafts and void invoices can't take payments");
      expect(await paymentsOf(id)).toHaveLength(0);
    }
  });

  it("rejects non-positive amounts without inserting anything", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });

    const result = await recordPaymentAction(
      { error: null, saved: false },
      fd({ id, amount: "0", paidOn: "2026-11-15" }),
    );

    expect(result.error).toBe("Amount must be positive");
    expect(await paymentsOf(id)).toHaveLength(0);
  });

  it("rejects malformed dates", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });

    const result = await recordPaymentAction(
      { error: null, saved: false },
      fd({ id, amount: "50", paidOn: "15/11/2026" }),
    );

    expect(result.saved).toBe(false);
    expect(result.error).toBeTruthy();
    expect(await paymentsOf(id)).toHaveLength(0);
  });
});

describe("deletePaymentAction", () => {
  it("un-pays a paid invoice when its covering payment is removed", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });
    await recordPaymentAction(
      { error: null, saved: false },
      fd({ id, amount: "1000", paidOn: "2026-11-15" }),
    );
    expect((await row(id)).status).toBe("paid");
    const [payment] = await paymentsOf(id);

    await deletePaymentAction(fd({ invoiceId: id, paymentId: payment.id }));

    const r = await row(id);
    expect(r.status).toBe("sent");
    expect(r.paidAt).toBeNull();
    expect(await paymentsOf(id)).toHaveLength(0);
  });

  it("keeps a sent invoice sent when a partial payment is removed", async () => {
    const id = seedInvoice({ status: "sent", lines: [{ rateMinor: 100_000 }] });
    const paymentId = seedPayment(id, 40_000);

    await deletePaymentAction(fd({ invoiceId: id, paymentId }));

    expect((await row(id)).status).toBe("sent");
    expect(await paymentsOf(id)).toHaveLength(0);
  });
});

describe("share tokens", () => {
  it("generates a token on non-void invoices and regenerates it", async () => {
    const id = seedInvoice({ status: "sent" });

    await generateShareTokenAction(fd({ id }));
    const first = (await row(id)).shareToken;
    expect(first).toMatch(/^[0-9a-f]{32}$/);

    await generateShareTokenAction(fd({ id }));
    expect((await row(id)).shareToken).toMatch(/^[0-9a-f]{32}$/);
    expect((await row(id)).shareToken).not.toBe(first);
  });

  it("never generates a token for a void invoice", async () => {
    const id = seedInvoice({ status: "void" });

    await generateShareTokenAction(fd({ id }));

    expect((await row(id)).shareToken).toBeNull();
  });

  it("revokes an active token", async () => {
    const id = seedInvoice({ status: "sent", shareToken: "tok-123" });

    await revokeShareTokenAction(fd({ id }));

    expect((await row(id)).shareToken).toBeNull();
  });
});
