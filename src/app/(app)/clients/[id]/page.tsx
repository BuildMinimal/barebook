import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { deleteClientAction } from "@/app/actions/clients";
import { CURRENCIES } from "@/lib/currencies";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Client — Barebook" };

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getDb().select().from(clients).where(eq(clients.id, id)).get();
  if (!client) notFound();

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
        <p className="rounded-lg border border-dashed border-border-subtle px-5 py-8 text-center text-sm text-faint">
          Projects arrive with the time-tracking milestone.
        </p>
      </section>

      <p className="text-xs text-faint">
        <Link href="/clients" className="hover:underline">
          ← All clients
        </Link>
      </p>
    </div>
  );
}
