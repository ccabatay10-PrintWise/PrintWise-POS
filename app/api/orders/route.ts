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
  "SUPABASE_ANON_KEY",
);
const serviceKey = envValue(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SERVICE_ROLE_KEY",
);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function numberValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function userRole(user: any) {
  return user?.app_metadata?.role || user?.user_metadata?.role || "";
}

async function getAuthenticatedAdmin(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) {
    return { error: jsonError("Order service is not configured on the server.", 500) };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: jsonError("Please sign in again.", 401) };

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonError("Your session has expired. Please sign in again.", 401) };
  }

  const role = userRole(data.user);
  if (role && role !== "admin") {
    return { error: jsonError("Admin access is required to void transactions.", 403) };
  }

  return { user: data.user };
}

export async function GET(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) {
    return jsonError("Order service is not configured on the server.", 500);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonError("Please sign in again.", 401);

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonError("Your session has expired. Please sign in again.", 401);
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const orderId = request.nextUrl.searchParams.get("orderId")?.trim();

  if (orderId) {
    const { data, error } = await adminClient
      .from("pos_order_items")
      .select("id,product_id,item_name,unit_price,quantity,line_total")
      .eq("pos_order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) return jsonError(`Unable to load order items: ${error.message}`, 400);
    return NextResponse.json({ items: data ?? [] });
  }

  const { data, error } = await adminClient
    .from("pos_orders")
    .select("id,order_no,customer_name,subtotal,discount_amount,total,amount_paid,status,created_at,created_by")
    .order("created_at", { ascending: false });

  if (error) return jsonError(`Unable to load orders: ${error.message}`, 400);

  const orderIds = (data ?? []).map((order: any) => String(order.id)).filter(Boolean);
  const paymentTotals = new Map<string, number>();
  const itemTotals = new Map<string, number>();

  if (orderIds.length) {
    const [{ data: payments }, { data: items }] = await Promise.all([
      adminClient
        .from("payment_transactions")
        .select("pos_order_id,amount,status")
        .in("pos_order_id", orderIds),
      adminClient
        .from("pos_order_items")
        .select("pos_order_id,line_total")
        .in("pos_order_id", orderIds),
    ]);

    for (const payment of payments ?? []) {
      const status = String((payment as any).status || "").toLowerCase();
      if (status === "voided" || status === "failed") continue;
      const id = String((payment as any).pos_order_id || "");
      paymentTotals.set(id, (paymentTotals.get(id) || 0) + numberValue((payment as any).amount));
    }

    for (const item of items ?? []) {
      const id = String((item as any).pos_order_id || "");
      itemTotals.set(id, (itemTotals.get(id) || 0) + numberValue((item as any).line_total));
    }
  }

  const nameCache = new Map<string, string>();
  const orders = await Promise.all((data ?? []).map(async (order: any) => {
    const id = String(order.id || "");
    const savedSubtotal = numberValue(order.subtotal);
    const savedDiscount = numberValue(order.discount_amount);
    const savedTotal = numberValue(order.total);
    const savedPaid = numberValue(order.amount_paid);
    const itemTotal = itemTotals.get(id) || 0;
    const paymentTotal = paymentTotals.get(id) || 0;

    // Older/broken rows may contain zero totals even though their items or payment were saved.
    // Always return the best valid amount so the Transactions screen stays accurate.
    const resolvedSubtotal = savedSubtotal > 0 ? savedSubtotal : itemTotal;
    const resolvedTotal = savedTotal > 0
      ? savedTotal
      : Math.max(0, resolvedSubtotal - savedDiscount) || paymentTotal;
    const resolvedPaid = savedPaid > 0 ? savedPaid : paymentTotal;

    const userId = String(order.created_by || "").trim();
    let transactedBy = "Not recorded";
    if (userId) {
      let name = nameCache.get(userId);
      if (!name) {
        try {
          const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
          const user = userData?.user;
          name = userError || !user
            ? "Not recorded"
            : String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Not recorded");
        } catch {
          name = "Not recorded";
        }
        nameCache.set(userId, name);
      }
      transactedBy = name;
    }

    return {
      ...order,
      subtotal: resolvedSubtotal,
      total: resolvedTotal,
      amount_paid: resolvedPaid,
      transacted_by: transactedBy,
    };
  }));

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedAdmin(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid void request.", 400);
  }

  const action = String(body.action || "");
  if (action !== "void") return jsonError("Unsupported order action.", 400);

  const orderId = String(body.orderId || "").trim();
  const password = String(body.password || "");
  if (!orderId || !password) {
    return jsonError("Enter the admin password to void this transaction.", 400);
  }

  if (!auth.user.email) {
    return jsonError("The current admin account has no email address.", 400);
  }

  const passwordCheckClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: passwordCheck, error: passwordError } =
    await passwordCheckClient.auth.signInWithPassword({
      email: auth.user.email,
      password,
    });

  if (passwordError || !passwordCheck.user) {
    return jsonError("Incorrect admin password. Transaction was not voided.", 401);
  }

  const checkedRole = userRole(passwordCheck.user);
  if (checkedRole && checkedRole !== "admin") {
    return jsonError("Admin access is required to void transactions.", 403);
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingOrder, error: existingError } = await adminClient
    .from("pos_orders")
    .select("id,status")
    .eq("id", orderId)
    .single();

  if (existingError || !existingOrder) {
    return jsonError("Transaction not found.", 404);
  }

  if (String(existingOrder.status || "").toLowerCase() === "voided") {
    return NextResponse.json({ ok: true, alreadyVoided: true });
  }

  const { error: orderError } = await adminClient
    .from("pos_orders")
    .update({ status: "voided" })
    .eq("id", orderId);

  if (orderError) {
    return jsonError(`Unable to void transaction: ${orderError.message}`, 400);
  }

  const { error: paymentError } = await adminClient
    .from("payment_transactions")
    .update({ status: "voided" })
    .eq("pos_order_id", orderId);

  if (paymentError) {
    return jsonError(`Transaction was voided, but the payment status could not be updated: ${paymentError.message}`, 400);
  }

  return NextResponse.json({ ok: true });
}
