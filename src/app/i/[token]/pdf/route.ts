import * as React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getInvoiceDetail, invoiceIdByToken } from "@/invoice/queries";
import { toPdfData } from "@/invoice/data";
import { ensureFontsRegistered } from "@/invoice/fonts";
import { InvoicePdfDocument } from "@/invoice/template";
import { getBusinessProfile } from "@/settings/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-facing PDF via magic share token — no session needed, token is the
 * credential. The token is looked up fresh on every request, so revoking the
 * link in the editor kills this URL immediately.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invoiceId = invoiceIdByToken(token);
  const detail = invoiceId ? getInvoiceDetail(invoiceId) : null;
  if (!detail) {
    return new NextResponse("Link expired or invalid", { status: 404 });
  }

  const data = toPdfData(detail, getBusinessProfile());
  ensureFontsRegistered();
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
