import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listInvoiceSummaries } from "@/invoice/queries";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile } from "@/settings/store";

function StatusBadge({
  kind,
  status,
  dueDate,
  totalMinor,
  paidMinor,
  currency,
}: {
  kind: string;
  status: string;
  dueDate: string | null;
  totalMinor: number;
  paidMinor: number;
  currency: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = status === "sent" && !!dueDate && dueDate < today;

  if (kind === "quote") return <Badge>quote</Badge>;
  if (status === "paid") return <Badge variant="success">paid</Badge>;
  if (status === "void") return <Badge variant="outline">void</Badge>;
  if (overdue) return <Badge variant="danger">overdue</Badge>;
  if (status === "sent") {
    return paidMinor > 0 ? (
      <Badge variant="warning">
        partial · {formatMoney(paidMinor, currency)}
      </Badge>
    ) : (
      <Badge variant="warning">sent</Badge>
    );
  }
  void totalMinor;
  return <Badge>draft</Badge>;
}

export default function InvoicesPage() {
  const rows = listInvoiceSummaries();
  const business = getBusinessProfile();
  const today = new Date().toISOString().slice(0, 10);

  const outstandingMinor = rows
    .filter((r) => r.kind === "invoice" && (r.status === "sent" || (r.status === "sent" && r.dueDate && r.dueDate < today)))
    .reduce((sum, r) => sum + Math.max(0, r.totalMinor - r.paidMinor), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted">
            {outstandingMinor > 0 ? (
              <>
                Outstanding:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatMoney(outstandingMinor, business.currency)}
                </span>
              </>
            ) : (
              "Nothing outstanding."
            )}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          New invoice
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle px-5 py-10 text-center text-sm text-faint">
          No invoices yet. Track time or add lines to make the first one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/invoices/${r.id}`}
                    className="font-medium tabular-nums hover:underline"
                  >
                    {r.number}
                  </Link>
                  {r.kind === "quote" ? (
                    <span className="ml-2 text-2xs text-faint">quote</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${r.clientId}`} className="hover:underline">
                    {r.clientName}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted">
                  {r.issueDate ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted">
                  {r.dueDate ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind={r.kind}
                    status={r.status}
                    dueDate={r.dueDate}
                    totalMinor={r.totalMinor}
                    paidMinor={r.paidMinor}
                    currency={r.currency}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatMoney(r.totalMinor, r.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
