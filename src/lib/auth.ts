import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { owners, sessions } from "@/db/schema";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE } from "./session-cookie";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 64;

// ---------------------------------------------------------------------------
// passwords — scrypt with per-password salt, stored as "scrypt:<salt>:<key>"
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const key = await scrypt(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
  const expected = Buffer.from(keyHex, "hex");
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

// ---------------------------------------------------------------------------
// sessions — random token in an HttpOnly cookie, sha-256(token) in the DB
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(ownerId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  getDb()
    .insert(sessions)
    .values({ id: hashToken(token), ownerId, expiresAt })
    .run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export interface OwnerSession {
  id: string;
  email: string;
}

/** Validates the session cookie against the DB. Null when absent/expired. */
export async function getSessionOwner(): Promise<OwnerSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getDb()
    .select({ id: owners.id, email: owners.email })
    .from(sessions)
    .innerJoin(owners, eq(owners.id, sessions.ownerId))
    .where(
      and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())),
    )
    .get();

  return row ?? null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().delete(sessions).where(eq(sessions.id, hashToken(token))).run();
  }
  store.delete(SESSION_COOKIE);
}

/** Page/action guard: redirects to /login when there is no valid session. */
export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getSessionOwner();
  if (!owner) {
    redirect("/login");
  }
  return owner;
}

// ---------------------------------------------------------------------------
// login rate limiting — in-memory, per single-process server (fine for a
// single-tenant deploy; resets on restart by design)
// ---------------------------------------------------------------------------

const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function loginAttemptsRemaining(key: string): number {
  const entry = ATTEMPTS.get(key);
  if (!entry || entry.resetAt < Date.now()) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry || entry.resetAt < now) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  ATTEMPTS.delete(key);
}

/** Opportunistic cleanup so the map cannot grow unbounded. */
export function pruneLoginFailures(): void {
  const now = Date.now();
  for (const [key, entry] of ATTEMPTS) {
    if (entry.resetAt < now) ATTEMPTS.delete(key);
  }
}
