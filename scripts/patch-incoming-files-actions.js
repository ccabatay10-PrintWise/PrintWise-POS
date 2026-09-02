const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app", "received-files", "page.tsx");
let source = fs.readFileSync(filePath, "utf8");

source = source.replace(
  "import { CheckCircle2, Copy, ExternalLink, Eye, FileText, FileUp, FolderOpen, MoreHorizontal, RefreshCw, ScanLine, UserRound } from \"lucide-react\";",
  "import { CheckCircle2, Copy, Download, ExternalLink, FileText, FileUp, FolderOpen, RefreshCw, ScanLine, Sparkles, UserRound } from \"lucide-react\";"
);
source = source.replace(
  "received_file_items?: { id: string }[];",
  "received_file_items?: { id: string; original_name: string; storage_path: string; mime_type: string; size_bytes: number }[];"
);
source = source.replace(
  'select("id, reference_no, customer_name, email, status, created_at, received_file_items(id)")',
  'select("id, reference_no, customer_name, email, status, created_at, received_file_items(id, original_name, storage_path, mime_type, size_bytes)")'
);

const oldReview = `  const reviewJob = async (job: Job) => {\n    if (openingId) return;\n    setOpeningId(job.id);\n    try {\n      await fetch("/api/email/send", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ jobId: job.id, trigger: "RECEIVED", automatic: true }),\n      });\n    } catch {\n      // Do not prevent staff from opening the job when an email provider is temporarily unavailable.\n    } finally {\n      window.location.href = \`/received-files/\${job.id}\`;\n    }\n  };`;
const newActions = `  const reviewJob = async (job: Job) => {\n    if (openingId) return;\n    setOpeningId(job.id);\n    try {\n      await fetch("/api/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id, trigger: "RECEIVED", automatic: true }) });\n    } catch {}\n    finally { window.location.href = \`/received-files/\${job.id}\`; }\n  };\n\n  const openFile = async (file: NonNullable<Job["received_file_items"]>[number], download = false) => {\n    const { data, error } = await supabase.storage.from("received-files").createSignedUrl(file.storage_path, 900, download ? { download: file.original_name } : undefined);\n    if (error || !data?.signedUrl) return;\n    window.open(data.signedUrl, "_blank", "noopener,noreferrer");\n  };\n\n  const goToSmartPricing = (job: Job, file: NonNullable<Job["received_file_items"]>[number]) => {\n    const q = new URLSearchParams({ fileId: file.id, name: file.original_name });\n    window.location.href = \`/received-files/\${job.id}/smart-pricing?\${q.toString()}\`;\n  };`;
if (source.includes(oldReview)) source = source.replace(oldReview, newActions);

const oldHead = `<thead><tr><th>Reference No.</th><th>Customer</th><th>Email</th><th>Files</th><th>Date Received</th><th>Status</th><th>Actions</th></tr></thead>`;
const newHead = `<thead><tr><th>Reference No.</th><th>Customer</th><th>Email</th><th>Files & Actions</th><th>Date Received</th><th>Status</th></tr></thead>`;
source = source.replace(oldHead, newHead);

const oldRow = `<td><span className="file-count"><FileText size={16} />{fileCount} file{fileCount === 1 ? "" : "s"}</span></td><td>{formatDate(job.created_at)}</td><td><span className={\`status \${job.status.toLowerCase()}\`}>{job.status.replaceAll("_", " ")}</span></td><td><div className="row-actions"><button type="button" className="review-btn" disabled={busy} onClick={() => reviewJob(job)}><Eye size={18} />{busy ? "Opening..." : "Review"}</button><button type="button" disabled={busy} onClick={() => reviewJob(job)} title="Open job"><MoreHorizontal size={20} /></button></div></td>`;
const newRow = `<td><div className="incoming-tab-files">{(job.received_file_items ?? []).map((file) => <div className="incoming-tab-file" key={file.id}><div className="incoming-tab-file-name"><FileText size={16} /><span><b>{file.original_name}</b><small>{file.mime_type || "File"} · {formatDate(job.created_at)}</small></span></div><div className="incoming-tab-actions"><button type="button" onClick={() => openFile(file)}><ExternalLink size={15} /> Open</button><button type="button" onClick={() => openFile(file, true)}><Download size={15} /> Download</button><button type="button" className="incoming-smart-btn" onClick={() => goToSmartPricing(job, file)}><Sparkles size={15} /> Smart Pricing</button></div></div>)}</div></td><td>{formatDate(job.created_at)}</td><td><span className={\`status \${job.status.toLowerCase()}\`}>{job.status.replaceAll("_", " ")}</span></td>`;
if (source.includes(oldRow)) source = source.replace(oldRow, newRow);

const oldFooter = `<div className="jobs-footer"><span>Showing 1 to {filteredJobs.length} of {filteredJobs.length} result{filteredJobs.length === 1 ? "" : "s"}</span><span className="count-pill">{receivedCount} New</span></div>`;
const newFooter = `<div className="jobs-footer"><span>Showing 1 to {filteredJobs.length} of {filteredJobs.length} result{filteredJobs.length === 1 ? "" : "s"}</span><span className="count-pill">{receivedCount} New</span></div>`;
source = source.replace(oldFooter, newFooter);

const css = `.incoming-tab-files{display:flex;flex-direction:column;gap:10px;min-width:520px}.incoming-tab-file{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0}.incoming-tab-file+.incoming-tab-file{border-top:1px solid #eef1f3;padding-top:12px}.incoming-tab-file-name{display:flex;align-items:center;gap:9px;min-width:180px;color:#4c535a}.incoming-tab-file-name span{min-width:0}.incoming-tab-file-name b{display:block;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#33383e}.incoming-tab-file-name small{display:block;color:#7a828a;font-size:11px;margin-top:3px}.incoming-tab-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.incoming-tab-actions button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #dfe3e7;background:#fff;border-radius:9px;padding:8px 10px;color:#3d4349;font-size:12px;font-weight:800;cursor:pointer}.incoming-tab-actions .incoming-smart-btn{background:#f00;color:#fff;border-color:#f00}@media(max-width:900px){.incoming-tab-files{min-width:420px}.incoming-tab-file{align-items:flex-start;flex-direction:column}.incoming-tab-actions{justify-content:flex-start}}`;
if (!source.includes(".incoming-tab-files{")) {
  const styleEnd = source.lastIndexOf("`;\n");
  if (styleEnd < 0) throw new Error("PrintWise: Incoming Files styles marker was not found.");
  source = source.slice(0, styleEnd) + css + source.slice(styleEnd);
}

fs.writeFileSync(filePath, source, "utf8");
console.log("PrintWise: Incoming Files tab now owns Open, Download, and Smart Pricing actions.");
