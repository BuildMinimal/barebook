import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasOwner } from "@/lib/setup";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Barebook" };

export default async function LoginPage() {
  // No owner yet? The setup wizard is the entry point.
  if (!hasOwner()) {
    redirect("/setup");
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-xl font-semibold tracking-tight">Barebook</span>
          <p className="mt-1 text-sm text-muted">Sign in to your book</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
