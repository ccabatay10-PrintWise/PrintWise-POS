"use client";

import { useEffect, useState } from "react";
import { ReceiptText, Search, User, CalendarDays, X, Printer, Calculator, Ban, ShieldCheck, AlertTriangle, Shirt, CupSoda, Sticker, Image, FileText, Barcode, Layers3, PenLine, CheckCircle2, ClipboardList, CircleDollarSign, CalendarClock, RefreshCw, Eye, Filter, ShoppingBag, TrendingUp, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./orders.css";
import Sidebar from "../components/Sidebar";

type Order = { id: string; order_no: string; customer_name: string | null; subtotal: number; discount_amount: number; total: number; amount_paid: number; status: string; created_at: string; transacted_by?: string; payment_channels?: string[]; };
type OrderItem = { id: string; product_id?: string | null; item_name: string; unit_price: number; quantity: number; line_total: number; icon?: string; image_url?: string | null; category?: string; };
type ProductVisualData = { id: string; icon_key?: string | null; image_url?: string | null; category?: string | null; };

function ProductIcon({ icon, size = 28 }: { icon?: string; size?: number }) {
  const p = { size, strokeWidth: 1.8 };
  if (icon === "shirt") return <Shirt {...p} />;
  if (icon === "mug") return <CupSoda {...p} />;
  if (icon === "sticker") return <Sticker {...p} />;
  if (icon === "photo") return <Image {...p} />;
  if (icon === "paper") return <FileText {...p} />;
  if (icon === "id") return <Barcode {...p} />;
  if (icon === "layers") return <Layers3 {...p} />;
  if (icon === "pen") return <PenLine {...p} />;
  return <Printer {...p} />;
}

function OrderItemVisual({ item }: { item: OrderItem }) {
  if (item.image_url) return <img className="order-item-image" src={item.image_url} alt="" />;
  return <div className="order-item-vector"><ProductIcon icon={item.icon} size={29} /></div>;
}

async function apiPost(path: string, body: unknown) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to complete this action.");
  return payload;
}

async function apiGet(path: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Unable to load orders.");
  return payload;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidPassword, setVoidPassword] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await apiGet("/api/orders");
        if (active) setOrders((payload.orders ?? []).map((o: any) => ({
          ...o,
          subtotal: Number(o.subtotal || 0),
          discount_amount: Number(o.discount_amount || 0),
          total: Number(o.total || 0),
          amount_paid: Number(o.amount_paid || 0),
        })));
      } catch (err: any) {
        if (active) setError(err?.message || "Unable to load orders.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch = String(o.order_no + " " + (o.customer_name || "") + " " + (o.transacted_by || "") + " " + o.status)
      .toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || String(o.status || "").toLowerCase() === statusFilter;
    const matchesPayment = paymentFilter === "all" || (o.payment_channels || []).some((channel) => paymentFilter === "gcash" ? channel.includes("gcash") : channel === paymentFilter);
    const orderDate = new Date(o.created_at);
    const matchesFrom = !dateFrom || orderDate >= new Date(dateFrom + "T00:00:00");
    const matchesTo = !dateTo || orderDate < new Date(dateTo + "T00:00:00").getTime() + 86400000;
    return matchesSearch && matchesStatus && matchesPayment && matchesFrom && matchesTo;
  });

  const completedOrders = orders.filter((o) => String(o.status || "").toLowerCase() === "completed");
  const voidedOrders = orders.filter((o) => String(o.status || "").toLowerCase() === "voided");
  const completedSales = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const refreshOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiGet("/api/orders");
      setOrders((payload.orders ?? []).map((o: any) => ({
        ...o,
        subtotal: Number(o.subtotal || 0),
        discount_amount: Number(o.discount_amount || 0),
        total: Number(o.total || 0),
        amount_paid: Number(o.amount_paid || 0),
      })));
    } catch (err: any) {
      setError(err?.message || "Unable to refresh orders.");
    } finally {
      setLoading(false);
    }
  };

  const openOrder = async (order: Order) => {
    setSelected(order);
    setItems([]);
    setLoadingItems(true);
    setError("");
    try {
      const [orderPayload, productsPayload] = await Promise.all([
        apiGet(`/api/orders?orderId=${encodeURIComponent(order.id)}`),
        apiGet("/api/products").catch(() => ({ products: [] })),
      ]);
      const productMap = new Map<string, ProductVisualData>(
        (productsPayload.products ?? []).map((product: any) => [String(product.id), product])
      );
      setItems((orderPayload.items ?? []).map((i: any) => {
        const product = productMap.get(String(i.product_id || ""));
        return {
          ...i,
          icon: product?.icon_key || "box",
          image_url: product?.image_url || null,
          category: product?.category || "Printing Service",
          unit_price: Number(i.unit_price || 0),
          quantity: Number(i.quantity || 0),
          line_total: Number(i.line_total || 0),
        };
      }));
    } catch (err: any) {
      setError(err?.message || "Unable to load order items.");
    } finally {
      setLoadingItems(false);
    }
  };

  const createCosting = () => {
    if (!selected) return;
    const quantity = Math.max(1, items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
    const projectName = items.length === 1 ? items[0].item_name : `Project - ${selected.order_no}`;
    sessionStorage.setItem(`printwise_costing_order_${selected.id}`, JSON.stringify({
      id: selected.id,
      order_no: selected.order_no,
      customer_name: selected.customer_name,
      total: selected.total,
      quantity,
      projectName,
    }));
    window.location.href = `/project-costing?orderId=${encodeURIComponent(selected.id)}`;
  };

  const requestVoid = () => {
    if (!selected || String(selected.status || "").toLowerCase() === "voided") return;
    setVoidPassword("");
    setVoidError("");
    setShowVoidModal(true);
  };

  const confirmVoid = async () => {
    if (!selected) return;
    if (!voidPassword) {
      setVoidError("Enter the admin password to continue.");
      return;
    }
    setVoiding(true);
    setVoidError("");
    try {
      await apiPost("/api/orders", { action: "void", orderId: selected.id, password: voidPassword });
      const updated = { ...selected, status: "voided" };
      setOrders((current) => current.map((order) => order.id === selected.id ? { ...order, status: "voided" } : order));
      setSelected(updated);
      setShowVoidModal(false);
      setVoidPassword("");
      setError(`Transaction ${selected.order_no} was voided successfully.`);
    } catch (err: any) {
      setVoidError(err?.message || "Unable to void this transaction.");
    } finally {
      setVoiding(false);
    }
  };

  const requestDelete = () => { if (!selected) return; setManagerEmail(""); setManagerPassword(""); setDeleteError(""); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    if (!selected) return;
    if (!managerEmail.trim() || !managerPassword) { setDeleteError("Enter the manager email and password to continue."); return; }
    setDeleting(true); setDeleteError("");
    try {
      await apiPost("/api/orders", { action: "delete", orderId: selected.id, managerEmail: managerEmail.trim(), managerPassword, reason: "Staff correction / transaction entered in error" });
      const orderNo = selected.order_no;
      setOrders(current => current.filter(order => order.id !== selected.id));
      setSelected(null); setShowDeleteModal(false); setManagerPassword("");
      setError(`Transaction ${orderNo} was deleted. An audit record was retained.`);
    } catch (err: any) { setDeleteError(err?.message || "Unable to delete transaction."); }
    finally { setDeleting(false); }
  };

  const escapeHtml = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const printInFrame = (html: string) => {
    // Print from the current Orders tab. An iframe can cause Edge to open
    // a separate about:blank window during reprints.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const printRoot = document.createElement("div");
    printRoot.id = "wise-orders-print-root";
    printRoot.innerHTML = parsed.body.innerHTML;
    const printStyle = document.createElement("style");
    printStyle.id = "wise-orders-print-style";
    const pageStyles = Array.from(parsed.head.querySelectorAll("style"))
      .map((style) => style.textContent || "")
      .join("\n");
    printStyle.textContent = pageStyles + `
      #wise-orders-print-root{display:none}
      @media print{
        @page{size:80mm auto;margin:0}
        html,body{width:80mm!important;min-width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important;background:#fff!important}
        body>*:not(#wise-orders-print-root){display:none!important}
        #wise-orders-print-root{display:block!important;position:static!important;width:80mm!important;margin:0!important;padding:0!important;overflow:visible!important}
      }`;
    document.head.appendChild(printStyle);
    document.body.appendChild(printRoot);
    const cleanup = () => {
      printRoot.remove();
      printStyle.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    try {
      window.print();
      window.setTimeout(cleanup, 15000);
    } catch {
      cleanup();
      alert("Unable to start printing. Please try again.");
    }
  };

  const reprintReceipt = async () => {
    if (!selected) return;
    const money = (value: number) => `₱${Number(value || 0).toFixed(2)}`;
    const subtotal = Number(selected.subtotal || items.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
    const discount = Math.max(0, Number(selected.discount_amount || 0));
    const total = Number(selected.total || Math.max(0, subtotal - discount));
    const amountPaid = Number(selected.amount_paid || total);
    const change = Math.max(0, amountPaid - total);
    const dateText = new Date(selected.created_at).toLocaleString();
    let storeSettings: any = {};
    try { const cached = localStorage.getItem("printwise-company-settings"); if (cached) storeSettings = JSON.parse(cached); } catch {}
    try {
      const { data } = await supabase.from("company_settings").select("business_name,tagline,address,contact_number,email,receipt_footer,logo_url").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (data) { storeSettings = { ...storeSettings, ...data }; try { localStorage.setItem("printwise-company-settings", JSON.stringify(storeSettings)); } catch {} }
    } catch {}
    const storeName = String(storeSettings.business_name || "PRINTWISE");
    const storeTagline = String(storeSettings.tagline || "Printing & Customized Services");
    const storeAddress = String(storeSettings.address || "");
    const storePhone = String(storeSettings.contact_number || "");
    const storeEmail = String(storeSettings.email || "");
    const storeFooter = String(storeSettings.receipt_footer || ("Thank you for choosing " + storeName + "!"));
    const rows = items.map((item) => `<tr><td class="item-name">${escapeHtml(item.item_name)}</td><td class="num">${Number(item.quantity || 0)}</td><td class="num">${money(item.unit_price)}</td><td class="num">${money(item.line_total)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(storeName)} Merchant Receipt - ${escapeHtml(selected.order_no)}</title>
<style>
*{box-sizing:border-box}@page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;width:80mm!important;min-width:80mm!important;max-width:80mm!important}body{font-size:10px;overflow-wrap:anywhere}.receipt{width:72mm;max-width:72mm;margin:0 auto;padding:3mm 0}.brand{text-align:center;border-bottom:1px dashed #333;padding-bottom:3mm;margin-bottom:2mm}.brand .logo{display:block;width:auto;max-width:42mm;max-height:20mm;object-fit:contain;margin:0 auto 2mm}.brand .logo-missing{font-size:9px;color:#777;margin:2mm 0}.brand h1{font-size:25px;letter-spacing:1px;margin:0;font-weight:900}.brand h3{font-size:10px;letter-spacing:2px;margin:0 0 5px}.brand .sub{border-top:1px solid #333;display:inline-block;padding-top:3px;font-size:9px;font-weight:700;letter-spacing:1px}.brand p{font-size:9px;margin:2px 0}.copy-title{display:flex;justify-content:space-between;align-items:center;gap:3px;border-bottom:1px dashed #333;padding:2mm 0;font-size:11px}.copy-title b{background:#111;color:#fff;padding:1.5mm;font-size:9px;white-space:nowrap}.meta{border-bottom:1px dashed #333;padding:2mm 0;display:grid;gap:1mm}.meta div{display:grid;grid-template-columns:22mm 1fr;gap:2mm}.meta span{font-weight:800}.meta b{text-align:right;font-weight:600;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:auto;font-size:9px}.items{padding:2mm 0;border-bottom:1px dashed #333}th{text-align:left;font-size:8px;border-bottom:1px dashed #333;padding:1.5mm .4mm}td{padding:1.5mm .4mm;vertical-align:top}.item-name{overflow-wrap:anywhere}.num{text-align:right;white-space:nowrap}.totals{padding:2mm 0;border-bottom:1px dashed #333;display:grid;gap:1.5mm}.totals div{display:flex;justify-content:space-between;gap:3mm}.totals b{font-weight:600;text-align:right}.totals .grand{border-top:1px dashed #333;border-bottom:1px dashed #333;padding:2mm 0;font-size:16px;font-weight:900}.totals .grand b{font-weight:900}.thanks{text-align:center;padding-top:3mm;font-size:10px;font-weight:900}.footer{text-align:center;font-size:9px}.reprint{text-align:center;font-size:8px;margin-top:3mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main class="receipt">
<header class="brand">${storeSettings.logo_url ? `<img class="logo" src="${escapeHtml(storeSettings.logo_url)}" alt="Store logo"/>` : `<div class="logo-missing">Store logo not configured</div>`}${storeTagline ? `<h3>${escapeHtml(storeTagline)}</h3>` : ""}${storeAddress ? `<p>${escapeHtml(storeAddress)}</p>` : ""}${storePhone ? `<p>Tel: ${escapeHtml(storePhone)}</p>` : ""}${storeEmail ? `<p>${escapeHtml(storeEmail)}</p>` : ""}</header>
<div class="copy-title"><strong>SALES RECEIPT</strong><b>MERCHANT COPY</b></div>
<section class="meta"><div><span>Receipt No.</span><b>${escapeHtml(selected.order_no)}</b></div><div><span>Date &amp; Time</span><b>${escapeHtml(dateText)}</b></div><div><span>Customer</span><b>${escapeHtml(selected.customer_name || "Walk-in Customer")}</b></div><div><span>Cashier</span><b>${escapeHtml(selected.transacted_by || "PrintWise Staff")}</b></div><div><span>Payment</span><b>PAID</b></div></section>
<div class="items"><table><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No order items found.</td></tr>'}</tbody></table></div>
<section class="totals"><div><span>Subtotal</span><b>${money(subtotal)}</b></div>${discount > 0 ? `<div><span>Discount</span><b>-${money(discount)}</b></div>` : ""}<div class="grand"><span>TOTAL</span><b>${money(total)}</b></div><div><span>Payment Method</span><b>Paid</b></div><div><span>Amount Paid</span><b>${money(amountPaid)}</b></div><div><span>Change</span><b>${money(change)}</b></div></section>
<p class="thanks">${escapeHtml(storeFooter)}</p><p class="footer">Please keep this receipt for your records.</p><p class="reprint">REPRINTED · MERCHANT COPY</p>
</main></body></html>`;
    printInFrame(html);
  };

  const printOrder = () => {
    if (!selected) return;
    const money = (value: number) => `₱${Number(value || 0).toFixed(2)}`;
    const date = new Date(selected.created_at);
    const contractDate = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const downPayment = Math.min(Number(selected.amount_paid || 0), Number(selected.total || 0));
    const remainingBalance = Math.max(Number(selected.total || 0) - downPayment, 0);
    const rows = items.map((i) => `<tr><td>${escapeHtml(i.item_name)}</td><td class="center">${Number(i.quantity || 0)}</td><td>${escapeHtml(i.item_name)}</td><td class="right">${money(i.unit_price)}</td><td class="right">${money(i.line_total)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Printing Order Contract - ${escapeHtml(selected.order_no)}</title><style>*{box-sizing:border-box}@page{size:A4 portrait;margin:8mm}body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#20242b}.contract{width:100%;max-width:194mm;margin:auto}.brand{text-align:center;font-size:26px;font-weight:900;letter-spacing:2px;padding:5mm 0}.title{text-align:center;font-size:19px;font-weight:900;margin-bottom:4mm}.red{color:#c91009}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding:0 2mm 2mm}.section{background:#2c2c2c;color:#fff;font-weight:900;text-transform:uppercase;padding:5px 7px;margin-top:2mm}.client{border:1px solid #aeb4ba;padding:8px;line-height:2}.line{display:inline-block;min-width:55%;border-bottom:1px solid #444;height:11px;vertical-align:middle;margin-left:4px}table{width:100%;border-collapse:collapse;margin-top:3mm}th{background:#c91009;color:#fff;border:1px solid #9f0c07;padding:5px;text-transform:uppercase}td{border:1px solid #9ea4aa;padding:6px}.center{text-align:center}.right{text-align:right}.summary td{font-weight:900}.terms{border:1px solid #aeb4ba;padding:8px;line-height:1.5}.signatures{display:grid;grid-template-columns:1fr 1fr;border:1px solid #9ea4aa}.sig{padding:8px;min-height:70px;border-right:1px solid #9ea4aa}.sig:last-child{border-right:0}.footer{margin-top:4mm;background:#2c2c2c;color:#fff;text-align:center;padding:6px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><div class="contract"><div class="brand">PRINTWISE</div><div class="title"><span class="red">PRINTING ORDER</span> CONTRACT</div><div class="meta"><span>CONTRACT NO.: <b>${escapeHtml(selected.order_no)}</b></span><span>DATE: <b>${escapeHtml(contractDate)}</b></span></div><div class="section">1. Client Information</div><div class="client"><b>Client Name / Company:</b> ${escapeHtml(selected.customer_name || "Walk-in Customer")}<br/><b>Address:</b> <span class="line"></span><br/><b>Contact No.:</b> <span class="line"></span></div><div class="section">2. Order Details</div><table><thead><tr><th>Product / Service</th><th>Qty.</th><th>Specifications</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="center">No order items found.</td></tr>'}</tbody></table><table class="summary"><tbody><tr><td colspan="4" class="right">TOTAL CONTRACT AMOUNT</td><td class="right">${money(selected.total)}</td></tr><tr><td colspan="2" class="right">DOWN PAYMENT</td><td class="right">${money(downPayment)}</td><td class="right">REMAINING BALANCE</td><td class="right">${money(remainingBalance)}</td></tr></tbody></table><div class="section">3. Terms & Conditions</div><div class="terms"><b>PAYMENT TERMS.</b> Production begins after the required down payment has been received. Balance must be settled before release or delivery unless otherwise agreed.<br/><b>QUALITY CONCERNS.</b> Verified production concerns must be reported within three (3) days from receipt, together with the order details and supporting photos when applicable.<br/><b>DESIGN APPROVAL.</b> Final artwork, spelling, sizes, colors, quantities, and specifications approved by the client will be used for production.<br/><b>FINAL AGREEMENT.</b> By signing this document, the client confirms that the order details and agreed terms have been reviewed and accepted.</div><div class="signatures"><div class="sig"><b>Client's Confirmation</b><br/><br/>Name: ______________________________<br/><br/>Signature: __________________________<br/><br/>Date: ______________________________</div><div class="sig"><b>PrintWise Authorized Representative</b><br/><br/>Name: ${escapeHtml(selected.transacted_by || "")}<br/><br/>Signature: __________________________<br/><br/>Date: ______________________________</div></div><div class="footer">PRINTWISE · Guiguinto, Bulacan, Philippines · Thank you for choosing PRINTWISE</div></div></body></html>`;
    printInFrame(html);
  };

  return <main className="app-shell">
    <Sidebar />
    <section className="workspace orders-workspace">
      <header className="topbar orders-topbar">
        <div>
          <div className="orders-eyebrow"><ReceiptText size={15} /> TRANSACTION MANAGEMENT</div>
          <h1>Orders</h1>
          <p>Review completed sales, customer transactions, and order documents in one place.</p>
        </div>
        <button className="orders-refresh-btn" onClick={refreshOrders} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} /> {loading ? "Refreshing..." : "Refresh"}</button>
      </header>
      <div className="orders-summary-grid">
        <div className="orders-summary-card"><div className="orders-summary-icon blue"><ShoppingBag size={21} /></div><div><span>Total Orders</span><strong>{orders.length}</strong><small>All recorded transactions</small></div></div>
        <div className="orders-summary-card"><div className="orders-summary-icon green"><CheckCircle2 size={21} /></div><div><span>Completed</span><strong>{completedOrders.length}</strong><small>Successfully paid sales</small></div></div>
        <div className="orders-summary-card"><div className="orders-summary-icon red"><Ban size={21} /></div><div><span>Voided</span><strong>{voidedOrders.length}</strong><small>Transactions kept for audit</small></div></div>
        <div className="orders-summary-card"><div className="orders-summary-icon gold"><TrendingUp size={21} /></div><div><span>Completed Sales</span><strong>₱{completedSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>Based on completed orders</small></div></div>
      </div>
      <section className="orders-content-card">
        <div className="orders-content-head"><div><h2>Transaction History</h2><p>{filtered.length} {filtered.length === 1 ? "transaction" : "transactions"} displayed</p></div>
          <div className="orders-tools">
            <div className="orders-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, customer, cashier..." />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}</div>
            <label className="orders-filter"><Filter size={16} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter order status"><option value="all">All Status</option><option value="completed">Completed</option><option value="voided">Voided</option></select><span className="orders-filter-chevron">⌄</span></label>
            <label className="orders-filter"><Filter size={16} /><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filter payment method"><option value="all">All Payments</option><option value="gcash">GCash</option><option value="cash">Cash</option><option value="maya">Maya</option><option value="credit_card">Credit Card</option><option value="e_wallet">eWallet</option></select><span className="orders-filter-chevron">⌄</span></label>
            <label className="orders-date-filter"><CalendarDays size={15} /><span>From</span><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" /></label>
            <label className="orders-date-filter"><CalendarDays size={15} /><span>To</span><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" /></label>
            {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear dates</button>}
          </div>
        </div>
        {error && <div className="message orders-message">{error}</div>}
        <div className="orders-table-wrap"><table className="orders-table orders-table-enhanced">
          <thead><tr><th>Order</th><th>Customer</th><th>Cashier</th><th>Date & Time</th><th className="num">Total</th><th className="num">Paid</th><th>Status</th><th className="action-col">Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><div className="orders-empty"><RefreshCw className="spin" size={22} /><span>Loading transactions...</span></div></td></tr> : filtered.length === 0 ? <tr><td colSpan={8}><div className="orders-empty"><ReceiptText size={28} /><strong>No transactions found</strong><span>Try another search or status filter.</span></div></td></tr> : filtered.map((o) => {
              const isVoided = String(o.status || "").toLowerCase() === "voided"; const date = new Date(o.created_at);
              return <tr key={o.id} onClick={() => openOrder(o)} className="order-table-row">
                <td><div className="order-number-cell"><div className="order-number-icon"><ReceiptText size={16} /></div><div><b>{o.order_no}</b><small>Transaction ID</small></div></div></td>
                <td><div className="order-person-cell"><div className="order-avatar"><User size={14} /></div><span>{o.customer_name || "Walk-in Customer"}</span></div></td>
                <td><span className="cashier-name">{o.transacted_by || "Not recorded"}</span></td>
                <td><div className="order-date-cell"><b>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</b><span>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div></td>
                <td className="num"><strong>₱{o.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td><td className="num"><span className="paid-amount">₱{o.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                <td><span className={"order-status enhanced-status " + (isVoided ? "voided" : "")}><span className="status-dot" />{o.status}</span></td>
                <td className="action-col"><button className="view-order-btn" onClick={(e) => { e.stopPropagation(); openOrder(o); }}><Eye size={15} /> View</button></td>
              </tr>; })}
          </tbody></table></div>
        <div className="orders-content-footer"><span>Showing <b>{filtered.length}</b> of <b>{orders.length}</b> transactions</span><span>Click any row to view complete order details</span></div>
      </section>
    </section>
{selected && <div className="order-details-backdrop"><div className="order-details-modal" role="dialog" aria-modal="true" aria-labelledby="order-details-title"><div className="order-details-header"><div className="order-details-title-wrap"><div className="order-details-brand"><ReceiptText size={30} /></div><div><h2 id="order-details-title"><span>ORDER</span> DETAILS</h2><p>View transaction information and manage this order.</p></div></div><button className="order-details-close" onClick={() => setSelected(null)} aria-label="Close order details"><X size={24} /></button></div><div className="order-details-rule" /><div className="order-details-mobile-meta"><b>{selected.order_no}</b><span>•</span><span>Transacted by: <strong>{selected.transacted_by || "Not recorded"}</strong></span></div><div className="order-meta-grid"><div className="order-meta-card"><div className="order-meta-icon"><ClipboardList size={22} /></div><div><span>ORDER NO.</span><b>{selected.order_no}</b></div></div><div className="order-meta-card"><div className="order-meta-icon"><CalendarClock size={22} /></div><div><span>DATE & TIME</span><b>{new Date(selected.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</b><small>{new Date(selected.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></div></div><div className="order-meta-card"><div className="order-meta-icon"><User size={22} /></div><div><span>TRANSACTED BY</span><b>{selected.transacted_by || "Not recorded"}</b><small>Cashier / Administrator</small></div></div><div className="order-meta-card status-card"><div><span>STATUS</span><div className={`order-detail-status ${String(selected.status || "").toLowerCase() === "voided" ? "is-voided" : ""}`}>{String(selected.status || "").toLowerCase() === "voided" ? <Ban size={18} /> : <CheckCircle2 size={18} />} {String(selected.status || "").toLowerCase() === "voided" ? "VOIDED" : String(selected.status || "").toUpperCase()}</div></div></div></div><div className="order-items-card"><div className="order-items-head"><span>ITEM</span><span>QTY</span><span>UNIT PRICE</span><span>TOTAL</span></div><div className="order-items-body">{loadingItems ? <div className="order-loading">Loading items...</div> : items.length === 0 ? <div className="order-loading">No order items found.</div> : items.map((i) => <div className="order-item-row" key={i.id}><div className="order-item-main"><OrderItemVisual item={i} /><div><b>{i.item_name}</b><small>{i.category || "Printing Service"}</small></div></div><strong>{i.quantity}</strong><strong>₱{i.unit_price.toFixed(2)}</strong><strong>₱{i.line_total.toFixed(2)}</strong></div>)}</div></div><div className="order-total-card"><div className="order-summary-intro"><div className="order-summary-icon"><CircleDollarSign size={38} /></div><div><b>ORDER SUMMARY</b><span>Review the total amount for this transaction.</span></div></div><div className="order-summary-values"><div><span>Subtotal</span><b>₱{selected.subtotal.toFixed(2)}</b></div><div><span>Discount</span><b>₱{selected.discount_amount.toFixed(2)}</b></div><div className="order-summary-total"><span>TOTAL AMOUNT</span><b>₱{selected.total.toFixed(2)}</b></div></div></div><div className="order-details-actions"><button className="order-action close" onClick={() => setSelected(null)}><X size={20} /> CLOSE</button><button className="order-action costing" onClick={createCosting} disabled={loadingItems || String(selected.status || "").toLowerCase() === "voided"}><Calculator size={20} /> CREATE COSTING</button><button className="order-action delete" onClick={requestDelete} disabled={deleting}><Trash2 size={20} /> DELETE TRANSACTION</button><button className="order-action void" onClick={requestVoid} disabled={voiding || String(selected.status || "").toLowerCase() === "voided"}><Ban size={20} /> {String(selected.status || "").toLowerCase() === "voided" ? "VOIDED" : "VOID TRANSACTION"}</button><button className="order-action print" onClick={reprintReceipt} disabled={loadingItems}><ReceiptText size={21} /> RE-PRINT RECEIPT</button><button className="order-action print" onClick={printOrder} disabled={loadingItems}><Printer size={21} /> PRINT CONTRACT / SAVE AS PDF</button></div></div></div>}{showDeleteModal && selected && <div className="void-modal-backdrop"><div className="void-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="void-modal-close" onClick={() => !deleting && setShowDeleteModal(false)} aria-label="Close"><X size={19} /></button><div className="void-modal-icon delete-icon"><Trash2 size={25} /></div><h2 id="delete-title">Manager Authorization Required</h2><p>Enter a <b>manager or admin account</b> to delete transaction <b>{selected.order_no}</b>.</p><div className="void-warning delete-warning"><AlertTriangle size={18} /><span>This removes the transaction from Orders and deletes its line items. Payment records and a deletion audit record are retained for accountability. This action cannot be undone from this screen.</span></div><label className="void-password-label">Manager Email<input autoFocus type="email" value={managerEmail} onChange={e=>setManagerEmail(e.target.value)} placeholder="manager@example.com" disabled={deleting}/></label><label className="void-password-label">Manager Password<input type="password" value={managerPassword} onChange={e=>setManagerPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmDelete()} placeholder="Enter manager password" disabled={deleting}/></label>{deleteError&&<div className="void-error">{deleteError}</div>}<div className="void-modal-actions"><button onClick={()=>setShowDeleteModal(false)} disabled={deleting}>Cancel</button><button className="delete-confirm-btn" onClick={confirmDelete} disabled={deleting||!managerEmail.trim()||!managerPassword}><Trash2 size={17}/>{deleting?"DELETING...":"CONFIRM DELETE"}</button></div></div></div>}{showVoidModal && selected && <div className="void-modal-backdrop"><div className="void-modal" role="dialog" aria-modal="true" aria-labelledby="void-title"><button className="void-modal-close" onClick={() => !voiding && setShowVoidModal(false)} aria-label="Close"><X size={19} /></button><div className="void-modal-icon"><ShieldCheck size={25} /></div><h2 id="void-title">Admin Authorization Required</h2><p>Enter the <b>admin password</b> before voiding <b>{selected.order_no}</b>.</p><div className="void-warning"><AlertTriangle size={18} /><span>This will mark the transaction as <b>VOIDED</b> and keep the record for order history and audit purposes.</span></div><label className="void-password-label">Admin Password<input autoFocus type="password" value={voidPassword} onChange={(e) => setVoidPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmVoid()} placeholder="Enter admin password" disabled={voiding} /></label>{voidError && <div className="void-error">{voidError}</div>}<div className="void-modal-actions"><button onClick={() => setShowVoidModal(false)} disabled={voiding}>Cancel</button><button className="void-confirm-btn" onClick={confirmVoid} disabled={voiding || !voidPassword}><Ban size={17} />{voiding ? "VOIDING..." : "CONFIRM VOID"}</button></div></div></div>}</main>;
}
