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

function metadataRole(user: any) {
  return String(user?.app_metadata?.role || "").trim().toLowerCase();
}

function adminClient() {
  return createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAdmin(request: NextRequest) {
  if (!url || !anonKey || !serviceKey) return { error: configError() };

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: jsonError("Your admin session is missing. Please sign in again, refresh the page, and retry.", 401) };
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { error: jsonError("Your session has expired. Please sign in again.", 401) };
  }

  let role = metadataRole(data.user);
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,is_active,business_name")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: jsonError(`Unable to verify your admin role: ${profileError.message}`, 500) };
  }

  if (profile) role = String(profile.role || role).trim().toLowerCase();

  if (role !== "admin" || (profile && profile.is_active === false)) {
    return { error: jsonError("Admin access is required to manage staff accounts.", 403) };
  }

  let businessName = String(profile?.business_name || "").trim();
  if (!businessName) {
    const { data: settings } = await admin
      .from("company_settings")
      .select("business_name")
      .limit(1)
      .maybeSingle();
    businessName = String(settings?.business_name || "").trim();
  }

  return { user: data.user, businessName };
}

function staffRecord(user: any, profile?: any) {
  const profileActive = profile?.is_active;
  const authActive = !user.banned_until || new Date(user.banned_until).getTime() <= Date.now();
  return {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || user.email || "Staff",
    email: profile?.email || user.email || "",
    role: "Staff",
    active: profileActive === false ? false : authActive,
    created_at: user.created_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAdmin(request);
  if (auth.error) return auth.error;

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonError(`Unable to load staff accounts: ${error.message}`, 400);

  const staffUsers = data.users.filter((user) => {
    const appRole = metadataRole(user);
    const userRole = String(user.user_metadata?.role || "").trim().toLowerCase();
    return appRole === "staff" || userRole === "staff";
  });

  const ids = staffUsers.map(user => user.id);
  let profiles: any[] = [];
  if (ids.length) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id,full_name,email,role,is_active,business_name")
      .in("id", ids);
    profiles = profileRows || [];
  }

  const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
  const staff = staffUsers
    .filter(user => String(profileMap.get(user.id)?.role || "staff").toLowerCase() === "staff")
    .map(user => staffRecord(user, profileMap.get(user.id)));

  return NextResponse.json({ staff, businessName: auth.businessName || "WISE POS" });
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError("Enter a valid email address.", 400);
    }

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
      const { data: existingProfile, error: existingProfileError } = await admin
        .from("profiles")
        .select("role,is_active,business_name")
        .eq("id", existing.id)
        .maybeSingle();

      if (existingProfileError) {
        return jsonError(`Unable to verify the existing account before staff provisioning: ${existingProfileError.message}`, 500);
      }

      const existingRole = String(
        existingProfile?.role ||
        metadataRole(existing) ||
        existing.user_metadata?.role ||
        ""
      ).trim().toLowerCase();

      if (existingRole && existingRole !== "staff") {
        return jsonError(
          "That email already belongs to an existing non-staff account. Use a different email address; existing admin/cashier accounts cannot be converted from Staff Management.",
          409,
        );
      }

      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          full_name: name,
          role: "staff",
          business_name: auth.businessName || existingProfile?.business_name || existing.user_metadata?.business_name || "WISE POS",
        },
        app_metadata: {
          ...existing.app_metadata,
          role: "staff",
        },
      });
      if (updateError || !updated.user) {
        return jsonError(updateError?.message || "The existing account could not be updated as a staff account.", 400);
      }

      const { error: profileError } = await admin.from("profiles").upsert({
        id: existing.id,
        full_name: name,
        email,
        role: "staff",
        is_active: true,
        business_name: auth.businessName || existingProfile?.business_name || existing.user_metadata?.business_name || "WISE POS",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (profileError) return jsonError(`The login was updated, but the staff profile could not be saved: ${profileError.message}`, 500);

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
      user_metadata: {
        full_name: name,
        role: "staff",
        business_name: auth.businessName || "WISE POS",
      },
      app_metadata: { role: "staff" },
    });

    if (error || !data.user) {
      return jsonError(error?.message || "Supabase did not return the new staff account.", 400);
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      full_name: name,
      email,
      role: "staff",
      is_active: true,
      business_name: auth.businessName || "WISE POS",
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return jsonError(`The staff login could not be completed because its profile could not be created: ${profileError.message}`, 500);
    }

    return NextResponse.json({ success: true, created: true, staff: staffRecord(data.user) });
  }

  const staffId = String(body.staffId || "").trim();
  if (!staffId) return jsonError("Staff account not found.", 400);

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(staffId);
  if (targetError || !target.user) return jsonError("Staff account not found.", 404);
  const targetRole = metadataRole(target.user) || String(target.user.user_metadata?.role || "").trim().toLowerCase();
  if (targetRole !== "staff") return jsonError("Only staff accounts can be changed here.", 403);

  if (action === "reset_password") {
    const password = String(body.password || "");
    if (password.length < 6) return jsonError("Password must be at least 6 characters.", 400);
    const { error } = await admin.auth.admin.updateUserById(staffId, { password });
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ success: true });
  }

  if (action === "toggle_active") {
    const active = Boolean(body.active);
    const { error: authError } = await admin.auth.admin.updateUserById(staffId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (authError) return jsonError(authError.message, 400);

    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("id", staffId);
    if (profileError) return jsonError(`Login status changed, but the staff profile could not be updated: ${profileError.message}`, 500);

    return NextResponse.json({ success: true });
  }

  return jsonError("Unsupported staff action.", 400);
}
