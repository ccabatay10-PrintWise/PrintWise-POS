import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function envValue(...names: string[]) { for (const name of names) { const value = process.env[name]?.trim().replace(/^['\"]|['\"]$/g, ""); if (value) return value; } return ""; }
const url = envValue("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const anonKey = envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");
function jsonError(error: string, status: number) { return NextResponse.json({ error }, { status }); }

export async function GET(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return jsonError("Product service is not configured on the server.", 500);
  const authorization = request.headers.get("authorization") || "", token = authorization.replace(/^Bearer\\s+/i, "").trim();
  if (!token) return jsonError("Please sign in again.", 401);
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return jsonError("Your session has expired. Please sign in again.", 401);
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await adminClient.from("products").select("id,name,category,price,unit,icon_key,image_url,item_type").eq("is_active", true).eq("show_in_pos", true).order("category").order("name");
  if (error) return jsonError(`Unable to load products: ${error.message}`, 400);
  return new NextResponse(JSON.stringify({ products: (data ?? []).map((p: any) => ({ ...p, item_type: p.item_type === "service" ? "service" : "product" })) }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
