import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const normalizeNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `63${digits}`;
  return digits;
};

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim().replace(/^['\"]|['\"]$/g, "");
    if (value) return value;
  }
  return "";
}

async function authorizeStaff(request: NextRequest) {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return { error: NextResponse.json({ error: "SMS service authentication is not configured." }, { status: 500 }) };

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "Authentication is required to send SMS." }, { status: 401 }) };

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await db.from("profiles").select("role,is_active").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: NextResponse.json({ error: "Unable to verify your account permissions." }, { status: 500 }) };
  const role = String(profile?.role || authData.user.app_metadata?.role || "").trim().toLowerCase();
  if (!["admin", "staff"].includes(role) || profile?.is_active === false) return { error: NextResponse.json({ error: "Staff or admin access is required to send SMS." }, { status: 403 }) };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeStaff(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const number = normalizeNumber(String(body?.number || ""));
    const message = String(body?.message || "").trim();

    if (!number || !/^639\d{9}$/.test(number)) {
      return NextResponse.json({ error: "Please provide a valid Philippine mobile number." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "SMS message cannot be empty." }, { status: 400 });
    }

    const apiKey = process.env.SEMAPHORE_API_KEY;
    const senderName = process.env.SEMAPHORE_SENDERNAME;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Live SMS is not configured yet. Add SEMAPHORE_API_KEY to the server environment." },
        { status: 503 }
      );
    }

    const form = new URLSearchParams({ apikey: apiKey, number, message });
    if (senderName) form.set("sendername", senderName);

    const response = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const raw = await response.text();
    let data: unknown = raw;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      const providerError = typeof data === "object" && data !== null ? JSON.stringify(data) : raw;
      return NextResponse.json({ error: providerError || "SMS provider rejected the request." }, { status: 502 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result !== "object") {
      return NextResponse.json({ error: "Unexpected response from SMS provider." }, { status: 502 });
    }

    const record = result as { message_id?: string | number; status?: string; recipient?: string; message?: string };
    const providerStatus = String(record.status || "QUEUED").toUpperCase();
    const status = providerStatus === "FAILED" || providerStatus === "REFUNDED" ? "FAILED" : providerStatus;

    return NextResponse.json({
      ok: true,
      status,
      providerStatus,
      providerMessageId: record.message_id ? String(record.message_id) : null,
      recipient: record.recipient || number,
      message: record.message || message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send SMS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
