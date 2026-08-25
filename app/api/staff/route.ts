import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configError() {
  return NextResponse.json({ error: "Staff Management is not configured yet. Add SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables." }, { status: 500 });
}

async function getAdmin(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return { error: configError() };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = data.user.user_metadata?.role;
  // Existing PrintWise owner accounts created before role support are treated as Admin.
  if (role && role !== "admin") return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return { user: data.user };
}

export async function GET(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const staff = data.users
    .filter((u) => u.user_metadata?.role === "staff")
    .map((u) => ({
      id: u.id,
      name: u.user_metadata?.full_name || u.email || "Staff",
      email: u.email || "",
      role: "Staff",
      active: !u.banned_until || new Date(u.banned_until).getTime() <= Date.now(),
      created_at: u.created_at,
    }));
  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;
  const body = await request.json();
  const action = body.action || "create";
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });

  if (action === "create") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || !email || password.length < 6) return NextResponse.json({ error: "Enter a full name, valid email, and password with at least 6 characters." }, { status: 400 });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: "staff" },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, staff: { id: data.user.id, name, email, role: "Staff", active: true, created_at: data.user.created_at } });
  }

  const staffId = String(body.staffId || "");
  if (!staffId) return NextResponse.json({ error: "Staff account not found." }, { status: 400 });

  if (action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(staffId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (action === "toggle_active") {
    const active = Boolean(body.active);
    const { error } = await admin.auth.admin.updateUserById(staffId, { ban_duration: active ? "none" : "876000h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
