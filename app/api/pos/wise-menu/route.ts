import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminClient() {
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authorize(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Authentication required");
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Authentication required");
  const { data: profile, error: profileError } = await admin.from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
  if (profileError || !profile?.is_active || !["admin", "staff", "cashier"].includes(profile.role)) throw new Error("Not authorized");
  return { admin, userId: data.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await authorize(request);
    const { data, error } = await admin.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,balance,notes,created_at,source_type,source_id").eq("source_type", "wise_menu_order").eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, orders: data ?? [] });
  } catch (error: any) {
    const message = error?.message || "Unable to load WISE MENU orders.";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await authorize(request);
    const body = await request.json().catch(() => ({}));
    const posOrderId = String(body.posOrderId || "").trim();
    const channel = String(body.channel || "cash").trim();
    const amountPaid = Number(body.amountPaid);
    const transactionNo = String(body.transactionNo || "").trim();
    if (!posOrderId || !Number.isFinite(amountPaid) || amountPaid < 0 || !transactionNo) throw new Error("Invalid payment details.");
    const { data, error } = await admin.rpc("finalize_wise_menu_pos_payment", {
      p_pos_order_id: posOrderId,
      p_payment_channel: channel,
      p_amount_paid: amountPaid,
      p_transaction_no: transactionNo,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    const message = error?.message || "Unable to complete WISE MENU payment.";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 400 });
  }
}
