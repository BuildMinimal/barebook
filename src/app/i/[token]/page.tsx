import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { invoiceIdByToken, getInvoiceDetail } from "@/invoice/queries";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile } from "@/settings/store";

export const metadata: Metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

/**
 * Client-facing read-only invoice page. Reached via the magic share link —
 * no authentication, token is the only credential (revocable from the
 * invoice editor).
 */
export default async function SharedInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoiceId = invoiceIdByToken(token);
  if (!invoiceId) notFound();

  const inv = getInvoiceDetail(invoiceId);
  if (!inv) notFound();

  const business = getBusinessProfile();
  const kindLabel = inv.kind === "quote" ? "Quote" : "Invoice";
  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    inv.status === "sent" && !!inv.dueDate && inv.dueDate < today;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <header className="flex items-start justify-between border-b border-border-subtle pb-6">
        <div>
          <p className="text-base font-semibold">{business.name}</p>
          {business.address ? (
            <p className="mt-1 whitespace-pre-line text-2xs text-muted">
              {business.address}
            </p>
          ) : null}
          {business.taxId ? (
            <p className="text-2xs text-muted">Tax ID {business.taxId}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tracking-wide">{kindLabel}</p>
          <p className="text-sm font-medium tabular-nums">{inv.number}</p>
          <p className="mt-1 text-2xs text-muted">
            {inv.issueDate ? `Issued ${inv.issueDate}` : null}
          </p>
          <p className="text-2xs text-muted">
            {inv.dueDate ? `Due ${inv.dueDate}` : null}
          </p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-2xs uppercase tracking-widest text-faint">Billed to</p>
        <p className="mt-1 text-sm font-medium">
          {inv.clientCompany ?? inv.clientName}
        </p>
        {inv.clientCompany ? (
          <p className="text-sm text-muted">{inv.clientName}</p>
        ) : null}
        {inv.clientEmail ? (
          <p className="text-sm text-muted">{inv.clientEmail}</p>
        ) : null}
      </section>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-2xs uppercase tracking-wide text-faint">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Rate</th>
            <th className="py-2 text-right font-medium">Tax</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((line) => (
            <tr key={line.id} className="border-b border-border-subtle">
              <td className="py-2.5">{line.description}</td>
              <td className="py-2.5 text-right tabular-nums">
                {line.qtyMilli / 1000} {line.unit}
              </td>
              <td className="py-2.5 text-right tabular-nums text-muted">
                {formatMoney(line.rateMinor, inv.currency)}
              </td>
              <td className="py-2.5 text-right tabular-nums text-muted">
                {line.taxBps ? `${line.taxBps / 100}%` : "—"}
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums">
                {formatMoney(line.amountMinor, inv.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 ml-auto flex w-full max-w-xs flex-col gap-1.5 text-sm">
        <Row label="Subtotal" value={formatMoney(inv.totals.subtotalMinor, inv.currency)} />
        {inv.totals.discountMinor > 0 ? (
          <Row
            label={`Discount (${inv.discountBps / 100}%)`}
            value={`−${formatMoney(inv.totals.discountMinor, inv.currency)}`}
          />
        ) : null}
        {inv.totals.taxMinor > 0 ? (
          <Row label="Tax" value={formatMoney(inv.totals.taxMinor, inv.currency)} />
        ) : null}
        {inv.paidMinor > 0 ? (
          <Row
            label="Amount paid"
            value={`−${formatMoney(inv.paidMinor, inv.currency)}`}
          />
        ) : null}
        <div className="mt-1 flex justify-between border-t border-foreground pt-2 font-semibold">
          <span>{inv.paidMinor > 0 ? "Balance due" : "Total due"}</span>
          <span className="tabular-nums">
            {formatMoney(
              inv.paidMinor > 0 ? inv.balanceMinor : inv.totals.totalMinor,
              inv.currency,
            )}
          </span>
        </div>
        {overdue ? (
          <p className="mt-2 text-xs text-danger">This invoice is past its due date.</p>
        ) : null}
      </section>

      {inv.notes ? (
        <p className="mt-10 whitespace-pre-line text-sm text-muted">{inv.notes}</p>
      ) : null}

      <footer className="mt-12 flex justify-end border-t border-border-subtle pt-6 text-xs text-faint">
        <a
          href={`/i/${token}/pdf`}
          target="_blank"
          className="inline-flex h-8 items-center rounded-md border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Download PDF
        </a>
      </footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
