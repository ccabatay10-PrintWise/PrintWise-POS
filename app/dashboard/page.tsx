"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./dashboard.css";
import Sidebar from "../components/Sidebar";

type Period = "today" | "7d" | "30d";

type Order = {
  id: string;
  order_no: string;
  customer_name: string | null;
  total: number;
  amount_paid: number;
  status: string;
  created_at: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  reorder_level: number;
  unit: string;
};

type TrendPoint = { key: string; label: string; amount: number };

type DashboardData = {
  totalSales: number;
  periodSales: number;
  completedOrders: number;
  totalOrders: number;
  averageOrder: number;
  customerCount: number;
  productCount: number;
  lowStockCount: number;
  lowStock: InventoryItem[];
  recentOrders: Order[];
  trend: TrendPoint[];
  statusCounts: { completed: number; pending: number; processing: number; other: number };
};

const emptyData: DashboardData = {
  totalSales: 0,
  periodSales: 0,
  completedOrders: 0,
  totalOrders: 0,
  averageOrder: 0,
  customerCount: 0,
  productCount: 0,
  lowStockCount: 0,
  lowStock: [],
  recentOrders: [],
  trend: [],
  statusCounts: { completed: 0, pending: 0, processing: 0, other: 0 },
};

const currency = (value: number) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const startOfLocalDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeStatus = (status: string) => String(status || "pending").trim().toLowerCase();

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("PrintWise User");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersRes, recentRes, customersRes, productsRes, inventoryRes] = await Promise.all([
        supabase
          .from("pos_orders")
          .select("id,order_no,customer_name,total,amount_paid,status,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("pos_orders")
          .select("id,order_no,customer_name,total,amount_paid,status,created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("inventory_items")
          .select("id,name,category,quantity,reorder_level,unit")
          .eq("is_active", true)
          .order("quantity", { ascending: true }),
      ]);

      const firstError = [ordersRes.error, recentRes.error, customersRes.error, productsRes.error, inventoryRes.error].find(Boolean);
      if (firstError) throw new Error(firstError.message);

      const orders = (ordersRes.data || []).map((order: any) => ({
        ...order,
        total: Number(order.total || 0),
        amount_paid: Number(order.amount_paid || 0),
        status: normalizeStatus(order.status),
      })) as Order[];

      const recentOrders = (recentRes.data || []).map((order: any) => ({
        ...order,
        total: Number(order.total || 0),
        amount_paid: Number(order.amount_paid || 0),
        status: normalizeStatus(order.status),
      })) as Order[];

      const now = new Date();
      const periodStart = startOfLocalDay(now);
      const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
      periodStart.setDate(periodStart.getDate() - (days - 1));

      const periodOrders = orders.filter((order) => {
        const created = new Date(order.created_at);
        return !Number.isNaN(created.getTime()) && created >= periodStart && created <= now;
      });

      const completedAll = orders.filter((order) => order.status === "completed");
      const completedPeriod = periodOrders.filter((order) => order.status === "completed");
      const totalSales = completedAll.reduce((sum, order) => sum + order.total, 0);
      const periodSales = completedPeriod.reduce((sum, order) => sum + order.total, 0);

      const trendMap = new Map<string, number>();
      for (let offset = days - 1; offset >= 0; offset--) {
        const day = startOfLocalDay(now);
        day.setDate(day.getDate() - offset);
        trendMap.set(localDateKey(day), 0);
      }
      completedPeriod.forEach((order) => {
        const key = localDateKey(new Date(order.created_at));
        if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) || 0) + order.total);
      });

      const trend = Array.from(trendMap.entries()).map(([key, amount]) => {
        const [year, month, day] = key.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return {
          key,
          label: period === "today"
            ? "Today"
            : days === 30
              ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : date.toLocaleDateString(undefined, { weekday: "short" }),
          amount,
        };
      });

      const statusCounts = periodOrders.reduce(
        (counts, order) => {
          if (order.status === "completed") counts.completed++;
          else if (["processing", "in progress"].includes(order.status)) counts.processing++;
          else if (["pending", "for approval"].includes(order.status)) counts.pending++;
          else counts.other++;
          return counts;
        },
        { completed: 0, pending: 0, processing: 0, other: 0 },
      );

      const lowStockAll = (inventoryRes.data || [])
        .map((item: any) => ({
          ...item,
          quantity: Number(item.quantity || 0),
          reorder_level: Number(item.reorder_level || 0),
        }))
        .filter((item: InventoryItem) => item.quantity <= item.reorder_level);

      setData({
        totalSales,
        periodSales,
        completedOrders: completedPeriod.length,
        totalOrders: periodOrders.length,
        averageOrder: completedPeriod.length ? periodSales / completedPeriod.length : 0,
        customerCount: customersRes.count || 0,
        productCount: productsRes.count || 0,
        lowStockCount: lowStockAll.length,
        lowStock: lowStockAll.slice(0, 6),
        recentOrders,
        trend,
        statusCounts,
      });
    } catch (e: any) {
      setError(e?.message || "Unable to load dashboard data.");
      setData((current) => ({ ...emptyData, customerCount: current.customerCount }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/pos";
        return;
      }
      setUserName(
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "PrintWise User",
      );
    };
    boot();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const maxTrend = Math.max(...data.trend.map((item) => item.amount), 1);
  const periodLabel = period === "today" ? "Today" : period === "7d" ? "Last 7 Days" : "Last 30 Days";
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace dashboard-workspace dashboard-v2">
        <header className="dashboard-header dashboard-hero">
          <div>
            <div className="eyebrow"><CalendarDays size={14} /> PRINTWISE COMMAND CENTER</div>
            <h1>{greeting}, {userName.split(" ")[0]}! 👋</h1>
            <p>Live sales, order, customer, product, and inventory information.</p>
          </div>
          <div className="dashboard-actions">
            <button className="refresh-dashboard" onClick={loadDashboard} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} /> {loading ? "REFRESHING..." : "REFRESH DATA"}
            </button>
            <a className="quick-pos" href="/pos"><ShoppingCart size={18} /> OPEN POS</a>
          </div>
        </header>

        <div className="dashboard-period-bar">
          <div><span className="period-label">SALES OVERVIEW</span><strong>{periodLabel}</strong></div>
          <div className="period-tabs">
            {(["today", "7d", "30d"] as const).map((value) => (
              <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>
                {value === "today" ? "Today" : value === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="dashboard-error">Unable to load dashboard data: {error}</div>}

        <div className="dashboard-stats dashboard-kpis">
          <article className="dash-stat primary-stat"><div className="stat-icon sales"><Banknote size={22} /></div><div><span>All-Time Sales</span><strong>{currency(data.totalSales)}</strong><small><CheckCircle2 size={14} /> All completed transactions</small></div></article>
          <article className="dash-stat"><div className="stat-icon today"><TrendingUp size={22} /></div><div><span>{periodLabel} Sales</span><strong>{currency(data.periodSales)}</strong><small>Completed sales in selected period</small></div></article>
          <article className="dash-stat"><div className="stat-icon orders"><ReceiptText size={22} /></div><div><span>Completed Orders</span><strong>{data.completedOrders}</strong><small>{data.totalOrders} total orders in selected period</small></div></article>
          <article className="dash-stat"><div className="stat-icon customers"><Users size={22} /></div><div><span>Customers</span><strong>{data.customerCount}</strong><small>Registered customers</small></div></article>
        </div>

        <div className="dashboard-analytics-grid">
          <section className="dashboard-card sales-trend-card">
            <div className="card-title"><div><h2>Sales Trend</h2><p>Completed sales for {periodLabel.toLowerCase()}.</p></div><span className="card-chip"><TrendingUp size={14} /> {currency(data.periodSales)}</span></div>
            <div className="sales-bars">
              {data.trend.map((item) => <div className="sales-bar-item" key={item.key}><div className="sales-bar-track"><div className="sales-bar-fill" style={{ height: `${Math.max((item.amount / maxTrend) * 100, item.amount > 0 ? 8 : 2)}%` }} title={currency(item.amount)} /></div><b>{item.label}</b><small>{item.amount > 0 ? `₱${Math.round(item.amount)}` : "₱0"}</small></div>)}
            </div>
          </section>

          <section className="dashboard-card order-health-card">
            <div className="card-title"><div><h2>Order Health</h2><p>{periodLabel} order activity.</p></div><CircleDollarSign size={22} /></div>
            <div className="health-list">
              <div><span className="health-dot completed" /><b>Completed</b><strong>{data.statusCounts.completed}</strong></div>
              <div><span className="health-dot pending" /><b>Pending</b><strong>{data.statusCounts.pending}</strong></div>
              <div><span className="health-dot processing" /><b>Processing</b><strong>{data.statusCounts.processing}</strong></div>
              <div><span className="health-dot other" /><b>Other</b><strong>{data.statusCounts.other}</strong></div>
            </div>
            <div className="average-order"><span>Average Completed Order ({periodLabel})</span><strong>{currency(data.averageOrder)}</strong></div>
          </section>
        </div>

        <div className="dashboard-main-grid">
          <section className="dashboard-card recent-card">
            <div className="card-title"><div><h2>Recent Transactions</h2><p>Latest activity from your PrintWise POS.</p></div><a href="/orders">VIEW ALL <ArrowRight size={16} /></a></div>
            <div className="transaction-list">
              {loading ? <div className="dashboard-empty">Loading dashboard data...</div> : data.recentOrders.length === 0 ? <div className="dashboard-empty">No transactions yet. Start selling from the Point of Sale.</div> : data.recentOrders.map((order) => <div className="transaction" key={order.id}><div className="transaction-icon"><ReceiptText size={18} /></div><div className="transaction-info"><b>{order.order_no}</b><span>{order.customer_name || "Walk-in Customer"}</span></div><div className="transaction-meta"><strong>{currency(order.total)}</strong><small>{new Date(order.created_at).toLocaleString()}</small></div><span className={`transaction-status status-${order.status.replace(/\s+/g, "-")}`}>{order.status}</span></div>)}
            </div>
          </section>

          <section className="dashboard-card inventory-card">
            <div className="card-title"><div><h2>Inventory Alerts</h2><p>Items that need your attention.</p></div><a href="/inventory">MANAGE <ArrowRight size={16} /></a></div>
            <div className="inventory-summary"><div><Boxes size={20} /><span>Active Products</span><b>{data.productCount}</b></div><div><AlertTriangle size={20} /><span>Low Stock</span><b>{data.lowStockCount}</b></div></div>
            <div className="low-stock-list">
              {loading ? <div className="dashboard-empty">Checking inventory...</div> : data.lowStockCount === 0 ? <div className="stock-good">✓ All tracked inventory is above the reorder level.</div> : data.lowStock.map((item) => <div className="low-stock-item" key={item.id}><div><b>{item.name}</b><span>{item.category}</span></div><strong>{item.quantity} {item.unit}</strong></div>)}
              {!loading && data.lowStockCount > data.lowStock.length && <div className="dashboard-empty">+{data.lowStockCount - data.lowStock.length} more low-stock item(s)</div>}
            </div>
          </section>
        </div>

        <div className="dashboard-bottom-grid quick-dashboard-actions">
          <a className="action-card" href="/pos"><div className="action-icon"><ShoppingCart size={21} /></div><div><b>Start a New Sale</b><span>Open Point of Sale</span></div><ArrowRight size={18} /></a>
          <a className="action-card" href="/orders"><div className="action-icon"><ReceiptText size={21} /></div><div><b>Review Orders</b><span>View and manage transactions</span></div><ArrowRight size={18} /></a>
          <a className="action-card" href="/gcash-bayad"><div className="action-icon"><CreditCard size={21} /></div><div><b>GCash / Bayad</b><span>Review payment transactions</span></div><ArrowRight size={18} /></a>
        </div>
      </section>
    </main>
  );
}
