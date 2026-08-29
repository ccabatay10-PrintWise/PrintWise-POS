"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, Download, ExternalLink, FileText, FolderOpen, LoaderCircle, Mail, MessageSquare, Palette, Printer, RefreshCw, Settings2, ShoppingCart, Sparkles, UserRound } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import "../../pos/pos.css";

type FileItem={id:string;original_name:string;storage_path:string;mime_type:string;size_bytes:number};
type Job={id:string;reference_no:string;customer_name:string;contact_number:string;email:string|null;status:string;created_at:string;received_file_items?:FileItem[]};
type FileSetup={mode:"PRINT"|"EDIT"|"SKIP";paperSize:string;paperQuality:string;colorMode:string;inkCoverage:string;sides:string;copies:number;pages:number;smartPrice?:number;smartApplied?:boolean};
type POSHandoff={jobId:string;referenceNo:string;customerName:string;contactNumber:string;items:Array<{id:string;name:string;price:number;quantity:number}>};
type SmartTransfer={fileId:string;jobId?:string;analysis?:{pages?:number;paper?:string;bwLight?:number;bwMedium?:number;bwHeavy?:number;colorLight?:number;colorMedium?:number;colorHeavy?:number};copies?:number;computation?:{suggested?:number};usedAt?:string};

const statuses=["RECEIVED","REVIEWING","PROCESSING","READY","COMPLETED"];
const defaultSetup=():FileSetup=>({mode:"PRINT",paperSize:"A4",paperQuality:"Standard",colorMode:"Black & White",inkCoverage:"Normal",sides:"Single-sided",copies:1,pages:1});
const formatBytes=(bytes:number)=>{if(!bytes)return "0 KB";const u=["B","KB","MB","GB"];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1);return `${(bytes/Math.pow(1024,i)).toFixed(i===0?0:1)} ${u[i]}`};
const money=(value:number)=>`₱${Number(value||0).toFixed(2)}`;

export default function ReceivedFileJobPage(){
 const params=useParams<{id:string}>();
 const jobId=Array.isArray(params.id)?params.id[0]:params.id;
 const [job,setJob]=useState<Job|null>(null);
 const [loading,setLoading]=useState(true);
 const [updating,setUpdating]=useState(false);
 const [sendingToPOS,setSendingToPOS]=useState(false);
 const [error,setError]=useState("");
 const [activeFileId,setActiveFileId]=useState<string|null>(null);
 const [setups,setSetups]=useState<Record<string,FileSetup>>({});

 const smartSetupFor=(fileId:string):Partial<FileSetup>|null=>{
  if(typeof window==="undefined")return null;
  try{
   const raw=sessionStorage.getItem(`printwise-smart-price-${fileId}`);
   if(!raw)return null;
   const transfer=JSON.parse(raw) as SmartTransfer;
   const suggested=Number(transfer?.computation?.suggested||0);
   if(transfer.fileId!==fileId||!Number.isFinite(suggested)||suggested<=0)return null;
   const a=transfer.analysis||{};
   const paper=["A4","Letter","Legal"].includes(String(a.paper))?String(a.paper):"A4";
   const colorTotal=Number(a.colorLight||0)+Number(a.colorMedium||0)+Number(a.colorHeavy||0);
   const coverage=[
    ["Heavy",Math.max(Number(a.bwHeavy||0),Number(a.colorHeavy||0))],
    ["Medium",Math.max(Number(a.bwMedium||0),Number(a.colorMedium||0))],
    ["Light",Math.max(Number(a.bwLight||0),Number(a.colorLight||0))]
   ].find(([,count])=>count>0)?.[0] as string|undefined;
   return {mode:"PRINT",paperSize:paper,colorMode:colorTotal>0?"Colored":"Black & White",inkCoverage:coverage||"Normal",pages:Math.max(1,Number(a.pages)||1),copies:Math.max(1,Number(transfer.copies)||1),smartPrice:Number(suggested.toFixed(2)),smartApplied:true};
  }catch{return null;}
 };

 const loadJob=useCallback(async()=>{
  if(!jobId){setError("Invalid file job ID.");setLoading(false);return;}
  setLoading(true);setError("");
  const {data,error:loadError}=await supabase.from("received_file_jobs").select("id, reference_no, customer_name, contact_number, email, status, created_at, received_file_items(id, original_name, storage_path, mime_type, size_bytes)").eq("id",jobId).single();
  if(loadError){setError(loadError.message||"Unable to load this file job.");setLoading(false);return;}
  const next=data as Job;
  const nextSetups:Record<string,FileSetup>={};
  (next.received_file_items??[]).forEach(file=>{
   const smart=smartSetupFor(file.id);
   nextSetups[file.id]={...defaultSetup(),...(smart||{})};
  });
  setJob(next);setSetups(nextSetups);setActiveFileId((next.received_file_items??[])[0]?.id??null);setLoading(false);
 },[jobId]);
 useEffect(()=>{loadJob()},[loadJob]);

 const updateStatus=async(status:string)=>{
  if(!job||status===job.status)return;
  setUpdating(true);setError("");
  const {error:e}=await supabase.from("received_file_jobs").update({status}).eq("id",job.id);
  if(e)setError(e.message||"Unable to update the job status.");else setJob({...job,status});
  setUpdating(false);
 };
 const openFile=async(file:FileItem,download=false)=>{
  const {data,error:e}=await supabase.storage.from("received-files").createSignedUrl(file.storage_path,900,download?{download:file.original_name}:undefined);
  if(e||!data?.signedUrl){setError(e?.message||"Unable to open this file.");return;}
  window.open(data.signedUrl,"_blank","noopener,noreferrer");
 };
 const goToSmartPricing=(file:FileItem)=>{
  if(!job)return;
  const q=new URLSearchParams({fileId:file.id,name:file.original_name});
  window.location.href=`/received-files/${job.id}/smart-pricing?${q.toString()}`;
 };
 const updateSetup=(id:string,patch:Partial<FileSetup>)=>setSetups(current=>{
  const currentSetup=current[id]??defaultSetup();
  const changes=Object.keys(patch);
  const manualChange=changes.some(key=>!["mode"].includes(key));
  return {...current,[id]:{...currentSetup,...patch,...(manualChange?{smartPrice:undefined,smartApplied:false}:{})}};
 });
 const estimateFile=(s?:FileSetup)=>{
  if(!s||s.mode!=="PRINT")return 0;
  if(s.smartApplied&&Number(s.smartPrice)>0)return Number(s.smartPrice);
  let rate=s.colorMode==="Colored"?8:2;
  if(s.paperSize==="Legal")rate+=1.5;if(s.paperSize==="Letter")rate+=.5;if(s.paperQuality==="Premium")rate+=2;if(s.paperQuality==="Photo")rate+=8;
  if(s.inkCoverage==="Heavy")rate+=s.colorMode==="Colored"?3:1;if(s.inkCoverage==="Light")rate-=.25;if(s.sides==="Double-sided")rate+=.75;
  return Math.max(rate,0)*Math.max(s.pages,1)*Math.max(s.copies,1);
 };
 const files=job?.received_file_items??[];
 const totalSize=useMemo(()=>files.reduce((sum,file)=>sum+Number(file.size_bytes||0),0),[files]);
 const estimatedTotal=useMemo(()=>Object.values(setups).reduce((sum,setup)=>sum+estimateFile(setup),0),[setups]);
 const printableCount=useMemo(()=>Object.values(setups).filter(setup=>setup.mode==="PRINT").length,[setups]);
 const smartAppliedCount=useMemo(()=>Object.values(setups).filter(setup=>setup.smartApplied&&setup.mode==="PRINT").length,[setups]);

 const sendToPOS=async()=>{
  if(!job)return;
  const items=files.map(file=>{
   const setup=setups[file.id]??defaultSetup();const price=estimateFile(setup);
   return setup.mode==="PRINT"&&price>0?{id:`received-file-${job.id}-${file.id}`,name:`Print: ${file.original_name}`,price:Number(price.toFixed(2)),quantity:1}:null;
  }).filter(Boolean) as POSHandoff["items"];
  if(!items.length){setError("Choose at least one file to print before adding this job to the POS.");return;}
  setSendingToPOS(true);setError("");
  try{
   sessionStorage.setItem("printwise_received_file_cart",JSON.stringify({jobId:job.id,referenceNo:job.reference_no,customerName:job.customer_name,contactNumber:job.contact_number,items} satisfies POSHandoff));
   const {error:e}=await supabase.from("received_file_jobs").update({status:"PROCESSING"}).eq("id",job.id);
   if(e)throw e;
   window.location.href="/pos";
  }catch(e:any){setError(e?.message||"Unable to add this file job to the POS.");setSendingToPOS(false);}
 };

 if(loading)return <div className="app-shell received-shell"><Sidebar/><main className="received-main"><div className="job-loading"><LoaderCircle className="spin" size={30}/><b>Loading file job…</b></div></main><style jsx global>{styles}</style></div>;
 if(!job)return <div className="app-shell received-shell"><Sidebar/><main className="received-main"><button className="back-btn" onClick={()=>window.location.href="/received-files"}><ArrowLeft size={18}/> Back to Received Files</button><div className="job-empty"><FolderOpen size={38}/><h1>Job not found</h1><p>{error||"This file job may have been removed."}</p></div></main><style jsx global>{styles}</style></div>;
 const date=new Date(job.created_at).toLocaleString(undefined,{month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});

 return <div className="app-shell received-shell"><Sidebar/><main className="received-main">
  <div className="job-topbar"><button className="back-btn" onClick={()=>window.location.href="/received-files"}><ArrowLeft size={18}/> Back to Received Files</button><button className="refresh-btn" onClick={loadJob}><RefreshCw size={17}/> Refresh</button></div>
  <section className="job-hero"><div><span className="eyebrow">INCOMING FILE JOB</span><h1>{job.reference_no}</h1><p>Received {date}</p></div><span className={`status ${job.status.toLowerCase()}`}>{job.status.replaceAll("_"," ")}</span></section>
  <section className="job-grid"><article className="job-card customer-card"><span className="mini-label">CUSTOMER DETAILS</span><div className="customer-row"><span className="detail-icon"><UserRound size={20}/></span><div><small>Customer Name</small><b>{job.customer_name}</b></div></div><div className="customer-row"><span className="detail-icon"><Mail size={20}/></span><div><small>Email</small><b>{job.email||"No email provided"}</b></div></div></article><article className="job-card workflow-card"><span className="mini-label">JOB WORKFLOW</span><h2>Update job status</h2><p>Move the submission through the file processing workflow.</p><div className="workflow-buttons">{statuses.map(status=><button key={status} className={job.status===status?"active":""} disabled={updating} onClick={()=>updateStatus(status)}>{status}</button>)}</div><button className="customer-updates-btn" onClick={()=>window.location.href=`/received-files/${job.id}/updates`}><MessageSquare size={18}/> CUSTOMER UPDATES</button><span className="customer-updates-hint">Send, save and review customer notifications.</span>{error&&<div className="job-error">{error}</div>}</article></section>
  <section className="job-card files-card"><div className="files-head"><div><span className="mini-label">STEP 3 · FILE PROCESSING</span><h2>Review and configure submitted files</h2><p>{files.length} file{files.length===1?"":"s"} · {formatBytes(totalSize)} total size</p></div><div className="estimate-total"><small>Current estimated total</small><b>{money(estimatedTotal)}</b></div></div><div className="processing-note"><Settings2 size={19}/><span>{smartAppliedCount>0?`${smartAppliedCount} file${smartAppliedCount===1?"":"s"} currently use the exact Smart Price suggested by the pricing engine.`:"Choose what happens to each file. Smart Pricing automatically carries the exact file you selected into the next processing phase."}</span></div><div className="processing-list">{files.map((file,index)=>{const s=setups[file.id]??defaultSetup();const isOpen=activeFileId===file.id;const est=estimateFile(s);return <article className={`processing-file ${isOpen?"open":""}`} key={file.id}><button className="processing-file-head" onClick={()=>setActiveFileId(isOpen?null:file.id)}><span className="file-number">{index+1}</span><span className="file-icon"><FileText size={20}/></span><span className="file-title"><b>{file.original_name}</b><small>{file.mime_type||"Unknown file type"} · {formatBytes(Number(file.size_bytes||0))}</small></span><span className="file-estimate">{s.mode==="PRINT"?`${money(est)} est.`:s.mode==="EDIT"?"Needs editing":"Skipped"}</span><ChevronDown size={20} className={isOpen?"chevron open":"chevron"}/></button>{isOpen&&<div className="processing-body"><div className="file-actions"><button onClick={()=>openFile(file)}><ExternalLink size={17}/> Open</button><button onClick={()=>openFile(file,true)}><Download size={17}/> Download</button><button className="smart-pricing-btn" onClick={()=>goToSmartPricing(file)}><Sparkles size={17}/> Smart Pricing</button></div>{s.smartApplied&&<div className="smart-applied"><CheckCircle2 size={18}/><div><b>Smart Price Applied</b><span>The exact suggested price from the Smart Pricing engine is now being used for this file: <strong>{money(est)}</strong>.</span></div></div>}<div className="mode-switch"><button className={s.mode==="PRINT"?"selected":""} onClick={()=>updateSetup(file.id,{mode:"PRINT"})}><Printer size={18}/> Print Directly</button><button className={s.mode==="EDIT"?"selected":""} onClick={()=>updateSetup(file.id,{mode:"EDIT"})}><FileText size={18}/> Edit / Customize First</button><button className={s.mode==="SKIP"?"selected muted":"muted"} onClick={()=>updateSetup(file.id,{mode:"SKIP"})}>Skip File</button></div>{s.mode==="PRINT"&&<div className="setup-grid"><label>Paper Size<select value={s.paperSize} onChange={e=>updateSetup(file.id,{paperSize:e.target.value})}><option>A4</option><option>Letter</option><option>Legal</option></select></label><label>Paper Quality<select value={s.paperQuality} onChange={e=>updateSetup(file.id,{paperQuality:e.target.value})}><option>Standard</option><option>Premium</option><option>Photo</option></select></label><label><Palette size={15}/> Print Color<select value={s.colorMode} onChange={e=>updateSetup(file.id,{colorMode:e.target.value})}><option>Black & White</option><option>Colored</option></select></label><label>Ink Coverage<select value={s.inkCoverage} onChange={e=>updateSetup(file.id,{inkCoverage:e.target.value})}><option>Light</option><option>Normal</option><option>Heavy</option></select></label><label>Print Sides<select value={s.sides} onChange={e=>updateSetup(file.id,{sides:e.target.value})}><option>Single-sided</option><option>Double-sided</option></select></label><label>Estimated Pages<input type="number" min="1" value={s.pages} onChange={e=>updateSetup(file.id,{pages:Math.max(1,Number(e.target.value)||1)})}/></label><label>Quantity / Copies<input type="number" min="1" value={s.copies} onChange={e=>updateSetup(file.id,{copies:Math.max(1,Number(e.target.value)||1)})}/></label><div className="file-price-box"><small>{s.smartApplied?"Smart Price":"Live estimate"}</small><b>{money(est)}</b><span>{s.pages} page{s.pages===1?"":"s"} × {s.copies} cop{s.copies===1?"y":"ies"}</span></div></div>}{s.mode==="EDIT"&&<div className="edit-guide"><FileText size={22}/><div><b>Customization required</b><p>Download the original file, edit or arrange it in Word or another application, then re-upload the finished version in the next processing step.</p></div></div>}{s.mode==="SKIP"&&<div className="skip-guide">This file will not be included in the print calculation or the POS cart.</div>}</div>}</article>})}</div></section>
  <section className="next-phase-card"><CheckCircle2 size={22}/><div><span className="mini-label">READY FOR PAYMENT</span><b>{printableCount} printable file{printableCount===1?"":"s"} ready to send to the POS.</b><p>The calculated print items, including any Smart Price transfers, will be added to the POS cart under <strong>{job.customer_name}</strong>.</p></div><div className="next-total"><small>Job total</small><strong>{money(estimatedTotal)}</strong></div><button className="send-pos-btn" disabled={sendingToPOS||printableCount===0||estimatedTotal<=0} onClick={sendToPOS}><ShoppingCart size={18}/> {sendingToPOS?"ADDING...":"ADD JOB TO POS"}</button></section>
 </main><style jsx global>{styles}</style></div>;
}

const styles=`
.received-shell{min-height:100vh;background:#f4f6f8}.received-main{width:100%;max-width:1600px;padding:28px 32px 40px;min-width:0}.job-topbar,.job-hero,.files-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.back-btn,.refresh-btn{border:1px solid #dfe3e7;background:#fff;border-radius:11px;padding:11px 15px;color:#373b40;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.job-topbar{margin-bottom:18px}.job-hero,.job-card,.next-phase-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;box-shadow:0 10px 30px rgba(26,36,46,.05)}.job-hero{padding:26px 28px;margin-bottom:18px}.eyebrow,.mini-label{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.job-hero h1{margin:6px 0;font-size:31px;color:#292d32}.job-hero p,.workflow-card p,.files-head p{margin:0;color:#747a81}.status{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:850;letter-spacing:.04em}.status.received{background:#fff0df;color:#b66408}.status.reviewing,.status.processing{background:#eef4ff;color:#2864b3}.status.ready,.status.completed{background:#e9f8ef;color:#237247}.job-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:18px;margin-bottom:18px}.job-card{padding:24px}.customer-card{display:flex;flex-direction:column;gap:17px}.customer-row{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #eef1f3}.customer-row small{display:block;color:#81878e;font-size:12px;margin-bottom:4px}.customer-row b{color:#353a40}.detail-icon,.file-icon{width:42px;height:42px;border-radius:12px;background:#fbefef;color:#c12626;display:grid;place-items:center;flex:0 0 auto}.workflow-card h2,.files-head h2{margin:7px 0 5px;color:#2f3439}.workflow-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.workflow-buttons button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:800;color:#555c63;cursor:pointer}.workflow-buttons button.active{background:#c90f0f;border-color:#c90f0f;color:#fff}.workflow-buttons button:disabled{opacity:.65}.customer-updates-btn{margin-top:14px;width:100%;border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:13px 16px;font-weight:850;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}.customer-updates-hint{display:block;margin-top:7px;text-align:center;color:#7b8288;font-size:11px}.job-error{margin-top:14px;padding:10px 12px;border-radius:10px;background:#fff0f0;color:#b12626;font-size:13px}.files-card{padding:0;overflow:hidden}.files-head{padding:24px 26px;border-bottom:1px solid #e9edf0}.estimate-total{min-width:180px;padding:12px 16px;border-radius:13px;background:#fff8f8;border:1px solid #f1d8d8;text-align:right}.estimate-total small,.file-price-box small,.next-total small{display:block;color:#747a81;font-size:11px;font-weight:750}.estimate-total b,.file-price-box b,.next-total strong{display:block;color:#c90f0f;font-size:22px;margin-top:3px}.processing-note{display:flex;align-items:flex-start;gap:10px;margin:18px 26px;padding:13px 15px;background:#f8fafb;border:1px solid #e8ecef;border-radius:12px;color:#60676e;font-size:13px;line-height:1.5}.processing-note svg{color:#c90f0f;flex:0 0 auto}.processing-list{padding:0 26px 26px}.processing-file{border:1px solid #e4e8eb;border-radius:14px;margin-top:12px;overflow:hidden;background:#fff}.processing-file.open{border-color:#edcaca;box-shadow:0 8px 24px rgba(120,25,25,.05)}.processing-file-head{width:100%;display:flex;align-items:center;gap:12px;text-align:left;border:0;background:#fff;padding:15px 16px;cursor:pointer}.file-number{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#f4f5f6;color:#737980;font-size:11px;font-weight:850;flex:0 0 auto}.file-title{min-width:0;flex:1}.file-title b{display:block;color:#343a40;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.file-title small{display:block;color:#81878e;font-size:12px;margin-top:4px}.file-estimate{font-size:12px;font-weight:800;color:#8b5151;white-space:nowrap}.chevron{color:#7a8086;transition:.2s}.chevron.open{transform:rotate(180deg)}.processing-body{border-top:1px solid #edf0f2;padding:18px}.file-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.file-actions button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 13px;display:inline-flex;align-items:center;gap:7px;font-weight:800;color:#41474d;cursor:pointer}.smart-pricing-btn{background:#ef1610!important;border-color:#ef1610!important;color:#fff!important}.smart-applied{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin-bottom:16px;border:1px solid #b9e3c6;background:#f0fff4;border-radius:12px;color:#237247}.smart-applied b{display:block;margin-bottom:3px}.smart-applied span{font-size:12px;color:#4d7257}.mode-switch{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}.mode-switch button{border:1px solid #dfe3e7;background:#fff;border-radius:10px;padding:10px 13px;font-weight:800;color:#535a61;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.mode-switch button.selected{background:#fdf0f0;border-color:#e4b7b7;color:#b52323}.mode-switch button.muted{color:#848a90}.setup-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.setup-grid label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#60676e}.setup-grid select,.setup-grid input{border:1px solid #dfe3e7;border-radius:9px;padding:10px;background:#fff;color:#3e444a}.file-price-box{border:1px solid #f0d6d6;background:#fff9f9;border-radius:10px;padding:11px}.file-price-box span{display:block;color:#777e85;font-size:11px;margin-top:4px}.edit-guide{display:flex;gap:12px;padding:15px;border-radius:12px;background:#f8fafb;color:#5e656c}.edit-guide p{margin:4px 0 0;font-size:13px}.skip-guide{padding:14px;border-radius:10px;background:#f7f7f7;color:#727980}.next-phase-card{margin-top:18px;padding:20px 24px;display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:16px}.next-phase-card>svg{color:#c90f0f}.next-phase-card p{margin:5px 0 0;color:#737a81;font-size:13px}.next-total{text-align:right}.send-pos-btn{border:0;border-radius:11px;background:#c90f0f;color:#fff;padding:13px 17px;font-weight:850;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.send-pos-btn:disabled{opacity:.55;cursor:not-allowed}.job-loading,.job-empty{min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#747a81}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1100px){.setup-grid{grid-template-columns:repeat(2,1fr)}.next-phase-card{grid-template-columns:auto 1fr}.next-total,.send-pos-btn{grid-column:2}}@media(max-width:760px){.received-main{padding:20px 14px}.job-grid{grid-template-columns:1fr}.job-topbar,.job-hero,.files-head{align-items:flex-start;flex-direction:column}.estimate-total{width:100%;text-align:left}.setup-grid{grid-template-columns:1fr}.processing-list{padding:0 14px 18px}.processing-note{margin:14px}.file-estimate{display:none}.next-phase-card{grid-template-columns:1fr}.next-total,.send-pos-btn{grid-column:auto;text-align:left;width:100%}.send-pos-btn{justify-content:center}}`;
