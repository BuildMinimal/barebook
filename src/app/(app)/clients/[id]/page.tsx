import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { deleteClientAction } from "@/app/actions/clients";
import { deleteProjectAction } from "@/app/actions/projects";
import { CURRENCIES } from "@/lib/currencies";
import { formatMoney } from "@/lib/money";
import { getBusinessProfile } from "@/settings/store";
import { getDb } from "@/db";
import { clients, projects } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { projectUninvoiced } from "@/lib/queries";
import { ClientForm } from "../client-form";
import { EditProjectForm, NewProjectForm } from "./project-forms";

export const metadata: Metadata = { title: "Client — Barebook" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getDb().select().from(clients).where(eq(clients.id, id)).get();
  if (!client) notFound();

  const projectRows = getDb()
    .select()
    .from(projects)
    .where(eq(projects.clientId, id))
    .orderBy(asc(projects.name))
    .all();

  const businessCurrency = getBusinessProfile().currency;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {client.company ?? client.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {client.company ? client.name : null}
            {client.email ? ` · ${client.email}` : ""}
          </p>
        </div>
        <form action={deleteClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <ConfirmSubmit
            message={`Delete ${client.name}? All their projects, time entries, and invoices go too. This cannot be undone.`}
            className="h-9"
          >
            Delete
          </ConfirmSubmit>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted">Details</h2>
        <ClientForm
          mode="edit"
          clientId={client.id}
          values={{
            name: client.name,
            company: client.company ?? "",
            email: client.email ?? "",
            address: client.address ?? "",
            taxId: client.taxId ?? "",
            currency: client.currency ?? "USD",
            notes: client.notes ?? "",
          }}
          currencies={CURRENCIES}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Projects</h2>
        <NewProjectForm clientId={client.id} />

        {projectRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-faint">
            No projects yet. Add the first one above.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
            {projectRows.map((p) => {
              const uninvoiced = projectUninvoiced(p.id, p.hourlyRateMinor);
              return (
                <details key={p.id} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.status === "archived" ? (
                        <Badge variant="outline">archived</Badge>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-4 text-sm text-muted">
                      {uninvoiced.minutes > 0 ? (
                        <>
                          <span className="text-2xs">
                            {Math.floor(uninvoiced.minutes / 60)}h{" "}
                            {uninvoiced.minutes % 60}m uninvoiced
                          </span>
                          <span className="font-medium tabular-nums text-foreground">
                            {formatMoney(uninvoiced.valueMinor, businessCurrency)}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xs">no uninvoiced time</span>
                      )}
                      <span className="text-faint group-open:hidden">edit ▾</span>
                      <span className="hidden text-faint group-open:inline">close ▴</span>
                    </span>
                  </summary>
                  <div className="border-t border-border-subtle px-5 pb-4">
                    <EditProjectForm project={p} />
                    <form action={deleteProjectAction} className="mt-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="clientId" value={client.id} />
                      <ConfirmSubmit
                        message={`Delete project "${p.name}"? Its time entries go too. Invoiced entries are untouched (invoices keep their copies).`}
                      >
                        Delete project
                      </ConfirmSubmit>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-faint">
        <Link href="/clients" className="hover:underline">
          ← All clients
        </Link>
      </p>
    </div>
  );
}
