"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ReceiptText, Search, User, CalendarDays, Package } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./orders.css";

type Order = { id: string; order_no: string; customer_name: string | null; total: number; amount_paid: number; status: string; created_at: string };

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrders = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = "/pos"; return; }
      const { data, error } = await supabase
        .from("pos_orders")
        .select("id,order_no,customer_name,total,amount_paid,status,created_at")
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      else setOrders((data ?? []).map(order => ({ ...order, total: Number(order.total), amount_paid: Number(order.amount_paid) })));
      setLoading(false);
    };
    loadOrders();
  }, []);

  const filtered = orders.filter(order => `${order.order_no} ${order.customer_name || ""} ${order.status}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ReceiptText size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/pos"><ArrowLeft size={19} /><span>Point of Sale</span></a>
      <a className="nav-item active" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
      <a className="nav-item" href="/products"><Package size={19} /><span>Products & Services</span></a>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><h1>Orders</h1><p>View completed PrintWise POS transactions.</p></div></header>
      <div className="pos-layout" style={{ gridTemplateColumns: "1fr" }}>
        <section className="catalog-panel">
          <div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number, customer, or status..." /></div>
          {error && <div className="message">Unable to load orders: {error}</div>}
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>
              {loading ? <tr><td colSpan={6}>Loading orders...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6}>No orders found.</td></tr> : filtered.map(order => <tr key={order.id}><td><b>{order.order_no}</b></td><td><User size={14} /> {order.customer_name || "Walk-in Customer"}</td><td><CalendarDays size={14} /> {new Date(order.created_at).toLocaleString()}</td><td>₱{order.total.toFixed(2)}</td><td>₱{order.amount_paid.toFixed(2)}</td><td><span className="order-status">{order.status}</span></td></tr>)}
            </tbody></table>
          </div>
        </section>
      </div>
    </section>
  </main>;
}
