"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, FileText, Layers3, Package, ReceiptText, Search, ShoppingCart, Users, Wallet } from "lucide-react";
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

export default function ReportsPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [range,setRange]=useState("all");

  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const {data,error}=await supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false});
      if(error) setMessage(`Unable to load reports: ${error.message}`);
      else setOrders((data??[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0)})));
      setLoading(false);
    };
    supabase.auth.getUser().then(({data})=>{ if(!data.user) window.location.href="/pos"; else load(); });
  },[]);

  const filtered=useMemo(()=>{
    const now=new Date();
    const start=new Date(now);
    if(range==="today") start.setHours(0,0,0,0);
    if(range==="7days") start.setDate(now.getDate()-6);
    if(range==="30days") start.setDate(now.getDate()-29);
    return orders.filter(o=>{
      const matches=`${o.order_no} ${o.customer_name||""} ${o.status}`.toLowerCase().includes(search.toLowerCase());
      const date=range==="all"?true:new Date(o.created_at)>=start;
      return matches&&date;
    });
  },[orders,search,range]);

  const completed=filtered.filter(o=>o.status?.toLowerCase()==="completed");
  const sales=completed.reduce((sum,o)=>sum+o.total,0);
  const paid=completed.reduce((sum,o)=>sum+o.amount_paid,0);
  const average=completed.length?sales/completed.length:0;

  const exportCsv=()=>{
    const rows=[["Order No.","Customer","Date & Time","Total","Paid","Status"],...filtered.map(o=>[o.order_no,o.customer_name||"Walk-in Customer",new Date(o.created_at).toLocaleString(),o.total.toFixed(2),o.amount_paid.toFixed(2),o.status])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`printwise-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BarChart3 size={21}/></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      {nav.map(([Icon,label,href])=><a key={label} href={href} className={`nav-item ${label==="Reports"?"active":""}`}><Icon size={19}/><span>{label}</span></a>)}
    </aside>
    <section className="workspace">
      <header className="topbar"><div><h1>Reports</h1><p>Review PrintWise sales performance and completed transactions.</p></div><button className="process-btn" style={{width:"auto"}} onClick={exportCsv}><Download size={18}/> EXPORT CSV</button></header>
      <div className="pos-layout" style={{gridTemplateColumns:"1fr"}}><section className="catalog-panel">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:14,marginBottom:18}}>
          <div className="summary"><b>Total Sales</b><strong style={{fontSize:24}}>₱{sales.toFixed(2)}</strong></div>
          <div className="summary"><b>Completed Orders</b><strong style={{fontSize:24}}>{completed.length}</strong></div>
          <div className="summary"><b>Total Paid</b><strong style={{fontSize:24}}>₱{paid.toFixed(2)}</strong></div>
          <div className="summary"><b>Average Sale</b><strong style={{fontSize:24}}>₱{average.toFixed(2)}</strong></div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div className="search-box" style={{flex:1,minWidth:240}}><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order number, customer, or status..."/></div>
          <div style={{display:"flex",alignItems:"center",gap:8,border:"1px solid #e5e7eb",borderRadius:12,padding:"0 12px",height:48,background:"#fff"}}><CalendarDays size={18}/><select value={range} onChange={e=>setRange(e.target.value)} style={{border:0,outline:0,background:"transparent",fontSize:14}}><option value="all">All Time</option><option value="today">Today</option><option value="7days">Last 7 Days</option><option value="30days">Last 30 Days</option></select></div>
        </div>
        {message&&<div className="message">{message}</div>}
        <div style={{overflowX:"auto",marginTop:18}}><table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan={6}>Loading reports...</td></tr>:filtered.length===0?<tr><td colSpan={6}>No transactions found for this report.</td></tr>:filtered.map(o=><tr key={o.id}><td><b>{o.order_no}</b></td><td>{o.customer_name||"Walk-in Customer"}</td><td>{new Date(o.created_at).toLocaleString()}</td><td>₱{o.total.toFixed(2)}</td><td>₱{o.amount_paid.toFixed(2)}</td><td><span className="order-status">{o.status||"Unknown"}</span></td></tr>)}</tbody></table></div>
      </section></div>
    </section>
  </main>;
}
