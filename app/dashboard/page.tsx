"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Banknote, Boxes, CheckCircle2, CreditCard,
  ReceiptText, RefreshCw, ShoppingCart, TrendingUp, Users, CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./dashboard.css";
import Sidebar from "../components/Sidebar";

type Period = "today" | "7d" | "30d";
type Order = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; status:string; created_at:string };
type InventoryItem = { id:string; name:string; category:string; quantity:number; reorder_level:number; unit:string };
type TrendPoint = { key:string; label:string; amount:number };
type DashboardData = { totalSales:number; periodSales:number; completedOrders:number; totalOrders:number; averageOrder:number; customerCount:number; productCount:number; lowStockCount:number; lowStock:InventoryItem[]; recentOrders:Order[]; trend:TrendPoint[]; statusCounts:{completed:number;pending:number;processing:number;other:number} };
const emptyData:DashboardData={totalSales:0,periodSales:0,completedOrders:0,totalOrders:0,averageOrder:0,customerCount:0,productCount:0,lowStockCount:0,lowStock:[],recentOrders:[],trend:[],statusCounts:{completed:0,pending:0,processing:0,other:0}};
const currency=(value:number)=>`₱${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const startOfLocalDay=(date=new Date())=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const normalizeStatus=(status:string)=>String(status||"pending").trim().toLowerCase();

export default function DashboardPage(){
 const [period,setPeriod]=useState<Period>("7d"); const [data,setData]=useState<DashboardData>(emptyData); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [userName,setUserName]=useState("PrintWise User");
 const loadDashboard=async()=>{setLoading(true);setError("");try{
  const [ordersRes,recentRes,customersRes,productsRes,inventoryRes]=await Promise.all([
   supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false}),
   supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").neq("status","voided").order("created_at",{ascending:false}).limit(5),
   supabase.from("customers").select("id",{count:"exact",head:true}),supabase.from("products").select("id",{count:"exact",head:true}).eq("is_active",true),supabase.from("inventory_items").select("id,name,category,quantity,reorder_level,unit").eq("is_active",true).order("quantity",{ascending:true})]);
  const firstError=[ordersRes.error,recentRes.error,customersRes.error,productsRes.error,inventoryRes.error].find(Boolean); if(firstError)throw new Error(firstError.message);
  const orders=(ordersRes.data||[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0),status:normalizeStatus(o.status)})) as Order[];
  const recentOrders=(recentRes.data||[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0),status:normalizeStatus(o.status)})) as Order[];
  const now=new Date(); const periodStart=startOfLocalDay(now); const days=period==="today"?1:period==="7d"?7:30; periodStart.setDate(periodStart.getDate()-(days-1));
  const periodOrders=orders.filter(o=>{const d=new Date(o.created_at);return !Number.isNaN(d.getTime())&&d>=periodStart&&d<=now;});
  const completedAll=orders.filter(o=>o.status==="completed"); const completedPeriod=periodOrders.filter(o=>o.status==="completed");
  const totalSales=completedAll.reduce((s,o)=>s+o.total,0),periodSales=completedPeriod.reduce((s,o)=>s+o.total,0);
  const trendMap=new Map<string,number>(); for(let offset=days-1;offset>=0;offset--){const d=startOfLocalDay(now);d.setDate(d.getDate()-offset);trendMap.set(localDateKey(d),0)}
  completedPeriod.forEach(o=>{const key=localDateKey(new Date(o.created_at));if(trendMap.has(key))trendMap.set(key,(trendMap.get(key)||0)+o.total)});
  const trend=Array.from(trendMap.entries()).map(([key,amount])=>{const [y,m,d]=key.split("-").map(Number);const date=new Date(y,m-1,d);return{key,label:period==="today"?"Today":days===30?date.toLocaleDateString(undefined,{month:"short",day:"numeric"}):date.toLocaleDateString(undefined,{weekday:"short"}),amount}});
  const statusCounts=periodOrders.reduce((c,o)=>{if(o.status==="completed")c.completed++;else if(["processing","in progress"].includes(o.status))c.processing++;else if(["pending","for approval"].includes(o.status))c.pending++;else c.other++;return c},{completed:0,pending:0,processing:0,other:0});
  const lowStockAll=(inventoryRes.data||[]).map((i:any)=>({...i,quantity:Number(i.quantity||0),reorder_level:Number(i.reorder_level||0)})).filter((i:InventoryItem)=>i.quantity<=i.reorder_level);
  setData({totalSales,periodSales,completedOrders:completedPeriod.length,totalOrders:periodOrders.filter(o=>o.status!=="voided").length,averageOrder:completedPeriod.length?periodSales/completedPeriod.length:0,customerCount:customersRes.count||0,productCount:productsRes.count||0,lowStockCount:lowStockAll.length,lowStock:lowStockAll.slice(0,4),recentOrders,trend,statusCounts});
 }catch(e:any){setError(e?.message||"Unable to load dashboard data.");setData(emptyData)}finally{setLoading(false)}};
 useEffect(()=>{const boot=async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/pos";return}setUserName(user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"PrintWise User")};boot()},[]);
 useEffect(()=>{loadDashboard();const interval=window.setInterval(loadDashboard,60000);return()=>window.clearInterval(interval)},[period]);
 const maxTrend=useMemo(()=>Math.max(...data.trend.map(t=>t.amount),1),[data.trend]);
 return <div className="dashboard-page"><Sidebar/><main className="dashboard-main"><div className="dashboard-header"><div><h1>Dashboard</h1><p>Welcome back, {userName}.</p></div><button onClick={loadDashboard} disabled={loading} className="refresh-button"><RefreshCw size={16}/> Refresh</button></div>
 {error&&<div className="dashboard-error"><AlertTriangle size={18}/><span>{error}</span></div>}
 <div className="dashboard-periods">{(["today","7d","30d"] as Period[]).map(p=><button key={p} onClick={()=>setPeriod(p)} className={period===p?"active":""}>{p==="today"?"Today":p==="7d"?"Last 7 Days":"Last 30 Days"}</button>)}</div>
 <section className="dashboard-cards"><div className="dashboard-card"><div><span>Total Sales</span><strong>{currency(data.totalSales)}</strong><small>Completed sales only</small></div><CircleDollarSign/></div><div className="dashboard-card"><div><span>Period Sales</span><strong>{currency(data.periodSales)}</strong><small>{data.completedOrders} completed orders</small></div><TrendingUp/></div><div className="dashboard-card"><div><span>Average Order</span><strong>{currency(data.averageOrder)}</strong><small>Completed orders only</small></div><ReceiptText/></div><div className="dashboard-card"><div><span>Orders</span><strong>{data.totalOrders}</strong><small>Voided orders excluded</small></div><ShoppingCart/></div></section>
 <section className="dashboard-grid"><div className="dashboard-panel dashboard-trend"><div className="panel-heading"><div><h2>Sales Trend</h2><p>Completed sales only</p></div></div><div className="trend-bars">{data.trend.map(t=><div className="trend-item" key={t.key}><div className="trend-value">{currency(t.amount)}</div><div className="trend-bar-wrap"><div className="trend-bar" style={{height:`${Math.max(4,(t.amount/maxTrend)*100)}%`}}/></div><small>{t.label}</small></div>)}</div></div>
 <div className="dashboard-panel"><div className="panel-heading"><div><h2>Order Status</h2><p>Current period</p></div></div><div className="status-list"><div><span>Completed</span><strong>{data.statusCounts.completed}</strong></div><div><span>Processing</span><strong>{data.statusCounts.processing}</strong></div><div><span>Pending</span><strong>{data.statusCounts.pending}</strong></div><div><span>Other</span><strong>{data.statusCounts.other}</strong></div></div></div></section>
 <section className="dashboard-grid"><div className="dashboard-panel"><div className="panel-heading"><div><h2>Recent Orders</h2><p>Voided transactions are hidden</p></div><ArrowRight size={18}/></div>{data.recentOrders.length?<div className="recent-orders">{data.recentOrders.map(o=><div className="recent-order" key={o.id}><div><strong>{o.order_no}</strong><span>{o.customer_name||"Walk-in Customer"}</span></div><div><strong>{currency(o.total)}</strong><span>{new Date(o.created_at).toLocaleString()}</span></div></div>)}</div>:<div className="empty-state"><CheckCircle2/>No completed orders yet.</div>}</div>
 <div className="dashboard-panel"><div className="panel-heading"><div><h2>Low Stock</h2><p>{data.lowStockCount} items need attention</p></div><Boxes size={18}/></div>{data.lowStock.length?<div className="low-stock-list">{data.lowStock.map(i=><div className="low-stock" key={i.id}><div><strong>{i.name}</strong><span>{i.category}</span></div><strong>{i.quantity} {i.unit}</strong></div>)}</div>:<div className="empty-state"><CheckCircle2/>Inventory levels are healthy.</div>}</div></section>
 <section className="dashboard-mini-stats"><div><Users size={18}/><span>Customers</span><strong>{data.customerCount}</strong></div><div><Boxes size={18}/><span>Active Products</span><strong>{data.productCount}</strong></div><div><CalendarDays size={18}/><span>Selected Period</span><strong>{period==="today"?"Today":period==="7d"?"7 Days":"30 Days"}</strong></div><div><Banknote size={18}/><span>Revenue Basis</span><strong>Completed</strong></div><div><CreditCard size={18}/><span>Voids</span><strong>Excluded</strong></div></section>
 </main></div>;
}
