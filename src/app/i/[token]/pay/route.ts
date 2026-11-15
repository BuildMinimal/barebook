import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { getInvoiceDetail, invoiceIdByToken } from "@/invoice/queries";
import { getSetting } from "@/settings/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a Stripe Checkout session for the invoice balance. Reached from the
 * public share page — the owner's own Stripe key (BYOK), no session needed.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = await requestOrigin();

  const invoiceId = invoiceIdByToken(token);
  const detail = invoiceId ? getInvoiceDetail(invoiceId) : null;
  if (!detail) {
    return new NextResponse("Link expired or invalid", { status: 404 });
  }
  if (detail.balanceMinor <= 0) {
    return NextResponse.redirect(new URL(`/i/${token}`, origin), 303);
  }

  const key = getSetting("stripe_secret_key");
  if (!key) {
    return new NextResponse("Online payments are not configured", { status: 400 });
  }

  const stripe = new Stripe(key);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: detail.currency.toLowerCase(),
          unit_amount: detail.balanceMinor,
          product_data: {
            name: `Invoice ${detail.number}`,
            description: detail.clientCompany ?? detail.clientName,
          },
        },
      },
    ],
    // include the token so the completion callback can't be replayed against
    // a different invoice
    metadata: { token, invoiceId: detail.id },
    success_url: `${origin}/i/${token}/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/i/${token}`,
    ...(detail.clientEmail ? { customer_email: detail.clientEmail } : {}),
  });

  if (!session.url) {
    return new NextResponse("Stripe session could not be created", { status: 502 });
  }
  return NextResponse.redirect(session.url, 303);
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
