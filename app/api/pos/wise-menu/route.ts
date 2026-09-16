import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AuthContext = { admin: SupabaseClient; userClient: SupabaseClient; userId: string };

async function authorize(request: NextRequest): Promise<AuthContext> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Authentication required");
  if (!supabaseUrl || !publicKey || !serviceKey) throw new Error("Supabase configuration is missing");
  const userClient = createClient(supabaseUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Authentication required");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile, error: profileError } = await admin.from("profiles").select("role,is_active").eq("id", authData.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.is_active || !["admin", "staff", "cashier"].includes(profile.role)) throw new Error("Not authorized");
  return { admin, userClient, userId: authData.user.id };
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await authorize(request);
    const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
    if (!orderId) throw new Error("WISE MENU order is required.");
    const { data: order, error: orderError } = await admin.from("wise_menu_orders").select("id,order_no,customer_name,customer_email,total,subtotal,notes,created_at,status").eq("id", orderId).in("status", ["accepted", "pending"]).maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw new Error("WISE MENU order is no longer available for Current Sale.");
    const { data: items, error: itemsError } = await admin.from("wise_menu_order_items").select("product_id,product_name,quantity,unit_price,line_total").eq("order_id", orderId).order("created_at", { ascending: true });
    if (itemsError) throw itemsError;
    if (!items?.length) throw new Error("WISE MENU order has no items.");
    return NextResponse.json({ ok: true, order: { id: order.id, order_no: order.order_no, customer_name: order.customer_name, total: Number(order.total), amount_paid: 0, balance: Number(order.total), notes: order.notes, created_at: order.created_at, status: order.status, items: items.map((item) => ({ product_id: item.product_id, product_name: item.product_name, quantity: Number(item.quantity), unit_price: Number(item.unit_price), line_total: Number(item.line_total) })) } });
  } catch (error: any) {
    const message = error?.message || "Unable to load WISE MENU order.";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : message === "Not authorized" ? 403 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userClient } = await authorize(request);
    const body = await request.json().catch(() => ({}));
    const wiseMenuOrderId = String(body.wiseMenuOrderId || body.posOrderId || "").trim();
    const channel = String(body.channel || "cash").trim();
    const amountPaid = Number(body.amountPaid);
    const transactionNo = String(body.transactionNo || "").trim();
    if (!wiseMenuOrderId || !Number.isFinite(amountPaid) || amountPaid < 0 || !transactionNo) throw new Error("Invalid payment details.");
    const { data, error } = await userClient.rpc("checkout_wise_menu_order", { p_wise_menu_order_id: wiseMenuOrderId, p_payment_channel: channel, p_amount_paid: amountPaid, p_transaction_no: transactionNo });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    const message = error?.message || "Unable to complete WISE MENU payment.";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : message === "Not authorized" ? 403 : 400 });
  }
}
