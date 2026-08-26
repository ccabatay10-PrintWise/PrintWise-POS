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

function configError() {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean).join(", ");
  return jsonError(
    `Staff Management server configuration is incomplete. Missing: ${missing || "unknown setting"}. Add the value as a Secret in Vercel Production and redeploy.`,
    500,
  );
}

function userRole(user: any) {
  return user?.app_metadata?.role || user?.user_metadata?.role || "";
}

async function getAdmin(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return { error: configError() };

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: jsonError("Your admin session is missing. Please sign in again, refresh the page, and retry.", 401) };

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonError("Your session has expired. Please sign in again.", 401) };
  }

  const role = userRole(data.user);
  // Existing owner accounts created before role support are treated as admins.
  if (role && role !== "admin") {
    return { error: jsonError("Admin access is required to manage staff accounts.", 403) };
  }

  return { user: data.user };
}

function staffRecord(user: any) {
  return {
    id: user.id,
    name: user.user_metadata?.full_name || user.email || "Staff",
    email: user.email || "",
    role: "Staff",
    active: !user.banned_until || new Date(user.banned_until).getTime() <= Date.now(),
    created_at: user.created_at,
  };
}

function adminClient() {
  return createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonError(`Unable to load staff accounts: ${error.message}`, 400);

  const staff = data.users
    .filter((user) => userRole(user) === "staff")
    .map(staffRecord);

  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid staff request.", 400);
  }

  const action = body.action || "create";
  const admin = adminClient();

  if (action === "create") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!name || !email || password.length < 6) {
      return jsonError("Enter a full name, valid email, and password with at least 6 characters.", 400);
    }

    // Check first so a previously created account can be repaired instead of failing.
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) {
      return jsonError(`Unable to access Supabase users. Check SUPABASE_SERVICE_ROLE_KEY: ${usersError.message}`, 500);
    }

    const existing = usersData.users.find(
      (user) => (user.email || "").toLowerCase() === email,
    );

    if (existing) {
      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          full_name: name,
          role: "staff",
        },
      });
      if (updateError || !updated.user) {
        return jsonError(updateError?.message || "The existing account could not be updated as a staff account.", 400);
      }
      return NextResponse.json({
        success: true,
        created: false,
        message: "The existing account was updated and restored as a staff account.",
        staff: staffRecord(updated.user),
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: "staff" },
    });

    if (error || !data.user) {
      return jsonError(error?.message || "Supabase did not return the new staff account.", 400);
    }

    return NextResponse.json({ success: true, created: true, staff: staffRecord(data.user) });
  }

  const staffId = String(body.staffId || "").trim();
  if (!staffId) return jsonError("Staff account not found.", 400);

  if (action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < 6) return jsonError("Password must be at least 6 characters.", 400);
    const { error } = await admin.auth.admin.updateUserById(staffId, { password });
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ success: true });
  }

  if (action === "toggle_active") {
    const active = Boolean(body.active);
    const { error } = await admin.auth.admin.updateUserById(staffId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ success: true });
  }

  return jsonError("Unsupported staff action.", 400);
}
