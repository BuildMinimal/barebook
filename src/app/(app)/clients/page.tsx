import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClientsPage() {
  const rows = getDb()
    .select({
      id: clients.id,
      name: clients.name,
      company: clients.company,
      email: clients.email,
      currency: clients.currency,
    })
    .from(clients)
    .orderBy(asc(clients.name))
    .all();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} {rows.length === 1 ? "client" : "clients"} in your
            book
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          New client
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle px-5 py-10 text-center text-sm text-faint">
          No clients yet. Add the first one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Currency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted">{c.company ?? "—"}</TableCell>
                <TableCell className="text-muted">{c.email ?? "—"}</TableCell>
                <TableCell className="text-muted">{c.currency}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
