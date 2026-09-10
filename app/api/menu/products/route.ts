import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const env = (...names: string[]) => names.map(n => process.env[n]?.trim()).find(Boolean) || "";
const url = env("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");

export async function GET() {
  if (!url || !serviceKey) return NextResponse.json({ error: "Menu service is not configured." }, { status: 500 });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.from("products").select("id,name,category,description,price,unit,image_url,video_url,icon_key").eq("is_active", true).eq("show_in_pos", true).order("category").order("name");
  if (error) return NextResponse.json({ error: "Unable to load menu." }, { status: 500 });
  return NextResponse.json({ products: data ?? [] }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
