"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, History, Loader2, Search, SlidersHorizontal, UserRound } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import "../../pos/pos.css";

type Approval = {
  id: string;
  job_id: string;
  file_id: string;
  suggested_price: number | string | null;
  final_price: number | string | null;
  copies: number | string | null;
  adjustment_reason: string | null;
  staff_notes: string | null;
  status: string | null;
  approved_by_name?: string | null;
  approved_by_user_id?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
};

type JobInfo = { id: string; reference_no: string | null; customer_name: string | null };
type FileInfo = { id: string; original_name: string | null };

const money = (n: number | string | null | undefined) => `₱${Number(n || 0).toFixed(2)}`;
const dateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

export default function SmartPricingHistoryPage() {
  const [rows, setRows] = useState<Approval[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobInfo>>({});
  const [files, setFiles] = useState<Record<string, FileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ADJUSTED" | "ACCEPTED">("ALL");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: approvalError } = await supabase
        .from("smart_pricing_approvals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250);
      if (approvalError) throw approvalError;

      const approvals = (data || []) as Approval[];
      setRows(approvals);
      const jobIds = [...new Set(approvals.map(x => x.job_id).filter(Boolean))];
      const fileIds = [...new Set(approvals.map(x => x.file_id).filter(Boolean))];

      const [{ data: jobData, error: jobError }, { data: fileData, error: fileError }] = await Promise.all([
        jobIds.length ? supabase.from("received_file_jobs").select("id, reference_no, customer_name").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
        fileIds.length ? supabase.from("received_file_items").select("id, original_name").in("id", fileIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (jobError) throw jobError;
      if (fileError) throw fileError;

      setJobs(Object.fromEntries(((jobData || []) as JobInfo[]).map(x => [x.id, x])));
      setFiles(Object.fromEntries(((fileData || []) as FileInfo[]).map(x => [x.id, x])));
    } catch (e: any) {
      setError(e?.message || "Unable to load Smart Pricing approval history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(row => {
    const suggested = Number(row.suggested_price || 0);
    const final = Number(row.final_price || 0);
    const adjusted = Math.abs(final - suggested) >= 0.005;
    if (filter === "ADJUSTED" && !adjusted) return false;
    if (filter === "ACCEPTED" && adjusted) return false;
    const text = [files[row.file_id]?.original_name, jobs[row.job_id]?.reference_no, jobs[row.job_id]?.customer_name, row.approved_by_name, row.adjustment_reason, row.staff_notes].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [rows, jobs, files, query, filter]);

  const adjustedCount = rows.filter(x => Math.abs(Number(x.final_price || 0) - Number(x.suggested_price || 0)) >= 0.005).length;
  const totalApproved = rows.reduce((sum, x) => sum + Number(x.final_price || 0), 0);

  return <main className="app-shell"><Sidebar /><section className="workspace history-main">
    <button className="history-back" onClick={() => window.location.href = "/smart-pricing"}><ArrowLeft size={18} /> Back to Smart Pricing Settings</button>

    <header className="history-hero">
      <div><span className="history-eyebrow">SMART PRICING · AUDIT TRAIL</span><h1>Smart Pricing History</h1><p>Review every approved Smart Price, manual adjustment, reason, staff note, and approval record.</p></div>
      <History size={38} />
    </header>

    <section className="history-stats">
      <div><span>Total Approvals</span><b>{rows.length}</b></div>
      <div><span>Manual Adjustments</span><b>{adjustedCount}</b></div>
      <div><span>Final Approved Value</span><b>{money(totalApproved)}</b></div>
    </section>

    <section className="history-card">
      <div className="history-toolbar">
        <label className="history-search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search file, customer, reference, notes..." /></label>
        <label className="history-filter"><SlidersHorizontal size={16} /><select value={filter} onChange={e => setFilter(e.target.value as any)}><option value="ALL">All approvals</option><option value="ACCEPTED">Smart price accepted</option><option value="ADJUSTED">Price adjusted</option></select></label>
        <button className="history-refresh" onClick={load} disabled={loading}>{loading ? <Loader2 className="spin" size={17} /> : <History size={17} />} Refresh</button>
      </div>

      {error && <div className="history-error">{error}</div>}
      {loading ? <div className="history-loading"><Loader2 className="spin" size={26} /> Loading approval history...</div> : filtered.length === 0 ? <div className="history-empty"><History size={34} /><b>No approval records found.</b><span>Approved Smart Prices will appear here automatically.</span></div> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Date & Time</th><th>File / Job</th><th>Customer</th><th>Smart Price</th><th>Final Price</th><th>Adjustment</th><th>Audit Details</th></tr></thead><tbody>{filtered.map(row => {
        const suggested = Number(row.suggested_price || 0);
        const final = Number(row.final_price || 0);
        const difference = final - suggested;
        const adjusted = Math.abs(difference) >= 0.005;
        const job = jobs[row.job_id];
        const file = files[row.file_id];
        const when = row.created_at || row.approved_at;
        return <tr key={row.id}><td><b>{dateTime(when)}</b><small>{row.status || "APPROVED"}</small></td><td><div className="history-file"><FileText size={17} /><div><b>{file?.original_name || "Selected file"}</b><small>{job?.reference_no || "No reference"}</small></div></div></td><td>{job?.customer_name || "—"}</td><td>{money(suggested)}</td><td><strong className="history-final">{money(final)}</strong><small>{Number(row.copies || 1)} copy/copies</small></td><td><span className={adjusted ? "history-badge changed" : "history-badge accepted"}>{adjusted ? `${difference > 0 ? "+" : ""}${money(difference)}` : "Accepted"}</span></td><td><div className="history-audit">{row.approved_by_name && <span><UserRound size={14} />{row.approved_by_name}</span>}{row.adjustment_reason && <p><b>Reason:</b> {row.adjustment_reason}</p>}{row.staff_notes && <p><b>Notes:</b> {row.staff_notes}</p>}{!row.approved_by_name && !row.adjustment_reason && !row.staff_notes && <small>No additional notes</small>}</div></td></tr>;
      })}</tbody></table></div>}
    </section>

    <style jsx global>{`
      .history-main{padding:24px 28px 48px;max-width:1700px}.history-back{border:1px solid #dfe4e8;background:#fff;border-radius:11px;padding:10px 15px;font-weight:800;color:#48525b;display:inline-flex;gap:8px;align-items:center;cursor:pointer}.history-hero{margin:18px 0;display:flex;justify-content:space-between;align-items:center;padding:28px;background:#fff;border:1px solid #e1e6eb;border-radius:20px;box-shadow:0 8px 28px rgba(20,30,40,.05)}.history-eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:#b21f1f}.history-hero h1{margin:8px 0 5px;font-size:32px;color:#414a53}.history-hero p{margin:0;color:#68737d}.history-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:18px}.history-stats>div{background:#fff;border:1px solid #e2e7eb;border-radius:16px;padding:18px}.history-stats span{display:block;color:#75808a;font-size:12px;font-weight:800}.history-stats b{display:block;font-size:28px;color:#39434c;margin-top:6px}.history-card{background:#fff;border:1px solid #e1e6eb;border-radius:20px;box-shadow:0 8px 28px rgba(20,30,40,.05);padding:20px}.history-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:18px}.history-search{flex:1;min-width:240px;border:1px solid #dce2e7;border-radius:11px;padding:0 12px;height:44px;display:flex;align-items:center;gap:8px;color:#77818a}.history-search input{border:0;outline:0;width:100%;font:inherit}.history-filter{height:44px;border:1px solid #dce2e7;border-radius:11px;padding:0 10px;display:flex;align-items:center;gap:7px;color:#66717a}.history-filter select{border:0;outline:0;font:inherit;background:#fff}.history-refresh{height:44px;border:1px solid #dce2e7;border-radius:11px;background:#fff;padding:0 13px;font-weight:800;display:flex;align-items:center;gap:7px;cursor:pointer}.history-loading,.history-empty{min-height:220px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:9px;color:#68737d}.history-empty b{color:#47515a}.history-error{padding:12px 14px;border:1px solid #f0c7c7;background:#fff3f3;color:#b21f1f;border-radius:11px;margin-bottom:14px}.history-table-wrap{overflow:auto}.history-table{width:100%;border-collapse:collapse;min-width:1120px}.history-table th{text-align:left;font-size:11px;letter-spacing:.08em;color:#78828b;padding:12px;border-bottom:1px solid #e8ecef}.history-table td{padding:15px 12px;vertical-align:top;border-bottom:1px solid #edf0f2;color:#59636c;font-size:13px}.history-table td b{color:#424b54}.history-table small{display:block;color:#818a92;font-size:11px;margin-top:4px}.history-file{display:flex;gap:8px;align-items:flex-start}.history-file svg{color:#c52525;margin-top:2px}.history-final{color:#b51f1f!important;font-size:15px}.history-badge{display:inline-flex;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:900}.history-badge.accepted{background:#eef8f1;color:#287346}.history-badge.changed{background:#fff6e9;color:#a25d10}.history-audit{max-width:300px}.history-audit>span{display:inline-flex;gap:5px;align-items:center;font-size:11px;font-weight:800;color:#55606a;margin-bottom:5px}.history-audit p{margin:4px 0;line-height:1.45}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:850px){.history-main{padding:16px}.history-hero{padding:22px}.history-hero h1{font-size:26px}.history-stats{grid-template-columns:1fr}.history-toolbar{flex-wrap:wrap}.history-search{flex-basis:100%}}
    `}</style>
  </section></main>;
}
