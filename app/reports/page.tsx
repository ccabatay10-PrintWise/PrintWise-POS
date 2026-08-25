"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Download, FileText, Layers3, Package, ReceiptText, Search, ShoppingCart, TrendingUp, Users, Wallet, X } from "lucide-react";
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

const peso = new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP", minimumFractionDigits:2 });

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

  const rangeLabel={all:"All Time",today:"Today",["7days"]:"Last 7 Days",["30days"]:"Last 30 Days"}[range]||"All Time";
  const formatDate=(date:string)=>new Date(date).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});

  return <main className="app-shell reports-page">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BarChart3 size={21}/></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      {nav.map(([Icon,label,href])=><a key={label} href={href} className={`nav-item ${label==="Reports"?"active":""}`}><Icon size={19}/><span>{label}</span></a>)}
    </aside>

    <section className="workspace reports-workspace">
      <header className="reports-header">
        <div>
          <div className="report-kicker">BUSINESS INSIGHTS</div>
          <h1>Reports & Analytics</h1>
          <p>Monitor your PrintWise sales, payments, and completed transactions in one place.</p>
        </div>
        <button className="export-btn" onClick={exportCsv}><Download size={19}/> <span>EXPORT CSV</span></button>
      </header>

      <div className="reports-content">
        <section className="metrics-grid">
          <div className="metric-card sales-card"><div className="metric-icon"><TrendingUp size={22}/></div><div><span>Total Sales</span><strong>{peso.format(sales)}</strong><small>Completed orders only</small></div></div>
          <div className="metric-card orders-card"><div className="metric-icon"><ReceiptText size={22}/></div><div><span>Completed Orders</span><strong>{completed.length}</strong><small>Transactions in this period</small></div></div>
          <div className="metric-card paid-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Total Paid</span><strong>{peso.format(paid)}</strong><small>Successfully collected</small></div></div>
          <div className="metric-card average-card"><div className="metric-icon"><BarChart3 size={22}/></div><div><span>Average Sale</span><strong>{peso.format(average)}</strong><small>Average per completed order</small></div></div>
        </section>

        <section className="report-table-card">
          <div className="table-topbar">
            <div><h2>Sales Transactions</h2><p>{filtered.length} transaction{filtered.length===1?"":"s"} • {rangeLabel}</p></div>
            <div className="table-actions">
              <div className="search-field"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, customer or status..."/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search"><X size={16}/></button>}</div>
              <label className="range-select"><CalendarDays size={18}/><select value={range} onChange={e=>setRange(e.target.value)}><option value="all">All Time</option><option value="today">Today</option><option value="7days">Last 7 Days</option><option value="30days">Last 30 Days</option></select></label>
            </div>
          </div>

          {message&&<div className="message report-message">{message}</div>}

          <div className="table-wrap"><table className="reports-table"><thead><tr><th>ORDER DETAILS</th><th>CUSTOMER</th><th>DATE & TIME</th><th>TOTAL</th><th>PAID</th><th>STATUS</th></tr></thead><tbody>
            {loading?<tr><td colSpan={6}><div className="loading-state"><div className="loader"></div>Loading report data...</div></td></tr>:
            filtered.length===0?<tr><td colSpan={6}><div className="empty-report"><div className="empty-icon"><FileText size={26}/></div><b>No transactions found</b><span>Try changing your search or date range.</span></div></td></tr>:
            filtered.map(o=><tr key={o.id}><td><div className="order-cell"><b>{o.order_no}</b><span>PrintWise POS</span></div></td><td><div className="customer-cell"><div className="customer-avatar">{(o.customer_name||"W").charAt(0).toUpperCase()}</div><span>{o.customer_name||"Walk-in Customer"}</span></div></td><td className="date-cell">{formatDate(o.created_at)}</td><td className="money-cell">{peso.format(o.total)}</td><td className="money-cell paid-money">{peso.format(o.amount_paid)}</td><td><span className={`status-pill ${o.status?.toLowerCase()==="completed"?"completed":""}`}><CheckCircle2 size={14}/>{o.status||"Unknown"}</span></td></tr>)}
          </tbody></table></div>

          <div className="table-footer"><span>Showing <b>{filtered.length}</b> transaction{filtered.length===1?"":"s"}</span><span>Last updated from your PrintWise database</span></div>
        </section>
      </div>

      <style>{`
        .reports-workspace{background:#f5f7fb;min-height:100vh}.reports-header{min-height:122px;padding:28px 34px;border-bottom:1px solid #e8ecf2;background:linear-gradient(135deg,#fff 0%,#f9fafc 100%);display:flex;align-items:center;justify-content:space-between;gap:20px}.report-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;color:#e32620;margin-bottom:5px}.reports-header h1{margin:0;font-size:32px;letter-spacing:-.03em;color:#1f2937}.reports-header p{margin:7px 0 0;color:#718096;font-size:15px}.export-btn{border:0;border-radius:14px;background:#ed1c16;color:#fff;font-weight:800;font-size:14px;letter-spacing:.04em;padding:16px 22px;display:flex;align-items:center;gap:9px;box-shadow:0 10px 24px rgba(237,28,22,.22);cursor:pointer;transition:.2s}.export-btn:hover{transform:translateY(-2px);background:#d91510}.reports-content{padding:28px 34px 40px}.metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.metric-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:19px;display:flex;gap:14px;align-items:flex-start;box-shadow:0 4px 18px rgba(17,24,39,.035);position:relative;overflow:hidden}.metric-card:after{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:#e32620}.metric-icon{width:44px;height:44px;border-radius:13px;background:#fff1f0;color:#e32620;display:grid;place-items:center;flex:0 0 auto}.orders-card .metric-icon{background:#f1f5ff;color:#4f6fd8}.paid-card .metric-icon{background:#ecfdf5;color:#169b6b}.average-card .metric-icon{background:#fff8e7;color:#d99100}.metric-card span{display:block;font-size:12px;font-weight:700;color:#7a8796;text-transform:uppercase;letter-spacing:.06em}.metric-card strong{display:block;font-size:24px;line-height:1.25;color:#202938;margin:5px 0 3px;letter-spacing:-.02em}.metric-card small{color:#9aa4b2;font-size:12px}.report-table-card{background:#fff;border:1px solid #e8ecf2;border-radius:20px;box-shadow:0 8px 30px rgba(17,24,39,.045);overflow:hidden}.table-topbar{padding:22px 24px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:18px}.table-topbar h2{margin:0;color:#243041;font-size:19px}.table-topbar p{margin:5px 0 0;color:#8b96a5;font-size:13px}.table-actions{display:flex;align-items:center;gap:10px}.search-field{height:46px;min-width:320px;border:1px solid #dfe5ec;border-radius:12px;background:#f9fafb;display:flex;align-items:center;padding:0 13px;gap:10px;color:#8b96a5}.search-field input{border:0!important;background:transparent!important;outline:0;width:100%;font-size:14px;color:#334155}.search-field button{border:0;background:transparent;color:#8b96a5;cursor:pointer;padding:3px}.range-select{height:46px;border:1px solid #dfe5ec;border-radius:12px;padding:0 12px;display:flex;align-items:center;gap:8px;color:#6b7785;background:#fff}.range-select select{border:0;outline:0;background:transparent;color:#334155;font-weight:600;font-size:14px;cursor:pointer}.table-wrap{overflow-x:auto}.reports-table{width:100%;border-collapse:collapse;min-width:850px}.reports-table th{text-align:left;padding:15px 24px;background:#fafbfc;color:#8a95a4;font-size:11px;letter-spacing:.07em;font-weight:800;border-bottom:1px solid #edf0f4}.reports-table td{padding:17px 24px;border-bottom:1px solid #eef1f4;color:#3b4756;font-size:14px}.reports-table tbody tr{transition:.15s}.reports-table tbody tr:hover{background:#fcfcfd}.order-cell b{display:block;color:#273344;font-size:14px}.order-cell span{display:block;color:#9aa4b2;font-size:11px;margin-top:4px}.customer-cell{display:flex;align-items:center;gap:9px;font-weight:600}.customer-avatar{width:30px;height:30px;border-radius:50%;background:#fff0ef;color:#df251f;display:grid;place-items:center;font-size:12px;font-weight:800}.date-cell{color:#647184!important;white-space:nowrap}.money-cell{font-weight:700;color:#263244!important;white-space:nowrap}.paid-money{color:#0c8a61!important}.status-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:12px;font-weight:700;text-transform:capitalize}.status-pill.completed{background:#eaf8f1;color:#16855f}.loading-state,.empty-report{padding:58px 20px;text-align:center;color:#7d8998}.loader{width:26px;height:26px;border:3px solid #edf0f3;border-top-color:#e32620;border-radius:50%;margin:0 auto 12px;animation:spin .8s linear infinite}.empty-report{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-report b{color:#374151;font-size:15px}.empty-icon{width:52px;height:52px;border-radius:16px;background:#fff1f0;color:#e32620;display:grid;place-items:center;margin-bottom:2px}.table-footer{display:flex;justify-content:space-between;gap:12px;padding:14px 24px;color:#9aa4b2;font-size:12px;background:#fbfcfd}.table-footer b{color:#4b5563}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1150px){.metrics-grid{grid-template-columns:repeat(2,1fr)}.table-topbar{align-items:flex-start;flex-direction:column}.table-actions{width:100%}.search-field{flex:1;min-width:0}}@media(max-width:700px){.reports-header{padding:22px 18px;align-items:flex-start;flex-direction:column}.reports-header h1{font-size:26px}.export-btn{width:100%;justify-content:center}.reports-content{padding:18px}.metrics-grid{grid-template-columns:1fr;gap:12px}.table-actions{flex-direction:column;align-items:stretch}.range-select{justify-content:flex-start}.table-footer{flex-direction:column}.report-table-card{border-radius:16px}.table-topbar{padding:18px}}
      `}</style>
    </section>
  </main>;
}
