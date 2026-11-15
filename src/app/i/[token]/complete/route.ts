import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { getInvoiceDetail, invoiceIdByToken } from "@/invoice/queries";
import { getSetting } from "@/settings/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe Checkout success redirect. Verifies the session server-side with the
 * owner's key, records the payment exactly once (session-id dedupe), flips
 * the invoice to paid when the balance clears, then shows the share page.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = await (async () => {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  })();
  const back = (query = "") => NextResponse.redirect(new URL(`/i/${token}${query}`, origin), 303);

  const invoiceId = invoiceIdByToken(token);
  if (!invoiceId) return back("?error=expired");

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return back();

  const key = getSetting("stripe_secret_key");
  if (!key) return back("?error=stripe");

  const stripe = new Stripe(key);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return back("?error=stripe");
  }
  if (session.payment_status !== "paid" || session.metadata?.token !== token) {
    return back();
  }

  const db = getDb();
  // dedupe: same stripe session must not record twice
  const existing = db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.method, "stripe"), eq(payments.note, sessionId)))
    .get();
  if (!existing) {
    const detail = getInvoiceDetail(invoiceId);
    const paidMinor =
      typeof session.amount_total === "number" ? session.amount_total : 0;
    const now = new Date();

    db.insert(payments)
      .values({
        id: randomUUID(),
        invoiceId,
        paidAt: now,
        amountMinor: paidMinor,
        method: "stripe",
        note: sessionId,
      })
      .run();

    if (detail && detail.balanceMinor - paidMinor <= 0) {
      db.update(invoices)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(eq(invoices.id, invoiceId))
        .run();
    }
  }

  return back("?paid=1");
}
