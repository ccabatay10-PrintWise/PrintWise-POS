"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Clock3, RefreshCw, WalletCards, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./wise-menu-payment.css";

type WiseOrder = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; balance:number; notes:string|null; created_at:string };
const money=(v:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(v);
const channels=["Cash","GCash","Maya","Credit Card","eWallet"];

export default function WiseMenuPaymentModal(){
 const [orders,setOrders]=useState<WiseOrder[]>([]); const [open,setOpen]=useState(false); const [selected,setSelected]=useState<WiseOrder|null>(null); const [channel,setChannel]=useState("Cash"); const [paid,setPaid]=useState(0); const [loading,setLoading]=useState(false); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
 const load=async()=>{setLoading(true);setMessage("");try{const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)return;const r=await fetch("/api/pos/wise-menu",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const p=await r.json();if(!r.ok)throw new Error(p.error);setOrders(p.orders||[]);if((p.orders||[]).length)setOpen(true);}catch(e:any){setMessage(e?.message||"Unable to load WISE MENU orders.");}finally{setLoading(false)}};
 useEffect(()=>{load();const id=window.setInterval(load,30000);return()=>window.clearInterval(id)},[]);
 const select=(o:WiseOrder)=>{setSelected(o);setPaid(Number(o.total));setChannel("Cash");setMessage("")};
 const pay=async()=>{if(!selected)return;if(paid<Number(selected.total)){setMessage("Amount received is not enough.");return}setSaving(true);setMessage("");try{const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Your session has expired. Please sign in again.");const now=Date.now();const r=await fetch("/api/pos/wise-menu",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({posOrderId:selected.id,channel:channel.toLowerCase().replace(/\s+/g,"_"),amountPaid:paid,transactionNo:`WM-${now}-${Math.random().toString(36).slice(2,7).toUpperCase()}`})});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.error||"Payment failed.");setOrders(x=>x.filter(o=>o.id!==selected.id));setSelected(null);setMessage(`Payment completed for ${p.order_no}. Change: ${money(Number(p.change||0))}`);if(orders.length<=1)setOpen(false)}catch(e:any){setMessage(e?.message||"Unable to complete payment.")}finally{setSaving(false)}};
 return <>
  {orders.length>0&&<button className="wm-pay-bell" onClick={()=>setOpen(true)} title="WISE MENU orders"><BellRing size={19}/><span>{orders.length}</span></button>}
  {open&&<div className="wm-pay-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="wm-pay-modal">
   <header><div><h2>WISE MENU Orders</h2><p>Customer orders ready for cashier payment</p></div><button onClick={()=>setOpen(false)}><X size={20}/></button></header>
   {message&&<div className="wm-pay-message">{message}</div>}
   {!selected?<><div className="wm-pay-toolbar"><b>{orders.length} unpaid order{orders.length===1?"":"s"}</b><button onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button></div><div className="wm-pay-list">{orders.map(o=><button className="wm-pay-order" key={o.id} onClick={()=>select(o)}><div><strong>{o.order_no}</strong><span>{o.customer_name||"Walk-in customer"}</span><small><Clock3 size={13}/> {new Date(o.created_at).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</small></div><b>{money(Number(o.total))}</b></button>)}</div></>:<div className="wm-pay-checkout"><button className="wm-pay-back" onClick={()=>setSelected(null)}>← Back to orders</button><div className="wm-pay-summary"><div><span>Order</span><b>{selected.order_no}</b></div><div><span>Customer</span><b>{selected.customer_name||"Walk-in customer"}</b></div><div><span>Total</span><b>{money(Number(selected.total))}</b></div></div><label>Payment Method<select value={channel} onChange={e=>{setChannel(e.target.value);setPaid(Number(selected.total))}}>{channels.map(c=><option key={c}>{c}</option>)}</select></label><label>Amount Received<input type="number" min="0" step="0.01" value={paid} onChange={e=>setPaid(Number(e.target.value)||0)}/></label><div className="wm-pay-change"><span>Change</span><strong>{money(Math.max(0,paid-Number(selected.total)))}</strong></div><button className="wm-pay-submit" onClick={pay} disabled={saving}>{saving?<><RefreshCw className="spin" size={18}/> Processing...</>:<><CheckCircle2 size={18}/> Complete Payment</>}</button></div>}
  </section></div>}
 </>
}
