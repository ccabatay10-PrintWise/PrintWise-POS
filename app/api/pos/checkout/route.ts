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

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return errorResponse("POS checkout service is not configured.", 500);

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return errorResponse("Please sign in again.", 401);

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return errorResponse("Your session has expired. Please sign in again.", 401);

  let body: any;
  try { body = await request.json(); } catch { return errorResponse("Invalid checkout request.", 400); }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return errorResponse("At least one item is required.", 400);

  const normalizedItems = items.map((item: any) => ({
    product_id: item.product_id ? String(item.product_id) : null,
    item_name: String(item.item_name || "").trim(),
    unit_price: Number(item.unit_price),
    quantity: Number(item.quantity),
    line_total: Number(item.line_total),
  }));

  if (normalizedItems.some((item: any) => !item.item_name || !Number.isFinite(item.unit_price) || item.unit_price < 0 || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.line_total) || item.line_total < 0)) {
    return errorResponse("One or more order items are invalid.", 400);
  }

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await adminClient.rpc("create_printwise_pos_sale", {
    p_order_no: String(body.order_no || "").trim(),
    p_customer_name: body.customer_name ? String(body.customer_name) : null,
    p_subtotal: Number(body.subtotal),
    p_discount_type: body.discount_type ? String(body.discount_type) : null,
    p_discount_value: Number(body.discount_value || 0),
    p_discount_amount: Number(body.discount_amount || 0),
    p_total: Number(body.total),
    p_amount_paid: Number(body.amount_paid),
    p_created_by: authData.user.id,
    p_payment_channel: String(body.payment_channel || "cash"),
    p_transaction_no: String(body.transaction_no || "").trim(),
    p_items: normalizedItems,
  });

  if (error) {
    const message = error.message || "Unable to complete checkout.";
    const status = /Unauthorized|not permitted|session/i.test(message) ? 403 : 400;
    return errorResponse(message, status);
  }

  return NextResponse.json(data || { ok: true });
}
