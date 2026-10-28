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
const anonKey = envValue(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY"
);

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizePaymentChannel(value: unknown) {
  const raw = String(value ?? "cash").trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, string> = {
    cash: "cash",
    gcash: "gcash",
    bayad_center: "bayad_center",
    bayadcenter: "bayad_center",
    bank_transfer: "bank_transfer",
    banktransfer: "bank_transfer",
    maya: "other",
    credit_card: "other",
    creditcard: "other",
    ewallet: "other",
    e_wallet: "other",
    other: "other",
  };
  return aliases[raw] || "other";
}

export async function POST(request: NextRequest) {
  if (!url || !anonKey) return errorResponse("WISE POS checkout service is not configured.", 500);

  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return errorResponse("Please sign in again.", 401);

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return errorResponse("Your session has expired. Please sign in again.", 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid checkout request.", 400);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return errorResponse("At least one item is required.", 400);

  const normalizedItems = items.map((item: any) => ({
    product_id: item.product_id ?? item.productId ?? item.id ?? null,
    item_name: String(item.item_name ?? item.itemName ?? item.name ?? "").trim(),
    unit_price: Number(item.unit_price ?? item.unitPrice ?? item.price),
    quantity: Number(item.quantity),
    line_total: Number(item.line_total ?? item.lineTotal ?? item.price * item.quantity),
    options: { ...(item.options && typeof item.options === "object" ? item.options : {}), order_type: item.orderType === "dine_in" ? "dine_in" : "take_out" },
  }));

  if (
    normalizedItems.some(
      (item: any) =>
        !item.item_name ||
        !Number.isFinite(item.unit_price) ||
        item.unit_price < 0 ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.line_total) ||
        item.line_total < 0
    )
  ) {
    return errorResponse("One or more order items are invalid.", 400);
  }

  const orderNo = String(body.order_no ?? body.orderNo ?? "").trim();
  const transactionNo = String(body.transaction_no ?? body.transactionNo ?? "").trim();
  const customerName = body.customer_name ?? body.customerName ?? null;
  const subtotal = Number(body.subtotal);
  const discountAmount = Number(body.discount_amount ?? body.discountAmount ?? 0);
  const total = Number(body.total);
  const amountPaid = Number(body.amount_paid ?? body.amountPaid);
  const paymentChannel = normalizePaymentChannel(
    body.payment_channel ?? body.paymentChannel ?? body.channel ?? "cash"
  );

  if (
    !orderNo ||
    !transactionNo ||
    !Number.isFinite(subtotal) ||
    !Number.isFinite(discountAmount) ||
    !Number.isFinite(total) ||
    !Number.isFinite(amountPaid)
  ) {
    return errorResponse("Invalid checkout totals or transaction details.", 400);
  }

  // Preserve the signed-in user's JWT for the database function. This keeps
  // auth.uid() available during the SECURITY DEFINER transaction.
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await userClient.rpc("create_wise_pos_sale", {
    p_order_no: orderNo,
    p_customer_name: customerName ? String(customerName) : null,
    p_subtotal: subtotal,
    p_discount_type: body.discount_type ?? body.discountType ?? null,
    p_discount_value: Number(body.discount_value ?? body.discountValue ?? 0),
    p_discount_amount: discountAmount,
    p_total: total,
    p_amount_paid: amountPaid,
    p_created_by: authData.user.id,
    p_payment_channel: paymentChannel,
    p_transaction_no: transactionNo,
    p_items: normalizedItems,
  });

  if (error) {
    const message = error.message || "Unable to complete checkout.";
    const status = /Unauthorized|not permitted|session/i.test(message) ? 403 : 400;
    return errorResponse(message, status);
  }

  let loyaltyResult: any = null;
  const loyaltyMemberId = String(body.loyaltyMemberId || "").trim();
  if (loyaltyMemberId && data?.order_id) {
    const { data: stampData, error: stampError } = await userClient.rpc("award_loyalty_stamp", {
      p_order_id: data.order_id,
      p_member_id: loyaltyMemberId,
    });
    if (stampError) {
      console.error("Loyalty stamp could not be recorded:", stampError.message);
      loyaltyResult = { warning: "Sale completed, but the loyalty stamp was not recorded. Please record it from Loyalty Members after checking the order." };
    } else {
      loyaltyResult = stampData;
    }
  }

  const notes = String(body.notes ?? "").trim().slice(0, 500);
  if (notes) {
    // Store staff-entered notes on both the POS transaction and the kitchen receiving order.
    const [posNoteResult, kitchenNoteResult] = await Promise.all([
      userClient.from("pos_orders").update({ notes }).eq("order_no", orderNo),
      userClient.from("wise_menu_orders").update({ notes }).eq("order_no", orderNo),
    ]);
    if (posNoteResult.error) console.error("Unable to save POS transaction note:", posNoteResult.error.message);
    if (kitchenNoteResult.error) console.error("Unable to save kitchen order note:", kitchenNoteResult.error.message);
    if (posNoteResult.error && kitchenNoteResult.error) {
      return NextResponse.json({ ...(data || { ok: true }), loyalty: loyaltyResult, warning: "Sale completed, but the customer note could not be saved. Please add it to the order notes." });
    }
  }

  return NextResponse.json({ ...(data || { ok: true }), loyalty: loyaltyResult });
}
