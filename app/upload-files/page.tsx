"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, LoaderCircle, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "../../lib/supabase";

const allowedExtensions = ["pdf", "docx", "xlsx", "pptx", "jpg", "jpeg", "png"];
const maxFileSize = 25 * 1024 * 1024;
const maxFiles = 10;

function makeReference() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `RF-${date}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export default function UploadFilesPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ reference: string; count: number } | null>(null);

  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const accepted = selected.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      return allowedExtensions.includes(ext) && file.size <= maxFileSize;
    });
    if (accepted.length !== selected.length) setError("Some files were skipped. Only PDF, DOCX, XLSX, PPTX, JPG and PNG files up to 25 MB are accepted.");
    setFiles((current) => [...current, ...accepted].slice(0, maxFiles));
    event.target.value = "";
  };

  const removeFile = (index: number) => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim() || !cleanEmail) return setError("Please enter your name and email address.");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("Please enter a valid email address.");
    if (!files.length) return setError("Please attach at least one file.");

    setBusy(true);
    const reference = makeReference();
    const jobId = crypto.randomUUID();
    const { error: jobError } = await supabase
      .from("received_file_jobs")
      .insert({ id: jobId, reference_no: reference, customer_name: name.trim(), email: cleanEmail, status: "RECEIVED", file_count: files.length });

    if (jobError) {
      setBusy(false);
      setError(jobError.message || "Unable to create your file job. Please try again.");
      return;
    }

    const uploaded: { original_name: string; storage_path: string; mime_type: string; size_bytes: number }[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${jobId}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("received-files").upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) throw uploadError;
        uploaded.push({ original_name: file.name, storage_path: path, mime_type: file.type || "application/octet-stream", size_bytes: file.size });
      }

      const { error: itemsError } = await supabase.from("received_file_items").insert(uploaded.map((file) => ({ ...file, job_id: jobId })));
      if (itemsError) throw itemsError;

      setSuccess({ reference, count: files.length });
      setFiles([]);
      setName("");
      setEmail("");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Some files could not be uploaded.";
      setError(`Upload could not be completed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  if (success) return <main className="upload-page"><section className="upload-card success-card"><CheckCircle2 size={52} /><span className="eyebrow">FILES RECEIVED</span><h1>Thank you!</h1><p>Your files have been successfully sent to PrintWise.</p><div className="reference-box"><span>Your Reference Number</span><b>{success.reference}</b><small>{success.count} file{success.count === 1 ? "" : "s"} received</small></div><p className="success-note">Please keep this reference number for your record.</p><button onClick={() => setSuccess(null)}>Send Another File</button></section><style jsx global>{baseStyles}</style></main>;

  return <main className="upload-page"><section className="upload-card"><div className="brand-line"><div className="brand-dot">P</div><div><b>PRINTWISE</b><span>Printing & Customized Services</span></div></div><span className="eyebrow">CUSTOMER FILE UPLOAD</span><h1>Send your files to PrintWise</h1><p className="lead">Enter your details and attach the file or files you need us to receive.</p><form onSubmit={submit}><label>Full Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" autoComplete="name" /></label><label>Email Address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" /></label><div className="upload-area"><input id="files" type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png" onChange={addFiles} /><label htmlFor="files" className="drop-zone"><UploadCloud size={28} /><b>Choose files to upload</b><span>PDF, Word, Excel, PowerPoint, JPG or PNG</span><small>Up to {maxFiles} files · 25 MB each</small></label></div>{files.length > 0 && <div className="file-list">{files.map((file, index) => <div className="file-item" key={`${file.name}-${index}`}><span className="file-icon">{file.type.startsWith("image/") ? <ImageIcon size={18} /> : <FileText size={18} />}</span><div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 2 : 1)} {file.size > 1024 * 1024 ? "MB" : "KB"}</small></div><button type="button" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><Trash2 size={17} /></button></div>)}</div>}<div className="upload-summary"><Paperclip size={16} /> {files.length} file{files.length === 1 ? "" : "s"} selected · {(totalSize / 1024 / 1024).toFixed(2)} MB total</div>{error && <div className="error-message">{error}</div>}<button className="submit-btn" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> Sending files…</> : <><UploadCloud size={18} /> Submit Files</>}</button></form><p className="privacy-note">Your files are received for PrintWise service processing.</p></section><style jsx global>{baseStyles}</style></main>;
}

const baseStyles = `
*{box-sizing:border-box}.upload-page{min-height:100vh;background:linear-gradient(145deg,#f7f7f8,#f0f1f3);padding:24px;display:grid;place-items:center;font-family:Arial,sans-serif;color:#292b2f}.upload-card{width:min(100%,580px);background:#fff;border:1px solid #e5e6e8;border-radius:24px;padding:30px;box-shadow:0 18px 60px rgba(27,31,35,.09)}.brand-line{display:flex;align-items:center;gap:10px;margin-bottom:28px}.brand-dot{width:38px;height:38px;border-radius:11px;background:#9f2424;color:#fff;display:grid;place-items:center;font-weight:900}.brand-line div:last-child{display:flex;flex-direction:column;gap:2px}.brand-line b{font-size:14px;letter-spacing:.06em}.brand-line span{font-size:11px;color:#888}.eyebrow{display:block;font-size:11px;letter-spacing:.12em;font-weight:800;color:#a52a2a;margin-bottom:7px}.upload-card h1{font-size:29px;margin:0 0 9px}.lead{margin:0 0 24px;color:#6f7378;line-height:1.5}form{display:flex;flex-direction:column;gap:16px}label{font-size:13px;font-weight:800;display:flex;flex-direction:column;gap:7px}input{border:1px solid #dedfe3;border-radius:11px;padding:13px 14px;font-size:15px;outline:none;background:#fff}input:focus{border-color:#a52a2a;box-shadow:0 0 0 3px rgba(165,42,42,.09)}.upload-area input{display:none}.drop-zone{border:1.5px dashed #cfcfd4;border-radius:15px;min-height:155px;display:flex;align-items:center;justify-content:center;text-align:center;color:#60646a;cursor:pointer;padding:20px}.drop-zone svg{color:#a52a2a;margin-bottom:3px}.drop-zone b{color:#35383d}.drop-zone span,.drop-zone small{font-size:12px;font-weight:500;color:#7b7f85}.file-list{border:1px solid #ececef;border-radius:14px;overflow:hidden}.file-item{display:grid;grid-template-columns:34px 1fr 34px;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid #f0f0f1}.file-item:last-child{border-bottom:0}.file-icon{width:34px;height:34px;border-radius:9px;background:#f8eaea;color:#a52a2a;display:grid;place-items:center}.file-item div{min-width:0;display:flex;flex-direction:column;gap:3px}.file-item b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.file-item small{font-size:11px;color:#83868b}.file-item button{border:0;background:transparent;color:#9b9ea2;cursor:pointer;padding:7px}.upload-summary{font-size:12px;color:#6f7378;display:flex;align-items:center;gap:7px}.error-message{padding:11px 12px;border-radius:10px;background:#fff0f0;color:#b12626;font-size:13px}.submit-btn,.success-card button{border:0;background:#9f2424;color:#fff;border-radius:11px;padding:14px 16px;font-weight:800;font-size:14px;display:flex;justify-content:center;align-items:center;gap:8px;cursor:pointer}.submit-btn:disabled{opacity:.7;cursor:not-allowed}.privacy-note{text-align:center;color:#94979b;font-size:11px;margin:3px 0 0}.success-card{text-align:center;align-items:center}.success-card>svg{color:#2e9d57;margin:8px auto 18px}.success-card .eyebrow{margin-top:0}.reference-box{margin:24px 0;background:#f7f7f8;border:1px solid #e7e7e9;border-radius:15px;padding:18px;display:flex;flex-direction:column;gap:6px}.reference-box span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8a8d92}.reference-box b{font-size:22px;letter-spacing:.04em;color:#9f2424}.reference-box small{color:#73777c}.success-note{font-size:13px;color:#777b80}.success-card button{width:100%;margin-top:18px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:560px){.upload-page{padding:14px}.upload-card{padding:23px 18px;border-radius:20px}.upload-card h1{font-size:25px}}
`;