"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { owners } from "@/db/schema";
import {
  clearLoginFailures,
  createSession,
  destroySession,
  loginAttemptsRemaining,
  pruneLoginFailures,
  recordLoginFailure,
  verifyPassword,
} from "@/lib/auth";

export interface LoginState {
  error: string | null;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  pruneLoginFailures();
  if (loginAttemptsRemaining(email) <= 0) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const owner = getDb()
    .select()
    .from(owners)
    .where(eq(owners.email, email))
    .get();
  const ok = owner
    ? await verifyPassword(parsed.data.password, owner.passwordHash)
    : false;

  if (!owner || !ok) {
    recordLoginFailure(email);
    return { error: "Invalid email or password." };
  }

  clearLoginFailures(email);
  await createSession(owner.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
