import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Container HEALTHCHECK target: DB open + schema present. */
export async function GET() {
  try {
    const db = getDb();
    db.get(sql`select count(*) as migrated from sqlite_master where type = 'table' and name = 'settings'`.as("migrated"));
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
