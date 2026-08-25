"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, Boxes, CreditCard, FileText, LayoutDashboard, Package, ReceiptText, ShoppingCart, TrendingUp, Users, Wallet, Layers3 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./dashboard.css";

type Order = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; status:string; created_at:string };
type InventoryItem = { id:string; name:string; category:string; quantity:number; reorder_level:number; unit:string; is_active:boolean };

type DashboardData = {
  totalSales:number;
  todaySales:number;
  orderCount:number;
  customerCount:number;
  productCount:number;
  lowStock:InventoryItem[];
  recentOrders:Order[];
};

const routes:Record<string,string>={Dashboard:"/dashboard","Point of Sale":"/pos",Orders:"/orders","GCash / Bayad":"/gcash-bayad","Products & Services":"/products",Customers:"/customers",Inventory:"/inventory",Reports:"/reports"};

export default function DashboardPage(){
  const [data,setData]=useState<DashboardData>({totalSales:0,todaySales:0,orderCount:0,customerCount:0,productCount:0,lowStock:[],recentOrders:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=async()=>{
    setLoading(true); setError("");
    const today=new Date(); today.setHours(0,0,0,0);
    const [ordersRes,customersRes,productsRes,inventoryRes]=await Promise.all([
      supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false}).limit(8),
      supabase.from("customers").select("id",{count:"exact",head:true}),
      supabase.from("products").select("id",{count:"exact",head:true}).eq("is_active",true),
      supabase.from("inventory_items").select("id,name,category,quantity,reorder_level,unit,is_active").eq("is_active",true).order("quantity",{ascending:true})
    ]);
    if(ordersRes.error){ setError(`Unable to load dashboard: ${ordersRes.error.message}`); setLoading(false); return; }
    const orders=(ordersRes.data??[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0)}));
    const allSales=orders.filter((o:any)=>o.status==="completed").reduce((s:number,o:any)=>s+o.total,0);
    const todaySales=orders.filter((o:any)=>o.status==="completed"&&new Date(o.created_at)>=today).reduce((s:number,o:any)=>s+o.total,0);
    const inventory=(inventoryRes.data??[]).map((i:any)=>({...i,quantity:Number(i.quantity||0),reorder_level:Number(i.reorder_level||0)}));
    setData({
      totalSales:allSales,
      todaySales,
      orderCount:orders.filter((o:any)=>o.status==="completed").length,
      customerCount:customersRes.count??0,
      productCount:productsRes.count??0,
      lowStock:inventory.filter((i:any)=>i.quantity<=i.reorder_level).slice(0,6),
      recentOrders:orders
    });
    setLoading(false);
  };

  useEffect(()=>{supabase.auth.getUser().then(({data:{user}})=>{if(!user){window.location.href="/pos";return;}load();});},[]);

  const nav=[[LayoutDashboard,"Dashboard"],[ShoppingCart,"Point of Sale"],[ReceiptText,"Orders"],[Wallet,"GCash / Bayad"],[Package,"Products & Services"],[Users,"Customers"],[Layers3,"Inventory"],[FileText,"Reports"]] as const;
  const completedRate=useMemo(()=>data.recentOrders.length?Math.round((data.orderCount/data.recentOrders.length)*100):0,[data]);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21}/></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      {nav.map(([Icon,label])=>{const N=Icon;return <a href={routes[label]} className={`nav-item ${label==="Dashboard"?"active":""}`} key={label}><N size={19}/><span>{label}</span></a>})}
    </aside>
    <section className="workspace dashboard-workspace">
      <header className="dashboard-header">
        <div><div className="eyebrow">PRINTWISE COMMAND CENTER</div><h1>Good day! Here’s your business overview.</h1><p>Monitor sales, orders, customers, products, and inventory from one dashboard.</p></div>
        <div className="dashboard-actions"><button className="refresh-dashboard" onClick={load} disabled={loading}>{loading?"REFRESHING...":"↻ REFRESH DATA"}</button><a className="quick-pos" href="/pos"><ShoppingCart size={18}/> OPEN POS</a></div>
      </header>
      {error&&<div className="dashboard-error">{error}</div>}
      <div className="dashboard-stats">
        <article className="dash-stat"><div className="stat-icon sales"><Banknote size={22}/></div><div><span>Total Sales</span><strong>₱{data.totalSales.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small><TrendingUp size={14}/> Completed orders</small></div></article>
        <article className="dash-stat"><div className="stat-icon today"><TrendingUp size={22}/></div><div><span>Today's Sales</span><strong>₱{data.todaySales.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong><small>Sales recorded today</small></div></article>
        <article className="dash-stat"><div className="stat-icon orders"><ReceiptText size={22}/></div><div><span>Completed Orders</span><strong>{data.orderCount}</strong><small>{completedRate}% in recent activity</small></div></article>
        <article className="dash-stat"><div className="stat-icon customers"><Users size={22}/></div><div><span>Customers</span><strong>{data.customerCount}</strong><small>Saved customer records</small></div></article>
      </div>
      <div className="dashboard-main-grid">
        <section className="dashboard-card recent-card"><div className="card-title"><div><h2>Recent Transactions</h2><p>Latest activity from your PrintWise POS.</p></div><a href="/orders">VIEW ALL <ArrowRight size={16}/></a></div>
          <div className="transaction-list">{loading?<div className="dashboard-empty">Loading dashboard data...</div>:data.recentOrders.length===0?<div className="dashboard-empty">No transactions yet. Start selling from the Point of Sale.</div>:data.recentOrders.map(o=><div className="transaction" key={o.id}><div className="transaction-icon"><ReceiptText size={18}/></div><div className="transaction-info"><b>{o.order_no}</b><span>{o.customer_name||"Walk-in Customer"}</span></div><div className="transaction-meta"><strong>₱{o.total.toFixed(2)}</strong><small>{new Date(o.created_at).toLocaleString()}</small></div><span className="transaction-status">{o.status}</span></div>)}</div>
        </section>
        <section className="dashboard-card inventory-card"><div className="card-title"><div><h2>Inventory Alerts</h2><p>Items that need your attention.</p></div><a href="/inventory">MANAGE <ArrowRight size={16}/></a></div>
          <div className="inventory-summary"><div><Boxes size={20}/><span>Active Products</span><b>{data.productCount}</b></div><div><AlertTriangle size={20}/><span>Low Stock</span><b>{data.lowStock.length}</b></div></div>
          <div className="low-stock-list">{loading?<div className="dashboard-empty">Checking inventory...</div>:data.lowStock.length===0?<div className="stock-good">✓ All tracked inventory is above the reorder level.</div>:data.lowStock.map(i=><div className="low-stock-item" key={i.id}><div><b>{i.name}</b><span>{i.category}</span></div><strong>{i.quantity} {i.unit}</strong></div>)}</div>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <a className="action-card" href="/pos"><div className="action-icon"><ShoppingCart size={21}/></div><div><b>Start a New Sale</b><span>Open Point of Sale</span></div><ArrowRight size={18}/></a>
        <a className="action-card" href="/products"><div className="action-icon"><Package size={21}/></div><div><b>Manage Products</b><span>Add or update services</span></div><ArrowRight size={18}/></a>
        <a className="action-card" href="/gcash-bayad"><div className="action-icon"><CreditCard size={21}/></div><div><b>GCash / Bayad</b><span>Review payment transactions</span></div><ArrowRight size={18}/></a>
      </div>
    </section>
  </main>;
}
