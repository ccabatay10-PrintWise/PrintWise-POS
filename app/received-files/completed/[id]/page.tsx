"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, CreditCard, FileText, LoaderCircle, ReceiptText, UserRound } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import { supabase } from "../../../../lib/supabase";
import "../../../pos/pos.css";

type Job = { id:string; reference_no:string; customer_name:string; contact_number:string; status:string; payment_status:string; payment_method:string|null; amount_paid:number|null; paid_at:string|null; pos_order_no:string|null; receipt_reference:string|null; created_at:string; received_file_items?: {id:string; original_name:string}[] };

export default function CompletedJobDetailPage() {
  const params = useParams<{id:string}>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job,setJob] = useState<Job|null>(null);
  const [loading,setLoading] = useState(true);

  useEffect(() => { if(!id) return; supabase.from("received_file_jobs").select("id,reference_no,customer_name,contact_number,status,payment_status,payment_method,amount_paid,paid_at,pos_order_no,receipt_reference,created_at,received_file_items(id,original_name)").eq("id",id).single().then(({data})=>{setJob(data as Job|null);setLoading(false);}); },[id]);

  if(loading) return <div className="app-shell"><Sidebar/><main className="detail-main"><div className="loading"><LoaderCircle className="spin" size={28}/><b>Loading completed job…</b></div></main></div>;
  if(!job) return <div className="app-shell"><Sidebar/><main className="detail-main"><button className="back" onClick={()=>history.back()}><ArrowLeft size={17}/>Back</button><div className="loading"><FileText size={34}/><b>Job not found</b></div></main></div>;
  const paidDate = job.paid_at ? new Date(job.paid_at).toLocaleString() : "Not recorded";

  return <div className="app-shell"><Sidebar/><main className="detail-main">
    <button className="back" onClick={()=>window.location.href="/received-files/completed"}><ArrowLeft size={17}/>Completed Jobs</button>
    <section className="detail-hero"><div><span>COMPLETED FILE JOB</span><h1>{job.reference_no}</h1><p>{job.customer_name} · {job.contact_number}</p></div><div className="paid-badge"><CheckCircle2 size={18}/>PAID & COMPLETED</div></section>
    <section className="detail-grid">
      <article className="detail-card"><span className="label">PAYMENT DETAILS</span><div className="metric"><CreditCard size={19}/><div><small>Amount Paid</small><b>₱{Number(job.amount_paid??0).toFixed(2)}</b></div></div><div className="metric"><ReceiptText size={19}/><div><small>Payment Method</small><b>{job.payment_method||"Not recorded"}</b></div></div><div className="metric"><CheckCircle2 size={19}/><div><small>Paid At</small><b>{paidDate}</b></div></div></article>
      <article className="detail-card"><span className="label">POS & RECEIPT</span><div className="metric"><FileText size={19}/><div><small>POS Order Number</small><b>{job.pos_order_no||"Not linked"}</b></div></div><div className="metric"><ReceiptText size={19}/><div><small>Receipt Reference</small><b>{job.receipt_reference||"Not linked"}</b></div></div><div className="metric"><UserRound size={19}/><div><small>Customer</small><b>{job.customer_name}</b></div></div></article>
    </section>
    <section className="files-card"><span className="label">COMPLETED FILES</span>{(job.received_file_items??[]).length===0?<p>No file records found.</p>:<div className="files-list">{job.received_file_items?.map((file,index)=><div key={file.id}><span>{index+1}</span><b>{file.original_name}</b></div>)}</div>}</section>
  </main><style jsx global>{`.detail-main{width:100%;max-width:1400px;padding:28px 32px;background:#f4f6f8;min-height:100vh}.back{display:inline-flex;align-items:center;gap:7px;border:0;background:transparent;color:#555;cursor:pointer;margin-bottom:16px}.detail-hero{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:28px;margin-bottom:18px}.detail-hero span,.label{font-size:11px;letter-spacing:.12em;font-weight:800;color:#a52a2a}.detail-hero h1{margin:6px 0;font-size:32px}.detail-hero p{margin:0;color:#6f7378}.paid-badge{display:flex;align-items:center;gap:8px;background:#e7f7ed;color:#237247;padding:11px 14px;border-radius:999px;font-size:12px;font-weight:850}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.detail-card,.files-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:22px}.metric{display:flex;gap:12px;align-items:center;padding:15px 0;border-bottom:1px solid #eef1f3;color:#a52a2a}.metric:last-child{border-bottom:0}.metric small{display:block;color:#777;font-size:12px;margin-bottom:3px}.metric b{color:#333}.files-card{margin-top:18px}.files-list{margin-top:14px}.files-list div{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #eef1f3}.files-list span{width:28px;height:28px;border-radius:8px;background:#fbefef;color:#b12424;display:grid;place-items:center;font-weight:800;font-size:12px}.loading{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#70777e}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:700px){.detail-main{padding:18px 12px}.detail-hero{align-items:flex-start;flex-direction:column;gap:15px}.detail-grid{grid-template-columns:1fr}}`}</style></div>;
}
