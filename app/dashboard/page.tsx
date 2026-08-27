"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Calculator,
  CheckCircle2,
  CreditCard,
  KeyRound,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  ShieldCheck,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./dashboard.css";
import Sidebar from "../components/Sidebar";

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
  is_active: boolean;
};

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};

type DashboardData = {
  totalSales: number;
  periodSales: number;
  completedOrders: number;
  totalOrders: number;
  averageOrder: number;
  customerCount: number;
  productCount: number;
  lowStock: InventoryItem[];
  recentOrders: Order[];
  trend: { label: string; amount: number }[];
  statusCounts: {
    completed: number;
    pending: number;
    processing: number;
    other: number;
  };
};

const currency = (value: number) =>
  `₱${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("7d");
  const [data, setData] = useState<DashboardData>({
    totalSales: 0,
    periodSales: 0,
    completedOrders: 0,
    totalOrders: 0,
    averageOrder: 0,
    customerCount: 0,
    productCount: 0,
    lowStock: [],
    recentOrders: [],
    trend: [],
    statusCounts: { completed: 0, pending: 0, processing: 0, other: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("PrintWise User");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffMessage, setStaffMessage] = useState("");
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [savingStaff, setSavingStaff] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const authHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  const loadStaff = async () => {
    if (isAdmin !== true) return;

    setStaffLoading(true);
    setStaffError("");

    try {
      const res = await fetch("/api/staff", {
        headers: await authHeaders(),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Unable to load staff accounts.");
      }

      setStaff(json.staff || []);
    } catch (e: any) {
      setStaffError(e.message || "Unable to load staff accounts.");
    } finally {
      setStaffLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [allOrdersRes, recentOrdersRes, customersRes, productsRes, inventoryRes] =
        await Promise.all([
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
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("inventory_items")
            .select("id,name,category,quantity,reorder_level,unit,is_active")
            .eq("is_active", true)
            .order("quantity", { ascending: true }),
        ]);

      const firstError = [
        allOrdersRes.error,
        recentOrdersRes.error,
        customersRes.error,
        productsRes.error,
        inventoryRes.error,
      ].find(Boolean);

      if (firstError) {
        setError(`Unable to load some dashboard data: ${firstError.message}`);
      }

      const orders = (allOrdersRes.data || []).map((order: any) => ({
        ...order,
        total: Number(order.total || 0),
        amount_paid: Number(order.amount_paid || 0),
        status: String(order.status || "pending").toLowerCase(),
      })) as Order[];

      const recentOrders = (recentOrdersRes.data || []).map((order: any) => ({
        ...order,
        total: Number(order.total || 0),
        amount_paid: Number(order.amount_paid || 0),
        status: String(order.status || "pending").toLowerCase(),
      })) as Order[];

      const completed = orders.filter((order) => order.status === "completed");
      const totalSales = completed.reduce((sum, order) => sum + order.total, 0);

      const now = new Date();
      const periodStart = startOfDay(now);
      if (period === "7d") periodStart.setDate(periodStart.getDate() - 6);
      if (period === "30d") periodStart.setDate(periodStart.getDate() - 29);

      const periodCompleted = completed.filter(
        (order) => new Date(order.created_at) >= periodStart,
      );
      const periodSales = periodCompleted.reduce(
        (sum, order) => sum + order.total,
        0,
      );

      const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
      const trendDays = Math.min(days, 7);
      const trend: { label: string; amount: number }[] = [];

      for (let offset = trendDays - 1; offset >= 0; offset--) {
        const day = startOfDay(now);
        day.setDate(day.getDate() - offset);
        const key = dateKey(day);

        const amount = completed
          .filter((order) => dateKey(new Date(order.created_at)) === key)
          .reduce((sum, order) => sum + order.total, 0);

        trend.push({
          label: day.toLocaleDateString(undefined, { weekday: "short" }),
          amount,
        });
      }

      const statusCounts = orders.reduce(
        (counts, order) => {
          if (order.status === "completed") counts.completed++;
          else if (order.status === "processing" || order.status === "in progress") {
            counts.processing++;
          } else if (order.status === "pending" || order.status === "for approval") {
            counts.pending++;
          } else {
            counts.other++;
          }
          return counts;
        },
        { completed: 0, pending: 0, processing: 0, other: 0 },
      );

      const inventory = (inventoryRes.data || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        reorder_level: Number(item.reorder_level || 0),
      })) as InventoryItem[];

      setData({
        totalSales,
        periodSales,
        completedOrders: completed.length,
        totalOrders: orders.length,
        averageOrder: completed.length ? totalSales / completed.length : 0,
        customerCount: customersRes.count || 0,
        productCount: productsRes.count || 0,
        lowStock: inventory
          .filter((item) => item.quantity <= item.reorder_level)
          .slice(0, 6),
        recentOrders,
        trend,
        statusCounts,
      });
    } catch (e: any) {
      setError(e.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/pos";
        return;
      }

      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "PrintWise User";

      const role = String(
        user.app_metadata?.role || user.user_metadata?.role || "admin",
      ).toLowerCase();

      setUserName(name);
      setIsAdmin(role === "admin");
    };

    boot();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  useEffect(() => {
    if (isAdmin === true) loadStaff();
  }, [isAdmin]);

  const refreshAll = async () => {
    await loadDashboard();
    if (isAdmin === true) await loadStaff();
  };

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setStaffError("");
    setStaffMessage("");

    if (form.password !== form.confirmPassword) {
      setStaffError("Passwords do not match.");
      return;
    }

    setSavingStaff(true);

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          action: "create",
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Unable to create staff account.");
      }

      setStaffMessage(`${form.name} was added successfully.`);
      setForm({ name: "", email: "", password: "", confirmPassword: "" });
      setShowStaffModal(false);
      loadStaff();
    } catch (e: any) {
      setStaffError(e.message || "Unable to create staff account.");
    } finally {
      setSavingStaff(false);
    }
  };

  const staffAction = async (
    staffId: string,
    action: "toggle_active" | "reset_password",
    active?: boolean,
  ) => {
    setStaffError("");
    setStaffMessage("");

    let password = "";
    if (action === "reset_password") {
      password =
        window.prompt("Enter the new password (minimum 6 characters):") || "";
      if (!password) return;
    }

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action, staffId, active, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Staff update failed.");
      }

      setStaffMessage(
        action === "reset_password"
          ? "Password updated successfully."
          : active
            ? "Staff account activated."
            : "Staff account deactivated.",
      );
      loadStaff();
    } catch (e: any) {
      setStaffError(e.message || "Staff update failed.");
    }
  };

  const maxTrend = Math.max(...data.trend.map((item) => item.amount), 1);
  const periodLabel =
    period === "today"
      ? "Today"
      : period === "7d"
        ? "Last 7 Days"
        : "Last 30 Days";

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="workspace dashboard-workspace dashboard-v2">
        <header className="dashboard-header dashboard-hero">
          <div>
            <div className="eyebrow">
              <CalendarDays size={14} /> PRINTWISE COMMAND CENTER
            </div>
            <h1>
              {greeting}, {userName.split(" ")[0]}! 👋
            </h1>
            <p>
              Here’s a live overview of your sales, orders, customers, products,
              and inventory.
            </p>
          </div>

          <div className="dashboard-actions">
            <button
              className="refresh-dashboard"
              onClick={refreshAll}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "REFRESHING..." : "REFRESH DATA"}
            </button>
            <a className="quick-pos" href="/pos">
              <ShoppingCart size={18} /> OPEN POS
            </a>
          </div>
        </header>

        <div className="dashboard-period-bar">
          <div>
            <span className="period-label">SALES OVERVIEW</span>
            <strong>{periodLabel}</strong>
          </div>

          <div className="period-tabs">
            {(["today", "7d", "30d"] as const).map((value) => (
              <button
                key={value}
                className={period === value ? "active" : ""}
                onClick={() => setPeriod(value)}
              >
                {value === "today" ? "Today" : value === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        <div className="dashboard-stats dashboard-kpis">
          <article className="dash-stat primary-stat">
            <div className="stat-icon sales">
              <Banknote size={22} />
            </div>
            <div>
              <span>Total Sales</span>
              <strong>{currency(data.totalSales)}</strong>
              <small>
                <CheckCircle2 size={14} /> All completed transactions
              </small>
            </div>
          </article>

          <article className="dash-stat">
            <div className="stat-icon today">
              <TrendingUp size={22} />
            </div>
            <div>
              <span>{periodLabel} Sales</span>
              <strong>{currency(data.periodSales)}</strong>
              <small>Based on completed orders</small>
            </div>
          </article>

          <article className="dash-stat">
            <div className="stat-icon orders">
              <ReceiptText size={22} />
            </div>
            <div>
              <span>Completed Orders</span>
              <strong>{data.completedOrders}</strong>
              <small>{data.totalOrders} total orders recorded</small>
            </div>
          </article>

          <article className="dash-stat">
            <div className="stat-icon customers">
              <Users size={22} />
            </div>
            <div>
              <span>Customers</span>
              <strong>{data.customerCount}</strong>
              <small>Registered customers</small>
            </div>
          </article>
        </div>

        <div className="dashboard-analytics-grid">
          <section className="dashboard-card sales-trend-card">
            <div className="card-title">
              <div>
                <h2>Sales Trend</h2>
                <p>Completed sales for the most recent days.</p>
              </div>
              <span className="card-chip">
                <TrendingUp size={14} /> {currency(data.periodSales)}
              </span>
            </div>

            <div className="sales-bars">
              {data.trend.map((item) => (
                <div className="sales-bar-item" key={item.label}>
                  <div className="sales-bar-track">
                    <div
                      className="sales-bar-fill"
                      style={{
                        height: `${Math.max(
                          (item.amount / maxTrend) * 100,
                          item.amount > 0 ? 8 : 2,
                        )}%`,
                      }}
                      title={currency(item.amount)}
                    />
                  </div>
                  <b>{item.label}</b>
                  <small>{item.amount > 0 ? `₱${Math.round(item.amount)}` : "₱0"}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-card order-health-card">
            <div className="card-title">
              <div>
                <h2>Order Health</h2>
                <p>Current order activity.</p>
              </div>
              <CircleDollarSign size={22} />
            </div>

            <div className="health-list">
              <div>
                <span className="health-dot completed" />
                <b>Completed</b>
                <strong>{data.statusCounts.completed}</strong>
              </div>
              <div>
                <span className="health-dot pending" />
                <b>Pending</b>
                <strong>{data.statusCounts.pending}</strong>
              </div>
              <div>
                <span className="health-dot processing" />
                <b>Processing</b>
                <strong>{data.statusCounts.processing}</strong>
              </div>
              <div>
                <span className="health-dot other" />
                <b>Other</b>
                <strong>{data.statusCounts.other}</strong>
              </div>
            </div>

            <div className="average-order">
              <span>Average Completed Order</span>
              <strong>{currency(data.averageOrder)}</strong>
            </div>
          </section>
        </div>

        <div className="dashboard-main-grid">
          <section className="dashboard-card recent-card">
            <div className="card-title">
              <div>
                <h2>Recent Transactions</h2>
                <p>Latest activity from your PrintWise POS.</p>
              </div>
              <a href="/orders">
                VIEW ALL <ArrowRight size={16} />
              </a>
            </div>

            <div className="transaction-list">
              {loading ? (
                <div className="dashboard-empty">Loading dashboard data...</div>
              ) : data.recentOrders.length === 0 ? (
                <div className="dashboard-empty">
                  No transactions yet. Start selling from the Point of Sale.
                </div>
              ) : (
                data.recentOrders.map((order) => (
                  <div className="transaction" key={order.id}>
                    <div className="transaction-icon">
                      <ReceiptText size={18} />
                    </div>
                    <div className="transaction-info">
                      <b>{order.order_no}</b>
                      <span>{order.customer_name || "Walk-in Customer"}</span>
                    </div>
                    <div className="transaction-meta">
                      <strong>{currency(order.total)}</strong>
                      <small>{new Date(order.created_at).toLocaleString()}</small>
                    </div>
                    <span
                      className={`transaction-status status-${order.status.replace(/\s+/g, "-")}`}
                    >
                      {order.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="dashboard-card inventory-card">
            <div className="card-title">
              <div>
                <h2>Inventory Alerts</h2>
                <p>Items that need your attention.</p>
              </div>
              <a href="/inventory">
                MANAGE <ArrowRight size={16} />
              </a>
            </div>

            <div className="inventory-summary">
              <div>
                <Boxes size={20} />
                <span>Active Products</span>
                <b>{data.productCount}</b>
              </div>
              <div>
                <AlertTriangle size={20} />
                <span>Low Stock</span>
                <b>{data.lowStock.length}</b>
              </div>
            </div>

            <div className="low-stock-list">
              {loading ? (
                <div className="dashboard-empty">Checking inventory...</div>
              ) : data.lowStock.length === 0 ? (
                <div className="stock-good">
                  ✓ All tracked inventory is above the reorder level.
                </div>
              ) : (
                data.lowStock.map((item) => (
                  <div className="low-stock-item" key={item.id}>
                    <div>
                      <b>{item.name}</b>
                      <span>{item.category}</span>
                    </div>
                    <strong>
                      {item.quantity} {item.unit}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="dashboard-bottom-grid quick-dashboard-actions">
          <a className="action-card" href="/pos">
            <div className="action-icon">
              <ShoppingCart size={21} />
            </div>
            <div>
              <b>Start a New Sale</b>
              <span>Open Point of Sale</span>
            </div>
            <ArrowRight size={18} />
          </a>

          <a className="action-card" href="/project-costing">
            <div className="action-icon">
              <Calculator size={21} />
            </div>
            <div>
              <b>Create Project Costing</b>
              <span>Calculate expenses and profit</span>
            </div>
            <ArrowRight size={18} />
          </a>

          <a className="action-card" href="/gcash-bayad">
            <div className="action-icon">
              <CreditCard size={21} />
            </div>
            <div>
              <b>GCash / Bayad</b>
              <span>Review payment transactions</span>
            </div>
            <ArrowRight size={18} />
          </a>
        </div>

        {isAdmin && (
          <section className="staff-section">
            <div className="staff-section-head">
              <div>
                <div className="staff-kicker">
                  <ShieldCheck size={16} /> ADMIN ONLY
                </div>
                <h2>Staff Management</h2>
                <p>
                  Create and manage staff accounts directly from your PrintWise
                  Dashboard.
                </p>
              </div>

              <button
                className="add-staff-btn"
                onClick={() => {
                  setStaffError("");
                  setStaffMessage("");
                  setShowStaffModal(true);
                }}
              >
                <UserPlus size={18} /> ADD STAFF ACCOUNT
              </button>
            </div>

            {staffMessage && <div className="staff-message">✓ {staffMessage}</div>}
            {staffError && <div className="staff-error">{staffError}</div>}

            <div className="staff-grid">
              <div className="staff-summary">
                <Users size={22} />
                <div>
                  <span>Total Staff</span>
                  <strong>{staff.length}</strong>
                </div>
              </div>
              <div className="staff-summary">
                <UserCheck size={22} />
                <div>
                  <span>Active</span>
                  <strong>{staff.filter((member) => member.active).length}</strong>
                </div>
              </div>
              <div className="staff-summary">
                <UserX size={22} />
                <div>
                  <span>Inactive</span>
                  <strong>{staff.filter((member) => !member.active).length}</strong>
                </div>
              </div>
            </div>

            <div className="staff-table-wrap">
              <div className="staff-table-head">
                <span>STAFF MEMBER</span>
                <span>ROLE</span>
                <span>STATUS</span>
                <span>ACTIONS</span>
              </div>

              {staffLoading ? (
                <div className="dashboard-empty">Loading staff accounts...</div>
              ) : staff.length === 0 ? (
                <div className="staff-empty">
                  <Users size={28} />
                  <b>No staff accounts yet</b>
                  <span>
                    Click “Add Staff Account” to register your first staff member.
                  </span>
                </div>
              ) : (
                staff.map((member) => (
                  <div className="staff-row" key={member.id}>
                    <div className="staff-person">
                      <div className="staff-avatar">
                        {member.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <b>{member.name}</b>
                        <span>{member.email}</span>
                      </div>
                    </div>
                    <span className="role-badge">{member.role}</span>
                    <span
                      className={`status-badge ${member.active ? "active" : "inactive"}`}
                    >
                      {member.active ? "Active" : "Inactive"}
                    </span>
                    <div className="staff-actions">
                      <button
                        title="Reset password"
                        onClick={() => staffAction(member.id, "reset_password")}
                      >
                        <KeyRound size={16} />
                      </button>
                      <button
                        className={member.active ? "danger" : "success"}
                        onClick={() =>
                          staffAction(member.id, "toggle_active", !member.active)
                        }
                      >
                        {member.active ? <UserX size={16} /> : <UserCheck size={16} />}
                        <span>{member.active ? "Deactivate" : "Activate"}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {showStaffModal && (
          <div className="staff-modal-backdrop">
            <form className="staff-modal" onSubmit={createStaff}>
              <button
                type="button"
                className="staff-close"
                onClick={() => setShowStaffModal(false)}
              >
                <X size={21} />
              </button>

              <div className="staff-modal-icon">
                <UserPlus size={24} />
              </div>
              <h2>Add Staff Account</h2>
              <p>Create a separate account for your PrintWise staff member.</p>

              <label>
                Full Name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>
                Email Address
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <div className="staff-form-row">
                <label>
                  Password
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                <label>
                  Confirm Password
                  <input
                    required
                    minLength={6}
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="role-info">
                <ShieldCheck size={18} />
                <div>
                  <b>Role: Staff</b>
                  <span>
                    Staff accounts will use the staff interface and should not have
                    access to Admin Management.
                  </span>
                </div>
              </div>

              <div className="staff-modal-actions">
                <button type="button" onClick={() => setShowStaffModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={savingStaff}>
                  {savingStaff ? "CREATING..." : "CREATE STAFF ACCOUNT"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
