"use client";

import { useActionState } from "react";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface ClientFormValues {
  name: string;
  company: string;
  email: string;
  address: string;
  taxId: string;
  currency: string;
  notes: string;
}

export function ClientForm({
  mode,
  clientId,
  values,
  currencies,
}: {
  mode: "create" | "edit";
  clientId?: string;
  values: ClientFormValues;
  currencies: { code: string; label: string }[];
}) {
  const action =
    mode === "create" ? createClientAction : updateClientAction;
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" ? <input type="hidden" name="id" value={clientId} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={values.name} required autoFocus={mode === "create"} />
          <p className="text-2xs text-faint">The person you deal with.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={values.company} />
          <p className="text-2xs text-faint">Shown on invoices when set.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxId">Tax ID</Label>
          <Input id="taxId" name="taxId" defaultValue={values.taxId} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            defaultValue={values.address}
            className="min-h-16"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Invoice currency</Label>
          <Select id="currency" name="currency" defaultValue={values.currency}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <p className="text-2xs text-faint">Default for new invoices.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={values.notes}
            className="min-h-16"
            placeholder="Payment terms, preferences…"
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add client" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
