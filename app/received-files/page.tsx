"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  FileUp,
  FolderOpen,
  MoreHorizontal,
  RefreshCw,
  ScanLine,
  UserRound,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Job = {
  id: string;
  reference_no: string;
  customer_name: string;
  contact_number: string;
  status: string;
  created_at: string;
  received_file_items?: { id: string }[];
};

const supportedFiles = "PDF, Word, Excel, PowerPoint, JPG and PNG";

export default function ReceivedFilesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const uploadUrl = typeof window === "undefined" ? "/upload-files" : `${window.location.origin}/upload-files`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=520x520&margin=10&data=${encodeURIComponent(uploadUrl)}`;

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("received_file_jobs")
      .select("id, reference_no, customer_name, contact_number, status, created_at, received_file_items(id)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs();
    const channel = supabase
      .channel("received-file-jobs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "received_file_jobs" }, loadJobs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadJobs]);

  const receivedCount = useMemo(() => jobs.filter((job) => job.status === "RECEIVED").length, [jobs]);
  const filteredJobs = useMemo(() => statusFilter === "ALL" ? jobs : jobs.filter((job) => job.status === statusFilter), [jobs, statusFilter]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(uploadUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  };

  const formatDate = (date: string) => new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const reviewJob = (id: string) => { window.location.href = `/received-files/${id}`; };

  return (
    <div className="app-shell received-shell">
      <Sidebar />
      <main className="received-main">
        <section className="received-header">
          <div><span className="eyebrow">PRINTWISE FILE INTAKE</span><h1>Received Files</h1><p>Receive customer files through one simple QR scan.</p></div>
          <button className="refresh-btn" onClick={loadJobs} type="button"><RefreshCw size={17} className={loading ? "spin" : ""} />Refresh</button>
        </section>

        <section className="upload-card" aria-label="Customer file upload">
          <div className="upload-copy">
            <span className="mini-label">CUSTOMER UPLOAD</span>
            <h2>Scan to <strong>send files</strong></h2>
            <span className="title-rule" />
            <p>Customers scan the code, enter their name and contact number, then upload one or multiple files.</p>
            <div className="upload-link"><span>{uploadUrl}</span><button onClick={copyLink} aria-label="Copy upload link" type="button"><Copy size={17} /></button></div>
            <div className="qr-actions">
              <button className="primary-action" onClick={copyLink} type="button"><Copy size={17} />{copied ? "Link Copied" : "Copy Upload Link"}</button>
              <a href="/upload-files" target="_blank" rel="noreferrer"><ExternalLink size={17} />Open Upload Page</a>
            </div>
          </div>
          <div className="qr-panel"><img src={qrUrl} alt="PrintWise customer upload QR code" /></div>
          <div className="upload-steps">
            <div className="step-item"><div className="step-icon"><ScanLine size={22} /></div><div><b>1. Scan QR code</b><span>Use any phone camera.</span></div></div>
            <div className="step-item"><div className="step-icon"><UserRound size={22} /></div><div><b>2. Name + contact number</b><span>Enter customer details.</span></div></div>
            <div className="step-item"><div className="step-icon"><FileUp size={22} /></div><div><b>3. Upload multiple files</b><span>Send one or multiple files at once.</span></div></div>
            <div className="step-item"><div className="step-icon"><CheckCircle2 size={22} /></div><div><b>4. Job appears here</b><span>The submission is ready for staff review.</span></div></div>
          </div>
          <div className="supported-strip"><div className="supported-icon"><FileText size={21} /></div><div><b>Supported file types: <span>{supportedFiles}.</span></b><small>You can upload up to 10 files at once. Maximum file size is 25MB per file.</small></div></div>
        </section>

        <section className="jobs-card">
          <div className="jobs-head">
            <div><span className="mini-label">LIVE INTAKE</span><h2>Incoming file jobs</h2><p>Review and manage customer file submissions.</p></div>
            <select className="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter incoming file jobs by status">
              <option value="ALL">All Status</option><option value="RECEIVED">Received</option><option value="REVIEWING">Reviewing</option><option value="PROCESSING">Processing</option><option value="READY">Ready</option><option value="COMPLETED">Completed</option>
            </select>
          </div>
          {loading ? <div className="empty-state"><RefreshCw className="spin" size={24} /><b>Loading received files…</b></div> : filteredJobs.length === 0 ? <div className="empty-state"><FolderOpen size={32} /><b>No files received yet</b><span>Share the QR code with a customer to start receiving files.</span></div> : <div className="jobs-table-wrap"><table className="jobs-table"><thead><tr><th>Reference No.</th><th>Customer</th><th>Contact Number</th><th>Files</th><th>Date Received</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredJobs.map((job) => {
            const fileCount = job.received_file_items?.length ?? 0;
            return <tr key={job.id}><td className="reference-cell"><span className="reference-dot" /><b>{job.reference_no}</b></td><td>{job.customer_name}</td><td>{job.contact_number}</td><td><span className="file-count"><FileText size={16} />{fileCount} file{fileCount === 1 ? "" : "s"}</span></td><td>{formatDate(job.created_at)}</td><td><span className={`status ${job.status.toLowerCase()}`}>{job.status.replaceAll("_", " ")}</span></td><td><div className="row-actions"><button type="button" className="review-btn" onClick={() => reviewJob(job.id)}><Eye size={18} />Review</button><button type="button" onClick={() => reviewJob(job.id)} title="Open job"><MoreHorizontal size={20} /></button></div></td></tr>;
          })}</tbody></table></div>}
          <div className="jobs-footer"><span>Showing 1 to {filteredJobs.length} of {filteredJobs.length} result{filteredJobs.length === 1 ? "" : "s"}</span><span className="count-pill">{receivedCount} New</span></div>
        </section>
      </main>
      <style jsx global>{styles}</style>
    </div>
  );
}

const styles = `
.received-shell{min-height:100vh;background:#f4f6f8}.received-main{width:100%;max-width:1600px;padding:28px 32px 36px;min-width:0}.received-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.received-header h1{margin:5px 0;font-size:31px;line-height:1.1;color:#25272b}.received-header p,.jobs-head p{margin:0;color:#6f7378}.refresh-btn,.qr-actions a,.qr-actions button,.row-actions button{border:1px solid #dfe3e7;background:#fff;border-radius:11px;color:#363a3f;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:750;text-decoration:none;cursor:pointer}.refresh-btn{padding:11px 16px}.upload-card,.jobs-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.upload-card{display:grid;grid-template-columns:minmax(300px,1fr) minmax(280px,.82fr) minmax(300px,.8fr);gap:26px;padding:28px 28px 14px;margin-bottom:18px}.upload-copy{padding:4px 0 14px}.upload-copy h2{margin:6px 0 0;font-size:42px;line-height:1.06;letter-spacing:-.03em;color:#25282d;max-width:340px}.upload-copy h2 strong{color:#b51e1e;font-weight:800}.title-rule{display:block;width:42px;height:3px;background:#c42020;border-radius:999px;margin:18px 0}.upload-copy p{max-width:500px;margin:0 0 22px;color:#60676e;font-size:15px;line-height:1.65}.upload-link{display:flex;max-width:520px;border:1px solid #dfe3e7;border-radius:10px;overflow:hidden;background:#fff}.upload-link span{flex:1;padding:13px 14px;color:#555d66;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.upload-link button{width:54px;border:0;border-left:1px solid #dfe3e7;background:#f8f9fa;color:#353b42;display:grid;place-items:center;cursor:pointer}.qr-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.qr-actions a,.qr-actions button{padding:13px 18px}.qr-actions .primary-action{background:#c90f0f;border-color:#c90f0f;color:#fff}.qr-panel{display:flex;align-items:center;justify-content:center;min-height:340px;padding:10px}.qr-panel img{width:min(100%,320px);aspect-ratio:1;height:auto;border:1px solid #dfe3e7;border-radius:18px;padding:14px;background:#fff;box-shadow:0 10px 26px rgba(26,36,46,.07)}.upload-steps{display:flex;flex-direction:column;justify-content:center;padding:8px 0 14px}.step-item{display:grid;grid-template-columns:48px 1fr;gap:15px;align-items:center;padding:15px 0;border-bottom:1px solid #eceff2}.step-item:last-child{border-bottom:0}.step-icon{width:46px;height:46px;border-radius:13px;background:#fbefef;color:#c12626;display:grid;place-items:center}.step-item b{display:block;color:#31353a;font-size:14px;margin-bottom:5px}.step-item span{display:block;color:#727980;font-size:13px;line-height:1.45}.supported-strip{grid-column:1/-1;display:flex;align-items:center;gap:12px;border:1px solid #f0d8d8;background:#fffafa;border-radius:11px;padding:11px 14px}.supported-icon{width:42px;height:42px;border-radius:11px;background:#f9e4e4;color:#c12626;display:grid;place-items:center;flex:0 0 auto}.supported-strip b{display:block;color:#44484d;font-size:13px}.supported-strip b span{font-weight:500}.supported-strip small{display:block;margin-top:3px;color:#71777e;font-size:12px}.jobs-card{padding:0;overflow:hidden}.jobs-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 26px 18px;border-bottom:1px solid #e9edf0}.jobs-head h2{margin:4px 0 5px;color:#2b2f34;font-size:23px}.status-filter{min-width:145px;border:1px solid #dfe3e7;border-radius:10px;padding:11px 13px;background:#fff;color:#4a5057;font-weight:650;outline:none}.jobs-table-wrap{overflow-x:auto}.jobs-table{width:100%;border-collapse:collapse;min-width:1080px}.jobs-table th{padding:14px 16px;text-align:left;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#69717a;background:#fafbfc;border-bottom:1px solid #e9edf0;white-space:nowrap}.jobs-table td{padding:13px 16px;color:#42484f;border-bottom:1px solid #eef1f3;font-size:14px;vertical-align:middle}.jobs-table tbody tr:last-child td{border-bottom:0}.reference-cell{display:flex;align-items:center;gap:9px;white-space:nowrap;color:#b52424!important}.reference-dot{width:7px;height:7px;border-radius:50%;background:#c72323;display:inline-block}.file-count{display:inline-flex;align-items:center;gap:6px;color:#59616a;white-space:nowrap}.status{display:inline-flex;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:850;letter-spacing:.04em}.status.received{background:#fff0df;color:#b66408}.status.reviewing,.status.processing{background:#eef4ff;color:#2864b3}.status.ready,.status.completed{background:#e7f7ed;color:#237247}.row-actions{display:flex;gap:7px}.row-actions button{min-height:34px;padding:7px 10px}.row-actions .review-btn{background:#fffafa;border-color:#efd5d5;color:#b12424}.jobs-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 26px;border-top:1px solid #eef1f3;color:#737a81;font-size:12px}.count-pill{background:#fff0df;color:#b66408;border-radius:999px;padding:7px 11px;font-weight:800}.empty-state{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#737a81;text-align:center}.empty-state b{color:#4a5057}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1180px){.upload-card{grid-template-columns:1fr 1fr}.upload-steps{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.supported-strip{grid-column:1/-1}}@media(max-width:820px){.received-main{padding:22px 18px 32px}.upload-card{grid-template-columns:1fr}.qr-panel{min-height:0}.upload-steps{grid-template-columns:1fr}.received-header{align-items:flex-start;flex-direction:column}.jobs-head{align-items:flex-start;flex-direction:column}.status-filter{width:100%}}@media(max-width:560px){.received-main{padding:16px 12px 28px}.upload-card{padding:22px 18px 12px;border-radius:15px}.upload-copy h2{font-size:34px}.qr-panel img{width:min(100%,280px)}.jobs-head,.jobs-footer{padding-left:18px;padding-right:18px}.jobs-footer{align-items:flex-start;flex-direction:column}}
`;
