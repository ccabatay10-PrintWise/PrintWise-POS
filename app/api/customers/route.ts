import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim().replace(/^['\"]|['\"]$/g, "");
    if (value) return value;
  }
  return "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const anonKey = envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");

function jsonError(error: string, status: number) { return NextResponse.json({ error }, { status }); }
function numberValue(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export async function GET(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return jsonError("Customer service is not configured on the server.", 500);
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonError("Please sign in again.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Your session has expired. Please sign in again.", 401);

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: orders, error } = await adminClient
    .from("pos_orders")
    .select("id,order_no,customer_name,subtotal,discount_amount,total,amount_paid,balance,status,created_at")
    .not("customer_name", "is", null)
    .order("created_at", { ascending: false });
  if (error) return jsonError(`Unable to load customers: ${error.message}`, 400);

  const ids = (orders || []).map((o: any) => o.id).filter(Boolean);
  const [{ data: items }, { data: payments }] = ids.length ? await Promise.all([
    adminClient.from("pos_order_items").select("pos_order_id,item_name,quantity,unit_price,line_total").in("pos_order_id", ids).order("created_at", { ascending: true }),
    adminClient.from("payment_transactions").select("pos_order_id,channel,transaction_type,amount,status,created_at").in("pos_order_id", ids).order("created_at", { ascending: true }),
  ]) : [{ data: [] }, { data: [] }];

  const itemsByOrder = new Map<string, any[]>();
  for (const item of items || []) {
    const key = String((item as any).pos_order_id);
    const list = itemsByOrder.get(key) || [];
    list.push(item);
    itemsByOrder.set(key, list);
  }
  const paymentsByOrder = new Map<string, any[]>();
  for (const payment of payments || []) {
    const key = String((payment as any).pos_order_id);
    const list = paymentsByOrder.get(key) || [];
    list.push(payment);
    paymentsByOrder.set(key, list);
  }

  const enrichedOrders = (orders || []).map((order: any) => ({
    ...order,
    subtotal: numberValue(order.subtotal),
    discount_amount: numberValue(order.discount_amount),
    total: numberValue(order.total),
    amount_paid: numberValue(order.amount_paid),
    balance: numberValue(order.balance),
    items: itemsByOrder.get(String(order.id)) || [],
    payments: paymentsByOrder.get(String(order.id)) || [],
  }));

  return NextResponse.json({ orders: enrichedOrders });
}
