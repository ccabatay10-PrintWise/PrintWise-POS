"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  LoaderCircle,
  Palette,
  Phone,
  Printer,
  RefreshCw,
  Settings2,
  ShoppingCart,
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

type FileSetup = {
  mode: "PRINT" | "EDIT" | "SKIP";
  paperSize: string;
  paperQuality: string;
  colorMode: string;
  inkCoverage: string;
  sides: string;
  copies: number;
  pages: number;
};

type POSHandoff = {
  jobId: string;
  referenceNo: string;
  customerName: string;
  contactNumber: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
};

const statuses = ["RECEIVED", "REVIEWING", "PROCESSING", "READY", "COMPLETED"];

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function defaultSetup(): FileSetup {
  return {
    mode: "PRINT",
    paperSize: "A4",
    paperQuality: "Standard",
    colorMode: "Black & White",
    inkCoverage: "Normal",
    sides: "Single-sided",
    copies: 1,
    pages: 1,
  };
}

export default function ReceivedFileJobPage() {
  const params = useParams<{ id: string }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sendingToPOS, setSendingToPOS] = useState(false);
  const [error, setError] = useState("");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [setups, setSetups] = useState<Record<string, FileSetup>>({});

  const loadJob = useCallback(async () => {
    if (!jobId) {
      setError("Invalid file job ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("received_file_jobs")
      .select("id, reference_no, customer_name, contact_number, status, created_at, received_file_items(id, original_name, storage_path, mime_type, size_bytes)")
      .eq("id", jobId)
      .single();

    if (loadError) {
      setError(loadError.message || "Unable to load this file job.");
    } else {
      const nextJob = data as Job;
      setJob(nextJob);
      const nextSetups: Record<string, FileSetup> = {};
      (nextJob.received_file_items ?? []).forEach((file) => {
        nextSetups[file.id] = defaultSetup();
      });
      setSetups(nextSetups);
      setActiveFileId((nextJob.received_file_items ?? [])[0]?.id ?? null);
    }
    setLoading(false);
  }, [jobId]);

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

  const updateSetup = (fileId: string, patch: Partial<FileSetup>) => {
    setSetups((current) => ({
      ...current,
      [fileId]: { ...(current[fileId] ?? defaultSetup()), ...patch },
    }));
  };

  const estimateFile = (setup?: FileSetup) => {
    if (!setup || setup.mode !== "PRINT") return 0;
    let rate = setup.colorMode === "Colored" ? 8 : 2;
    if (setup.paperSize === "Legal") rate += 1.5;
    if (setup.paperSize === "Letter") rate += 0.5;
    if (setup.paperQuality === "Premium") rate += 2;
    if (setup.paperQuality === "Photo") rate += 8;
    if (setup.inkCoverage === "Heavy") rate += setup.colorMode === "Colored" ? 3 : 1;
    if (setup.inkCoverage === "Light") rate -= 0.25;
    if (setup.sides === "Double-sided") rate += 0.75;
    return Math.max(rate, 0) * Math.max(setup.pages, 1) * Math.max(setup.copies, 1);
  };

  const totalSize = useMemo(
    () => (job?.received_file_items ?? []).reduce((sum, file) => sum + Number(file.size_bytes || 0), 0),
    [job]
  );

  const estimatedTotal = useMemo(
    () => Object.values(setups).reduce((sum, setup) => sum + estimateFile(setup), 0),
    [setups]
  );

  const printableCount = useMemo(
    () => Object.values(setups).filter((setup) => setup.mode === "PRINT").length,
    [setups]
  );

  const sendToPOS = async () => {
    if (!job) return;
    const files = job.received_file_items ?? [];
    const items = files
      .map((file) => {
        const setup = setups[file.id] ?? defaultSetup();
        const price = estimateFile(setup);
        if (setup.mode !== "PRINT" || price <= 0) return null;
        return {
          id: `received-file-${job.id}-${file.id}`,
          name: `Print: ${file.original_name}`,
          price: Number(price.toFixed(2)),
          quantity: 1,
        };
      })
      .filter(Boolean) as POSHandoff["items"];

    if (!items.length) {
      setError("Choose at least one file to print before adding this job to the POS.");
      return;
    }

    setSendingToPOS(true);
    setError("");

    const handoff: POSHandoff = {
      jobId: job.id,
      referenceNo: job.reference_no,
      customerName: job.customer_name,
      contactNumber: job.contact_number,
      items,
    };

    try {
      sessionStorage.setItem("printwise_received_file_cart", JSON.stringify(handoff));
      const { error: updateError } = await supabase
        .from("received_file_jobs")
        .update({ status: "PROCESSING" })
        .eq("id", job.id);

      if (updateError) throw updateError;
      window.location.href = "/pos";
    } catch (handoffError: any) {
      setError(handoffError?.message || "Unable to add this file job to the POS.");
      setSendingToPOS(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell received-shell">
        <Sidebar />
        <main className="received-main">
          <div className="job-loading"><LoaderCircle className="spin" size={30} /><b>Loading file job…</b></div>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="app-shell received-shell">
        <Sidebar />
        <main className="received-main">
          <button className="back-btn" onClick={() => (window.location.href = "/received-files")}><ArrowLeft size={18} /> Back to Received Files</button>
          <div className="job-empty"><FolderOpen size={38} /><h1>Job not found</h1><p>{error || "This file job may have been removed."}</p></div>
        </main>
      </div>
    );
  }

  const files = job.received_file_items ?? [];
  const date = new Date(job.created_at).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="app-shell received-shell">
      <Sidebar />
      <main className="received-main">
        <div className="job-topbar">
          <button className="back-btn" onClick={() => (window.location.href = "/received-files")}><ArrowLeft size={18} /> Back to Received Files</button>
          <button className="refresh-btn" onClick={loadJob}><RefreshCw size={17} /> Refresh</button>
        </div>

        <section className="job-hero">
          <div><span className="eyebrow">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div>
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
              {statuses.map((status) => (
                <button key={status} className={job.status === status ? "active" : ""} disabled={updating} onClick={() => updateStatus(status)}>
                  {status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            {error && <div className="job-error">{error}</div>}
          </article>
        </section>

        <section className="job-card files-card">
          <div className="files-head">
            <div>
              <span className="mini-label">STEP 3 · FILE PROCESSING</span>
              <h2>Review and configure submitted files</h2>
              <p>{files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalSize)} total size</p>
            </div>
            <div className="estimate-total"><small>Current estimated total</small><b>₱{estimatedTotal.toFixed(2)}</b></div>
          </div>

          <div className="processing-note"><Settings2 size={19} /><span>Choose what happens to each file, then set its print specifications. The calculated total will be transferred to the POS for payment and receipt generation.</span></div>

          <div className="processing-list">
            {files.map((file, index) => {
              const setup = setups[file.id] ?? defaultSetup();
              const isOpen = activeFileId === file.id;
              const estimate = estimateFile(setup);
              return (
                <article className={`processing-file ${isOpen ? "open" : ""}`} key={file.id}>
                  <button className="processing-file-head" onClick={() => setActiveFileId(isOpen ? null : file.id)}>
                    <span className="file-number">{index + 1}</span>
                    <span className="file-icon"><FileText size={20} /></span>
                    <span className="file-title"><b>{file.original_name}</b><small>{file.mime_type || "Unknown file type"} · {formatBytes(Number(file.size_bytes || 0))}</small></span>
                    <span className="file-estimate">{setup.mode === "PRINT" ? `₱${estimate.toFixed(2)} est.` : setup.mode === "EDIT" ? "Needs editing" : "Skipped"}</span>
                    <ChevronDown size={20} className={isOpen ? "chevron open" : "chevron"} />
                  </button>

                  {isOpen && (
                    <div className="processing-body">
                      <div className="file-actions">
                        <button onClick={() => openFile(file)}><ExternalLink size={17} /> Open</button>
                        <button onClick={() => openFile(file, true)}><Download size={17} /> Download</button>
                      </div>

                      <div className="mode-switch">
                        <button className={setup.mode === "PRINT" ? "selected" : ""} onClick={() => updateSetup(file.id, { mode: "PRINT" })}><Printer size={18} /> Print Directly</button>
                        <button className={setup.mode === "EDIT" ? "selected" : ""} onClick={() => updateSetup(file.id, { mode: "EDIT" })}><FileText size={18} /> Edit / Customize First</button>
                        <button className={setup.mode === "SKIP" ? "selected muted" : "muted"} onClick={() => updateSetup(file.id, { mode: "SKIP" })}>Skip File</button>
                      </div>

                      {setup.mode === "PRINT" && (
                        <div className="setup-grid">
                          <label>Paper Size<select value={setup.paperSize} onChange={(e) => updateSetup(file.id, { paperSize: e.target.value })}><option>A4</option><option>Letter</option><option>Legal</option></select></label>
                          <label>Paper Quality<select value={setup.paperQuality} onChange={(e) => updateSetup(file.id, { paperQuality: e.target.value })}><option>Standard</option><option>Premium</option><option>Photo</option></select></label>
                          <label><Palette size={15} /> Print Color<select value={setup.colorMode} onChange={(e) => updateSetup(file.id, { colorMode: e.target.value })}><option>Black & White</option><option>Colored</option></select></label>
                          <label>Ink Coverage<select value={setup.inkCoverage} onChange={(e) => updateSetup(file.id, { inkCoverage: e.target.value })}><option>Light</option><option>Normal</option><option>Heavy</option></select></label>
                          <label>Print Sides<select value={setup.sides} onChange={(e) => updateSetup(file.id, { sides: e.target.value })}><option>Single-sided</option><option>Double-sided</option></select></label>
                          <label>Estimated Pages<input type="number" min="1" value={setup.pages} onChange={(e) => updateSetup(file.id, { pages: Math.max(1, Number(e.target.value) || 1) })} /></label>
                          <label>Quantity / Copies<input type="number" min="1" value={setup.copies} onChange={(e) => updateSetup(file.id, { copies: Math.max(1, Number(e.target.value) || 1) })} /></label>
                          <div className="file-price-box"><small>Live estimate</small><b>₱{estimate.toFixed(2)}</b><span>{setup.pages} page{setup.pages === 1 ? "" : "s"} × {setup.copies} cop{setup.copies === 1 ? "y" : "ies"}</span></div>
                        </div>
                      )}

                      {setup.mode === "EDIT" && <div className="edit-guide"><FileText size={22} /><div><b>Customization required</b><p>Download the original file, edit or arrange it in Word or another application, then re-upload the finished version in the next processing step.</p></div></div>}
                      {setup.mode === "SKIP" && <div className="skip-guide">This file will not be included in the print calculation or the POS cart.</div>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="next-phase-card">
          <CheckCircle2 size={22} />
          <div>
            <span className="mini-label">READY FOR PAYMENT</span>
            <b>{printableCount} printable file{printableCount === 1 ? "" : "s"} ready to send to the POS.</b>
            <p>The calculated print items will be added to the POS cart under <strong>{job.customer_name}</strong>, where staff can collect payment and print the customer receipt.</p>
          </div>
          <div className="next-total"><small>Job total</small><strong>₱{estimatedTotal.toFixed(2)}</strong></div>
          <button className="send-pos-btn" disabled={sendingToPOS || printableCount === 0 || estimatedTotal <= 0} onClick={sendToPOS}>
            <ShoppingCart size={18} /> {sendingToPOS ? "ADDING..." : "ADD JOB TO POS"}
          </button>
        </section>
      </main>

      <style jsx global>{styles}</style>
    </div>
  );
}

const styles = `
.received-shell{min-height:100vh;background:#f4f6f8}.received-main{width:100%;max-width:1600px;padding:28px 32px 40px;min-width:0}.job-topbar,.job-hero,.files-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.back-btn,.refresh-btn{border:1px solid #dfe3e7;background:#fff;border-radius:11px;padding:11px 15px;color:#373b40;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.job-topbar{margin-bottom:18px}.job-hero,.job-card,.next-phase-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.job-hero{padding:26px 28px;margin-bottom:18px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.job-hero h1{margin:6px 0;font-size:31px;color:#292d32}.job-hero p,.workflow-card p,.files-head p{margin:0;color:#747a81}.status{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:850;letter-spacing:.04em}.status.received{background:#fff0df;color:#b66408}.status.reviewing,.status.processing{background:#eef4ff;color:#2864b3}.status.ready,.status.completed{background:#e9f8ef;color:#237247}.job-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px;margin-bottom:18px}.job-card{padding:24px}.customer-card{display:flex;flex-direction:column;gap:17px}.customer-row{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #eef1f3}.customer-row small{display:block;color:#81878e;font-size:12px;margin-bottom:4px}.customer-row b{color:#353a40}.detail-icon,.file-icon{width:42px;height:42px;border-radius:12px;background:#fbefef;color:#c12626;display:grid;place-items:center;flex:0 0 auto}.workflow-card h2,.files-head h2{margin:7px 0 5px;color:#2f3439}.workflow-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.workflow-buttons button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:800;color:#555c63;cursor:pointer}.workflow-buttons button.active{background:#c90f0f;border-color:#c90f0f;color:#fff}.workflow-buttons button:disabled{opacity:.65}.job-error{margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff0f0;color:#b12626;font-size:13px}.files-card{padding:0;overflow:hidden}.files-head{padding:24px 26px;border-bottom:1px solid #e9edf0}.estimate-total{min-width:180px;padding:12px 16px;border-radius:13px;background:#fff8f8;border:1px solid #f1d8d8;text-align:right}.estimate-total small,.file-price-box small,.next-total small{display:block;color:#747a81;font-size:11px;font-weight:750}.estimate-total b,.file-price-box b,.next-total strong{display:block;color:#c90f0f;font-size:22px;margin-top:3px}.processing-note{display:flex;align-items:flex-start;gap:10px;margin:18px 26px;padding:13px 15px;background:#f8fafb;border:1px solid #e8ecef;border-radius:12px;color:#60676e;font-size:13px;line-height:1.5}.processing-note svg{color:#c90f0f;flex:0 0 auto}.processing-list{padding:0 26px 26px}.processing-file{border:1px solid #e4e8eb;border-radius:14px;margin-top:12px;overflow:hidden;background:#fff}.processing-file.open{border-color:#edcaca;box-shadow:0 8px 24px rgba(120,25,25,.05)}.processing-file-head{width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:0;background:#fff;padding:15px 16px;cursor:pointer}.file-number{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#f4f5f6;color:#737980;font-size:11px;font-weight:850;flex:0 0 auto}.file-title{min-width:0;flex:1}.file-title b{display:block;color:#343a40;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.file-title small{display:block;color:#81878e;font-size:12px;margin-top:4px}.file-estimate{font-size:12px;font-weight:800;color:#8b5151;white-space:nowrap}.chevron{color:#7a8086;transition:.2s}.chevron.open{transform:rotate(180deg)}.processing-body{border-top:1px solid #edf0f2;padding:18px}.file-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.file-actions button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:9px 12px;color:#42484f;font-weight:750;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.mode-switch{display:grid;grid-template-columns:1.1fr 1.4fr .8fr;gap:9px;margin-bottom:18px}.mode-switch button{border:1px solid #dfe3e7;background:#fafbfb;border-radius:11px;padding:12px;color:#5c636a;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.mode-switch button.selected{background:#c90f0f;color:#fff;border-color:#c90f0f}.mode-switch button.muted.selected{background:#60666c;border-color:#60666c}.setup-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.setup-grid label{display:flex;flex-direction:column;gap:7px;color:#626970;font-size:11px;font-weight:850}.setup-grid label svg{vertical-align:middle;margin-right:4px;color:#c90f0f}.setup-grid select,.setup-grid input{width:100%;border:1px solid #dfe3e7;border-radius:10px;padding:10px 11px;background:#fff;color:#343a40;font:inherit;font-size:13px;outline:none}.setup-grid select:focus,.setup-grid input:focus{border-color:#d46b6b;box-shadow:0 0 0 3px rgba(201,15,15,.08)}.file-price-box{border:1px solid #f0d7d7;background:#fff9f9;border-radius:11px;padding:10px 12px;display:flex;flex-direction:column;justify-content:center}.file-price-box b{font-size:19px}.file-price-box span{font-size:10px;color:#7b8288;margin-top:3px}.edit-guide{display:flex;gap:12px;padding:15px;border:1px solid #dbe7f4;background:#f7fbff;border-radius:12px;color:#3f5f7d}.edit-guide p{margin:4px 0 0;color:#65717d;font-size:13px;line-height:1.45}.skip-guide{padding:14px;border-radius:10px;background:#f6f7f8;color:#727980;font-size:13px}.next-phase-card{margin-top:18px;padding:18px 22px;display:flex;align-items:center;gap:13px}.next-phase-card>svg{color:#c90f0f}.next-phase-card b{display:block;margin:5px 0;color:#33393f}.next-phase-card p{margin:0;color:#747a81;font-size:13px}.next-total{margin-left:auto;text-align:right}.send-pos-btn{border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:13px 17px;font-weight:850;display:inline-flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap}.send-pos-btn:disabled{opacity:.5;cursor:not-allowed}.job-loading,.job-empty{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#666d74}.job-empty h1{margin:0;color:#2e3338}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.setup-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:900px){.job-grid{grid-template-columns:1fr}.received-main{padding:22px 18px 32px}.setup-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.next-phase-card{align-items:flex-start;flex-wrap:wrap}.next-total{margin-left:35px;text-align:left}}@media(max-width:640px){.job-topbar,.job-hero,.files-head{align-items:flex-start;flex-direction:column}.job-hero{padding:22px}.received-main{padding:16px 12px 28px}.job-card{padding:20px}.files-head{padding:20px}.processing-note{margin:16px 20px}.processing-list{padding:0 20px 20px}.processing-file-head{align-items:flex-start;flex-wrap:wrap}.file-estimate{margin-left:36px}.mode-switch{grid-template-columns:1fr}.setup-grid{grid-template-columns:1fr}.send-pos-btn{width:100%;justify-content:center}.job-hero h1{font-size:24px}}
`;