import { createSign, createPrivateKey } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const privateKey = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!url || !anonKey || !serviceKey || !privateKey) return NextResponse.json({ error: "QZ signing is not configured." }, { status: 503 });

    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: "Unable to verify permissions." }, { status: 500 });
    const role = String(profile?.role || data.user.app_metadata?.role || "").toLowerCase();
    if (!["admin", "staff"].includes(role) || profile?.is_active === false) return NextResponse.json({ error: "Staff or admin access required." }, { status: 403 });

    const body = await request.json().catch(() => null);
    const toSign = typeof body?.request === "string" ? body.request : "";
    if (!toSign || toSign.length > 200000) return NextResponse.json({ error: "Invalid signing request." }, { status: 400 });
    const signer = createSign("RSA-SHA512");
    signer.update(toSign, "utf8");
    signer.end();
    return new NextResponse(signer.sign(createPrivateKey(privateKey), "base64"), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return NextResponse.json({ error: "Unable to sign QZ Tray request." }, { status: 500 });
  }
}
