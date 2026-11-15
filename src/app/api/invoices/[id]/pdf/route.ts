import * as React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { loadInvoiceForPdf } from "@/invoice/data";
import { ensureFontsRegistered } from "@/invoice/fonts";
import { InvoicePdfDocument } from "@/invoice/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const data = loadInvoiceForPdf(id);
  if (!data) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  ensureFontsRegistered();
  // InvoicePdfDocument renders a react-pdf <Document>; the cast re-attaches
  // the DocumentProps type that renderToBuffer's signature requires.
  const element = React.createElement(InvoicePdfDocument, {
    data,
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${data.number}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
