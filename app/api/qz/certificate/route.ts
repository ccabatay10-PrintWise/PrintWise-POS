import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const certificate = process.env.QZ_DIGITAL_CERTIFICATE?.replace(/\\n/g, "\n");
  if (!certificate) {
    return new NextResponse("QZ signing certificate is not configured.", { status: 503 });
  }
  return new NextResponse(certificate, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
