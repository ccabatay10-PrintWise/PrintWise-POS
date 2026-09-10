import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const env = (...names: string[]) => names.map(n => process.env[n]?.trim()).find(Boolean) || "";
const url = env("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const anonKey = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");

export async function POST(request: NextRequest) {
  if (!url || !anonKey) return NextResponse.json({ error: "Menu service is not configured." }, { status: 500 });
  try {
    const body = await request.json();
    const customerName = body?.customer_name ? String(body.customer_name).trim() : "";
    const notes = body?.notes ? String(body.notes).trim() : null;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!customerName || customerName.length > 120) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    if (items.length < 1 || items.length > 50) return NextResponse.json({ error: "Please select at least one item." }, { status: 400 });
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc("create_wise_menu_order", { p_table_code: null, p_customer_name: customerName, p_notes: notes, p_items: items });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Invalid order request." }, { status: 400 }); }
}
