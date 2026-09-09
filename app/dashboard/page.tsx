"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Banknote, CalendarDays, CheckCircle2, Clock3, Package, RefreshCw, ShoppingCart, TrendingUp, Users, Wallet, Truck, ReceiptText } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./dashboard.css";
import Sidebar from "../components/Sidebar";

type Order = { id: string; order_no: string; customer_name: string | null; subtotal: number; total: number; amount_paid: number; balance: number; status: string; created_at: string };
type InventoryItem = { id: string; name: string; category: string; quantity: number; reorder_level: number; unit: string };
type ProductSale = { name: string; amount: number; qty: number };

type DashboardData = {
  totalSales: number;
  periodSales: number;
  paymentsReceived: number;
  discounts: number;
  expenses: number;
  completedOrders: number;
  totalOrders: number;
  customerCount: number;
  productCount: number;
  outOfStock: number;
  expiring: number;
  unpaidPurchase: number;
  unpaidSales: number;
  topProducts: ProductSale[];
  lowStock: InventoryItem[];
  lastOrder: Order | null;
};

const empty: DashboardData = { totalSales: 0, periodSales: 0, paymentsReceived: 0, discounts: 0, expenses: 0, completedOrders: 0, totalOrders: 0, customerCount: 0, productCount: 0, outOfStock: 0, expiring: 0, unpaidPurchase: 0, unpaidSales: 0, topProducts: [], lowStock: [], lastOrder: null };
const currency = (n: number) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export default function DashboardPage() {
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");
  const [data, setData] = useState<DashboardData>(empty);
  const [businessName, setBusinessName] = useState("Espacio");
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    const end = new Date();
    const start = startOfDay(end);
    if (period === "7d") start.setDate(start.getDate() - 6);
    if (period === "30d") start.setDate(start.getDate() - 29);
    return { start, end };
  }, [period]);

  const loadDashboard = async () => {
    setLoading(true); setError("");
    const [ordersRes, itemsRes, customersRes, productsRes, inventoryRes, expensesRes, settingsRes] = await Promise.all([
      supabase.from("pos_orders").select("id,order_no,customer_name,subtotal,total,amount_paid,balance,status,created_at").order("created_at", { ascending: false }),
      supabase.from("pos_order_items").select("pos_order_id,item_name,product_id,quantity,line_total"),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("inventory_items").select("id,name,category,quantity,reorder_level,unit").eq("is_active", true).order("quantity", { ascending: true }),
      supabase.from("payment_transactions").select("amount,created_at,status,transaction_type").eq("transaction_type", "expense").eq("status", "successful"),
      supabase.from("company_settings").select("business_name").limit(1).maybeSingle(),
    ]);

    const firstError = [ordersRes.error, itemsRes.error, customersRes.error, productsRes.error, inventoryRes.error, expensesRes.error].find(Boolean);
    if (firstError) setError(firstError.message);

    const orders = (ordersRes.data || []).map((o: any) => ({ ...o, subtotal: Number(o.subtotal || 0), total: Number(o.total || 0), amount_paid: Number(o.amount_paid || 0), balance: Number(o.balance || 0), status: String(o.status || "pending").toLowerCase() })) as Order[];
    const completed = orders.filter(o => o.status === "completed");
    const inPeriod = completed.filter(o => new Date(o.created_at) >= range.start && new Date(o.created_at) <= range.end);
    const periodSales = inPeriod.reduce((s, o) => s + o.total, 0);
    const paymentsReceived = inPeriod.reduce((s, o) => s + o.amount_paid, 0);
    const discounts = inPeriod.reduce((s, o) => s + Math.max(0, o.subtotal - o.total), 0);
    const expenses = (expensesRes.data || []).filter((e: any) => new Date(e.created_at) >= range.start && new Date(e.created_at) <= range.end).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const productMap = new Map<string, { name: string; amount: number; qty: number }>();
    const completedIds = new Set(completed.map(o => o.id));
    for (const item of itemsRes.data || []) {
      if (!completedIds.has(item.pos_order_id)) continue;
      const key = item.product_id || item.item_name;
      const current = productMap.get(key) || { name: item.item_name || "Unnamed item", amount: 0, qty: 0 };
      current.amount += Number(item.line_total || 0);
      current.qty += Number(item.quantity || 0);
      productMap.set(key, current);
    }
    const topProducts = [...productMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const inventory = (inventoryRes.data || []).map((i: any) => ({ ...i, quantity: Number(i.quantity || 0), reorder_level: Number(i.reorder_level || 0) })) as InventoryItem[];

    setData({
      totalSales: completed.reduce((s, o) => s + o.total, 0), periodSales, paymentsReceived, discounts, expenses,
      completedOrders: completed.length, totalOrders: orders.length, customerCount: customersRes.count || 0, productCount: productsRes.count || 0,
      outOfStock: inventory.filter(i => i.quantity <= 0).length, expiring: 0, unpaidPurchase: 0,
      unpaidSales: orders.filter(o => o.status !== "voided" && o.balance > 0).reduce((s, o) => s + o.balance, 0),
      topProducts, lowStock: inventory.filter(i => i.quantity <= i.reorder_level).slice(0, 5), lastOrder: orders[0] || null,
    });
    if (settingsRes.data?.business_name) setBusinessName(settingsRes.data.business_name);
    setLoading(false);
  };

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/pos"; return; }
      setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User");
      await loadDashboard();
    };
    boot();
  }, [period]);

  const sales = data.periodSales;
  const expenses = data.expenses;
  const net = sales - expenses;
  const totalDonut = Math.max(sales + expenses, 1);
  const salesPct = (sales / totalDonut) * 100;
  const expensePct = (expenses / totalDonut) * 100;
  const dateLabel = `${range.start.toLocaleDateString(undefined, { month: "short", day: "2-digit" })} - ${range.end.toLocaleDateString(undefined, { month: "short", day: "2-digit" })}`;
  const periodLabel = period === "today" ? "Today" : period === "7d" ? "Last 7 Days" : "This Month";
  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }, []);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace dashboard-workspace dashboard-v3">
        <header className="dashboard-header dashboard-hero">
          <div><div className="eyebrow"><CalendarDays size={14} /> BUSINESS OVERVIEW</div><h1>{greeting}, {userName.split(" ")[0]}!</h1><p>Here’s what’s happening with your business today.</p></div>
          <div className="dashboard-actions"><button className="refresh-dashboard" onClick={loadDashboard} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> {loading ? "Refreshing..." : "Refresh"}</button><a className="quick-pos" href="/pos"><ShoppingCart size={17} /> Open POS</a></div>
        </header>

        <div className="dashboard-alert-grid">
          <a className="alert-card danger" href="/inventory"><div className="alert-icon"><AlertTriangle size={21} /></div><div><span>Out of Stock</span><strong>{data.outOfStock}</strong><small>View items <ArrowRight size={13} /></small></div></a>
          <a className="alert-card warning" href="/inventory"><div className="alert-icon"><Clock3 size={21} /></div><div><span>Expiring & Expired</span><strong>{data.expiring}</strong><small>Expiry tracking <ArrowRight size={13} /></small></div></a>
          <a className="alert-card info" href="/orders"><div className="alert-icon"><Truck size={21} /></div><div><span>Unpaid Purchase Orders</span><strong>{currency(data.unpaidPurchase)}</strong><small>View orders <ArrowRight size={13} /></small></div></a>
          <a className="alert-card danger" href="/orders"><div className="alert-icon"><ReceiptText size={21} /></div><div><span>Unpaid Sales Orders</span><strong>{currency(data.unpaidSales)}</strong><small>View orders <ArrowRight size={13} /></small></div></a>
        </div>

        {error && <div className="dashboard-error">Some dashboard data could not be loaded: {error}</div>}

        <div className="dashboard-main-grid-v3">
          <section className="dashboard-card summary-card-v3">
            <div className="card-title"><div><h2>Today’s Summary</h2><p>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p></div><div className="business-pill">{businessName}⌄</div></div>
            <div className="summary-metrics">
              <div><div className="metric-icon green"><Wallet size={21} /></div><span>Payments Received</span><strong>{currency(data.paymentsReceived)}</strong></div>
              <div><div className="metric-icon blue"><span>%</span></div><span>Discounts</span><strong>{currency(data.discounts)}</strong></div>
              <div><div className="metric-icon red"><Banknote size={21} /></div><span>Expenses</span><strong>{currency(expenses)}</strong></div>
              <div><div className="metric-icon purple"><Package size={21} /></div><span>Orders</span><strong>{data.completedOrders}</strong></div>
            </div>
            <div className="last-order"><span>Last order: <b>{data.lastOrder?.order_no || "—"}</b></span><span>Created by: <b>{data.lastOrder?.customer_name || "—"}</b></span><span>Amount: <b>{data.lastOrder ? currency(data.lastOrder.total) : "—"}</b></span></div>
            <a className="report-button" href="/reports">Sales Report <ArrowRight size={16} /></a>
          </section>

          <section className="dashboard-card donut-card-v3">
            <div className="card-title"><div><h2>Sales and Expenses</h2><p>{dateLabel}</p></div><div className="period-tabs">{(["today", "7d", "30d"] as const).map(v => <button key={v} className={period === v ? "active" : ""} onClick={() => setPeriod(v)}>{v === "today" ? "Today" : v === "7d" ? "7 Days" : "Month"}</button>)}</div></div>
            <div className="donut-row">
              <div className="donut-block"><div className="donut sales-donut" style={{ background: `conic-gradient(#10e6a1 0 ${salesPct}%, #dffaf1 ${salesPct}% 100%)` }}><div><strong>{currency(sales)}</strong><span>Total Sales</span></div></div><div className="legend"><i className="sales-dot" /> {businessName} <b>{currency(sales)}</b></div></div>
              <div className="donut-block"><div className="donut expense-donut" style={{ background: `conic-gradient(#ff5268 0 ${expensePct}%, #ffe2e6 ${expensePct}% 100%)` }}><div><strong>{currency(expenses)}</strong><span>Total Expenses</span></div></div><div className="legend"><i className="expense-dot" /> {businessName} <b>{currency(expenses)}</b></div></div>
            </div>
            <div className="net-income"><div><TrendingUp size={18} /><strong>{currency(net)}</strong><span>Net Income (Sales - Expenses)</span></div><small>{sales ? `${((net / sales) * 100).toFixed(1)}% margin` : "0.0% margin"}</small></div>
            <a className="report-button" href="/reports">Financial Summary <ArrowRight size={16} /></a>
          </section>
        </div>

        <div className="dashboard-main-grid-v3 lower">
          <section className="dashboard-card table-card-v3">
            <div className="card-title"><div><h2>Top Selling Products By Amount</h2><p>{dateLabel}</p></div><span className="select-like">{periodLabel}⌄</span></div>
            <div className="table-v3"><div className="thead"><span>#</span><span>Image</span><span>Name</span><span>Amount</span><span>Qty Sold</span></div>{data.topProducts.length ? data.topProducts.map((p, i) => <div className="trow" key={`${p.name}-${i}`}><span>{i + 1}</span><span className="product-thumb"><Package size={17} /></span><b>{p.name}</b><span>{currency(p.amount)}</span><span>{p.qty}</span></div>) : <div className="dashboard-empty">No completed sales in this period.</div>}</div>
            <a className="report-button" href="/reports">Catalog Report <ArrowRight size={16} /></a>
          </section>

          <section className="dashboard-card table-card-v3">
            <div className="card-title"><div><h2>Low Stock Items</h2><p>Top 5 inventory items that are low or out of stock</p></div><a className="view-all" href="/inventory">View All</a></div>
            <div className="table-v3"><div className="thead low"><span>#</span><span>Image</span><span>Name</span><span>Stock</span><span>Status</span></div>{data.lowStock.length ? data.lowStock.map((item, i) => <div className="trow" key={item.id}><span>{i + 1}</span><span className="product-thumb"><Package size={17} /></span><b>{item.name}</b><span className={item.quantity <= 0 ? "stock-danger" : "stock-warning"}>{item.quantity}{item.unit || " pcs"}</span><span className={`stock-badge ${item.quantity <= 0 ? "out" : "low"}`}>{item.quantity <= 0 ? "Out of Stock" : "Low Stock"}</span></div>) : <div className="dashboard-empty">All inventory levels look good.</div>}</div>
            <a className="report-button" href="/inventory">Inventory Report <ArrowRight size={16} /></a>
          </section>
        </div>
      </section>
    </main>
  );
}
