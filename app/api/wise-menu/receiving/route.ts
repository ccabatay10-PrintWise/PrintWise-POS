import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type AuthContext = { admin: SupabaseClient; userClient: SupabaseClient };

async function auth(req: NextRequest): Promise<AuthContext> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Authentication required");
  if (!url || !publicKey || !service) throw new Error("Supabase configuration is missing");

  const userClient = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) throw new Error("Authentication required");

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.is_active || !["admin", "staff", "cashier"].includes(profile.role)) throw new Error("Not authorized");
  return { admin, userClient };
}

export async function GET(req: NextRequest) {
  try {
    const { admin } = await auth(req);
    const { data, error } = await admin
      .from("wise_menu_orders")
      .select("id,order_no,customer_name,customer_email,notes,status,total,subtotal,created_at,updated_at,wise_menu_order_items(product_id,product_name,quantity,unit_price,line_total,options)")
      .eq("status", "new")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ orders: data || [] });
  } catch (e: any) {
    const message = e.message || "Unable to load WISE MENU orders";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 403 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userClient } = await auth(req);
    const body = await req.json();
    if (!body?.order_id) return NextResponse.json({ error: "Order is required" }, { status: 400 });

    // Confirmation does NOT create a POS/Orders record yet. It only accepts
    // the WISE MENU order and hands its ID to Current Sale. The POS order is
    // created only after the cashier completes payment in Current Sale.
    const { data, error } = await userClient.rpc("accept_wise_menu_order", {
      p_order_id: body.order_id,
    });
    if (error) throw error;
    return NextResponse.json(data || { ok: true });
  } catch (e: any) {
    const message = e.message || "Unable to send order to Current Sale";
    const status = message === "Authentication required" ? 401 : message === "Not authorized" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
