import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { NextResponse } from "next/server";
import { getSessionOwner } from "@/lib/auth";
import { getRawDb } from "@/db";
import { dataDir } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click backup: a consistent SQLite snapshot (via the backup API, safe
 * against concurrent writes) plus the uploads directory, zipped on the fly.
 * The archive contains credentials (SMTP password, Stripe key) — the UI warns.
 */
export async function GET() {
  const owner = await getSessionOwner();
  if (!owner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tmpDb = path.join(os.tmpdir(), `barebook-snapshot-${Date.now()}.db`);
  await getRawDb().backup(tmpDb); // online backup: consistent, WAL-safe

  const stamp = new Date().toISOString().slice(0, 10);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("end", () => {
    fs.rm(tmpDb, { force: true }, () => undefined);
  });
  archive.on("warning", (err) => {
    console.warn("[backup]", err);
  });

  archive.file(tmpDb, { name: "barebook.db" });

  const uploads = path.join(dataDir(), "uploads");
  if (fs.existsSync(uploads)) {
    archive.directory(uploads, "uploads");
  }

  void archive.finalize();

  return new NextResponse(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="barebook-backup-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}
