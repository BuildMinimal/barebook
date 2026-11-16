import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { CURRENCIES } from "@/lib/currencies";
import { TIMEZONES } from "@/lib/timezones";
import { hasOwner } from "@/lib/setup";
import { SetupAccountForm } from "./setup-account-form";
import { SetupDetailsForm } from "./setup-details-form";

export const metadata: Metadata = { title: "Setup — Barebook" };
// DB-backed (checks for an owner) — must not prerender at build time.
export const dynamic = "force-dynamic";

export type CurrencyOption = { code: string; label: string };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;

  if (step === "2") {
    // Step 1 already created the owner + session.
    await requireOwner();
    return <StepShell step={2}><SetupDetailsForm /></StepShell>;
  }

  // Step 1 is only reachable while the book has no owner at all.
  if (hasOwner()) {
    redirect("/login");
  }
  return (
    <StepShell step={1}>
      <SetupAccountForm currencies={CURRENCIES} timezones={TIMEZONES} />
    </StepShell>
  );
}

function StepShell({
  step,
  children,
}: {
  step: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="text-xl font-semibold tracking-tight">Barebook</span>
          <p className="mt-1 text-sm text-muted">
            {step === 1
              ? "One owner, one business, one book."
              : "Defaults now, everything editable later."}
          </p>
        </div>
        <span className="text-2xs font-medium uppercase tracking-widest text-faint">
          Step {step} of 2
        </span>
      </div>
      {children}
    </main>
  );
}
