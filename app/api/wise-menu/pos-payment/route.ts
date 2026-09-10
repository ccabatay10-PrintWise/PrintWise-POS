import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const { data: profile } = await admin.from("profiles").select("role,is_active").eq("id", auth.user.id).maybeSingle();
    if (!profile?.is_active || !["admin", "staff", "cashier"].includes(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const { data, error } = await admin.from("pos_orders")
      .select("id,order_no,customer_name,subtotal,discount_amount,total,amount_paid,balance,notes,created_at,source_type,source_id,pos_order_items(item_name,quantity,unit_price,line_total)")
      .eq("source_type", "wise_menu_order").eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ orders: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to load WISE MENU POS orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const body = await request.json();
    const posOrderId = String(body.posOrderId || "");
    const channel = String(body.channel || "cash").toLowerCase();
    const amountPaid = Number(body.amountPaid);
    const referenceNo = body.referenceNo ? String(body.referenceNo).trim() : null;
    if (!posOrderId || !Number.isFinite(amountPaid) || amountPaid < 0) return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const { data, error } = await admin.rpc("complete_wise_menu_pos_payment", {
      p_pos_order_id: posOrderId,
      p_created_by: auth.user.id,
      p_channel: channel,
      p_amount_paid: amountPaid,
      p_reference_no: referenceNo,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unable to complete payment" }, { status: 500 });
  }
}
