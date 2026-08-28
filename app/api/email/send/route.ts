import { NextResponse } from "next/server";

const b64url = (s: string) =>
  Buffer.from(s)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export async function POST(req: Request) {
  try {
    const { jobId, notificationType, to, subject, message, resendOf } = await req.json();

    if (!jobId || !notificationType || !to || !subject || !message) {
      return NextResponse.json({ error: "Missing email details." }, { status: 400 });
    }

    // Support both the existing GMAIL_* names and the GOOGLE_* names already configured in Vercel.
    const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
    const from = process.env.GMAIL_FROM || process.env.GOOGLE_EMAIL || process.env.EMAIL_FROM;

    const missing: string[] = [];
    if (!clientId) missing.push("GOOGLE_CLIENT_ID");
    if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
    if (!refreshToken) missing.push("GOOGLE_REFRESH_TOKEN");
    if (!from) missing.push("GOOGLE_EMAIL");

    if (missing.length) {
      return NextResponse.json(
        {
          error: `Gmail is not fully configured. Missing: ${missing.join(", ")}.`,
          missing,
        },
        { status: 503 }
      );
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      throw new Error(token.error_description || "Unable to authorize Gmail.");
    }

    const raw = `From: PrintWise <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${message}`;

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: b64url(raw) }),
      }
    );

    const sent = await sendRes.json();
    if (!sendRes.ok) {
      throw new Error(sent?.error?.message || "Gmail rejected the email.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && service) {
      const db = createClient(url, service);
      await db.from("customer_notifications").insert({
        job_id: jobId,
        notification_type: notificationType,
        recipient: to,
        message,
        status: "SENT",
        sent_at: new Date().toISOString(),
        provider_message_id: sent.id,
        resend_of: resendOf || null,
        error_message: null,
      });
    }

    return NextResponse.json({ ok: true, id: sent.id, status: "SENT" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to send email." },
      { status: 500 }
    );
  }
}
