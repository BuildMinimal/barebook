"use client";

import { useActionState } from "react";
import { invoiceIdle } from "@/app/actions/invoice-form-state";
import {
  addInvoiceLineAction,
  deleteInvoiceLineAction,
  updateInvoiceLineAction,
  updateInvoiceMetaAction,
} from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-sm text-danger" role="alert">
      {error}
    </p>
  );
}

export function InvoiceMetaForm({
  id,
  issueDate,
  dueDate,
  discountPct,
  notes,
}: {
  id: string;
  issueDate: string;
  dueDate: string;
  discountPct: string;
  notes: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateInvoiceMetaAction,
    invoiceIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issueDate">Issue date</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={issueDate} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={dueDate} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="discountPct">Discount (%)</Label>
          <Input
            id="discountPct"
            name="discountPct"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={discountPct}
          />
        </div>
        <div className="col-span-3 flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={notes}
            className="min-h-14"
            placeholder="Thanks for your business!"
          />
        </div>
      </div>
      <FormError error={state.error} />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </form>
  );
}

export function InvoiceLineRow({
  invoiceId,
  line,
}: {
  invoiceId: string;
  line: {
    id: string;
    description: string;
    qtyMilli: number;
    unit: string;
    rateMinor: number;
    taxBps: number;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateInvoiceLineAction,
    invoiceIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={invoiceId} />
      <input type="hidden" name="lineId" value={line.id} />
      <div className="grid grid-cols-[1fr_80px_70px_110px_70px] gap-2">
        <Input
          name="description"
          defaultValue={line.description}
          aria-label="Description"
          className="h-8"
        />
        <Input
          name="qty"
          type="number"
          step="0.01"
          min={0}
          defaultValue={line.qtyMilli / 1000}
          aria-label="Quantity"
          className="h-8 text-right tabular-nums"
        />
        <Input
          name="unit"
          defaultValue={line.unit}
          aria-label="Unit"
          className="h-8"
        />
        <Input
          name="rate"
          type="number"
          step="0.01"
          min={0}
          defaultValue={line.rateMinor / 100}
          aria-label="Rate"
          className="h-8 text-right tabular-nums"
        />
        <Input
          name="taxPct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          defaultValue={line.taxBps / 100}
          aria-label="Tax percent"
          className="h-8 text-right tabular-nums"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending}
          formAction={deleteInvoiceLineAction}
        >
          Delete
        </Button>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? "…" : "Save line"}
        </Button>
      </div>
    </form>
  );
}

export function AddInvoiceLineForm({
  invoiceId,
  defaultTaxPct,
}: {
  invoiceId: string;
  defaultTaxPct: number;
}) {
  const [state, formAction, pending] = useActionState(
    addInvoiceLineAction,
    invoiceIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={invoiceId} />
      <div className="grid grid-cols-[1fr_80px_70px_110px_70px] gap-2">
        <Input
          name="description"
          placeholder="Add a line — description"
          aria-label="New line description"
          className="h-8"
        />
        <Input
          name="qty"
          type="number"
          step="0.01"
          min={0}
          defaultValue={1}
          aria-label="New line quantity"
          className="h-8 text-right tabular-nums"
        />
        <Input
          name="unit"
          defaultValue="item"
          aria-label="New line unit"
          className="h-8"
        />
        <Input
          name="rate"
          type="number"
          step="0.01"
          min={0}
          defaultValue={0}
          aria-label="New line rate"
          className="h-8 text-right tabular-nums"
        />
        <Input
          name="taxPct"
          type="number"
          step="0.01"
          min={0}
          max={100}
          defaultValue={defaultTaxPct}
          aria-label="New line tax percent"
          className="h-8 text-right tabular-nums"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "…" : "Add line"}
        </Button>
      </div>
    </form>
  );
}
