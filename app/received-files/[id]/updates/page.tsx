"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Copy, LoaderCircle, Mail, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import { supabase } from "../../../../lib/supabase";
import "../../../pos/pos.css";

type Job = {
  id: string;
  reference_no: string;
  customer_name: string;
  email?: string | null;
  customer_email?: string | null;
  amount_paid?: number | null;
  receipt_reference?: string | null;
};

type Notice = {
  id: string;
  notification_type: string;
  recipient: string;
  message: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
};

const subject = (type: string, reference: string) =>
  type === "READY"
    ? `Your PrintWise Order ${reference} is Ready for Pickup`
    : type === "PAYMENT_COMPLETED"
      ? `Payment Confirmation - ${reference}`
      : type === "PROCESSING"
        ? `Your PrintWise Order ${reference} is Being Processed`
        : `PrintWise File Request Received - ${reference}`;

const messageTemplate = (type: string, job: Job) => {
  const name = job.customer_name || "Customer";
  const amount = Number(job.amount_paid || 0).toFixed(2);
  if (type === "PROCESSING") return `Hi ${name},\n\nYour PrintWise request ${job.reference_no} is now being processed. We will email you again once it is ready.\n\nThank you,\nPrintWise`;
  if (type === "READY") return `Hi ${name},\n\nGood news! Your PrintWise request ${job.reference_no} is ready for pickup.\n\nTotal Amount: ₱${amount}\n\nThank you,\nPrintWise`;
  if (type === "PAYMENT_COMPLETED") return `Hi ${name},\n\nThank you! Your payment of ₱${amount} for request ${job.reference_no} has been received.\nReceipt No.: ${job.receipt_reference || "N/A"}\n\nThank you for choosing PrintWise!`;
  return `Hi ${name},\n\nWe have successfully received your PrintWise file request.\nReference No.: ${job.reference_no}\n\nOur staff will review it shortly.\n\nThank you,\nPrintWise`;
};

export default function CustomerUpdatesPage() {
  const params = useParams<{ id: string }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("FILE_RECEIVED");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const customerEmail = job?.email || job?.customer_email || "";

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError("");

    // Select all job fields so this page works with the current email column
    // and also supports older records that used customer_email.
    const [{ data: jobData, error: jobError }, { data: notices, error: noticeError }] = await Promise.all([
      supabase.from("received_file_jobs").select("*").eq("id", jobId).single(),
      supabase
        .from("customer_notifications")
        .select("id,notification_type,recipient,message,status,sent_at,created_at,error_message")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false }),
    ]);

    if (jobError || noticeError) setError(jobError?.message || noticeError?.message || "Unable to load email updates.");
    if (jobData) {
      const nextJob = jobData as Job;
      setJob(nextJob);
      setMessage(messageTemplate(type, nextJob));
    }
    setItems((notices || []) as Notice[]);
    setLoading(false);
  }, [jobId, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (job) setMessage(messageTemplate(type, job));
  }, [type, job]);

  const saveEmail = async (resendOf?: Notice) => {
    if (!job || !customerEmail) {
      setError("This customer does not have an email address saved. Please enter the email first.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          notificationType: type,
          to: customerEmail,
          subject: subject(type, job.reference_no),
          message,
          resendOf: resendOf?.id || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send email.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send email.");
    } finally {
      setSending(false);
    }
  };

  const updateEmail = async (value: string) => {
    if (!job) return;
    setJob({ ...job, email: value, customer_email: value });
    setError("");
    const { error: updateError } = await supabase
      .from("received_file_jobs")
      .update({ email: value || null })
      .eq("id", jobId);
    if (updateError) setError(updateError.message);
  };

  const statusIcon = (status: string) =>
    status === "SENT" ? <CheckCircle2 size={18} /> : status === "FAILED" ? <XCircle size={18} /> : <Clock3 size={18} />;

  if (loading) {
    return <div className="app-shell"><Sidebar /><main className="updates-main"><LoaderCircle className="spin" /> Loading email updates…</main></div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="updates-main">
        <div className="updates-top">
          <button onClick={() => (location.href = `/received-files/${jobId}`)}><ArrowLeft size={18} /> Back to Job</button>
          <button onClick={load}><RefreshCw size={17} /> Refresh</button>
        </div>

        <section className="updates-hero">
          <div><span>CUSTOMER EMAIL UPDATES</span><h1>{job?.reference_no}</h1><p>Send and track customer updates by email.</p></div>
          <div className="email-badge"><Mail size={20} /><div><b>EMAIL NOTIFICATIONS</b><small>Gmail secure server delivery</small></div></div>
        </section>

        {error && <div className="updates-error">{error}</div>}

        <div className="updates-grid">
          <section className="card compose">
            <h3><Mail size={19} /> Send Customer Email</h3>
            <label>Customer<input value={job?.customer_name || ""} disabled /></label>
            <label>Email Address<input type="email" placeholder="customer@email.com" value={customerEmail} onChange={(e) => updateEmail(e.target.value)} /></label>
            <label>Update Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="FILE_RECEIVED">File Received</option><option value="PROCESSING">Processing Update</option><option value="READY">Ready for Pickup</option><option value="PAYMENT_COMPLETED">Payment Completed</option></select></label>
            <label>Subject<input value={job ? subject(type, job.reference_no) : ""} disabled /></label>
            <label>Message<textarea rows={9} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
            <div className="actions"><button onClick={() => navigator.clipboard?.writeText(message)}><Copy size={16} /> Copy</button><button className="primary" disabled={sending || !customerEmail} onClick={() => saveEmail()}><Send size={16} />{sending ? "SENDING..." : "SEND EMAIL"}</button></div>
          </section>

          <section className="card">
            <h3>Email Timeline</h3>
            {items.length === 0 ? <div className="empty"><Mail size={30} />No email updates yet</div> : items.map((notice) => (
              <article className="notice" key={notice.id}>
                <div className={`icon ${notice.status.toLowerCase()}`}>{statusIcon(notice.status)}</div>
                <div><b>{notice.notification_type.replaceAll("_", " ")}</b><p>{notice.message}</p><small>To: {notice.recipient} · {new Date(notice.created_at).toLocaleString()}</small>{notice.error_message && <em>{notice.error_message}</em>}</div>
                <button disabled={sending} onClick={() => saveEmail(notice)}><RotateCcw size={16} /></button>
              </article>
            ))}
          </section>
        </div>

        <div className="note">The customer's email address is automatically loaded from the received file record.</div>

        <style jsx>{`
          .updates-main{width:100%;padding:28px 32px;background:#f4f6f8}.updates-top,.updates-hero,.updates-grid,.actions{display:flex}.updates-top{justify-content:space-between;margin-bottom:18px}.updates-top button,.actions button,.notice button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 14px;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.updates-hero{justify-content:space-between;align-items:center;background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:25px;margin-bottom:18px}.updates-hero span{font-size:11px;font-weight:850;letter-spacing:.14em;color:#a52a2a}.updates-hero h1{margin:7px 0;font-size:30px}.updates-hero p{margin:0;color:#737980}.email-badge{display:flex;gap:10px;padding:12px;border:1px solid #dbe7f4;border-radius:12px;color:#286ea0}.email-badge small{display:block}.updates-grid{gap:18px;align-items:start}.card{flex:1;background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:22px}.compose{max-width:520px}.card h3{margin:0 0 16px;display:flex;gap:8px}.card label{display:block;font-size:11px;font-weight:800;margin-top:12px;color:#626970}.card input,.card select,.card textarea{box-sizing:border-box;width:100%;margin-top:6px;border:1px solid #dfe3e7;border-radius:10px;padding:10px;font:inherit}.card input:disabled{background:#f7f8f9}.actions{justify-content:flex-end;gap:8px;margin-top:16px}.actions .primary{background:#c90f0f;color:#fff;border:0}.notice{display:flex;gap:12px;padding:15px 0;border-bottom:1px solid #edf0f2}.icon{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#f2f4f6}.icon.sent{background:#eaf8ef;color:#287348}.icon.failed{background:#fff0f0;color:#b32a2a}.notice>div:nth-child(2){flex:1}.notice p{white-space:pre-wrap;font-size:13px;line-height:1.5;color:#555d64}.notice small{color:#858b91}.notice em{display:block;color:#b32a2a}.empty{text-align:center;padding:50px;color:#858b91}.empty svg{display:block;margin:0 auto 10px}.updates-error{margin-bottom:14px;padding:12px;background:#fff0f0;color:#b32a2a;border-radius:10px}.note{margin-top:18px;padding:14px;background:#f7fbff;border:1px solid #dbe7f4;border-radius:12px;color:#53687a}@media(max-width:900px){.updates-main{padding:20px}.updates-grid{flex-direction:column}.card{width:100%;box-sizing:border-box}.compose{max-width:none}.updates-hero{flex-direction:column;align-items:flex-start}}
        `}</style>
      </main>
    </div>
  );
}
