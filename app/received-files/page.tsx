"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, FileUp, FolderOpen, QrCode, RefreshCw, Upload } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";

type Job = {
  id: string;
  reference_no: string;
  customer_name: string;
  contact_number: string;
  status: string;
  created_at: string;
  received_file_items?: { id: string }[];
};

export default function ReceivedFilesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const uploadUrl = typeof window === "undefined" ? "/upload-files" : `${window.location.origin}/upload-files`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(uploadUrl)}`;

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "received_file_jobs" }, loadJobs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadJobs]);

  const receivedCount = useMemo(() => jobs.filter((job) => job.status === "RECEIVED").length, [jobs]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(uploadUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="app-shell received-shell">
      <Sidebar />
      <main className="received-main">
        <section className="received-header">
          <div>
            <span className="eyebrow">PRINTWISE FILE INTAKE</span>
            <h1>Received Files</h1>
            <p>Receive customer files through one simple QR scan.</p>
          </div>
          <button className="refresh-btn" onClick={loadJobs}><RefreshCw size={17} /> Refresh</button>
        </section>

        <section className="intake-grid">
          <article className="qr-card">
            <div className="card-top"><div><span className="mini-label">CUSTOMER UPLOAD</span><h2>Scan to send files</h2></div><QrCode size={22} /></div>
            <div className="qr-wrap"><img src={qrUrl} alt="PrintWise customer upload QR code" /></div>
            <p>Customers scan the code, enter their name and contact number, then upload one or multiple files.</p>
            <div className="upload-link"><span>{uploadUrl}</span><button onClick={copyLink} aria-label="Copy upload link"><Copy size={16} /></button></div>
            <div className="qr-actions"><button onClick={copyLink}>{copied ? "Link Copied" : "Copy Upload Link"}</button><a href="/upload-files" target="_blank"><ExternalLink size={16} /> Open Upload Page</a></div>
          </article>

          <article className="phase-card">
            <div className="phase-icon"><FileUp size={23} /></div>
            <span className="mini-label">PHASE 1 ACTIVE</span>
            <h2>Simple customer intake</h2>
            <div className="phase-list">
              <div><b>1</b><span>Scan QR code</span></div>
              <div><b>2</b><span>Name + contact number</span></div>
              <div><b>3</b><span>Upload multiple files</span></div>
              <div><b>4</b><span>Job appears here</span></div>
            </div>
            <small>Supported: PDF, Word, Excel, PowerPoint, JPG and PNG.</small>
          </article>
        </section>

        <section className="jobs-card">
          <div className="jobs-head"><div><span className="mini-label">LIVE INTAKE</span><h2>Incoming file jobs</h2></div><span className="count-pill">{receivedCount} New</span></div>
          {loading ? <div className="empty-state"><RefreshCw className="spin" size={22} /> Loading received files…</div> : jobs.length === 0 ? <div className="empty-state"><FolderOpen size={30} /><b>No files received yet</b><span>Share the QR code with a customer to start receiving files.</span></div> : <div className="jobs-list">{jobs.map((job) => <article className="job-row" key={job.id}><div className="job-file-icon"><Upload size={19} /></div><div className="job-primary"><b>{job.reference_no}</b><span>{job.customer_name} · {job.contact_number}</span></div><div className="job-meta"><b>{job.received_file_items?.length ?? 0} file{(job.received_file_items?.length ?? 0) === 1 ? "" : "s"}</b><span>{new Date(job.created_at).toLocaleString()}</span></div><span className="status received">{job.status.replaceAll("_", " ")}</span><button className="review-btn">Review Job</button></article>)}</div>}
        </section>
      </main>
      <style jsx global>{`
        .received-shell{min-height:100vh;background:#f6f7f9}.received-main{width:100%;max-width:1500px;padding:32px;min-width:0}.received-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.11em;font-weight:800;color:#a52a2a}.received-header h1{margin:4px 0 6px;font-size:30px;color:#202124}.received-header p{margin:0;color:#6f7378}.refresh-btn,.qr-actions button,.qr-actions a,.review-btn{border:1px solid #dedfe3;background:#fff;border-radius:10px;padding:10px 14px;font-weight:700;color:#34363a;display:inline-flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer}.intake-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:20px;margin-bottom:20px}.qr-card,.phase-card,.jobs-card{background:#fff;border:1px solid #e7e8eb;border-radius:18px;box-shadow:0 8px 28px rgba(28,32,36,.04)}.qr-card{padding:24px;display:grid;grid-template-columns:1fr 190px;gap:14px}.card-top{display:flex;justify-content:space-between;grid-column:1/3}.card-top h2,.phase-card h2,.jobs-head h2{margin:4px 0 0;color:#25272b}.qr-wrap{grid-column:2;grid-row:2/5;display:flex;align-items:center;justify-content:center}.qr-wrap img{width:168px;height:168px;border:1px solid #ececef;border-radius:12px;padding:8px}.qr-card p{margin:8px 0;color:#6d7177;line-height:1.55}.upload-link{display:flex;max-width:620px;border:1px solid #e2e3e6;border-radius:10px;overflow:hidden}.upload-link span{flex:1;padding:10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#62666b}.upload-link button{width:44px;border:0;border-left:1px solid #e2e3e6;background:#fafafa;cursor:pointer}.qr-actions{display:flex;gap:10px;flex-wrap:wrap}.qr-actions button{background:#9f2424;color:#fff;border-color:#9f2424}.phase-card{padding:24px}.phase-icon{width:46px;height:46px;border-radius:13px;background:#f8eaea;color:#a52a2a;display:grid;place-items:center;margin-bottom:18px}.phase-list{margin:18px 0}.phase-list div{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f0f0f1}.phase-list div:last-child{border-bottom:0}.phase-list b{width:24px;height:24px;border-radius:50%;background:#f3f4f5;display:grid;place-items:center;font-size:12px}.phase-card small{color:#777b81;line-height:1.5}.jobs-card{padding:24px}.jobs-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.count-pill{background:#fff2e6;color:#b45b00;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:800}.jobs-list{display:flex;flex-direction:column}.job-row{display:grid;grid-template-columns:42px 1.3fr 1fr auto auto;align-items:center;gap:16px;padding:15px 0;border-top:1px solid #eeeeef}.job-file-icon{width:42px;height:42px;border-radius:11px;background:#f8eaea;color:#a52a2a;display:grid;place-items:center}.job-primary,.job-meta{display:flex;flex-direction:column;gap:4px}.job-primary b{color:#2d3034}.job-primary span,.job-meta span{font-size:13px;color:#777b81}.job-meta{text-align:right}.job-meta b{font-size:13px}.status{font-size:11px;font-weight:800;padding:7px 10px;border-radius:999px;white-space:nowrap}.status.received{background:#fff2d8;color:#9a6400}.review-btn{padding:9px 12px}.empty-state{min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#777b81;text-align:center}.empty-state b{color:#3b3e42}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.intake-grid{grid-template-columns:1fr}.received-main{padding:24px}.job-row{grid-template-columns:42px 1fr auto;gap:12px}.job-meta{display:none}.status{justify-self:end}.review-btn{grid-column:2/4;justify-self:start}.qr-card{grid-template-columns:1fr 170px}.qr-wrap{grid-column:2;grid-row:2/5}}@media(max-width:700px){.received-main{padding:18px}.received-header{align-items:flex-start;flex-direction:column}.intake-grid{gap:14px}.qr-card{display:flex;flex-direction:column}.qr-wrap{order:1}.card-top{order:0}.qr-card p{order:2}.upload-link{order:3}.qr-actions{order:4}.job-row{grid-template-columns:42px 1fr}.status{grid-column:2}.review-btn{grid-column:2}.jobs-card,.phase-card,.qr-card{padding:18px}}
      `}</style>
    </div>
  );
}
