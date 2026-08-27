"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  Save,
  Upload,
} from "lucide-react";
import Sidebar from "../../../../../components/Sidebar";
import { supabase } from "../../../../../../lib/supabase";
import "../../../../../pos/pos.css";

type EditableFile = {
  id: string;
  job_id: string;
  original_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  edit_status: string;
  final_storage_path: string | null;
  final_name: string | null;
  final_mime_type: string | null;
  final_size_bytes: number | null;
  received_file_jobs?: {
    reference_no: string;
    customer_name: string;
    contact_number: string;
  } | null;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export default function StaffEditFilePage() {
  const params = useParams<{ id: string; fileId: string }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fileId = Array.isArray(params.fileId) ? params.fileId[0] : params.fileId;
  const [item, setItem] = useState<EditableFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadItem = useCallback(async () => {
    if (!jobId || !fileId) {
      setError("Invalid file or job ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("received_file_items")
      .select("id, job_id, original_name, storage_path, mime_type, size_bytes, edit_status, final_storage_path, final_name, final_mime_type, final_size_bytes, received_file_jobs(reference_no, customer_name, contact_number)")
      .eq("id", fileId)
      .eq("job_id", jobId)
      .single();

    if (loadError) setError(loadError.message || "Unable to load this file.");
    else setItem(data as EditableFile);
    setLoading(false);
  }, [fileId, jobId]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const openStoredFile = async (path: string | null, name: string, download = false) => {
    if (!path) return;
    setError("");
    const { data, error: urlError } = await supabase.storage
      .from("received-files")
      .createSignedUrl(path, 60 * 15, download ? { download: name } : undefined);

    if (urlError || !data?.signedUrl) {
      setError(urlError?.message || "Unable to open this file.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const onFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    setError("");
    setMessage("");
  };

  const saveFinishedFile = async () => {
    if (!item || !selectedFile) {
      setError("Choose the finished file before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const path = `staff-finished/${item.job_id}/${item.id}/${Date.now()}-${safeName(selectedFile.name)}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("received-files")
        .upload(path, selectedFile, {
          contentType: selectedFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("received_file_items")
        .update({
          edit_status: "FINISHED",
          final_storage_path: path,
          final_name: selectedFile.name,
          final_mime_type: selectedFile.type || null,
          final_size_bytes: selectedFile.size,
          staff_processed_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("job_id", item.job_id);

      if (updateError) throw updateError;

      const { error: jobError } = await supabase
        .from("received_file_jobs")
        .update({ status: "PROCESSING" })
        .eq("id", item.job_id);

      if (jobError) throw jobError;

      setItem({
        ...item,
        edit_status: "FINISHED",
        final_storage_path: path,
        final_name: selectedFile.name,
        final_mime_type: selectedFile.type || null,
        final_size_bytes: selectedFile.size,
      });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Finished file saved successfully. You can now return to the job and continue to print configuration and POS.");
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to save the finished file.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell staff-edit-shell">
        <Sidebar />
        <main className="staff-edit-main"><div className="staff-edit-loading"><LoaderCircle className="spin" size={30} /><b>Loading editing workspace…</b></div></main>
        <style jsx global>{styles}</style>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="app-shell staff-edit-shell">
        <Sidebar />
        <main className="staff-edit-main">
          <button className="staff-back" onClick={() => (window.location.href = `/received-files/${jobId}`)}><ArrowLeft size={18} /> Back to job</button>
          <div className="staff-edit-empty"><FileText size={42} /><h1>File not found</h1><p>{error || "This file may have been removed."}</p></div>
        </main>
        <style jsx global>{styles}</style>
      </div>
    );
  }

  const job = item.received_file_jobs;

  return (
    <div className="app-shell staff-edit-shell">
      <Sidebar />
      <main className="staff-edit-main">
        <div className="staff-edit-topbar">
          <button className="staff-back" onClick={() => (window.location.href = `/received-files/${item.job_id}`)}><ArrowLeft size={18} /> Back to job</button>
          <span className={item.edit_status === "FINISHED" ? "edit-status finished" : "edit-status"}>{item.edit_status === "FINISHED" ? "FINISHED VERSION SAVED" : "CUSTOMIZATION WORKSPACE"}</span>
        </div>

        <section className="staff-edit-hero">
          <div>
            <span className="staff-eyebrow">STAFF FILE EDITING</span>
            <h1>Customize and re-upload</h1>
            <p>Open the customer’s original file, edit it in Word or another application, then upload the finished version back into this job.</p>
          </div>
          <div className="staff-job-summary">
            <small>JOB</small><b>{job?.reference_no || item.job_id}</b>
            <span>{job?.customer_name || "Customer file"}</span>
          </div>
        </section>

        <section className="staff-edit-grid">
          <article className="staff-card original-card">
            <span className="staff-label">1 · ORIGINAL CUSTOMER FILE</span>
            <div className="file-preview-icon"><FileText size={30} /></div>
            <h2>{item.original_name}</h2>
            <p>{item.mime_type || "Unknown file type"} · {formatBytes(Number(item.size_bytes || 0))}</p>
            <div className="staff-actions">
              <button onClick={() => openStoredFile(item.storage_path, item.original_name)}><ExternalLink size={17} /> Open original</button>
              <button onClick={() => openStoredFile(item.storage_path, item.original_name, true)}><Download size={17} /> Download original</button>
            </div>
            <div className="staff-tip">After downloading, staff can arrange a JPEG in Word, edit a document, resize content, or make other requested adjustments.</div>
          </article>

          <article className="staff-card upload-card">
            <span className="staff-label">2 · UPLOAD FINISHED VERSION</span>
            <h2>Save the final working file</h2>
            <p>Choose the file after all editing and customer-requested adjustments are complete.</p>

            <input ref={inputRef} id="finished-file-input" className="hidden-input" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={onFileSelected} />
            <label htmlFor="finished-file-input" className="upload-zone">
              <Upload size={30} />
              <b>{selectedFile ? selectedFile.name : "Choose finished file"}</b>
              <span>{selectedFile ? `${formatBytes(selectedFile.size)} ready to save` : "PDF, Word, Excel, PowerPoint, JPG or PNG"}</span>
            </label>

            {item.final_storage_path && (
              <div className="existing-finished">
                <div><FileCheck2 size={20} /><span><b>Current finished version</b><small>{item.final_name || "Finished file"} · {formatBytes(Number(item.final_size_bytes || 0))}</small></span></div>
                <div className="existing-actions">
                  <button onClick={() => openStoredFile(item.final_storage_path, item.final_name || "finished-file")}>Open</button>
                  <button onClick={() => openStoredFile(item.final_storage_path, item.final_name || "finished-file", true)}>Download</button>
                </div>
              </div>
            )}

            {error && <div className="staff-error">{error}</div>}
            {message && <div className="staff-success"><CheckCircle2 size={18} /> {message}</div>}

            <div className="save-row">
              <button className="save-finished-btn" disabled={!selectedFile || saving} onClick={saveFinishedFile}><Save size={18} /> {saving ? "SAVING..." : item.final_storage_path ? "REPLACE FINISHED FILE" : "SAVE FINISHED FILE"}</button>
            </div>
          </article>
        </section>

        <section className="staff-next-card">
          <CheckCircle2 size={22} />
          <div><span className="staff-label">NEXT</span><b>Return to the job and configure printing</b><p>Once the finished file is saved, continue with paper size, quality, color, ink coverage, quantity, price calculation, and Add Job to POS.</p></div>
          <button onClick={() => (window.location.href = `/received-files/${item.job_id}`)}>RETURN TO JOB</button>
        </section>
      </main>
      <style jsx global>{styles}</style>
    </div>
  );
}

const styles = `
.staff-edit-shell{min-height:100vh;background:#f4f6f8}.staff-edit-main{width:100%;max-width:1500px;padding:28px 32px 40px;min-width:0}.staff-edit-topbar,.staff-edit-hero,.staff-next-card{display:flex;align-items:center;justify-content:space-between;gap:16px}.staff-back{border:1px solid #dfe3e7;background:#fff;border-radius:11px;padding:11px 15px;color:#373b40;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.edit-status{border-radius:999px;background:#fff1df;color:#a9650b;padding:8px 11px;font-size:11px;font-weight:850;letter-spacing:.04em}.edit-status.finished{background:#e9f8ef;color:#237247}.staff-edit-hero,.staff-card,.staff-next-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.staff-edit-hero{padding:26px 28px;margin:18px 0}.staff-eyebrow,.staff-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.staff-edit-hero h1{margin:7px 0;color:#2c3137;font-size:31px}.staff-edit-hero p{margin:0;color:#737a81;max-width:760px;line-height:1.5}.staff-job-summary{min-width:220px;padding:15px 17px;border:1px solid #eceff1;border-radius:14px;background:#fafbfb}.staff-job-summary small,.staff-job-summary span{display:block;color:#7c838a;font-size:12px}.staff-job-summary b{display:block;color:#33393f;margin:5px 0}.staff-edit-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:18px}.staff-card{padding:25px}.staff-card h2{margin:8px 0 5px;color:#33383e}.staff-card>p{margin:0;color:#747b82;line-height:1.5}.file-preview-icon{width:62px;height:62px;border-radius:16px;background:#fff0f0;color:#c12626;display:grid;place-items:center;margin:22px 0 12px}.staff-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.staff-actions button,.existing-actions button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 12px;color:#42484f;font-weight:750;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.staff-tip{margin-top:20px;padding:13px 14px;border-radius:12px;background:#f7fafc;border:1px solid #e5eaee;color:#687078;font-size:13px;line-height:1.5}.upload-zone{margin-top:20px;min-height:210px;border:2px dashed #d6dde2;border-radius:16px;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:24px;cursor:pointer;color:#9f2a2a}.upload-zone b{color:#394047;font-size:17px}.upload-zone span{color:#7b838a;font-size:13px}.hidden-input{display:none}.existing-finished{margin-top:16px;padding:14px;border:1px solid #d7eadf;background:#f5fbf7;border-radius:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.existing-finished>div:first-child{display:flex;align-items:center;gap:10px;color:#237247}.existing-finished span b,.existing-finished span small{display:block}.existing-finished span small{margin-top:3px;color:#718078;font-size:12px}.existing-actions{display:flex;gap:8px}.staff-error,.staff-success{margin-top:15px;padding:12px 13px;border-radius:11px;font-size:13px}.staff-error{background:#fff0f0;color:#b12626}.staff-success{background:#eaf8ef;color:#28744a;display:flex;align-items:flex-start;gap:8px}.save-row{display:flex;justify-content:flex-end;margin-top:18px}.save-finished-btn{border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:13px 17px;font-weight:850;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.save-finished-btn:disabled{opacity:.5;cursor:not-allowed}.staff-next-card{margin-top:18px;padding:18px 22px}.staff-next-card>svg{color:#c90f0f}.staff-next-card b{display:block;margin:5px 0;color:#33393f}.staff-next-card p{margin:0;color:#747a81;font-size:13px;line-height:1.45}.staff-next-card button{margin-left:auto;border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:12px 15px;font-weight:850;cursor:pointer;white-space:nowrap}.staff-edit-loading,.staff-edit-empty{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#666d74}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:980px){.staff-edit-grid{grid-template-columns:1fr}.staff-edit-hero{align-items:flex-start;flex-direction:column}.staff-job-summary{width:100%}}@media(max-width:640px){.staff-edit-main{padding:16px 12px 28px}.staff-edit-topbar,.staff-next-card{align-items:flex-start;flex-direction:column}.staff-edit-hero,.staff-card{padding:20px}.staff-edit-hero h1{font-size:25px}.staff-next-card button{margin-left:0;width:100%}.existing-finished{align-items:flex-start;flex-direction:column}.existing-actions{width:100%}.existing-actions button{flex:1;justify-content:center}.save-finished-btn{width:100%;justify-content:center}}
`;