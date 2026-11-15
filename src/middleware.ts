import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/*
 * Cookie-presence gate for fast UX redirects. The cookie is NOT validated
 * here (middleware runs on the edge runtime, no SQLite) — every protected
 * page/action re-validates the session server-side via requireOwner() /
 * getSessionOwner(). Public routes: /login, /setup, share links (/i/...),
 * and the healthcheck.
 */

const PUBLIC_PREFIXES = ["/login", "/setup", "/i/", "/api/health"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = !!req.cookies.get(SESSION_COOKIE)?.value;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (!hasCookie) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
