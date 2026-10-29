"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, RefreshCw, Gift, CheckCircle2, Users, Award } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "../pos/pos.css";

type Member = { id:string; loyalty_no:string; full_name:string; phone:string; stamps:number; free_drinks_redeemed:number; is_active:boolean; created_at:string };
const peso=(n:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(n);

export default function LoyaltyPage(){
 const [members,setMembers]=useState<Member[]>([]);
 const [search,setSearch]=useState("");
 const [name,setName]=useState("");
 const [phone,setPhone]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [selected,setSelected]=useState("");
 const [redeeming,setRedeeming]=useState(false);
 const [orderNo,setOrderNo]=useState("");const [stamping,setStamping]=useState(false);
 const request=async(path:string,options:RequestInit={})=>{
  const {data}=await supabase.auth.getSession(); const token=data.session?.access_token;
  if(!token) throw new Error("Please sign in again.");
  const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(options.headers||{})},cache:"no-store"});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload.error||"Loyalty request failed.");
  return payload;
 };
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const payload=await request("/api/loyalty");setMembers(payload.members||[]);}
  catch(e){setError(e instanceof Error?e.message:"Unable to load loyalty members.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const register=async(e:React.FormEvent)=>{
  e.preventDefault();setSaving(true);setError("");setMessage("");
  try{const payload=await request("/api/loyalty",{method:"POST",body:JSON.stringify({action:"register",fullName:name,phone})});setMembers(prev=>[payload.member,...prev]);setSelected(payload.member.id);setName("");setPhone("");setMessage(`Member registered: ${payload.member.loyalty_no}`);}
  catch(e){setError(e instanceof Error?e.message:"Unable to register member.");}
  finally{setSaving(false);}
 };
 const redeem=async()=>{
  if(!selected)return;setRedeeming(true);setError("");setMessage("");
  try{const payload=await request("/api/loyalty",{method:"POST",body:JSON.stringify({action:"redeem",memberId:selected})});setMembers(prev=>prev.map(m=>m.id===payload.member.id?payload.member:m));setMessage(`Free drink redemption recorded for ${payload.member.full_name}.`);}
  catch(e){setError(e instanceof Error?e.message:"Unable to redeem reward.");}
  finally{setRedeeming(false);}
 };
 const addMissedStamp=async()=>{if(!selected){setError("Select the customer first.");return;}if(!orderNo.trim()){setError("Enter the completed POS order number.");return;}setStamping(true);setError("");setMessage("");try{const payload=await request("/api/loyalty",{method:"POST",body:JSON.stringify({action:"manual_stamp",memberId:selected,orderNo:orderNo.trim()})});if(payload.member)setMembers(prev=>prev.map(m=>m.id===payload.member.id?payload.member:m));setOrderNo("");setMessage(payload.freeDrinkEarned?"Stamp added for "+payload.orderNo+". "+payload.member.full_name+" has earned a free drink!":"Missing stamp added for POS order "+payload.orderNo+".");}catch(e){setError(e instanceof Error?e.message:"Unable to add the missing stamp.");}finally{setStamping(false);}};
 const filtered=members.filter(m=>`${m.full_name} ${m.phone} ${m.loyalty_no}`.toLowerCase().includes(search.toLowerCase()));
 const selectedMember=members.find(m=>m.id===selected);
 return <main className="app-shell"><Sidebar/><section className="workspace" style={{padding:24,minWidth:0,width:"100%"}}>
  <header className="topbar"><div><div style={{fontSize:12,fontWeight:800,letterSpacing:1,color:"#b45309"}}>ESPACIO CAFÉ & RESTAURANT</div><h1>Loyalty Members</h1><p>Buy 9 qualifying transactions, get 1 free drink. One stamp per transaction.</p></div><button type="button" onClick={()=>void load()} disabled={loading} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:"1px solid #d7dee8",borderRadius:10,background:"#fff",fontWeight:700}}><RefreshCw size={16}/> Refresh</button></header>
  {message&&<div role="status" style={{margin:"12px 0",padding:12,borderRadius:10,background:"#ecfdf5",color:"#166534"}}><CheckCircle2 size={16} style={{display:"inline",verticalAlign:"middle",marginRight:8}}/>{message}</div>}
  {error&&<div role="alert" style={{margin:"12px 0",padding:12,borderRadius:10,background:"#fef2f2",color:"#991b1b"}}>{error}</div>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,margin:"18px 0"}}>
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:18}}><Users size={20}/><div style={{color:"#64748b",fontSize:13,marginTop:8}}>Registered members</div><strong style={{fontSize:28}}>{members.length}</strong></div>
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:18}}><Award size={20}/><div style={{color:"#64748b",fontSize:13,marginTop:8}}>Members ready for a free drink</div><strong style={{fontSize:28}}>{members.filter(m=>m.stamps>=9).length}</strong></div>
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:18}}><Gift size={20}/><div style={{color:"#64748b",fontSize:13,marginTop:8}}>Free drinks redeemed</div><strong style={{fontSize:28}}>{members.reduce((n,m)=>n+Number(m.free_drinks_redeemed||0),0)}</strong></div>
  </div>
  <div style={{display:"grid",gridTemplateColumns:"minmax(280px,350px) minmax(0,1fr)",gap:18,alignItems:"start"}}>
   <form onSubmit={register} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:20,display:"grid",gap:12}}>
    <h2 style={{fontSize:18,fontWeight:800,margin:0,display:"flex",alignItems:"center",gap:8}}><UserPlus size={19}/> Register member</h2>
    <label style={{fontSize:13,fontWeight:700}}>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Customer full name" style={{display:"block",width:"100%",padding:11,border:"1px solid #cbd5e1",borderRadius:9,marginTop:6}}/></label>
    <label style={{fontSize:13,fontWeight:700}}>Mobile number<input required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09XXXXXXXXX" inputMode="tel" style={{display:"block",width:"100%",padding:11,border:"1px solid #cbd5e1",borderRadius:9,marginTop:6}}/></label>
    <button disabled={saving} style={{padding:12,border:0,borderRadius:9,background:"#78350f",color:"#fff",fontWeight:800}}>{saving?"REGISTERING...":"REGISTER MEMBER"}</button>
    <p style={{fontSize:12,color:"#64748b",margin:0}}>A unique ESP loyalty number is generated automatically. Collect only information needed to run the program.</p>
   </form>
   <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:18,minWidth:0}}>
    <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:14}}><h2 style={{fontSize:18,fontWeight:800,margin:0}}>Member directory</h2><div style={{display:"flex",gap:8,alignItems:"center",border:"1px solid #cbd5e1",borderRadius:9,padding:"8px 10px"}}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, mobile, ID" style={{border:0,outline:0,minWidth:120}}/></div></div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Member","Stamps","Free drinks","Select"].map(t=><th key={t} style={{textAlign:"left",padding:"10px 8px",borderBottom:"1px solid #e2e8f0",color:"#64748b"}}>{t}</th>)}</tr></thead><tbody>
    {loading?<tr><td colSpan={4} style={{padding:24,textAlign:"center"}}>Loading members…</td></tr>:filtered.length===0?<tr><td colSpan={4} style={{padding:24,textAlign:"center",color:"#64748b"}}>No members found. Register your first loyalty member.</td></tr>:filtered.map(m=><tr key={m.id} style={{background:selected===m.id?"#fffbeb":"transparent"}}><td style={{padding:10,borderBottom:"1px solid #f1f5f9"}}><strong>{m.full_name}</strong><div style={{fontSize:11,color:"#64748b"}}>{m.loyalty_no} · {m.phone}</div></td><td style={{padding:10,borderBottom:"1px solid #f1f5f9"}}><strong>{m.stamps}/9</strong><div style={{display:"flex",gap:2,marginTop:5}}>{Array.from({length:9},(_,i)=><span key={i} style={{width:8,height:8,borderRadius:99,background:i<m.stamps?"#b45309":"#e2e8f0"}}/>)}</div></td><td style={{padding:10,borderBottom:"1px solid #f1f5f9"}}>{m.free_drinks_redeemed}</td><td style={{padding:10,borderBottom:"1px solid #f1f5f9"}}><button type="button" onClick={()=>setSelected(m.id)} style={{border:"1px solid #cbd5e1",borderRadius:7,padding:"6px 9px",background:"#fff"}}>{selected===m.id?"Selected":"Select"}</button></td></tr>)}
    </tbody></table></div>
    <div style={{marginTop:16,padding:14,background:"#fffbeb",borderRadius:10,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div><strong>{selectedMember?selectedMember.full_name:"Select a member"}</strong><div style={{fontSize:12,color:"#92400e"}}>{selectedMember?selectedMember.stamps>=9?"Reward ready — 9/9 stamps":`${selectedMember.stamps}/9 stamps collected`:"Select a member to redeem a reward."}</div></div><button type="button" disabled={!selectedMember||selectedMember.stamps<9||redeeming} onClick={()=>void redeem()} style={{padding:"10px 13px",border:0,borderRadius:9,background:selectedMember&&selectedMember.stamps>=9?"#78350f":"#cbd5e1",color:"#fff",fontWeight:800}}>{redeeming?"SAVING...":"REDEEM FREE DRINK"}</button></div><div style={{marginTop:12,padding:14,border:"1px solid #e2e8f0",borderRadius:10,display:"grid",gap:10}}><strong>Missed POS stamp? Add it from a completed order</strong><p style={{fontSize:12,color:"#64748b",margin:0}}>Select the customer above, then enter the completed POS order number. The same order cannot receive a second stamp.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input value={orderNo} onChange={e=>setOrderNo(e.target.value)} placeholder="POS order number (e.g. WISE-...)" style={{flex:"1 1 220px",minWidth:0,padding:11,border:"1px solid #cbd5e1",borderRadius:9}}/><button type="button" disabled={!selectedMember||!orderNo.trim()||stamping} onClick={()=>void addMissedStamp()} style={{padding:"10px 13px",border:0,borderRadius:9,background:"#1f4937",color:"#fff",fontWeight:800}}>{stamping?"UPDATING...":"ADD MISSED STAMP"}</button></div></div>
   </div>
  </div>
 </section></main>;
}
