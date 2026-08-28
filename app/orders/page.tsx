"use client";

import { useEffect, useState } from "react";
import { ReceiptText, Search, User, CalendarDays, X, Printer, Calculator, Ban, ShieldCheck, AlertTriangle, Shirt, CupSoda, Sticker, Image, FileText, Barcode, Layers3, PenLine, CheckCircle2, ClipboardList, CircleDollarSign, CalendarClock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./orders.css";
import Sidebar from "../components/Sidebar";

type Order = { id: string; order_no: string; customer_name: string | null; subtotal: number; discount_amount: number; total: number; amount_paid: number; status: string; created_at: string; transacted_by?: string; };
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

  const filtered = orders.filter((o) =>
    `${o.order_no} ${o.customer_name || ""} ${o.transacted_by || ""} ${o.status}`.toLowerCase().includes(search.toLowerCase())
  );

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

  const escapeHtml = (value: unknown) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const printInFrame = (html: string) => {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) {
      document.body.removeChild(frame);
      alert("Unable to open the print window.");
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(frame)) document.body.removeChild(frame); }, 1800);
    }, 350);
  };

  const reprintReceipt = () => {
    if (!selected) return;
    const money = (value: number) => `₱${Number(value || 0).toFixed(2)}`;
    const subtotal = Number(selected.subtotal || items.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
    const discount = Math.max(0, Number(selected.discount_amount || 0));
    const total = Number(selected.total || Math.max(0, subtotal - discount));
    const amountPaid = Number(selected.amount_paid || total);
    const change = Math.max(0, amountPaid - total);
    const dateText = new Date(selected.created_at).toLocaleString();
    const rows = items.map((item) => `
      <div class="item">
        <div><b>${escapeHtml(item.item_name)}</b><small>${Number(item.quantity || 0)} × ${money(item.unit_price)}</small></div>
        <strong>${money(item.line_total)}</strong>
      </div>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt - ${escapeHtml(selected.order_no)}</title>
<style>
*{box-sizing:border-box} @page{size:80mm auto;margin:0} html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;width:80mm} body{padding:5mm 4mm;font-size:11px} .receipt{width:72mm;margin:0 auto}.brand{text-align:center;font-size:23px;font-weight:900;letter-spacing:2px}.sub{text-align:center;font-size:10px;margin-top:3px}.rule{border-top:1px solid #111;margin:10px 0}.dash{border-top-style:dashed}.meta div,.totals div{display:flex;justify-content:space-between;gap:8px;margin:4px 0}.meta span{font-weight:800}.meta b{font-weight:700;text-align:right}.head{display:flex;justify-content:space-between;font-weight:900;font-size:10px;margin-bottom:6px}.item{display:flex;justify-content:space-between;gap:8px;margin:8px 0}.item>div{min-width:0}.item b{display:block;word-break:break-word}.item small{display:block;margin-top:3px}.item strong{white-space:nowrap}.totals .grand{font-size:14px;font-weight:900;margin-top:7px}.totals .grand span,.totals .grand b{font-weight:900}.thanks{text-align:center;font-weight:900;margin:12px 0 5px}.footer{text-align:center;font-size:9px;color:#333;margin:0}.reprint{text-align:center;font-size:8px;color:#555;margin-top:7px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="receipt">
<div class="brand">PRINTWISE</div><div class="sub">Printing & Customized Services</div><div class="rule"></div>
<div class="meta"><div><span>ORDER</span><b>${escapeHtml(selected.order_no)}</b></div><div><span>DATE</span><b>${escapeHtml(dateText)}</b></div><div><span>CUSTOMER</span><b>${escapeHtml(selected.customer_name || "Walk-in Customer")}</b></div><div><span>TRANSACTED BY</span><b>${escapeHtml(selected.transacted_by || "PrintWise Staff")}</b></div><div><span>PAYMENT</span><b>PAID</b></div></div>
<div class="rule dash"></div><div class="head"><span>ITEM</span><span>AMOUNT</span></div>${rows || '<div class="item"><div><b>No order items found.</b></div></div>'}
<div class="rule dash"></div><div class="totals"><div><span>Total Price</span><b>${money(subtotal)}</b></div>${discount > 0 ? `<div><span>Discount</span><b>-${money(discount)}</b></div>` : ""}<div class="grand"><span>AMOUNT DUE</span><b>${money(total)}</b></div><div><span>Amount Paid</span><b>${money(amountPaid)}</b></div>${change > 0 ? `<div><span>Change</span><b>${money(change)}</b></div>` : ""}</div>
<div class="rule"></div><p class="thanks">THANK YOU FOR CHOOSING PRINTWISE!</p><p class="footer">Please keep this receipt for your records.</p><p class="reprint">REPRINTED RECEIPT</p>
</div></body></html>`;
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

  return <main className="app-shell"><Sidebar /><section className="workspace"><header className="topbar"><div><h1>Orders</h1><p>View completed PrintWise POS transactions and create project costings.</p></div></header><div className="pos-layout" style={{ gridTemplateColumns: "1fr" }}><section className="catalog-panel"><div className="search-box"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order number, customer, cashier, or status..." /></div>{error && <div className="message">{error}</div>}<div style={{ overflowX: "auto", marginTop: 18 }}><table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Transacted By</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading orders...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7}>No orders found.</td></tr> : filtered.map((o) => <tr key={o.id} onClick={() => openOrder(o)} style={{ cursor: "pointer" }}><td><b>{o.order_no}</b></td><td><User size={14} /> {o.customer_name || "Walk-in Customer"}</td><td><User size={14} /> <b>{o.transacted_by || "Not recorded"}</b></td><td><CalendarDays size={14} /> {new Date(o.created_at).toLocaleString()}</td><td>₱{o.total.toFixed(2)}</td><td>₱{o.amount_paid.toFixed(2)}</td><td><span className={`order-status ${String(o.status || "").toLowerCase() === "voided" ? "voided" : ""}`}>{o.status}</span></td></tr>)}</tbody></table></div></section></div></section>{selected && <div className="order-details-backdrop"><div className="order-details-modal" role="dialog" aria-modal="true" aria-labelledby="order-details-title"><div className="order-details-header"><div className="order-details-title-wrap"><div className="order-details-brand"><ReceiptText size={30} /></div><div><h2 id="order-details-title"><span>ORDER</span> DETAILS</h2><p>View transaction information and manage this order.</p></div></div><button className="order-details-close" onClick={() => setSelected(null)} aria-label="Close order details"><X size={24} /></button></div><div className="order-details-rule" /><div className="order-details-mobile-meta"><b>{selected.order_no}</b><span>•</span><span>Transacted by: <strong>{selected.transacted_by || "Not recorded"}</strong></span></div><div className="order-meta-grid"><div className="order-meta-card"><div className="order-meta-icon"><ClipboardList size={22} /></div><div><span>ORDER NO.</span><b>{selected.order_no}</b></div></div><div className="order-meta-card"><div className="order-meta-icon"><CalendarClock size={22} /></div><div><span>DATE & TIME</span><b>{new Date(selected.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</b><small>{new Date(selected.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></div></div><div className="order-meta-card"><div className="order-meta-icon"><User size={22} /></div><div><span>TRANSACTED BY</span><b>{selected.transacted_by || "Not recorded"}</b><small>Cashier / Administrator</small></div></div><div className="order-meta-card status-card"><div><span>STATUS</span><div className={`order-detail-status ${String(selected.status || "").toLowerCase() === "voided" ? "is-voided" : ""}`}>{String(selected.status || "").toLowerCase() === "voided" ? <Ban size={18} /> : <CheckCircle2 size={18} />} {String(selected.status || "").toLowerCase() === "voided" ? "VOIDED" : String(selected.status || "").toUpperCase()}</div></div></div></div><div className="order-items-card"><div className="order-items-head"><span>ITEM</span><span>QTY</span><span>UNIT PRICE</span><span>TOTAL</span></div><div className="order-items-body">{loadingItems ? <div className="order-loading">Loading items...</div> : items.length === 0 ? <div className="order-loading">No order items found.</div> : items.map((i) => <div className="order-item-row" key={i.id}><div className="order-item-main"><OrderItemVisual item={i} /><div><b>{i.item_name}</b><small>{i.category || "Printing Service"}</small></div></div><strong>{i.quantity}</strong><strong>₱{i.unit_price.toFixed(2)}</strong><strong>₱{i.line_total.toFixed(2)}</strong></div>)}</div></div><div className="order-total-card"><div className="order-summary-intro"><div className="order-summary-icon"><CircleDollarSign size={38} /></div><div><b>ORDER SUMMARY</b><span>Review the total amount for this transaction.</span></div></div><div className="order-summary-values"><div><span>Subtotal</span><b>₱{selected.subtotal.toFixed(2)}</b></div><div><span>Discount</span><b>₱{selected.discount_amount.toFixed(2)}</b></div><div className="order-summary-total"><span>TOTAL AMOUNT</span><b>₱{selected.total.toFixed(2)}</b></div></div></div><div className="order-details-actions"><button className="order-action close" onClick={() => setSelected(null)}><X size={20} /> CLOSE</button><button className="order-action costing" onClick={createCosting} disabled={loadingItems || String(selected.status || "").toLowerCase() === "voided"}><Calculator size={20} /> CREATE COSTING</button><button className="order-action void" onClick={requestVoid} disabled={voiding || String(selected.status || "").toLowerCase() === "voided"}><Ban size={20} /> {String(selected.status || "").toLowerCase() === "voided" ? "VOIDED" : "VOID TRANSACTION"}</button><button className="order-action print" onClick={reprintReceipt} disabled={loadingItems}><ReceiptText size={21} /> RE-PRINT RECEIPT</button><button className="order-action print" onClick={printOrder} disabled={loadingItems}><Printer size={21} /> PRINT CONTRACT / SAVE AS PDF</button></div></div></div>}{showVoidModal && selected && <div className="void-modal-backdrop"><div className="void-modal" role="dialog" aria-modal="true" aria-labelledby="void-title"><button className="void-modal-close" onClick={() => !voiding && setShowVoidModal(false)} aria-label="Close"><X size={19} /></button><div className="void-modal-icon"><ShieldCheck size={25} /></div><h2 id="void-title">Admin Authorization Required</h2><p>Enter the <b>admin password</b> before voiding <b>{selected.order_no}</b>.</p><div className="void-warning"><AlertTriangle size={18} /><span>This will mark the transaction as <b>VOIDED</b> and keep the record for order history and audit purposes.</span></div><label className="void-password-label">Admin Password<input autoFocus type="password" value={voidPassword} onChange={(e) => setVoidPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmVoid()} placeholder="Enter admin password" disabled={voiding} /></label>{voidError && <div className="void-error">{voidError}</div>}<div className="void-modal-actions"><button onClick={() => setShowVoidModal(false)} disabled={voiding}>Cancel</button><button className="void-confirm-btn" onClick={confirmVoid} disabled={voiding || !voidPassword}><Ban size={17} />{voiding ? "VOIDING..." : "CONFIRM VOID"}</button></div></div></div>}</main>;
}
