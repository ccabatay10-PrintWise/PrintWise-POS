import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const b64url = (s: string) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const automaticEmail = (trigger: string, job: any) => {
  const name = job.customer_name || "Customer";
  const reference = job.reference_no;
  const amount = Number(job.amount_paid || 0).toFixed(2);
  switch (trigger) {
    case "RECEIVED": return { notificationType: "RECEIVED", subject: `We Received Your Files — ${reference}`, message: `Hi ${name},\n\nWe have successfully received your PrintWise files. Our team will review your submission shortly.\n\nReference No.: ${reference}\n\nThank you,\nPrintWise` };
    case "REVIEWING":
    case "VALIDATING": return { notificationType: "VALIDATING", subject: `Your Files Are Being Validated — ${reference}`, message: `Hi ${name},\n\nWe are currently validating your submitted files to ensure they are ready for processing.\n\nReference No.: ${reference}\n\nWe will update you once processing begins.\n\nThank you,\nPrintWise` };
    case "PROCESSING": return { notificationType: "PROCESSING", subject: `Your Files Are Now Being Processed — ${reference}`, message: `Hi ${name},\n\nGreat news! We have started processing your files.\n\nReference No.: ${reference}\n\nWe will notify you once your documents are ready for pickup.\n\nThank you,\nPrintWise` };
    case "READY":
    case "READY_FOR_PICKUP": return { notificationType: "READY", subject: `Your Order Is Ready for Pickup — ${reference}`, message: `Hi ${name},\n\nYour documents have been successfully processed and are now ready for pickup.\n\nReference No.: ${reference}${amount !== "0.00" ? `\nAmount Paid: ₱${amount}` : ""}\n\nThank you,\nPrintWise` };
    case "COMPLETED": return { notificationType: "COMPLETED", subject: `Your PrintWise Order Is Completed — ${reference}`, message: `Hi ${name},\n\nYour PrintWise request ${reference} has been completed.\n\nThank you for choosing PrintWise!` };
    default: return null;
  }
};

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim().replace(/^['\"]|['\"]$/g, "");
    if (value) return value;
  }
  return "";
}

async function authorizeStaff(request: NextRequest) {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  const service = envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SERVICE_ROLE_KEY");
  if (!url || !anonKey || !service) return { error: NextResponse.json({ error: "Email service authentication is not configured." }, { status: 500 }) };

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: NextResponse.json({ error: "Authentication is required to send email." }, { status: 401 }) };

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 }) };

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await db.from("profiles").select("role,is_active").eq("id", authData.user.id).maybeSingle();
  if (profileError) return { error: NextResponse.json({ error: "Unable to verify your account permissions." }, { status: 500 }) };
  const role = String(profile?.role || authData.user.app_metadata?.role || "").trim().toLowerCase();
  if (!["admin", "staff"].includes(role) || profile?.is_active === false) return { error: NextResponse.json({ error: "Staff or admin access is required to send email." }, { status: 403 }) };
  return { url, service };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeStaff(req);
    if (auth.error) return auth.error;
    const { url, service } = auth;

    const body = await req.json();
    let { jobId, notificationType, to, subject, message, resendOf } = body;
    const automatic = body.automatic === true;

    if (automatic) {
      const trigger = String(body.trigger || body.status || "").toUpperCase();
      if (!jobId || !trigger) return NextResponse.json({ error: "Automatic email is missing job details." }, { status: 400 });
      const db = createClient(url, service);
      const { data: job, error: jobError } = await db.from("received_file_jobs").select("id, reference_no, customer_name, email, customer_email, amount_paid, receipt_reference").eq("id", jobId).single();
      if (jobError || !job) return NextResponse.json({ error: jobError?.message || "File job not found." }, { status: 404 });
      to = job.email || job.customer_email || null;
      const template = automaticEmail(trigger, job);
      if (!to || !template) return NextResponse.json({ ok: true, skipped: true, reason: !to ? "No customer email provided." : "No automatic email for this trigger." });
      const { data: existing, error: existingError } = await db.from("customer_notifications").select("id, status").eq("job_id", jobId).eq("notification_type", template.notificationType).in("status", ["SENT", "SENDING"]).limit(1);
      if (!existingError && existing && existing.length > 0) return NextResponse.json({ ok: true, skipped: true, duplicate: true, notificationType: template.notificationType });
      notificationType = template.notificationType;
      subject = template.subject;
      message = template.message;
      resendOf = null;
    }

    if (!jobId || !notificationType || !to || !subject || !message) return NextResponse.json({ error: "Missing email details." }, { status: 400 });

    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
    const from = process.env.GMAIL_FROM || process.env.GOOGLE_EMAIL || process.env.EMAIL_FROM;
    if (!clientId || !clientSecret || !refreshToken || !from) {
      const missing: string[] = [];
      if (!clientId) missing.push("GOOGLE_CLIENT_ID");
      if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
      if (!refreshToken) missing.push("GOOGLE_REFRESH_TOKEN");
      if (!from) missing.push("GOOGLE_EMAIL");
      return NextResponse.json({ error: `Gmail is not fully configured. Missing: ${missing.join(", ")}.`, missing }, { status: 503 });
    }

    const tokenParams = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenParams });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) throw new Error(token.error_description || "Unable to authorize Gmail.");

    const raw = `From: PrintWise <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${message}`;
    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: b64url(raw) }) });
    const sent = await sendRes.json();
    if (!sendRes.ok) throw new Error(sent?.error?.message || "Gmail rejected the email.");

    const db = createClient(url, service);
    await db.from("customer_notifications").insert({ job_id: jobId, notification_type: notificationType, recipient: to, message, status: "SENT", sent_at: new Date().toISOString(), provider_message_id: sent.id, resend_of: resendOf || null, error_message: null });
    return NextResponse.json({ ok: true, id: sent.id, status: "SENT", notificationType });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to send email." }, { status: 500 });
  }
}
