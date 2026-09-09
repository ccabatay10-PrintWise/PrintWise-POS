"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, FolderOpen, Loader2, Printer, Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Order = {
  id: string;
  order_no: string;
  customer_name: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance?: number;
  status: string;
  created_at: string;
  transacted_by?: string;
};

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value || 0));
const statusText = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "Completed";
  if (normalized === "voided") return "Voided";
  if (normalized === "draft") return "Draft";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Pending";
};

function printDocument(order: Order, kind: "receipt" | "slip" | "order") {
  const title = kind === "receipt" ? "Receipt" : kind === "slip" ? "Payment Slip" : "Order";
  const customer = order.customer_name || "Walk-in Customer";
  const date = new Date(order.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} - ${order.order_no}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#17243a}main{max-width:760px;margin:auto}h1{margin:0 0 4px;font-size:24px}h2{margin:20px 0 8px;font-size:16px}p{margin:5px 0;color:#536b88}.head{display:flex;justify-content:space-between;border-bottom:1px solid #d9e2ec;padding-bottom:14px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:18px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #edf1f5;padding:9px 0}.total{font-size:18px;font-weight:800;border-top:2px solid #17243a;margin-top:12px;padding-top:12px}@media print{body{padding:10mm}}</style></head><body><main><div class="head"><div><h1>PRINTWISE</h1><p>${title}</p></div><strong>${order.order_no}</strong></div><div class="meta"><div><b>Customer</b><br>${customer}</div><div><b>Date</b><br>${date}</div><div><b>Status</b><br>${statusText(order.status)}</div><div><b>Transacted By</b><br>${order.transacted_by || "Not recorded"}</div></div><h2>Order Summary</h2><div class="row"><span>Subtotal</span><b>${money(order.subtotal)}</b></div><div class="row"><span>Discount</span><b>- ${money(order.discount_amount)}</b></div><div class="row total"><span>Total</span><b>${money(order.total)}</b></div><div class="row"><span>Amount Paid</span><b>${money(order.amount_paid)}</b></div><div class="row"><span>Balance</span><b>${money(Math.max(0, Number(order.balance || 0)))} </b></div></main><script>window.onload=()=>{window.focus();window.print();setTimeout(()=>window.close(),500)}</script></body></html>`;
  const popup = window.open("", "_blank", "width=820,height=720");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
}

export default function OrdersQuickModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"orders" | "unpaid">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleQuickOrder = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".wise-quick-action") as HTMLElement | null;
      if (!button) return;
      const label = button.querySelector("span")?.textContent?.trim().toLowerCase();
      if (label !== "orders") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    document.addEventListener("click", handleQuickOrder, true);
    return () => document.removeEventListener("click", handleQuickOrder, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in again.");
        const response = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to load orders.");
        if (active) setOrders((payload.orders ?? []).map((order: any) => ({
          ...order,
          subtotal: Number(order.subtotal || 0),
          discount_amount: Number(order.discount_amount || 0),
          total: Number(order.total || 0),
          amount_paid: Number(order.amount_paid || 0),
          balance: Number(order.balance || 0),
        })));
      } catch (err: any) {
        if (active) setError(err?.message || "Unable to load orders.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = tab === "unpaid"
      ? orders.filter((order) => String(order.status).toLowerCase() === "draft" || Number(order.balance || 0) > 0)
      : orders;
    return source.filter((order) => `${order.order_no} ${order.customer_name || ""} ${order.transacted_by || ""} ${order.status}`.toLowerCase().includes(term));
  }, [orders, search, tab]);

  const unpaidCount = orders.filter((order) => String(order.status).toLowerCase() === "draft" || Number(order.balance || 0) > 0).length;

  if (!open) return null;

  return <div className="wise-orders-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="wise-orders-modal" role="dialog" aria-modal="true" aria-label="Orders">
      <header className="wise-orders-head"><div><h2>Orders</h2><p>View, reopen, print, and manage POS orders.</p></div><button type="button" className="wise-orders-close" onClick={() => setOpen(false)} aria-label="Close"><X size={21} /></button></header>
      <div className="wise-orders-tabs"><button type="button" className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><ClipboardList size={17} /> Orders</button><button type="button" className={tab === "unpaid" ? "active" : ""} onClick={() => setTab("unpaid")}><Clock3 size={17} /> Draft &amp; Unpaid ({unpaidCount})</button></div>
      <div className="wise-orders-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by order number, receipt number, or notes" /></div>
      {error && <div className="wise-orders-error">{error}</div>}
      <div className="wise-orders-list">
        {loading ? <div className="wise-orders-empty"><Loader2 className="wise-spin" size={28} /><strong>Loading orders...</strong><span>Fetching the latest POS orders.</span></div> : filtered.length ? filtered.map((order) => {
          const unpaid = String(order.status).toLowerCase() === "draft" || Number(order.balance || 0) > 0;
          return <article className="wise-order-card" key={order.id}>
            <div className="wise-order-main"><div className="wise-order-title"><strong>{order.order_no}</strong><span className={`wise-order-status ${String(order.status).toLowerCase()}`}>{statusText(order.status)}</span><span className={`wise-order-paid ${unpaid ? "unpaid" : "paid"}`}>{unpaid ? "Unpaid" : "Paid"}</span></div><div className="wise-order-meta"><span><CalendarDays size={16} />{new Date(order.created_at).toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" })}</span><span><Clock3 size={16} />{new Date(order.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</span></div>{order.customer_name && <div className="wise-order-customer"><FileText size={15} />{order.customer_name}</div>}</div>
            <div className="wise-order-actions"><strong>{money(order.total)}</strong><div><button type="button" className="primary" onClick={() => { window.location.assign(`/orders?orderId=${encodeURIComponent(order.id)}`); }}><FolderOpen size={17} /> Open</button>{!unpaid && <button type="button" onClick={() => printDocument(order, "receipt")}><Printer size={17} /> Receipt</button>}<button type="button" onClick={() => printDocument(order, "slip")}><FileText size={17} /> Slip</button><ChevronRight size={19} className="wise-order-arrow" /></div></div>
          </article>;
        }) : <div className="wise-orders-empty"><CheckCircle2 size={30} /><strong>{tab === "unpaid" ? "No draft or unpaid orders" : "No orders found"}</strong><span>{search ? "Try another search term." : "Orders created through WISE POS will appear here."}</span></div>}
      </div>
      <footer className="wise-orders-footer">Showing {filtered.length} order{filtered.length === 1 ? "" : "s"}<span> · {orders.length} total loaded</span></footer>
    </section>
  </div>;
}
