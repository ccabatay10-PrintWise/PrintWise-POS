"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, LoaderCircle, PencilLine, ShieldCheck, AlertCircle } from "lucide-react";
import Sidebar from "../../../../components/Sidebar";
import { supabase } from "../../../../../lib/supabase";
import "../../../../pos/pos.css";

type Job = { id: string; reference_no: string; customer_name: string };
type FileItem = { id: string; original_name: string; mime_type: string; size_bytes: number };

type SmartTransfer = {
  fileId: string;
  jobId: string;
  analysis: { pages: number; paper: string };
  copies: number;
  computation: { suggested: number; originalSuggested: number; finalApproved: number };
  suggestedPrice: number;
  finalPrice: number;
  adjustmentReason: string | null;
  staffNotes: string | null;
  approvedAt: string;
  status: "APPROVED";
};

const money = (value: number) => `₱${Number(value || 0).toFixed(2)}`;

export default function SmartPriceApprovalPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fileId = searchParams.get("fileId") || "";
  const suggested = Math.max(0, Number(searchParams.get("suggested") || 0));
  const copies = Math.max(1, Number(searchParams.get("copies") || 1));

  const [job, setJob] = useState<Job | null>(null);
  const [file, setFile] = useState<FileItem | null>(null);
  const [finalPrice, setFinalPrice] = useState(suggested.toFixed(2));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!jobId || !fileId || suggested <= 0) {
        setError("The Smart Price approval details are incomplete. Please return and calculate the price again.");
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("received_file_jobs")
        .select("id, reference_no, customer_name, received_file_items(id, original_name, mime_type, size_bytes)")
        .eq("id", jobId)
        .single();

      if (loadError || !data) {
        setError(loadError?.message || "Unable to load the selected file.");
        setLoading(false);
        return;
      }

      setJob(data as Job);
      const selected = ((data as any).received_file_items || []).find((item: FileItem) => item.id === fileId) || null;
      setFile(selected);
      if (!selected) setError("The selected file could not be found in this job.");
      setLoading(false);
    })();
  }, [jobId, fileId, suggested]);

  const finalNumber = useMemo(() => Math.max(0, Number(finalPrice || 0)), [finalPrice]);
  const difference = finalNumber - suggested;
  const adjusted = Math.abs(difference) >= 0.005;

  const approve = async () => {
    setError("");
    if (!job || !file || finalNumber <= 0) {
      setError("Enter a valid final price before approving.");
      return;
    }
    if (adjusted && !reason.trim()) {
      setError("Please enter the reason for the manual price adjustment.");
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("smart_pricing_approvals").insert({
        job_id: job.id,
        file_id: file.id,
        suggested_price: suggested,
        final_price: finalNumber,
        copies,
        adjustment_reason: adjusted ? reason.trim() : null,
        staff_notes: notes.trim() || null,
        status: "APPROVED",
      });
      if (insertError) throw new Error(insertError.message);

      // The File Processing page already reads computation.suggested from this key.
      // Store the FINAL APPROVED PRICE there so the exact staff-approved amount is
      // used in Review & Configure Files, the job total, and the POS handoff.
      const transfer: SmartTransfer = {
        fileId: file.id,
        jobId: job.id,
        analysis: { pages: 1, paper: "A4" },
        copies,
        computation: {
          suggested: Number(finalNumber.toFixed(2)),
          originalSuggested: Number(suggested.toFixed(2)),
          finalApproved: Number(finalNumber.toFixed(2)),
        },
        suggestedPrice: Number(suggested.toFixed(2)),
        finalPrice: Number(finalNumber.toFixed(2)),
        adjustmentReason: adjusted ? reason.trim() : null,
        staffNotes: notes.trim() || null,
        approvedAt: new Date().toISOString(),
        status: "APPROVED",
      };

      sessionStorage.setItem(`printwise-smart-price-${file.id}`, JSON.stringify(transfer));

      window.location.href = `/received-files/${job.id}?smartFileId=${encodeURIComponent(file.id)}&smartPrice=${encodeURIComponent(finalNumber.toFixed(2))}&smartApproved=1`;
    } catch (e: any) {
      setError(e?.message || "Unable to approve the Smart Price.");
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="app-shell received-shell"><Sidebar /><main className="received-main"><div className="job-loading"><LoaderCircle className="spin" size={30} /><b>Loading approval review…</b></div></main></div>;
  }

  return <div className="app-shell received-shell"><Sidebar /><main className="received-main approval-main">
    <button className="back-btn" onClick={() => window.location.href = `/received-files/${jobId}/smart-pricing?fileId=${encodeURIComponent(fileId)}`}><ArrowLeft size={18} /> Back to Smart Pricing</button>

    <section className="approval-hero">
      <div><span className="eyebrow">STEP 1 · FINAL PRICE REVIEW</span><h1>Approve Smart Price</h1><p>Review the suggested amount before the job continues to File Processing and the POS.</p></div>
      <ShieldCheck size={38} />
    </section>

    {error && <div className="approval-error"><AlertCircle size={18} />{error}</div>}

    {job && file && <div className="approval-grid">
      <section className="approval-card">
        <span className="eyebrow">SELECTED FILE</span>
        <div className="file-head"><div className="file-icon"><FileText size={26} /></div><div><h2>{file.original_name}</h2><p>{file.mime_type || "Unknown file type"} · {(Number(file.size_bytes || 0) / 1024).toFixed(1)} KB</p></div></div>
        <div className="file-meta"><div><span>Customer</span><b>{job.customer_name}</b></div><div><span>Reference</span><b>{job.reference_no}</b></div><div><span>Copies</span><b>{copies}</b></div></div>
        <div className="suggested-box"><span>SMART SUGGESTED PRICE</span><strong>{money(suggested)}</strong><p>This is the original amount calculated by the Smart Pricing Engine.</p></div>
      </section>

      <section className="approval-card">
        <span className="eyebrow">STAFF FINAL REVIEW</span>
        <h2>Final selling price</h2>
        <label className="field-label">Final Price (₱)<input type="number" min="0" step="0.01" value={finalPrice} onChange={e => setFinalPrice(e.target.value)} /></label>
        <div className={adjusted ? "adjustment-summary changed" : "adjustment-summary"}>
          <div><span>{adjusted ? "PRICE ADJUSTED" : "SMART PRICE ACCEPTED"}</span><b>{adjusted ? `${difference > 0 ? "+" : ""}${money(difference)}` : "No adjustment"}</b></div>
          <p>{adjusted ? `Final price is ${difference > 0 ? "higher" : "lower"} than the Smart Suggested Price.` : "The staff is approving the exact Smart Suggested Price."}</p>
        </div>
        {adjusted && <label className="field-label">Reason for Adjustment <span className="required">Required</span><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Example: Returning customer discount, special promo, customer-approved custom price..." /></label>}
        <label className="field-label">Staff Notes <span className="optional">Optional</span><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any internal notes for this pricing decision..." /></label>
        <button className="approve-btn" disabled={saving || finalNumber <= 0} onClick={approve}>{saving ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{saving ? "SAVING APPROVAL..." : "APPROVE FINAL PRICE"}</button>
        <p className="approval-note"><PencilLine size={15} /> The exact final approved price will now be transferred to File Processing and then to the POS.</p>
      </section>
    </div>}

    <style jsx global>{`
      .approval-main{padding:24px 28px 48px}.approval-hero,.approval-card{background:#fff;border:1px solid #e1e6eb;border-radius:20px;box-shadow:0 8px 28px rgba(20,30,40,.05)}.approval-hero{padding:28px;display:flex;justify-content:space-between;align-items:center;margin:18px 0;color:#444d56}.approval-hero h1{margin:8px 0 4px;font-size:32px}.approval-hero p{margin:0;color:#68737d}.eyebrow{display:block;font-size:11px;letter-spacing:.14em;font-weight:900;color:#b21f1f}.approval-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.approval-card{padding:26px}.approval-card h2{margin:8px 0 18px;font-size:26px}.file-head{display:flex;gap:14px;align-items:center}.file-head h2{margin:0 0 4px;font-size:22px}.file-head p{margin:0;color:#6d7781}.file-icon{width:54px;height:54px;border-radius:15px;background:#fff0f0;color:#df1f1f;display:grid;place-items:center}.file-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}.file-meta div{padding:12px;border:1px solid #e2e7eb;border-radius:12px;background:#fafbfc}.file-meta span{display:block;font-size:11px;font-weight:800;color:#7b858f;margin-bottom:5px}.file-meta b{font-size:13px;color:#48515a}.suggested-box{margin-top:20px;padding:20px;border-radius:16px;background:#fff0f0;border:1px solid #f2caca;color:#b51e1e}.suggested-box span{font-size:11px;font-weight:900;letter-spacing:.12em}.suggested-box strong{display:block;font-size:38px;margin-top:8px}.suggested-box p{margin:7px 0 0;font-size:12px;color:#8b5656}.field-label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px;font-size:12px;font-weight:850;color:#59636d}.field-label input,.field-label textarea{width:100%;box-sizing:border-box;border:1px solid #dbe1e6;border-radius:12px;padding:13px;font:inherit;color:#3f4851;background:#fff}.field-label input{font-size:22px;font-weight:850}.field-label textarea{min-height:86px;resize:vertical;line-height:1.45}.required{color:#c61d1d;font-size:11px}.optional{color:#7a848d;font-size:11px}.adjustment-summary{border:1px solid #d9eadf;background:#f4fbf6;border-radius:14px;padding:15px;margin:4px 0 16px}.adjustment-summary.changed{border-color:#f0cf9f;background:#fff8ee}.adjustment-summary>div{display:flex;justify-content:space-between;align-items:center}.adjustment-summary span{font-size:11px;font-weight:900;letter-spacing:.1em;color:#2f7d48}.adjustment-summary.changed span{color:#a56214}.adjustment-summary b{font-size:17px;color:#3f4851}.adjustment-summary p{margin:8px 0 0;color:#6d7781;font-size:12px}.approve-btn{width:100%;border:0;border-radius:12px;background:#ef1616;color:#fff;font-weight:900;padding:15px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.approve-btn:disabled{opacity:.55;cursor:not-allowed}.approval-note{display:flex;align-items:flex-start;gap:7px;color:#727c85;font-size:12px;line-height:1.45;margin:12px 0 0}.approval-error{padding:13px 16px;border-radius:12px;margin-bottom:16px;display:flex;align-items:center;gap:9px;background:#fff0f0;color:#b21f1f;border:1px solid #f0c1c1}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.approval-grid{grid-template-columns:1fr}}@media(max-width:640px){.approval-main{padding:16px}.approval-hero{padding:22px}.approval-hero h1{font-size:26px}.file-meta{grid-template-columns:1fr}.suggested-box strong{font-size:32px}}
    `}</style>
  </main></div>;
}
