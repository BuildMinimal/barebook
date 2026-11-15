"use client";

import { useActionState } from "react";
import { invoiceActionIdle } from "@/app/actions/time-state";
import { recordPaymentAction } from "@/app/actions/invoice-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function PaymentForm({
  invoiceId,
  balanceMajor,
  today,
}: {
  invoiceId: string;
  balanceMajor: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordPaymentAction,
    invoiceActionIdle,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={invoiceId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payAmount">Amount received</Label>
          <Input
            id="payAmount"
            name="amount"
            type="number"
            step="0.01"
            min={0.01}
            defaultValue={balanceMajor}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payDate">Received on</Label>
          <Input id="payDate" name="paidOn" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payMethod">Method</Label>
          <Select id="payMethod" name="method" defaultValue="bank_transfer">
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="stripe">Stripe</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="payNote">Note</Label>
          <Input id="payNote" name="note" placeholder="Optional" />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-success" role="status">
          Payment recorded.
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
