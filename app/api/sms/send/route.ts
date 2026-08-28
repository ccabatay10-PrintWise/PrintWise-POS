import { NextResponse } from "next/server";

const normalizeNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `63${digits}`;
  return digits;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const number = normalizeNumber(String(body?.number || ""));
    const message = String(body?.message || "").trim();

    if (!number || !/^639\d{9}$/.test(number)) {
      return NextResponse.json({ error: "Please provide a valid Philippine mobile number." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "SMS message cannot be empty." }, { status: 400 });
    }

    const apiKey = process.env.SEMAPHORE_API_KEY;
    const senderName = process.env.SEMAPHORE_SENDERNAME;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Live SMS is not configured yet. Add SEMAPHORE_API_KEY to the server environment." },
        { status: 503 }
      );
    }

    const form = new URLSearchParams({ apikey: apiKey, number, message });
    if (senderName) form.set("sendername", senderName);

    const response = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });

    const raw = await response.text();
    let data: unknown = raw;
    try { data = JSON.parse(raw); } catch {}

    if (!response.ok) {
      const providerError = typeof data === "object" && data !== null ? JSON.stringify(data) : raw;
      return NextResponse.json({ error: providerError || "SMS provider rejected the request." }, { status: 502 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result !== "object") {
      return NextResponse.json({ error: "Unexpected response from SMS provider." }, { status: 502 });
    }

    const record = result as { message_id?: string | number; status?: string; recipient?: string; message?: string };
    const providerStatus = String(record.status || "QUEUED").toUpperCase();
    const status = providerStatus === "FAILED" || providerStatus === "REFUNDED" ? "FAILED" : providerStatus;

    return NextResponse.json({
      ok: true,
      status,
      providerStatus,
      providerMessageId: record.message_id ? String(record.message_id) : null,
      recipient: record.recipient || number,
      message: record.message || message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send SMS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
