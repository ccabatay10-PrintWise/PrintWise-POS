import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function auth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required");
  const admin = createClient(url, service);
  const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !["admin", "staff", "cashier"].includes(profile.role)) throw new Error("Not authorized");
  return admin;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await auth(req);
    const { data, error } = await admin.from("wise_menu_orders")
      .select("id,order_no,customer_name,customer_email,notes,status,total,subtotal,created_at,updated_at,wise_menu_order_items(product_id,product_name,quantity,unit_price,line_total,options)")
      .in("status", ["new", "accepted"])
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ orders: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unable to load WISE MENU orders" }, { status: e.message === "Authentication required" ? 401 : 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await auth(req);
    const body = await req.json();
    if (!body?.order_id) return NextResponse.json({ error: "Order is required" }, { status: 400 });
    const { data, error } = await admin.rpc("convert_wise_menu_order_to_pos", { p_order_id: body.order_id });
    if (error) throw error;
    return NextResponse.json(data || { ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unable to send order to POS" }, { status: 400 });
  }
}
