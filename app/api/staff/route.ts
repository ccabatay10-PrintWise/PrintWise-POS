import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function configError() {
  return jsonError(
    "Staff Management is not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY to the Production environment, then redeploy.",
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
  if (!token) return { error: jsonError("Your admin session is missing. Please sign in again and retry.", 401) };

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonError("Your session has expired. Please sign in again.", 401) };
  }

  const role = userRole(data.user);
  // Legacy owner accounts created before roles were introduced are treated as admins.
  if (role && role !== "admin") {
    return { error: jsonError("Admin access required to manage staff accounts.", 403) };
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

export async function GET(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;

  const admin = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonError(error.message, 400);

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
  const admin = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "create") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!name || !email || password.length < 6) {
      return jsonError("Enter a full name, valid email, and password with at least 6 characters.", 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: "staff" },
    });

    if (!error && data.user) {
      return NextResponse.json({ success: true, created: true, staff: staffRecord(data.user) });
    }

    // A previous click may already have created the account. Return the existing
    // staff account instead of leaving the user with an apparently broken button.
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = usersError
      ? undefined
      : usersData.users.find((user) => (user.email || "").toLowerCase() === email);

    if (existing) {
      if (userRole(existing) !== "staff") {
        return jsonError("This email is already registered to a non-staff account. Use a different email address.", 400);
      }
      return NextResponse.json({
        success: true,
        created: false,
        message: "This staff account already exists and has been restored to the staff list.",
        staff: staffRecord(existing),
      });
    }

    return jsonError(error?.message || "Unable to create the staff account.", 400);
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
