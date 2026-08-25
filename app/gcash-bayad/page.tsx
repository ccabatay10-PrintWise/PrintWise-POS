"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CreditCard, FileText, Layers3, Package, ReceiptText, Search, ShoppingCart, Users, Wallet, CheckCircle2, RefreshCw, Banknote } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Order = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; status:string; created_at:string };

const nav = [
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Orders", "/orders"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [Layers3, "Inventory", "/inventory"],
  [FileText, "Reports", "/reports"],
] as const;

export default function GCashBayadPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");

  const load=async()=>{
    setLoading(true); setMessage("");
    const {data,error}=await supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false});
    if(error) setMessage(`Unable to load payment transactions: ${error.message}`);
    else setOrders((data??[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0)})));
    setLoading(false);
  };

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{ if(!data.user) window.location.href="/pos"; else load(); });
  },[]);

  const filtered=useMemo(()=>orders.filter(o=>`${o.order_no} ${o.customer_name||""} ${o.status||""}`.toLowerCase().includes(search.toLowerCase())),[orders,search]);
  const completed=filtered.filter(o=>o.status?.toLowerCase()==="completed");
  const collected=completed.reduce((sum,o)=>sum+o.amount_paid,0);
  const outstanding=filtered.reduce((sum,o)=>sum+Math.max(0,o.total-o.amount_paid),0);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Wallet size={21}/></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      {nav.map(([Icon,label,href])=><a key={label} href={href} className={`nav-item ${label==="GCash / Bayad"?"active":""}`}><Icon size={19}/><span>{label}</span></a>)}
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div><h1>GCash / Bayad</h1><p>Review digital and collected payments from your PrintWise transactions.</p></div>
        <button className="process-btn" style={{width:"auto"}} onClick={load}><RefreshCw size={18}/> REFRESH</button>
      </header>

      <div className="pos-layout" style={{gridTemplateColumns:"1fr"}}>
        <section className="catalog-panel">
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14,marginBottom:18}}>
            <div className="summary"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b>Completed Payments</b><CheckCircle2 size={19}/></div><strong style={{fontSize:25}}>{completed.length}</strong><small>Completed transactions</small></div>
            <div className="summary"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b>Total Collected</b><Wallet size={19}/></div><strong style={{fontSize:25}}>₱{collected.toFixed(2)}</strong><small>Amount paid by customers</small></div>
            <div className="summary"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b>Outstanding</b><Banknote size={19}/></div><strong style={{fontSize:25}}>₱{outstanding.toFixed(2)}</strong><small>Unpaid balance from listed orders</small></div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16,marginBottom:20}}>
            <div style={{border:"1px solid #e5e7eb",borderRadius:16,padding:18,background:"#fff"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><Wallet size={24}/><div><b style={{fontSize:18}}>GCash</b><div style={{fontSize:13,color:"#64748b"}}>Digital wallet payments</div></div></div>
              <p style={{margin:0,color:"#64748b",fontSize:14,lineHeight:1.5}}>Use this page to review payment collections. Payment methods can be recorded from the POS checkout workflow.</p>
            </div>
            <div style={{border:"1px solid #e5e7eb",borderRadius:16,padding:18,background:"#fff"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><CreditCard size={24}/><div><b style={{fontSize:18}}>Bayad</b><div style={{fontSize:13,color:"#64748b"}}>Alternative payment collection</div></div></div>
              <p style={{margin:0,color:"#64748b",fontSize:14,lineHeight:1.5}}>The page is now fully routed and accessible from every PrintWise sidebar navigation menu.</p>
            </div>
          </div>

          <div className="search-box" style={{marginBottom:14}}><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order number, customer, or status..."/></div>
          {message&&<div className="message">{message}</div>}
          <div style={{overflowX:"auto"}}><table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>
            {loading?<tr><td colSpan={6}>Loading payment transactions...</td></tr>:filtered.length===0?<tr><td colSpan={6}>No payment transactions found.</td></tr>:filtered.map(o=><tr key={o.id}><td><b>{o.order_no}</b></td><td>{o.customer_name||"Walk-in Customer"}</td><td>{new Date(o.created_at).toLocaleString()}</td><td>₱{o.total.toFixed(2)}</td><td>₱{o.amount_paid.toFixed(2)}</td><td><span className="order-status">{o.status||"Unknown"}</span></td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </section>
  </main>;
}
