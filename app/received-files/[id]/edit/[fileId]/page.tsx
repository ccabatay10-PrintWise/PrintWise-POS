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
import Sidebar from "../../../../components/Sidebar";
import { supabase } from "../../../../../lib/supabase";

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
    else setItem(data as unknown as EditableFile);

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
    setSelectedFile(event.target.files?.[0] ?? null);
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
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the finished file.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    window.location.href = `/received-files/${jobId}`;
  };

  return (
    <div className="staff-page-shell">
      <Sidebar />
      <main className="staff-main">
        <div className="staff-toolbar">
          <button className="back-button" onClick={goBack}>
            <ArrowLeft size={18} /> Back to job
          </button>
          {item && (
            <span className={item.edit_status === "FINISHED" ? "status-pill done" : "status-pill"}>
              {item.edit_status === "FINISHED" ? "FINISHED VERSION SAVED" : "CUSTOMIZATION WORKSPACE"}
            </span>
          )}
        </div>

        {loading ? (
          <section className="loading-card">
            <LoaderCircle className="spin" size={30} />
            <strong>Loading editing workspace…</strong>
          </section>
        ) : !item ? (
          <section className="empty-card">
            <FileText size={42} />
            <h1>File not found</h1>
            <p>{error || "This file may have been removed."}</p>
          </section>
        ) : (
          <>
            <section className="hero-card">
              <div>
                <span className="eyebrow">STAFF FILE EDITING</span>
                <h1>Customize and re-upload</h1>
                <p>Open the customer’s original file, edit it in Word or another application, then upload the finished version back into this job.</p>
              </div>
              <div className="job-summary">
                <small>JOB</small>
                <strong>{item.received_file_jobs?.reference_no || item.job_id}</strong>
                <span>{item.received_file_jobs?.customer_name || "Customer file"}</span>
              </div>
            </section>

            <section className="edit-grid">
              <article className="workspace-card">
                <span className="eyebrow">1 · ORIGINAL CUSTOMER FILE</span>
                <div className="file-icon"><FileText size={30} /></div>
                <h2>{item.original_name}</h2>
                <p>{item.mime_type || "Unknown file type"} · {formatBytes(Number(item.size_bytes || 0))}</p>
                <div className="action-row">
                  <button onClick={() => openStoredFile(item.storage_path, item.original_name)}><ExternalLink size={17} /> Open original</button>
                  <button onClick={() => openStoredFile(item.storage_path, item.original_name, true)}><Download size={17} /> Download original</button>
                </div>
                <div className="tip-box">After downloading, staff can arrange a JPEG in Word, edit a document, resize content, or make other requested adjustments.</div>
              </article>

              <article className="workspace-card">
                <span className="eyebrow">2 · UPLOAD FINISHED VERSION</span>
                <h2>Save the final working file</h2>
                <p>Choose the file after all editing and customer-requested adjustments are complete.</p>

                <input
                  ref={inputRef}
                  id="finished-file-input"
                  className="hidden-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
                  onChange={onFileSelected}
                />
                <label htmlFor="finished-file-input" className="upload-zone">
                  <Upload size={30} />
                  <strong>{selectedFile ? selectedFile.name : "Choose finished file"}</strong>
                  <span>{selectedFile ? `${formatBytes(selectedFile.size)} ready to save` : "PDF, Word, Excel, PowerPoint, JPG or PNG"}</span>
                </label>

                {item.final_storage_path && (
                  <div className="finished-box">
                    <div className="finished-info">
                      <FileCheck2 size={21} />
                      <span>
                        <strong>Current finished version</strong>
                        <small>{item.final_name || "Finished file"} · {formatBytes(Number(item.final_size_bytes || 0))}</small>
                      </span>
                    </div>
                    <div className="action-row compact">
                      <button onClick={() => openStoredFile(item.final_storage_path, item.final_name || "finished-file")}>Open</button>
                      <button onClick={() => openStoredFile(item.final_storage_path, item.final_name || "finished-file", true)}>Download</button>
                    </div>
                  </div>
                )}

                {error && <div className="error-box">{error}</div>}
                {message && <div className="success-box"><CheckCircle2 size={18} /> {message}</div>}

                <div className="save-row">
                  <button className="save-button" disabled={!selectedFile || saving} onClick={saveFinishedFile}>
                    <Save size={18} /> {saving ? "SAVING..." : item.final_storage_path ? "REPLACE FINISHED FILE" : "SAVE FINISHED FILE"}
                  </button>
                </div>
              </article>
            </section>

            <section className="next-card">
              <CheckCircle2 size={23} />
              <div>
                <span className="eyebrow">NEXT</span>
                <strong>Return to the job and configure printing</strong>
                <p>Once the finished file is saved, continue with paper size, quality, color, ink coverage, quantity, price calculation, and Add Job to POS.</p>
              </div>
              <button className="return-button" onClick={goBack}>RETURN TO JOB</button>
            </section>
          </>
        )}
      </main>

      <style jsx global>{`
        .staff-page-shell{min-height:100vh;background:#f4f6f8;display:flex}.staff-main{flex:1;min-width:0;padding:28px 32px 40px;max-width:1500px}.staff-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px}.back-button,.action-row button,.return-button{border:1px solid #dfe4e8;background:#fff;border-radius:11px;padding:11px 15px;color:#353b42;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.status-pill{border-radius:999px;background:#fff1df;color:#a9650b;padding:8px 11px;font-size:11px;font-weight:850;letter-spacing:.04em}.status-pill.done{background:#e9f8ef;color:#237247}.hero-card,.workspace-card,.next-card,.loading-card,.empty-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.hero-card{padding:26px 28px;margin:18px 0;display:flex;align-items:center;justify-content:space-between;gap:24px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:850;color:#a52a2a}.hero-card h1{margin:7px 0;color:#2d3339;font-size:31px}.hero-card p,.workspace-card>p,.next-card p{margin:0;color:#737b83;line-height:1.55}.job-summary{min-width:220px;padding:15px 17px;border:1px solid #eceff1;border-radius:14px;background:#fafbfb}.job-summary small,.job-summary span{display:block;color:#7c838a;font-size:12px}.job-summary strong{display:block;color:#33393f;margin:5px 0}.edit-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:18px}.workspace-card{padding:25px}.workspace-card h2{margin:8px 0 5px;color:#33383e}.file-icon{width:62px;height:62px;border-radius:16px;background:#fff0f0;color:#c12626;display:grid;place-items:center;margin:22px 0 12px}.action-row{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.compact{margin-top:0}.tip-box{margin-top:20px;padding:13px 14px;border-radius:12px;background:#f7fafc;border:1px solid #e5eaee;color:#687078;font-size:13px;line-height:1.5}.hidden-input{display:none}.upload-zone{margin-top:20px;min-height:210px;border:2px dashed #d6dde2;border-radius:16px;background:#fafbfc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:24px;cursor:pointer;color:#a52a2a}.upload-zone strong{color:#394047;font-size:17px}.upload-zone span{color:#7b838a;font-size:13px}.finished-box{margin-top:16px;padding:14px;border:1px solid #d7eadf;background:#f5fbf7;border-radius:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.finished-info{display:flex;align-items:center;gap:10px;color:#237247}.finished-info span strong,.finished-info span small{display:block}.finished-info span small{margin-top:3px;color:#718078;font-size:12px}.error-box,.success-box{margin-top:15px;padding:12px 13px;border-radius:11px;font-size:13px}.error-box{background:#fff0f0;color:#b12626}.success-box{background:#eaf8ef;color:#28744a;display:flex;align-items:flex-start;gap:8px}.save-row{display:flex;justify-content:flex-end;margin-top:18px}.save-button{border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:13px 17px;font-weight:850;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.save-button:disabled{opacity:.55;cursor:not-allowed}.next-card{margin-top:18px;padding:20px 22px;display:flex;align-items:center;gap:14px;color:#c90f0f}.next-card>div{flex:1}.next-card strong{display:block;color:#353b42;margin:4px 0}.return-button{border-color:#c90f0f;color:#c90f0f}.loading-card,.empty-card{margin-top:24px;padding:80px 24px;text-align:center;color:#626b73;display:flex;flex-direction:column;align-items:center;gap:12px}.empty-card h1{margin:0;color:#33383e}.spin{animation:staffspin 1s linear infinite}@keyframes staffspin{to{transform:rotate(360deg)}}@media(max-width:900px){.staff-main{padding:20px}.hero-card,.next-card{align-items:flex-start;flex-direction:column}.edit-grid{grid-template-columns:1fr}.job-summary{width:100%}.next-card .return-button{width:100%;justify-content:center}}@media(max-width:560px){.staff-main{padding:14px}.staff-toolbar{align-items:flex-start;flex-direction:column}.hero-card,.workspace-card{padding:20px}.hero-card h1{font-size:26px}.action-row button{width:100%;justify-content:center}.finished-box{align-items:flex-start;flex-direction:column}.save-button{width:100%;justify-content:center}}
      `}</style>
    </div>
  );
}
