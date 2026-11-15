import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dashboardStats } from "@/invoice/queries";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile, getSetting } from "@/settings/store";

export default async function DashboardPage() {
  const business = getBusinessProfile();
  const tz = getSetting("timezone") ?? "UTC";
  const { outstandingMinor, revenueMtdMinor, uninvoicedValueMinor, uninvoicedMinutes, overdue } =
    dashboardStats(tz);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          The state of your book, in {business.currency}.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(outstandingMinor, business.currency)}
          hint="Sent, not fully paid"
        />
        <StatCard
          label="Revenue this month"
          value={formatMoney(revenueMtdMinor, business.currency)}
          hint="Payments received"
        />
        <StatCard
          label="Uninvoiced"
          value={formatMoney(uninvoicedValueMinor, business.currency)}
          hint={`${Math.floor(uninvoicedMinutes / 60)}h ${uninvoicedMinutes % 60}m tracked`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Overdue — worth a nudge</h2>
        {overdue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-faint">
            Nothing overdue.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${o.id}`}
                      className="font-medium tabular-nums hover:underline"
                    >
                      {o.number}
                    </Link>
                  </TableCell>
                  <TableCell>{o.clientName}</TableCell>
                  <TableCell>
                    <span className="text-muted">{o.dueDate}</span>{" "}
                    <Badge variant="danger">overdue</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(o.balanceMinor, o.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-5">
        <span className="text-2xs uppercase tracking-wide text-faint">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <span className="text-2xs text-muted">{hint}</span>
      </CardContent>
    </Card>
  );
}
