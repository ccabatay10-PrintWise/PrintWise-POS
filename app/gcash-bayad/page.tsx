"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Layers3,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Order = {
  id: string;
  order_no: string;
  customer_name: string | null;
  total: number;
  amount_paid: number;
  status: string;
  created_at: string;
};

const nav = [
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Orders", "/orders"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [Layers3, "Inventory", "/inventory"],
  [FileText, "Reports", "/reports"],
] as const;

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);

export default function GCashBayadPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("pos_orders")
      .select("id,order_no,customer_name,total,amount_paid,status,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Unable to load payment transactions: ${error.message}`);
    } else {
      setOrders(
        (data ?? []).map((o: any) => ({
          ...o,
          total: Number(o.total || 0),
          amount_paid: Number(o.amount_paid || 0),
        }))
      );
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/pos";
      else load();
    });
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return orders;
    return orders.filter((o) =>
      `${o.order_no} ${o.customer_name || ""} ${o.status || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [orders, search]);

  const completed = filtered.filter(
    (o) => o.status?.toLowerCase() === "completed"
  );
  const collected = completed.reduce((sum, o) => sum + o.amount_paid, 0);
  const outstanding = filtered.reduce(
    (sum, o) => sum + Math.max(0, o.total - o.amount_paid),
    0
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Wallet size={21} /></div>
          <span>PRINTWISE</span>
        </div>
        <div className="nav-label">MAIN MENU</div>
        {nav.map(([Icon, label, href]) => (
          <a
            key={label}
            href={href}
            className={`nav-item ${label === "GCash / Bayad" ? "active" : ""}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </a>
        ))}
      </aside>

      <section className="workspace payment-workspace">
        <header className="topbar payment-header">
          <div>
            <div className="eyebrow">PAYMENT COLLECTIONS</div>
            <h1>GCash / Bayad</h1>
            <p>Review, search, and monitor collected payments from your PrintWise transactions.</p>
          </div>
          <button
            className="refresh-btn"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
            {refreshing ? "REFRESHING..." : "REFRESH"}
          </button>
        </header>

        <div className="payment-content">
          <section className="metric-grid">
            <article className="metric-card">
              <div className="metric-icon soft-green"><CheckCircle2 size={21} /></div>
              <div className="metric-copy">
                <span>Completed Payments</span>
                <strong>{completed.length}</strong>
                <small>Completed transactions</small>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-icon soft-red"><Wallet size={21} /></div>
              <div className="metric-copy">
                <span>Total Collected</span>
                <strong>{peso(collected)}</strong>
                <small>Amount paid by customers</small>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-icon soft-amber"><Banknote size={21} /></div>
              <div className="metric-copy">
                <span>Outstanding</span>
                <strong>{peso(outstanding)}</strong>
                <small>Remaining unpaid balance</small>
              </div>
            </article>
          </section>

          <section className="payment-channels">
            <article className="channel-card gcash-card">
              <div className="channel-top">
                <div className="channel-icon"><Wallet size={24} /></div>
                <div>
                  <h2>GCash</h2>
                  <p>Digital wallet payments</p>
                </div>
              </div>
              <div className="channel-divider" />
              <p className="channel-description">
                Review customer payments recorded through the POS checkout workflow.
              </p>
              <div className="channel-footer">
                <span>Payment monitoring</span>
                <ChevronRight size={17} />
              </div>
            </article>

            <article className="channel-card bayad-card">
              <div className="channel-top">
                <div className="channel-icon"><CreditCard size={24} /></div>
                <div>
                  <h2>Bayad</h2>
                  <p>Alternative payment collection</p>
                </div>
              </div>
              <div className="channel-divider" />
              <p className="channel-description">
                Keep a clear overview of collected and outstanding transaction balances.
              </p>
              <div className="channel-footer">
                <span>Collection overview</span>
                <ChevronRight size={17} />
              </div>
            </article>
          </section>

          <section className="transactions-card">
            <div className="transactions-head">
              <div>
                <h2>Payment Transactions</h2>
                <p>{filtered.length} transaction{filtered.length === 1 ? "" : "s"} shown</p>
              </div>
              <div className="search-box payment-search">
                <Search size={19} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search order, customer, or status..."
                />
              </div>
            </div>

            {message && <div className="message payment-message">{message}</div>}

            <div className="table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Order No.</th>
                    <th>Customer</th>
                    <th>Date & Time</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="empty-state">Loading payment transactions...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="empty-state">No payment transactions found.</td></tr>
                  ) : (
                    filtered.map((o) => {
                      const isCompleted = o.status?.toLowerCase() === "completed";
                      return (
                        <tr key={o.id}>
                          <td><span className="order-number">{o.order_no}</span></td>
                          <td>{o.customer_name || "Walk-in Customer"}</td>
                          <td className="date-cell">{new Date(o.created_at).toLocaleString()}</td>
                          <td className="amount-cell">{peso(o.total)}</td>
                          <td className="amount-cell paid-cell">{peso(o.amount_paid)}</td>
                          <td>
                            <span className={`status-badge ${isCompleted ? "completed" : "pending"}`}>
                              {o.status || "Unknown"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <style jsx>{`
          .payment-workspace { background: #f7f8fb; min-height: 100vh; }
          .payment-header { padding: 24px 30px; background: #fff; border-bottom: 1px solid #e8ecf2; }
          .eyebrow { color: #ef2620; font-size: 11px; font-weight: 800; letter-spacing: .12em; margin-bottom: 4px; }
          .payment-header h1 { margin: 0; font-size: 30px; letter-spacing: -.02em; }
          .payment-header p { margin: 5px 0 0; color: #64748b; }
          .refresh-btn { display: inline-flex; align-items: center; gap: 9px; border: 0; border-radius: 14px; padding: 15px 23px; background: linear-gradient(135deg,#ff2720,#e71611); color: #fff; font-weight: 800; letter-spacing: .02em; cursor: pointer; box-shadow: 0 10px 22px rgba(229,22,17,.18); transition: transform .2s, box-shadow .2s; }
          .refresh-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(229,22,17,.25); }
          .refresh-btn:disabled { opacity: .75; cursor: wait; }
          .spin { animation: spin 1s linear infinite; }
          .payment-content { padding: 28px 30px 36px; max-width: 1500px; width: 100%; margin: 0 auto; box-sizing: border-box; }
          .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
          .metric-card { background: #fff; border: 1px solid #e8ecf2; border-radius: 18px; padding: 20px; display: flex; gap: 15px; align-items: flex-start; box-shadow: 0 5px 18px rgba(15,23,42,.035); }
          .metric-icon { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; flex: 0 0 auto; }
          .soft-green { color: #15803d; background: #ecfdf3; }
          .soft-red { color: #e11d1a; background: #fff1f0; }
          .soft-amber { color: #b45309; background: #fff8e8; }
          .metric-copy { display: flex; flex-direction: column; min-width: 0; }
          .metric-copy span { font-size: 13px; color: #64748b; font-weight: 700; }
          .metric-copy strong { font-size: 27px; line-height: 1.15; margin: 5px 0 4px; color: #18202d; letter-spacing: -.02em; white-space: nowrap; }
          .metric-copy small { color: #94a3b8; font-size: 12px; }
          .payment-channels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
          .channel-card { background: #fff; border: 1px solid #e8ecf2; border-radius: 18px; padding: 21px; box-shadow: 0 5px 18px rgba(15,23,42,.035); transition: transform .2s, box-shadow .2s; }
          .channel-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,.08); }
          .channel-top { display: flex; align-items: center; gap: 13px; }
          .channel-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: #fff1f0; color: #e11d1a; }
          .channel-top h2 { margin: 0; font-size: 19px; }
          .channel-top p { margin: 3px 0 0; color: #64748b; font-size: 13px; }
          .channel-divider { height: 1px; background: #eef1f5; margin: 17px 0 13px; }
          .channel-description { color: #64748b; line-height: 1.55; font-size: 14px; margin: 0; min-height: 44px; }
          .channel-footer { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; color: #475569; font-size: 12px; font-weight: 700; }
          .transactions-card { margin-top: 18px; background: #fff; border: 1px solid #e8ecf2; border-radius: 18px; padding: 20px; box-shadow: 0 5px 18px rgba(15,23,42,.035); }
          .transactions-head { display: flex; justify-content: space-between; align-items: center; gap: 18px; margin-bottom: 18px; }
          .transactions-head h2 { margin: 0; font-size: 20px; }
          .transactions-head p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }
          .payment-search { width: min(430px, 100%); margin: 0; background: #f8fafc; border: 1px solid #e4e9f0; border-radius: 13px; min-height: 48px; }
          .payment-search input { background: transparent; }
          .table-wrap { overflow-x: auto; border: 1px solid #eef1f5; border-radius: 14px; }
          .payment-table { width: 100%; min-width: 780px; border-collapse: collapse; }
          .payment-table th { text-align: left; padding: 13px 16px; background: #f8fafc; color: #64748b; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; border-bottom: 1px solid #eef1f5; }
          .payment-table td { padding: 16px; border-bottom: 1px solid #eef1f5; color: #334155; font-size: 14px; vertical-align: middle; }
          .payment-table tbody tr:last-child td { border-bottom: 0; }
          .payment-table tbody tr:hover { background: #fcfcfd; }
          .order-number { font-weight: 800; color: #1e293b; }
          .date-cell { color: #64748b; white-space: nowrap; }
          .amount-cell { font-weight: 700; white-space: nowrap; }
          .paid-cell { color: #15803d; }
          .status-badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: capitalize; }
          .status-badge.completed { background: #ecfdf3; color: #15803d; }
          .status-badge.pending { background: #fff8e8; color: #a16207; }
          .empty-state { padding: 34px !important; text-align: center; color: #94a3b8 !important; }
          .payment-message { margin-bottom: 14px; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 900px) { .metric-grid { grid-template-columns: 1fr; } .payment-channels { grid-template-columns: 1fr; } .payment-header, .payment-content { padding-left: 18px; padding-right: 18px; } .transactions-head { align-items: stretch; flex-direction: column; } .payment-search { width: 100%; } }
        `}</style>
      </section>
    </main>
  );
}
