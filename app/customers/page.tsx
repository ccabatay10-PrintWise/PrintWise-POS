"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserRound, Eye, X, ReceiptText, ShoppingBag, PhilippinePeso, CalendarDays, Mail, Phone, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import Sidebar from "../components/Sidebar";
import "./customers.css";

type OrderItem = { item_name: string | null; quantity: number | null; unit_price: number | null; line_total: number | null };
type Payment = { channel: string | null; transaction_type: string | null; amount: number | null; status: string | null };
type CustomerOrder = {
  id: string; order_no: string | null; customer_name: string | null; subtotal: number | null; discount_amount: number | null;
  total: number | null; amount_paid: number | null; balance: number | null; status: string | null; created_at: string;
  items?: OrderItem[]; payments?: Payment[];
};
type Customer = { name: string; orders: number; totalSpent: number; lastOrder: string; history: CustomerOrder[] };

const peso = (n: number) => `₱${n.toFixed(2)}`;
const dateTime = (value: string) => new Date(value).toLocaleString();

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true); setMessage("");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) { window.location.href = "/pos"; return; }
        const response = await fetch("/api/customers", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Unable to load customers.");

        const map = new Map<string, Customer>();
        for (const order of (payload.orders || []) as CustomerOrder[]) {
          const name = String(order.customer_name || "").trim(); if (!name) continue;
          const key = name.toLowerCase();
          const existing = map.get(key);
          if (existing) { existing.orders += 1; existing.totalSpent += Number(order.total || 0); existing.lastOrder = new Date(order.created_at) > new Date(existing.lastOrder) ? order.created_at : existing.lastOrder; existing.history.push(order); }
          else map.set(key, { name, orders: 1, totalSpent: Number(order.total || 0), lastOrder: order.created_at, history: [order] });
        }
        for (const customer of map.values()) customer.history.sort((a, b) => b.created_at.localeCompare(a.created_at));
        setCustomers(Array.from(map.values()).sort((a, b) => b.lastOrder.localeCompare(a.lastOrder)));
      } catch (error) { setCustomers([]); setMessage(error instanceof Error ? error.message : "Unable to load customers."); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = useMemo(() => customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())), [customers, search]);
  const totalSales = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders = customers.reduce((s, c) => s + c.orders, 0);

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace customers-workspace">
        <header className="topbar customer-header">
          <div><div className="customer-eyebrow">CUSTOMER MANAGEMENT</div><h1>Customers</h1><p>Manage customer profiles, order history, and transaction activity.</p></div>
          <div className="customer-header-badge"><UsersIcon /> <span>{customers.length} Customers</span></div>
        </header>

        <section className="customer-stat-grid">
          <div className="customer-stat"><div className="stat-icon"><UserRound size={20}/></div><div><span>Total Customers</span><strong>{customers.length}</strong><small>Recorded customers</small></div></div>
          <div className="customer-stat"><div className="stat-icon"><ShoppingBag size={20}/></div><div><span>Total Orders</span><strong>{totalOrders}</strong><small>Completed transactions</small></div></div>
          <div className="customer-stat"><div className="stat-icon"><PhilippinePeso size={20}/></div><div><span>Customer Sales</span><strong>{peso(totalSales)}</strong><small>Total customer spending</small></div></div>
        </section>

        <section className="customer-panel">
          <div className="customer-toolbar">
            <div><h2>Customer Directory</h2><p>Select a customer to view complete transaction history.</p></div>
            <label className="customer-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer name..."/><kbd>⌘ K</kbd></label>
          </div>
          {message && <div className="message">{message}</div>}
          <div className="customer-table-wrap">
            <table className="customer-table"><thead><tr><th>Customer</th><th>Orders</th><th>Total Spent</th><th>Last Order</th><th className="action-head">Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5}><div className="customer-empty">Loading customer records...</div></td></tr> : filtered.length === 0 ? <tr><td colSpan={5}><div className="customer-empty"><UserRound size={30}/><strong>No customer records found</strong><span>Customer names will appear here after completed orders.</span></div></td></tr> : filtered.map(customer => (
                  <tr key={customer.name.toLowerCase()} onDoubleClick={() => setSelected(customer)}>
                    <td><div className="customer-name-cell"><div className="customer-avatar">{customer.name.slice(0,1).toUpperCase()}</div><div><b>{customer.name}</b><span>Customer profile</span></div></div></td>
                    <td><span className="order-count">{customer.orders}</span></td><td><b>{peso(customer.totalSpent)}</b></td><td><span className="date-cell">{dateTime(customer.lastOrder)}</span></td>
                    <td className="action-cell"><button className="customer-view-btn" onClick={() => setSelected(customer)}><Eye size={16}/> View <ChevronRight size={15}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selected && <div className="customer-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <section className="customer-modal" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close"><X/></button>
            <div className="customer-profile-head"><div className="profile-avatar">{selected.name.slice(0,1).toUpperCase()}</div><div><div className="customer-eyebrow">CUSTOMER PROFILE</div><h2>{selected.name}</h2><span>Customer since {new Date(selected.history[selected.history.length-1]?.created_at || selected.lastOrder).toLocaleDateString()}</span></div></div>
            <div className="profile-stats"><div><span>Total Orders</span><b>{selected.orders}</b></div><div><span>Total Spent</span><b>{peso(selected.totalSpent)}</b></div><div><span>Average Order</span><b>{peso(selected.orders ? selected.totalSpent / selected.orders : 0)}</b></div><div><span>Last Order</span><b>{new Date(selected.lastOrder).toLocaleDateString()}</b></div></div>
            <div className="profile-section"><div className="section-title"><ReceiptText size={18}/><div><h3>Order History</h3><p>Complete transaction activity for this customer.</p></div></div>
              <div className="history-list">{selected.history.map(order => <button className="history-row" key={order.id} onClick={() => setSelectedOrder(order)}><div><b>{order.order_no || `Order ${order.id.slice(0,8)}`}</b><span>{dateTime(order.created_at)} · {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? "" : "s"}</span></div><div className="history-total"><b>{peso(Number(order.total || 0))}</b><span className={`status-pill ${String(order.status || "").toLowerCase()}`}>{order.status || "Completed"}</span></div><ChevronRight size={17}/></button>)}</div>
            </div>
            <div className="profile-footer"><span><CalendarDays size={16}/> Last activity: {dateTime(selected.lastOrder)}</span><button onClick={() => setSelected(null)}>Close</button></div>
          </section>
        </div>}

        {selectedOrder && <div className="customer-overlay nested" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
          <section className="order-detail-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setSelectedOrder(null)}><X/></button>
            <div className="customer-eyebrow">TRANSACTION DETAILS</div><h2>{selectedOrder.order_no || "Order Details"}</h2><p className="order-detail-date">{dateTime(selectedOrder.created_at)}</p>
            <div className="detail-cards"><div><span>Subtotal</span><b>{peso(Number(selectedOrder.subtotal || 0))}</b></div><div><span>Discount</span><b>- {peso(Number(selectedOrder.discount_amount || 0))}</b></div><div><span>Total</span><b>{peso(Number(selectedOrder.total || 0))}</b></div><div><span>Paid</span><b>{peso(Number(selectedOrder.amount_paid || 0))}</b></div></div>
            <h3>Items</h3><div className="detail-items">{(selectedOrder.items || []).map((item, i) => <div className="detail-item" key={`${item.item_name}-${i}`}><span>{item.quantity || 0} × {item.item_name || "Item"}</span><b>{peso(Number(item.line_total || 0))}</b></div>)}</div>
            <h3>Payment</h3><div className="payment-detail">{(selectedOrder.payments || []).length ? selectedOrder.payments?.map((p,i) => <div key={i}><span>{p.channel || p.transaction_type || "Payment"}</span><b>{peso(Number(p.amount || 0))}</b></div>) : <span>No payment details recorded.</span>}</div>
            <div className="order-detail-footer"><span>Status: <b>{selectedOrder.status || "Completed"}</b></span><button onClick={() => setSelectedOrder(null)}>Close</button></div>
          </section>
        </div>}
      </section>
    </main>
  );
}

function UsersIcon() { return <UserRound size={17}/>; }
