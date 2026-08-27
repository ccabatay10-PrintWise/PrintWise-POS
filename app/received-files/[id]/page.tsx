"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  LoaderCircle,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import "../../pos/pos.css";

type FileItem = {
  id: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
};

type Job = {
  id: string;
  reference_no: string;
  customer_name: string;
  contact_number: string;
  status: string;
  created_at: string;
  received_file_items?: FileItem[];
};

const statuses = ["RECEIVED", "REVIEWING", "PROCESSING", "READY", "COMPLETED"];

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function ReceivedFileJobPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const loadJob = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("received_file_jobs")
      .select("id, reference_no, customer_name, contact_number, status, created_at, received_file_items(id, original_name, storage_path, mime_type, size_bytes)")
      .eq("id", params.id)
      .single();

    if (loadError) setError(loadError.message || "Unable to load this file job.");
    else setJob(data as Job);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const updateStatus = async (status: string) => {
    if (!job || status === job.status) return;
    setUpdating(true);
    setError("");
    const { error: updateError } = await supabase
      .from("received_file_jobs")
      .update({ status })
      .eq("id", job.id);
    if (updateError) setError(updateError.message || "Unable to update the job status.");
    else setJob({ ...job, status });
    setUpdating(false);
  };

  const openFile = async (file: FileItem, download = false) => {
    const { data, error: urlError } = await supabase.storage
      .from("received-files")
      .createSignedUrl(file.storage_path, 60 * 15, download ? { download: file.original_name } : undefined);
    if (urlError || !data?.signedUrl) {
      setError(urlError?.message || "Unable to open this file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const totalSize = useMemo(
    () => (job?.received_file_items ?? []).reduce((sum, file) => sum + Number(file.size_bytes || 0), 0),
    [job]
  );

  if (loading) {
    return <div className="app-shell received-shell"><Sidebar /><main className="received-main"><div className="job-loading"><LoaderCircle className="spin" size={30} /><b>Loading file job…</b></div><style jsx global>{styles}</style></main></div>;
  }

  if (!job) {
    return <div className="app-shell received-shell"><Sidebar /><main className="received-main"><button className="back-btn" onClick={() => (window.location.href = "/received-files")}><ArrowLeft size={18} /> Back to Received Files</button><div className="job-empty"><FolderOpen size={38} /><h1>Job not found</h1><p>{error || "This file job may have been removed."}</p></div><style jsx global>{styles}</style></main></div>;
  }

  const files = job.received_file_items ?? [];
  const date = new Date(job.created_at).toLocaleString(undefined, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="app-shell received-shell">
      <Sidebar />
      <main className="received-main">
        <div className="job-topbar">
          <button className="back-btn" onClick={() => (window.location.href = "/received-files")}><ArrowLeft size={18} /> Back to Received Files</button>
          <button className="refresh-btn" onClick={loadJob}><RefreshCw size={17} /> Refresh</button>
        </div>

        <section className="job-hero">
          <div>
            <span className="eyebrow">INCOMING FILE JOB</span>
            <h1>{job.reference_no}</h1>
            <p>Received {date}</p>
          </div>
          <span className={`status ${job.status.toLowerCase()}`}>{job.status.replaceAll("_", " ")}</span>
        </section>

        <section className="job-grid">
          <article className="job-card customer-card">
            <span className="mini-label">CUSTOMER DETAILS</span>
            <div className="customer-row"><span className="detail-icon"><UserRound size={20} /></span><div><small>Customer Name</small><b>{job.customer_name}</b></div></div>
            <div className="customer-row"><span className="detail-icon"><Phone size={20} /></span><div><small>Contact Number</small><b>{job.contact_number}</b></div></div>
          </article>

          <article className="job-card workflow-card">
            <span className="mini-label">JOB WORKFLOW</span>
            <h2>Update job status</h2>
            <p>Move the submission through the file processing workflow.</p>
            <div className="workflow-buttons">
              {statuses.map((status) => <button key={status} className={job.status === status ? "active" : ""} disabled={updating} onClick={() => updateStatus(status)}>{status.replaceAll("_", " ")}</button>)}
            </div>
            {error && <div className="job-error">{error}</div>}
          </article>
        </section>

        <section className="job-card files-card">
          <div className="files-head"><div><span className="mini-label">SUBMITTED FILES</span><h2>{files.length} file{files.length === 1 ? "" : "s"} received</h2><p>{formatBytes(totalSize)} total size</p></div><span className="files-summary"><FileText size={18} /> Ready for review</span></div>
          <div className="file-list">
            {files.map((file) => <div className="file-row" key={file.id}>
              <div className="file-icon"><FileText size={21} /></div>
              <div className="file-meta"><b>{file.original_name}</b><span>{file.mime_type || "Unknown file type"} · {formatBytes(Number(file.size_bytes || 0))}</span></div>
              <div className="file-actions">
                <button onClick={() => openFile(file)}><ExternalLink size={17} /> Open</button>
                <button onClick={() => openFile(file, true)}><Download size={17} /> Download</button>
              </div>
            </div>)}
          </div>
          <div className="next-step"><CheckCircle2 size={20} /><div><b>Next: File processing and print setup</b><span>Review the submitted files first. The next phase will add print settings and automatic price calculation.</span></div></div>
        </section>
      </main>
      <style jsx global>{styles}</style>
    </div>
  );
}

const styles = `
.received-shell{min-height:100vh;background:#f4f6f8}.received-main{width:100%;max-width:1600px;padding:28px 32px 40px;min-width:0}.job-topbar,.job-hero,.files-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.back-btn,.refresh-btn{border:1px solid #dfe3e7;background:#fff;border-radius:11px;padding:11px 15px;color:#373b40;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.job-topbar{margin-bottom:18px}.job-hero,.job-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.job-hero{padding:26px 28px;margin-bottom:18px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.job-hero h1{margin:6px 0;font-size:31px;color:#292d32}.job-hero p,.workflow-card p,.files-head p{margin:0;color:#747a81}.status{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:850;letter-spacing:.04em}.status.received{background:#fff0df;color:#b66408}.status.reviewing{background:#eef4ff;color:#2864b3}.status.processing{background:#eef4ff;color:#2864b3}.status.ready{background:#e9f8ef;color:#237247}.status.completed{background:#e5f6ec;color:#237247}.job-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px;margin-bottom:18px}.job-card{padding:24px}.customer-card{display:flex;flex-direction:column;gap:17px}.customer-row{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #eef1f3}.customer-row small{display:block;color:#81878e;font-size:12px;margin-bottom:4px}.customer-row b{color:#353a40}.detail-icon,.file-icon{width:42px;height:42px;border-radius:12px;background:#fbefef;color:#c12626;display:grid;place-items:center;flex:0 0 auto}.workflow-card h2,.files-head h2{margin:7px 0 5px;color:#2f3439}.workflow-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.workflow-buttons button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:800;color:#555c63;cursor:pointer}.workflow-buttons button.active{background:#c90f0f;border-color:#c90f0f;color:#fff}.workflow-buttons button:disabled{opacity:.65}.job-error{margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff0f0;color:#b12626;font-size:13px}.files-card{padding:0;overflow:hidden}.files-head{padding:24px 26px;border-bottom:1px solid #e9edf0}.files-summary{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:9px 12px;background:#f7f8f9;color:#5f676f;font-size:12px;font-weight:750}.file-list{padding:0 26px}.file-row{display:flex;align-items:center;gap:14px;padding:17px 0;border-bottom:1px solid #eef1f3}.file-row:last-child{border-bottom:0}.file-meta{min-width:0;flex:1}.file-meta b{display:block;color:#353a40;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.file-meta span{display:block;margin-top:4px;color:#7c838a;font-size:12px}.file-actions{display:flex;gap:8px;flex-wrap:wrap}.file-actions button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:9px 12px;color:#42484f;font-weight:750;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.next-step{display:flex;gap:10px;align-items:flex-start;margin:0 26px 24px;padding:14px;border:1px solid #f0d8d8;background:#fffafa;border-radius:12px;color:#b12424}.next-step b{display:block;margin-bottom:4px;color:#3c4146}.next-step span{display:block;color:#737a81;font-size:13px;line-height:1.45}.job-loading,.job-empty{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#666d74}.job-empty h1{margin:0;color:#2e3338}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:900px){.job-grid{grid-template-columns:1fr}.received-main{padding:22px 18px 32px}}@media(max-width:640px){.job-topbar,.job-hero,.files-head{align-items:flex-start;flex-direction:column}.job-hero{padding:22px}.received-main{padding:16px 12px 28px}.job-card{padding:20px}.files-head{padding:20px}.file-list{padding:0 20px}.file-row{align-items:flex-start;flex-wrap:wrap}.file-actions{width:100%;margin-left:56px}.next-step{margin:0 20px 20px}.job-hero h1{font-size:24px}}
`;
