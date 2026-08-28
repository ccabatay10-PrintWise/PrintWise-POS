"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Bell, CheckCircle2, Clock3, Copy, LoaderCircle, RefreshCw, RotateCcw, Send, Smartphone, XCircle } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import { supabase } from "../../../../lib/supabase";
import "../../../pos/pos.css";

type Job = { id:string; reference_no:string; customer_name:string; contact_number:string; status:string; amount_paid:number|null; receipt_reference:string|null };
type Notice = { id:string; notification_type:string; recipient:string; message:string; status:string; sent_at:string|null; created_at:string; provider_message_id:string|null; error_message:string|null };

type SmsResponse = { ok?:boolean; status?:string; providerMessageId?:string|null; error?:string };

const template = (type:string, job:Job) => {
  const name = job.customer_name || "Customer";
  const ref = job.reference_no;
  const amount = Number(job.amount_paid || 0).toFixed(2);
  if(type === "PROCESSING") return `PrintWise: Hi ${name}! Your request ${ref} is now being processed. We will notify you once it is ready. Thank you!`;
  if(type === "READY") return `PrintWise: Good news, ${name}! Your request ${ref} is ready. Please visit PrintWise for pickup or payment. Thank you!`;
  if(type === "PAYMENT_COMPLETED") return `PrintWise: Thank you, ${name}! Your payment of ₱${amount} for request ${ref} has been received. Receipt No.: ${job.receipt_reference || "N/A"}. Thank you for choosing PrintWise!`;
  return `PrintWise: Hi ${name}! We have successfully received your file request. Reference No.: ${ref}. Our staff will review it shortly. Thank you!`;
};

export default function CustomerUpdatesPage(){
  const params = useParams<{id:string}>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [job,setJob]=useState<Job|null>(null); const [items,setItems]=useState<Notice[]>([]); const [loading,setLoading]=useState(true); const [type,setType]=useState("FILE_RECEIVED"); const [message,setMessage]=useState(""); const [sending,setSending]=useState(false); const [error,setError]=useState("");
  const load = useCallback(async()=>{ if(!jobId) return; setLoading(true); setError(""); const [{data:j,error:je},{data:n,error:ne}] = await Promise.all([supabase.from("received_file_jobs").select("id,reference_no,customer_name,contact_number,status,amount_paid,receipt_reference").eq("id",jobId).single(),supabase.from("customer_notifications").select("id,notification_type,recipient,message,status,sent_at,created_at,provider_message_id,error_message").eq("job_id",jobId).order("created_at",{ascending:false})]); if(je) setError(je.message); if(ne) setError(ne.message); if(j){ setJob(j as Job); setMessage(current=>current || template(type,j as Job)); } setItems((n||[]) as Notice[]); setLoading(false); },[jobId,type]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{if(job) setMessage(template(type,job))},[type,job]);

  const sendUpdate = async (resendOf?:Notice, override?:{type:string;message:string}) => {
    if(!job) return;
    const selectedType = override?.type || type;
    const selectedMessage = (override?.message ?? message).trim();
    if(!selectedMessage){ setError("Please enter a message first."); return; }
    if(!job.contact_number){ setError("This customer does not have a contact number."); return; }

    const recentDuplicate = items.find(n => n.notification_type === selectedType && n.message === selectedMessage && n.status !== "FAILED" && Date.now() - new Date(n.created_at).getTime() < 60000);
    if(recentDuplicate && !resendOf){ setError("This exact update was already sent recently. Please wait before sending it again."); return; }

    setSending(true); setError("");
    const {data:created,error:insertError}=await supabase.from("customer_notifications").insert({job_id:job.id,notification_type:selectedType,recipient:job.contact_number,message:selectedMessage,status:"READY",resend_of:resendOf?.id||null}).select().single();
    if(insertError || !created){ setError(insertError?.message || "Unable to create the SMS record."); setSending(false); return; }

    const notice = created as Notice;
    setItems(current=>[notice,...current]);
    try{
      const response = await fetch("/api/sms/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({number:job.contact_number,message:selectedMessage})});
      const result = await response.json() as SmsResponse;
      if(!response.ok || !result.ok) throw new Error(result.error || "SMS provider rejected the message.");
      const finalStatus = String(result.status || "QUEUED").toUpperCase();
      const {error:updateError}=await supabase.from("customer_notifications").update({status:finalStatus,provider_message_id:result.providerMessageId||null,sent_at:new Date().toISOString(),error_message:null}).eq("id",notice.id);
      if(updateError) throw new Error(updateError.message);
      setItems(current=>current.map(n=>n.id===notice.id?{...n,status:finalStatus,provider_message_id:result.providerMessageId||null,sent_at:new Date().toISOString(),error_message:null}:n));
    }catch(err){
      const failure = err instanceof Error ? err.message : "Unable to send SMS.";
      await supabase.from("customer_notifications").update({status:"FAILED",error_message:failure}).eq("id",notice.id);
      setItems(current=>current.map(n=>n.id===notice.id?{...n,status:"FAILED",error_message:failure}:n));
      setError(failure);
    }finally{ setSending(false); }
  };

  const copyMessage=async()=>{try{await navigator.clipboard.writeText(message)}catch{setError("Unable to copy the message on this device.")}};
  const statusIcon=(s:string)=> s==="SENT"?<CheckCircle2 size={18}/>:s==="FAILED"?<XCircle size={18}/>:<Clock3 size={18}/>;
  if(loading) return <div className="app-shell"><Sidebar/><main className="updates-main"><div className="updates-loading"><LoaderCircle className="spin"/> Loading customer updates…</div></main></div>;
  return <div className="app-shell"><Sidebar/><main className="updates-main">
    <div className="updates-top"><button onClick={()=>window.location.href=`/received-files/${jobId}`}><ArrowLeft size={18}/> Back to Job</button><button onClick={load}><RefreshCw size={17}/> Refresh</button></div>
    <section className="updates-hero"><div><span>CUSTOMER UPDATES</span><h1>{job?.reference_no||"Received File Job"}</h1><p>Send live SMS updates and track every customer notification in one timeline.</p></div><div className="sms-ready"><Smartphone size={20}/><div><b>LIVE SMS</b><small>Semaphore secure server connection</small></div></div></section>
    {error&&<div className="updates-error">{error}</div>}
    <div className="updates-grid"><section className="compose-card"><div className="card-head"><Bell size={20}/><div><b>Send Customer Update</b><small>Messages are sent by SMS and automatically recorded in the timeline.</small></div></div>
      <label>Customer<input value={job?.customer_name||""} disabled/></label><label>Contact Number<input value={job?.contact_number||""} disabled/></label>
      <label>Update Type<select value={type} onChange={e=>setType(e.target.value)}><option value="FILE_RECEIVED">File Received</option><option value="PROCESSING">Processing Update</option><option value="READY">Ready for Pickup</option><option value="PAYMENT_COMPLETED">Payment Completed</option></select></label>
      <label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={7}/></label>
      <div className="compose-actions"><button className="copy-btn" onClick={copyMessage}><Copy size={16}/> Copy Message</button><button className="send-btn" disabled={sending||!message.trim()} onClick={()=>sendUpdate()}><Send size={16}/>{sending?"SENDING...":"SEND SMS"}</button></div>
    </section>
    <section className="timeline-card"><div className="timeline-head"><div><b>Customer Updates Timeline</b><small>{items.length} update{items.length===1?"":"s"} recorded</small></div></div>
      <div className="timeline">{items.length===0?<div className="empty-timeline"><Bell size={30}/><b>No updates yet</b><span>Send the first customer SMS from the panel on the left.</span></div>:items.map(n=><article className="notice" key={n.id}><div className={`notice-icon ${n.status.toLowerCase()}`}>{statusIcon(n.status)}</div><div className="notice-body"><div className="notice-row"><b>{n.notification_type.replaceAll("_"," ")}</b><span className={`notice-status ${n.status.toLowerCase()}`}>{n.status}</span></div><p>{n.message}</p><small>To: {n.recipient} · {new Date(n.created_at).toLocaleString()}</small>{n.provider_message_id&&<small>Provider ID: {n.provider_message_id}</small>}{n.error_message&&<em>{n.error_message}</em>}</div><button className="resend-btn" disabled={sending} onClick={()=>sendUpdate(n,{type:n.notification_type,message:n.message})} title="Resend SMS"><RotateCcw size={16}/></button></article>)}</div>
    </section></div>
    <div className="phase-note">Phase 8B is active. The SMS API key stays on the server and is never exposed to the browser. Semaphore will return a provider message ID and initial delivery status for each successful send request.</div>
    <style jsx>{` .updates-main{width:100%;min-width:0;padding:28px 32px 40px;background:#f4f6f8}.updates-top,.updates-hero,.updates-grid,.compose-actions,.notice-row,.card-head{display:flex}.updates-top{justify-content:space-between;gap:10px;margin-bottom:18px}.updates-top button,.copy-btn,.resend-btn{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 14px;font-weight:750;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.updates-hero{justify-content:space-between;align-items:center;gap:20px;background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:26px 28px;margin-bottom:18px}.updates-hero span{font-size:11px;font-weight:850;letter-spacing:.14em;color:#a52a2a}.updates-hero h1{margin:7px 0;font-size:30px;color:#292d32}.updates-hero p,.card-head small,.timeline-head small{display:block;margin:0;color:#737980}.sms-ready{display:flex;gap:10px;align-items:center;padding:12px 15px;border:1px solid #d9eadf;background:#f4fbf6;border-radius:13px;color:#267047}.sms-ready small{display:block;font-size:11px;color:#66806f;margin-top:3px}.updates-grid{gap:18px;align-items:start}.compose-card,.timeline-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;padding:22px;box-shadow:0 10px 30px rgba(26,36,46,.04)}.compose-card{width:43%;min-width:360px}.timeline-card{flex:1}.card-head{gap:10px;margin-bottom:20px;color:#c90f0f}.card-head b{display:block;color:#30353a}.compose-card label{display:block;font-size:11px;font-weight:850;color:#626970;margin-top:13px}.compose-card input,.compose-card select,.compose-card textarea{box-sizing:border-box;width:100%;margin-top:7px;border:1px solid #dfe3e7;border-radius:10px;padding:10px 11px;font:inherit;color:#343a40;background:#fff}.compose-card input:disabled{background:#f7f8f9;color:#6e747a}.compose-card textarea{resize:vertical;line-height:1.5}.compose-actions{justify-content:flex-end;gap:9px;margin-top:16px}.send-btn{border:0;background:#c90f0f;color:#fff;border-radius:10px;padding:10px 15px;font-weight:850;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.send-btn:disabled,.resend-btn:disabled{opacity:.55;cursor:not-allowed}.timeline-head{padding-bottom:16px;border-bottom:1px solid #edf0f2}.timeline-head b{display:block;color:#30353a}.timeline{padding-top:8px}.notice{display:flex;gap:12px;align-items:flex-start;padding:16px 0;border-bottom:1px solid #eef1f3}.notice:last-child{border-bottom:0}.notice-icon{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#f2f4f6;color:#747b82;flex:0 0 auto}.notice-icon.sent{background:#eaf8ef;color:#287348}.notice-icon.failed{background:#fff0f0;color:#b32a2a}.notice-body{flex:1;min-width:0}.notice-row{justify-content:space-between;gap:10px}.notice-row b{font-size:13px;color:#343a40}.notice-status{font-size:10px;font-weight:850;padding:4px 8px;border-radius:999px;background:#f0f2f4;color:#697078}.notice-status.sent{background:#eaf8ef;color:#287348}.notice-status.failed{background:#fff0f0;color:#b32a2a}.notice-body p{font-size:13px;line-height:1.5;color:#555d64;margin:7px 0}.notice-body small{display:block;font-size:11px;color:#858b91;margin-top:3px}.notice-body em{display:block;color:#b32a2a;font-size:11px;margin-top:6px}.resend-btn{padding:8px;margin-top:1px}.empty-timeline{padding:50px 20px;text-align:center;color:#858b91;display:flex;flex-direction:column;align-items:center;gap:8px}.empty-timeline b{color:#4b5157}.updates-error{margin-bottom:14px;padding:12px 14px;background:#fff0f0;color:#b32a2a;border-radius:11px}.phase-note{margin-top:18px;padding:14px 16px;border:1px solid #dbe7f4;background:#f7fbff;border-radius:13px;color:#53687a;font-size:13px;line-height:1.5}@media(max-width:900px){.updates-main{padding:20px}.updates-grid{flex-direction:column}.compose-card{width:100%;min-width:0}.updates-hero{align-items:flex-start;flex-direction:column}.sms-ready{width:100%;box-sizing:border-box}}`}</style>
  </main></div>
}
