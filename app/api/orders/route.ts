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
  // Existing owner accounts created before role metadata are treated as admins.
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
      .select("id,item_name,unit_price,quantity,line_total")
      .eq("pos_order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) return jsonError(`Unable to load order items: ${error.message}`, 400);
    return NextResponse.json({ items: data ?? [] });
  }

  const { data, error } = await adminClient
    .from("pos_orders")
    .select("id,order_no,customer_name,subtotal,discount_amount,total,amount_paid,status,created_at")
    .order("created_at", { ascending: false });

  if (error) return jsonError(`Unable to load orders: ${error.message}`, 400);
  return NextResponse.json({ orders: data ?? [] });
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

  // Re-authenticate with the current admin's password before allowing the void.
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

  // Preserve the transaction history: mark as voided instead of physically deleting it.
  const { error: orderError } = await adminClient
    .from("pos_orders")
    .update({ status: "voided" })
    .eq("id", orderId);

  if (orderError) {
    return jsonError(`Unable to void transaction: ${orderError.message}`, 400);
  }

  // Keep related payment records consistent with the order status.
  const { error: paymentError } = await adminClient
    .from("payment_transactions")
    .update({ status: "voided" })
    .eq("pos_order_id", orderId);

  if (paymentError) {
    return jsonError(
      `Transaction was voided, but the payment status could not be updated: ${paymentError.message}`,
      400,
    );
  }

  return NextResponse.json({ ok: true });
}
