import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  deleteInvoiceAction,
} from "@/app/actions/invoices";
import {
  deletePaymentAction,
  generateShareTokenAction,
  markPaidAction,
  markSentAction,
  revokeShareTokenAction,
  voidInvoiceAction,
  convertQuoteAction,
} from "@/app/actions/invoice-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { getInvoiceDetail } from "@/invoice/queries";
import { formatDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { getSetting } from "@/settings/store";
import {
  AddInvoiceLineForm,
  InvoiceLineRow,
  InvoiceMetaForm,
} from "./invoice-forms";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Invoice — Barebook" };

async function shareOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function InvoiceEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = getInvoiceDetail(id);
  if (!inv) notFound();

  const defaultTaxPct = Number(getSetting("tax_default_bps") ?? "0") / 100;
  const today = new Date().toISOString().slice(0, 10);
  const editable = inv.kind === "quote" || inv.status === "draft";
  const overdue = inv.status === "sent" && !!inv.dueDate && inv.dueDate < today;
  const origin = await shareOrigin();
  const shareUrl = inv.shareToken ? `${origin}/i/${inv.shareToken}` : null;

  const kindLabel = inv.kind === "quote" ? "Quote" : "Invoice";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight tabular-nums">
            {kindLabel} {inv.number}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <Link href={`/clients/${inv.clientId}`} className="hover:underline">
              {inv.clientCompany ?? inv.clientName}
            </Link>
            <StatusBadge status={inv.status} overdue={overdue} kind={inv.kind} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/invoices/${inv.id}/pdf`}
            target="_blank"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border-subtle bg-surface px-3 text-sm font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            PDF
          </a>
          {editable ? (
            <form action={markSentAction}>
              <input type="hidden" name="id" value={inv.id} />
              <Button type="submit" size="sm">
                {inv.kind === "quote" ? "Send quote" : "Mark sent"}
              </Button>
            </form>
          ) : null}
          {inv.kind === "quote" &&
          inv.status !== "paid" &&
          inv.status !== "void" ? (
            <form action={convertQuoteAction}>
              <input type="hidden" name="id" value={inv.id} />
              <Button type="submit" size="sm" variant="secondary">
                Convert to invoice
              </Button>
            </form>
          ) : null}
          {inv.status === "sent" && inv.balanceMinor > 0 ? (
            <form action={markPaidAction}>
              <input type="hidden" name="id" value={inv.id} />
              <Button type="submit" size="sm" variant="secondary">
                Mark paid
              </Button>
            </form>
          ) : null}
          {inv.status !== "paid" && inv.status !== "void" ? (
            <form action={voidInvoiceAction}>
              <input type="hidden" name="id" value={inv.id} />
              <ConfirmSubmit
                message={`Void ${kindLabel.toLowerCase()} ${inv.number}?`}
              >
                Void
              </ConfirmSubmit>
            </form>
          ) : null}
          {editable ? (
            <form action={deleteInvoiceAction}>
              <input type="hidden" name="id" value={inv.id} />
              <ConfirmSubmit
                message={`Delete ${kindLabel.toLowerCase()} ${inv.number}? Imported time entries go back to uninvoiced.`}
              >
                Delete
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>
      </header>

      {/* lines */}
      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_80px_70px_110px_70px] gap-2 px-1 text-2xs font-medium uppercase tracking-wide text-faint">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span>Unit</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Tax %</span>
        </div>
        <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
          {inv.lines.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-faint">
              No lines yet — add one below.
            </p>
          ) : (
            inv.lines.map((line) => (
              <div key={line.id} className="px-3 py-3">
                {editable ? (
                  <InvoiceLineRow invoiceId={inv.id} line={line} />
                ) : (
                  <div className="grid grid-cols-[1fr_80px_70px_110px_70px] items-center gap-2 px-1 text-sm">
                    <span>{line.description}</span>
                    <span className="text-right tabular-nums">
                      {line.qtyMilli / 1000}
                    </span>
                    <span className="text-muted">{line.unit}</span>
                    <span className="text-right tabular-nums text-muted">
                      {formatMoney(line.rateMinor, inv.currency)}
                    </span>
                    <span className="text-right tabular-nums text-muted">
                      {line.taxBps ? `${line.taxBps / 100}%` : "—"}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
          {editable ? (
            <div className="px-3 py-3">
              <AddInvoiceLineForm invoiceId={inv.id} defaultTaxPct={defaultTaxPct} />
            </div>
          ) : null}
        </div>
      </section>

      {/* totals */}
      <section className="flex justify-end">
        <Card className="w-full max-w-xs">
          <CardContent className="flex flex-col gap-1.5 pt-5 text-sm">
            <TotalRow
              label="Subtotal"
              value={formatMoney(inv.totals.subtotalMinor, inv.currency)}
            />
            {inv.totals.discountMinor > 0 ? (
              <TotalRow
                label={`Discount (${inv.discountBps / 100}%)`}
                value={`−${formatMoney(inv.totals.discountMinor, inv.currency)}`}
              />
            ) : null}
            {inv.totals.taxMinor > 0 ? (
              <TotalRow
                label="Tax"
                value={formatMoney(inv.totals.taxMinor, inv.currency)}
              />
            ) : null}
            {inv.paidMinor > 0 ? (
              <TotalRow
                label="Amount paid"
                value={`−${formatMoney(inv.paidMinor, inv.currency)}`}
              />
            ) : null}
            <div className="mt-1 flex justify-between border-t border-border-subtle pt-2 font-semibold">
              <span>{inv.paidMinor > 0 ? "Balance due" : "Total due"}</span>
              <span className="tabular-nums">
                {formatMoney(
                  inv.paidMinor > 0 ? inv.balanceMinor : inv.totals.totalMinor,
                  inv.currency,
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* details */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Details</h2>
        {editable ? (
          <Card>
            <CardContent className="pt-5">
              <InvoiceMetaForm
                id={inv.id}
                issueDate={inv.issueDate ?? today}
                dueDate={inv.dueDate ?? today}
                discountPct={String(inv.discountBps / 100)}
                notes={inv.notes ?? ""}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted">
            Issued {inv.issueDate ?? "—"} · Due {inv.dueDate ?? "—"} ·{" "}
            {inv.notes ? inv.notes : "No notes"}
          </p>
        )}
      </section>

      {/* payments */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Payments</h2>
        {inv.status !== "draft" && inv.status !== "void" && inv.balanceMinor > 0 ? (
          <Card>
            <CardContent className="pt-5">
              <PaymentForm
                invoiceId={inv.id}
                balanceMajor={String(inv.balanceMinor / 100)}
                today={today}
              />
            </CardContent>
          </Card>
        ) : null}
        {inv.payments.length > 0 ? (
          <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface text-sm">
            {inv.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(p.amountMinor, inv.currency)}
                  </span>
                  <span className="text-faint"> · {formatDate(p.paidAt)}</span>
                  {p.method ? (
                    <span className="text-faint">
                      {" "}
                      · {p.method.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  {p.note ? <span className="text-faint"> · {p.note}</span> : null}
                </span>
                <form action={deletePaymentAction}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <input type="hidden" name="paymentId" value={p.id} />
                  <ConfirmSubmit message="Remove this payment record?">✕</ConfirmSubmit>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-faint">No payments recorded.</p>
        )}
      </section>

      {/* share */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Share link</h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            {shareUrl ? (
              <>
                <p className="break-all text-sm">
                  <a href={shareUrl} target="_blank" className="underline">
                    {shareUrl}
                  </a>
                </p>
                <form action={revokeShareTokenAction}>
                  <input type="hidden" name="id" value={inv.id} />
                  <ConfirmSubmit message="Revoke this share link? The old URL stops working immediately.">
                    Revoke link
                  </ConfirmSubmit>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-muted">
                  A client-facing read-only page, no login needed.
                </p>
                <form action={generateShareTokenAction}>
                  <input type="hidden" name="id" value={inv.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Generate share link
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-faint">
        <Link href="/invoices" className="hover:underline">
          ← All invoices
        </Link>
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  overdue,
  kind,
}: {
  status: string;
  overdue: boolean;
  kind: string;
}) {
  if (kind === "quote") return <Badge>quote</Badge>;
  if (status === "paid") return <Badge variant="success">paid</Badge>;
  if (status === "void") return <Badge variant="outline">void</Badge>;
  if (overdue) return <Badge variant="danger">overdue</Badge>;
  if (status === "sent") return <Badge variant="warning">sent</Badge>;
  return <Badge>draft</Badge>;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
