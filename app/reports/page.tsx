"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Download, FileText, Layers3, Package, ReceiptText, Search, ShoppingCart, TrendingUp, Users, Wallet, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import Sidebar from "../components/Sidebar";

type Order = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; status:string; created_at:string };
type Expense = { id:string; expense_date:string; category:string; description:string; amount:number; payment_method:string; notes:string|null };
type PurchasePlan = { id:string; plan_date:string; items:any[]; total_amount:number; notes:string|null };

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
  const [reportDate,setReportDate]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`});
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [purchasePlans,setPurchasePlans]=useState<PurchasePlan[]>([]);
  const [financeLoading,setFinanceLoading]=useState(true);

  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [ordersResult,expensesResult,plansResult]=await Promise.all([
        supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false}),
        supabase.from("daily_expenses").select("id,expense_date,category,description,amount,payment_method,notes").order("expense_date",{ascending:false}),
        supabase.from("stock_purchase_plans").select("id,plan_date,items,total_amount,notes").order("plan_date",{ascending:false})
      ]);
      if(ordersResult.error) setMessage(`Unable to load reports: ${ordersResult.error.message}`);
      else setOrders((ordersResult.data??[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0)})));
      if(expensesResult.error) setMessage(v=>v||`Unable to load expenses: ${expensesResult.error.message}`);
      else setExpenses((expensesResult.data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
      if(plansResult.error) setMessage(v=>v||`Unable to load stock purchase plans: ${plansResult.error.message}`);
      else setPurchasePlans((plansResult.data??[]).map((p:any)=>({...p,items:Array.isArray(p.items)?p.items:[],total_amount:Number(p.total_amount||0)})));
      setLoading(false);setFinanceLoading(false);
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

  const reportMonth=reportDate.slice(0,7);
  const businessDate=(s:string)=>new Date(s).toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
  const financeDayOrders=orders.filter(o=>o.status?.toLowerCase()==="completed"&&businessDate(o.created_at)===reportDate);
  const financeMonthOrders=orders.filter(o=>o.status?.toLowerCase()==="completed"&&businessDate(o.created_at).startsWith(reportMonth));
  const financeDayExpenses=expenses.filter(e=>e.expense_date===reportDate),financeMonthExpenses=expenses.filter(e=>e.expense_date.startsWith(reportMonth));
  const financeDayPlans=purchasePlans.filter(p=>p.plan_date===reportDate),financeMonthPlans=purchasePlans.filter(p=>p.plan_date.startsWith(reportMonth));
  const daySales=financeDayOrders.reduce((n,o)=>n+o.total,0),dayExpenses=financeDayExpenses.reduce((n,e)=>n+e.amount,0),dayPurchases=financeDayPlans.reduce((n,p)=>n+p.total_amount,0);
  const monthSales=financeMonthOrders.reduce((n,o)=>n+o.total,0),monthExpenses=financeMonthExpenses.reduce((n,e)=>n+e.amount,0),monthPurchases=financeMonthPlans.reduce((n,p)=>n+p.total_amount,0);
  const printFinancialReport=(period:"daily"|"monthly")=>{
    const monthly=period==="monthly",label=monthly?reportMonth:reportDate,salesTotal=monthly?monthSales:daySales,expenseTotal=monthly?monthExpenses:dayExpenses,purchaseTotal=monthly?monthPurchases:dayPurchases,cashLeft=salesTotal-expenseTotal-purchaseTotal;
    const expenseRows=(monthly?financeMonthExpenses:financeDayExpenses).map(e=>`<tr><td>${e.expense_date}</td><td>${e.description}</td><td>${e.category}</td><td class="money">${peso.format(e.amount)}</td></tr>`).join("");
    const planRows=(monthly?financeMonthPlans:financeDayPlans).map(p=>`<tr><td>${p.plan_date}</td><td>${(p.items||[]).map(i=>i.name).join(", ")}</td><td class="money">${peso.format(p.total_amount)}</td></tr>`).join("");
    const w=window.open("","_blank","width=900,height=720");if(!w){setMessage("Allow pop-ups to print the financial report.");return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ESPACIO Financial Report</title><style>@page{size:A4 portrait;margin:12mm}body{font:11px Arial,sans-serif;color:#111}header{text-align:center;border-bottom:2px solid #222;padding:12px;margin-bottom:12px}h1{font-size:20px;margin:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{border:1px solid #bbb;padding:10px}.metric b,.metric strong{display:block;margin-bottom:5px}.cash{border:2px solid #333;background:#f0f7f1}h2{font-size:13px;margin:18px 0 7px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}.money{text-align:right;white-space:nowrap}</style></head><body><header><h1>ESPACIO Café &amp; Restaurant</h1><b>${monthly?"MONTHLY":"DAILY"} FINANCIAL REPORT — ${label}</b></header><div class="grid"><div class="metric"><b>COMPLETED SALES</b><strong>${peso.format(salesTotal)}</strong></div><div class="metric"><b>TOTAL EXPENSES</b><strong>${peso.format(expenseTotal)}</strong></div><div class="metric"><b>SALES MINUS EXPENSES</b><strong>${peso.format(salesTotal-expenseTotal)}</strong></div><div class="metric"><b>NEXT-DAY STOCK PURCHASES</b><strong>${peso.format(purchaseTotal)}</strong></div><div class="metric cash"><b>ESTIMATED CASH LEFT ON HAND</b><strong>${peso.format(cashLeft)}</strong></div></div><h2>Expense Details</h2><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${expenseRows||"<tr><td colspan=\"4\">No expenses.</td></tr>"}</tbody></table><h2>Next-Day Stock Purchase Plans</h2><table><thead><tr><th>Purchase Date</th><th>Items</th><th>Total</th></tr></thead><tbody>${planRows||"<tr><td colspan=\"3\">No saved plans.</td></tr>"}</tbody></table><p>Cash left is an estimate: completed POS sales minus recorded expenses and saved purchase plans. Opening cash, withdrawals, non-POS income, and unpaid balances are not included.</p><script>window.onload=()=>{window.focus();window.print();};<\\/script></body></html>`);w.document.close();
  };
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
    <Sidebar />

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

        <section className="report-table-card finance-report-panel">
          <div className="table-topbar"><div><h2>Daily & Monthly Financial Reports</h2><p>Completed sales, expenses, next-day stock purchases, and estimated cash left.</p></div>
            <div className="table-actions"><label className="range-select"><CalendarDays size={18}/><input aria-label="Financial report date" type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} /></label><button className="export-btn finance-print" onClick={()=>printFinancialReport("daily")}><FileText size={17}/> Print Daily</button><button className="export-btn" onClick={()=>printFinancialReport("monthly")}><FileText size={17}/> Print Monthly</button></div></div>
          {financeLoading?<div className="loading-state">Loading financial summary...</div>:<div className="finance-report-content"><div className="finance-report-period"><b>Daily Summary</b><span>{reportDate}</span></div>
            <section className="metrics-grid finance-metrics">
              <div className="metric-card sales-card"><div className="metric-icon"><TrendingUp size={22}/></div><div><span>Completed Sales</span><strong>{peso.format(daySales)}</strong><small>{financeDayOrders.length} completed orders</small></div></div>
              <div className="metric-card"><div className="metric-icon"><ReceiptText size={22}/></div><div><span>Total Expenses</span><strong>{peso.format(dayExpenses)}</strong><small>{financeDayExpenses.length} expense entries</small></div></div>
              <div className="metric-card average-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Sales Minus Expenses</span><strong>{peso.format(daySales-dayExpenses)}</strong><small>Before stock purchases</small></div></div>
              <div className="metric-card orders-card"><div className="metric-icon"><Package size={22}/></div><div><span>Next-Day Stock Purchase</span><strong>{peso.format(dayPurchases)}</strong><small>{financeDayPlans.length} saved plans</small></div></div>
              <div className="metric-card paid-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Estimated Cash Left</span><strong>{peso.format(daySales-dayExpenses-dayPurchases)}</strong><small>Excludes opening cash and withdrawals</small></div></div>
            </section><div className="finance-report-period"><b>Monthly Summary</b><span>{reportMonth}</span></div>
            <div className="table-wrap"><table className="reports-table"><thead><tr><th>FINANCIAL SUMMARY</th><th>AMOUNT</th></tr></thead><tbody><tr><td>Completed Sales</td><td className="money-cell">{peso.format(monthSales)}</td></tr><tr><td>Total Expenses</td><td className="money-cell">{peso.format(monthExpenses)}</td></tr><tr><td>Sales Minus Expenses</td><td className="money-cell">{peso.format(monthSales-monthExpenses)}</td></tr><tr><td>Next-Day Stock Purchase Plans</td><td className="money-cell">{peso.format(monthPurchases)}</td></tr><tr><td><b>Estimated Monthly Cash Left</b></td><td className="money-cell"><b>{peso.format(monthSales-monthExpenses-monthPurchases)}</b></td></tr></tbody></table></div>
            <p className="finance-report-note">Cash left is an estimate based on completed POS sales minus recorded expenses and saved purchase plans. Opening cash, withdrawals, non-POS income, and unpaid balances are not included.</p></div>}
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
        .reports-workspace{background:#f5f7fb;min-height:100vh}.finance-report-panel{margin-bottom:22px}.finance-report-panel .table-actions{flex-wrap:wrap}.finance-report-panel .table-actions input{border:0;background:transparent;color:#334155;font:600 14px Arial;max-width:150px}.finance-report-content{padding:20px 24px 24px}.finance-report-period{display:flex;justify-content:space-between;align-items:center;padding:4px 0 12px;color:#273449;font-size:14px}.finance-report-period span{color:#7a8796;font-size:12px}.finance-metrics{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:22px}.finance-report-note{font-size:12px;color:#8792a1;margin:14px 0 0}.finance-report-panel .export-btn{padding:12px 15px;font-size:12px;border-radius:10px}.finance-report-panel .finance-print{background:#334155;box-shadow:none}.finance-report-panel .range-select{padding:0 9px}.finance-report-panel .range-select input{min-width:125px}.reports-header{min-height:122px;padding:28px 34px;border-bottom:1px solid #e8ecf2;background:linear-gradient(135deg,#fff 0%,#f9fafc 100%);display:flex;align-items:center;justify-content:space-between;gap:20px}.report-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;color:#e32620;margin-bottom:5px}.reports-header h1{margin:0;font-size:32px;letter-spacing:-.03em;color:#1f2937}.reports-header p{margin:7px 0 0;color:#718096;font-size:15px}.export-btn{border:0;border-radius:14px;background:#ed1c16;color:#fff;font-weight:800;font-size:14px;letter-spacing:.04em;padding:16px 22px;display:flex;align-items:center;gap:9px;box-shadow:0 10px 24px rgba(237,28,22,.22);cursor:pointer;transition:.2s}.export-btn:hover{transform:translateY(-2px);background:#d91510}.reports-content{padding:28px 34px 40px}.metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.metric-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:19px;display:flex;gap:14px;align-items:flex-start;box-shadow:0 4px 18px rgba(17,24,39,.035);position:relative;overflow:hidden}.metric-card:after{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:#e32620}.metric-icon{width:44px;height:44px;border-radius:13px;background:#fff1f0;color:#e32620;display:grid;place-items:center;flex:0 0 auto}.orders-card .metric-icon{background:#f1f5ff;color:#4f6fd8}.paid-card .metric-icon{background:#ecfdf5;color:#169b6b}.average-card .metric-icon{background:#fff8e7;color:#d99100}.metric-card span{display:block;font-size:12px;font-weight:700;color:#7a8796;text-transform:uppercase;letter-spacing:.06em}.metric-card strong{display:block;font-size:24px;line-height:1.25;color:#202938;margin:5px 0 3px;letter-spacing:-.02em}.metric-card small{color:#9aa4b2;font-size:12px}.report-table-card{background:#fff;border:1px solid #e8ecf2;border-radius:20px;box-shadow:0 8px 30px rgba(17,24,39,.045);overflow:hidden}.table-topbar{padding:22px 24px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:18px}.table-topbar h2{margin:0;color:#243041;font-size:19px}.table-topbar p{margin:5px 0 0;color:#8b96a5;font-size:13px}.table-actions{display:flex;align-items:center;gap:10px}.search-field{height:46px;min-width:320px;border:1px solid #dfe5ec;border-radius:12px;background:#f9fafb;display:flex;align-items:center;padding:0 13px;gap:10px;color:#8b96a5}.search-field input{border:0!important;background:transparent!important;outline:0;width:100%;font-size:14px;color:#334155}.search-field button{border:0;background:transparent;color:#8b96a5;cursor:pointer;padding:3px}.range-select{height:46px;border:1px solid #dfe5ec;border-radius:12px;padding:0 12px;display:flex;align-items:center;gap:8px;color:#6b7785;background:#fff}.range-select select{border:0;outline:0;background:transparent;color:#334155;font-weight:600;font-size:14px;cursor:pointer}.table-wrap{overflow-x:auto}.reports-table{width:100%;border-collapse:collapse;min-width:850px}.reports-table th{text-align:left;padding:15px 24px;background:#fafbfc;color:#8a95a4;font-size:11px;letter-spacing:.07em;font-weight:800;border-bottom:1px solid #edf0f4}.reports-table td{padding:17px 24px;border-bottom:1px solid #eef1f4;color:#3b4756;font-size:14px}.reports-table tbody tr{transition:.15s}.reports-table tbody tr:hover{background:#fcfcfd}.order-cell b{display:block;color:#273344;font-size:14px}.order-cell span{display:block;color:#9aa4b2;font-size:11px;margin-top:4px}.customer-cell{display:flex;align-items:center;gap:9px;font-weight:600}.customer-avatar{width:30px;height:30px;border-radius:50%;background:#fff0ef;color:#df251f;display:grid;place-items:center;font-size:12px;font-weight:800}.date-cell{color:#647184!important;white-space:nowrap}.money-cell{font-weight:700;color:#263244!important;white-space:nowrap}.paid-money{color:#0c8a61!important}.status-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:12px;font-weight:700;text-transform:capitalize}.status-pill.completed{background:#eaf8f1;color:#16855f}.loading-state,.empty-report{padding:58px 20px;text-align:center;color:#7d8998}.loader{width:26px;height:26px;border:3px solid #edf0f3;border-top-color:#e32620;border-radius:50%;margin:0 auto 12px;animation:spin .8s linear infinite}.empty-report{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-report b{color:#374151;font-size:15px}.empty-icon{width:52px;height:52px;border-radius:16px;background:#fff1f0;color:#e32620;display:grid;place-items:center;margin-bottom:2px}.table-footer{display:flex;justify-content:space-between;gap:12px;padding:14px 24px;color:#9aa4b2;font-size:12px;background:#fbfcfd}.table-footer b{color:#4b5563}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1150px){.metrics-grid{grid-template-columns:repeat(2,1fr)}.table-topbar{align-items:flex-start;flex-direction:column}.table-actions{width:100%}.search-field{flex:1;min-width:0}}@media(max-width:700px){.reports-header{padding:22px 18px;align-items:flex-start;flex-direction:column}.reports-header h1{font-size:26px}.export-btn{width:100%;justify-content:center}.reports-content{padding:18px}.metrics-grid{grid-template-columns:1fr;gap:12px}.table-actions{flex-direction:column;align-items:stretch}.range-select{justify-content:flex-start}.table-footer{flex-direction:column}.report-table-card{border-radius:16px}.table-topbar{padding:18px}}
      `}</style>
    </section>
  </main>;
}