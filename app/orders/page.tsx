"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ReceiptText, Search, User, CalendarDays, Package, X, Printer, Calculator, Ban, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./orders.css";

type Order = { id: string; order_no: string; customer_name: string | null; subtotal: number; discount_amount: number; total: number; amount_paid: number; status: string; created_at: string; transacted_by?: string; };
type OrderItem = { id: string; item_name: string; unit_price: number; quantity: number; line_total: number; };

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
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState(""); const [error, setError] = useState(""); const [selected, setSelected] = useState<Order | null>(null); const [items, setItems] = useState<OrderItem[]>([]); const [loadingItems, setLoadingItems] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false); const [voidPassword, setVoidPassword] = useState(""); const [voidError, setVoidError] = useState(""); const [voiding, setVoiding] = useState(false);
  useEffect(() => { let active = true; (async () => { setLoading(true); setError(""); try { const payload = await apiGet("/api/orders"); if (active) setOrders((payload.orders ?? []).map((o: any) => ({ ...o, subtotal: Number(o.subtotal || 0), discount_amount: Number(o.discount_amount || 0), total: Number(o.total || 0), amount_paid: Number(o.amount_paid || 0) }))); } catch (err: any) { if (active) setError(err?.message || "Unable to load orders."); } finally { if (active) setLoading(false); } })(); return () => { active = false; }; }, []);
  const filtered = orders.filter((o) => `${o.order_no} ${o.customer_name || ""} ${o.transacted_by || ""} ${o.status}`.toLowerCase().includes(search.toLowerCase()));
  const openOrder = async (order: Order) => { setSelected(order); setItems([]); setLoadingItems(true); setError(""); try { const payload = await apiGet(`/api/orders?orderId=${encodeURIComponent(order.id)}`); setItems((payload.items ?? []).map((i: any) => ({ ...i, unit_price: Number(i.unit_price || 0), quantity: Number(i.quantity || 0), line_total: Number(i.line_total || 0) }))); } catch (err: any) { setError(err?.message || "Unable to load order items."); } finally { setLoadingItems(false); } };
  const createCosting = () => { if (!selected) return; const quantity = Math.max(1, items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)); const projectName = items.length === 1 ? items[0].item_name : `Project - ${selected.order_no}`; sessionStorage.setItem(`printwise_costing_order_${selected.id}`, JSON.stringify({ id: selected.id, order_no: selected.order_no, customer_name: selected.customer_name, total: selected.total, quantity, projectName })); window.location.href = `/project-costing?orderId=${encodeURIComponent(selected.id)}`; };
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

  const printOrder = () => {
    if (!selected) return;

    const escapeHtml = (value: unknown) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const money = (value: number) => `₱${Number(value || 0).toFixed(2)}`;
    const date = new Date(selected.created_at);
    const contractDate = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const downPayment = Math.min(Number(selected.amount_paid || 0), Number(selected.total || 0));
    const remainingBalance = Math.max(Number(selected.total || 0) - downPayment, 0);
    const rows = items.map((i) => `
      <tr>
        <td class="item-cell">${escapeHtml(i.item_name)}</td>
        <td class="center">${Number(i.quantity || 0)}</td>
        <td class="spec-cell">${escapeHtml(i.item_name)}</td>
        <td class="right">${money(i.unit_price)}</td>
        <td class="right">${money(i.line_total)}</td>
      </tr>`).join("");

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Printing Order Contract - ${escapeHtml(selected.order_no)}</title>
<style>
  *{box-sizing:border-box}
  @page{size:A4 portrait;margin:8mm}
  body{margin:0;background:#fff;color:#20242b;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.25}
  .contract{width:100%;max-width:194mm;margin:0 auto}
  .brand{text-align:center;padding:3mm 0 1.5mm}
  .brand-name{display:inline-block;font-weight:900;line-height:.78;letter-spacing:-1.2px;font-size:24px;text-align:left}
  .brand-name .print{display:block;background:#b5120b;color:#fff;padding:1px 4px 0;width:max-content}
  .brand-name .wise{display:block;color:#3d434a;padding-left:1px}
  .title{text-align:center;font-size:19px;letter-spacing:1.4px;font-weight:900;margin:1mm 0 4mm}
  .title .red{color:#a9140d}.title .gray{color:#3e444b}
  .meta{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding:0 2mm 2mm;font-size:9px}
  .section-title{background:#2c2c2c;color:#fff;font-weight:900;text-transform:uppercase;letter-spacing:.6px;padding:4px 7px;margin-top:2mm}
  .client-box{border:1px solid #aeb4ba;border-top:0;padding:3px 7px;min-height:43px}
  .client-row{padding:2px 0;border-bottom:1px solid #d7dadd;min-height:12px}.client-row:last-child{border-bottom:0}
  .line{display:inline-block;min-width:55%;border-bottom:1px solid #444;height:11px;vertical-align:middle;margin-left:4px}
  table{width:100%;border-collapse:collapse;margin:3mm 0 0}
  th{background:#c91009;color:#fff;border:1px solid #9f0c07;padding:5px 4px;text-transform:uppercase;font-size:8px;letter-spacing:.2px}
  td{border:1px solid #9ea4aa;padding:5px 4px;vertical-align:middle;min-height:22px}
  .center{text-align:center}.right{text-align:right}.item-cell{font-weight:700}.spec-cell{font-size:8px}
  .summary-table{margin-top:0;border-top:0}.summary-table td{padding:5px}.summary-label{font-weight:900;text-align:right;background:#f5f5f5}.summary-value{font-weight:900;text-align:right}
  .delivery{border:1px solid #9ea4aa;border-top:0;padding:5px 7px;font-weight:800}
  .terms{border:1px solid #aeb4ba;border-top:0;padding:7px;display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;font-size:7px;line-height:1.35;min-height:84px}
  .terms b{font-weight:900}.terms .full{grid-column:1/-1}
  .agreement{text-align:center;font-weight:700;font-size:9px;padding:8px 12px 5px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;border:1px solid #9ea4aa}
  .sig-head{padding:5px;background:#c91009;color:#fff;font-size:8px;text-align:center;font-weight:900;text-transform:uppercase;letter-spacing:.4px}
  .sig-head.dark{background:#2c2c2c}.sig-body{min-height:54px;padding:6px 8px;font-size:8px;border-right:1px solid #9ea4aa}.sig-body:last-child{border-right:0}
  .sig-line{margin:7px 0;border-bottom:1px solid #7b8086;padding-bottom:2px;min-height:10px}
  .footer{margin-top:4mm;background:#2c2c2c;color:#fff;text-align:center;font-size:7px;font-weight:700;padding:5px 8px;letter-spacing:.15px}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.contract{max-width:none}}
</style></head>
<body><div class="contract">
  <div class="brand"><div class="brand-name"><span class="print">print</span><span class="wise">wise</span></div></div>
  <div class="title"><span class="red">PRINTING ORDER</span> <span class="gray">CONTRACT</span></div>
  <div class="meta"><span>CONTRACT NO.: <b>${escapeHtml(selected.order_no)}</b></span><span>DATE: <b>${escapeHtml(contractDate)}</b></span></div>

  <div class="section-title">1. Client Information</div>
  <div class="client-box">
    <div class="client-row"><b>Client Name / Company:</b> ${escapeHtml(selected.customer_name || "Walk-in Customer")}</div>
    <div class="client-row"><b>Address:</b> <span class="line"></span></div>
    <div class="client-row"><b>Contact No.:</b> <span class="line" style="min-width:28%"></span> &nbsp; <b>Email / Facebook:</b> <span class="line" style="min-width:28%"></span></div>
  </div>

  <div class="section-title">2. Order Details</div>
  <table><thead><tr><th style="width:26%">Product / Service</th><th style="width:8%">Qty.</th><th style="width:31%">Size / Specifications</th><th style="width:16%">Unit Price</th><th style="width:19%">Amount</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5" class="center">No order items found.</td></tr>'}</tbody></table>
  <table class="summary-table"><tbody>
    <tr><td class="summary-label" colspan="4">TOTAL CONTRACT AMOUNT</td><td class="summary-value">${money(selected.total)}</td></tr>
    <tr><td class="summary-label" colspan="2">DOWN PAYMENT</td><td class="summary-value">${money(downPayment)}</td><td class="summary-label">REMAINING BALANCE</td><td class="summary-value">${money(remainingBalance)}</td></tr>
  </tbody></table>
  <div class="delivery">TARGET RELEASE / DELIVERY DATE: <span class="line" style="min-width:45%"></span></div>

  <div class="section-title">3. Terms & Conditions</div>
  <div class="terms">
    <div><b>1. PAYMENT TERMS.</b> Production begins after the required down payment has been received. Balance must be settled before release or delivery unless otherwise agreed.</div>
    <div><b>2. QUALITY CONCERNS.</b> Verified production concerns must be reported within three (3) days from receipt, together with the order details and supporting photos when applicable.</div>
    <div><b>3. DESIGN APPROVAL.</b> Final artwork, spelling, sizes, colors, quantities, and specifications approved by the client will be used for production.</div>
    <div><b>4. CLIENT-PROVIDED MATERIALS.</b> PrintWise is not responsible for defects caused by client-supplied files, garments, or materials that are outside normal production control.</div>
    <div><b>5. PRODUCTION REVISIONS.</b> Changes requested after approval may affect the price, production schedule, and delivery date.</div>
    <div><b>6. PRICING & ADDITIONAL FEES.</b> Prices are based on the agreed specifications. Additional revisions or changes may require an additional charge.</div>
    <div><b>7. PRINT VARIATIONS.</b> Slight color or output variations may occur due to material, printing process, monitor display, and production conditions.</div>
    <div><b>8. CANCELLATION & REFUND.</b> Payments already applied to completed work, customized production, or approved materials may be non-refundable.</div>
    <div class="full"><b>9. FINAL AGREEMENT.</b> By signing this document, the client confirms that the order details and agreed terms have been reviewed and accepted.</div>
  </div>

  <div class="agreement">By signing below, both parties confirm that they have read, understood, and agreed to the terms and conditions stated in this Printing Order Contract.</div>
  <div class="signatures">
    <div><div class="sig-head">Client's Confirmation</div><div class="sig-body">Name:<div class="sig-line"></div>Signature:<div class="sig-line"></div>Date:<div class="sig-line"></div></div></div>
    <div><div class="sig-head dark">PrintWise Authorized Representative</div><div class="sig-body">Name: ${escapeHtml(selected.transacted_by || "")}<div class="sig-line"></div>Signature:<div class="sig-line"></div>Date:<div class="sig-line"></div></div></div>
  </div>
  <div class="footer">PRINTWISE · Guiguinto, Bulacan, Philippines · Thank you for choosing PRINTWISE</div>
</div></body></html>`;

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
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
      setTimeout(() => { if (document.body.contains(frame)) document.body.removeChild(frame); }, 1500);
    }, 350);
  };
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><ReceiptText size={21}/></div><span>PRINTWISE</span></div><div className="nav-label">MAIN MENU</div><a className="nav-item" href="/pos"><ArrowLeft size={19}/><span>Point of Sale</span></a><a className="nav-item active" href="/orders"><ReceiptText size={19}/><span>Orders</span></a><a className="nav-item" href="/project-costing"><Calculator size={19}/><span>Project Costing</span></a><a className="nav-item" href="/products"><Package size={19}/><span>Products & Services</span></a></aside><section className="workspace"><header className="topbar"><div><h1>Orders</h1><p>View completed PrintWise POS transactions and create project costings.</p></div></header><div className="pos-layout" style={{gridTemplateColumns:"1fr"}}><section className="catalog-panel"><div className="search-box"><Search size={19}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search order number, customer, cashier, or status..."/></div>{error&&<div className="message">{error}</div>}<div style={{overflowX:"auto",marginTop:18}}><table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Transacted By</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan={7}>Loading orders...</td></tr>:filtered.length===0?<tr><td colSpan={7}>No orders found.</td></tr>:filtered.map((o)=><tr key={o.id} onClick={()=>openOrder(o)} style={{cursor:"pointer"}}><td><b>{o.order_no}</b></td><td><User size={14}/> {o.customer_name||"Walk-in Customer"}</td><td><User size={14}/> <b>{o.transacted_by||"Not recorded"}</b></td><td><CalendarDays size={14}/> {new Date(o.created_at).toLocaleString()}</td><td>₱{o.total.toFixed(2)}</td><td>₱{o.amount_paid.toFixed(2)}</td><td><span className={`order-status ${String(o.status || "").toLowerCase()==="voided"?"voided":""}`}>{o.status}</span></td></tr>)}</tbody></table></div></section></div></section>{selected&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}><div style={{width:"min(780px,100%)",maxHeight:"90vh",overflowY:"auto",background:"white",borderRadius:18,padding:24}}><div style={{display:"flex",justifyContent:"space-between",gap:16}}><div><h2 style={{margin:0}}>Order Details</h2><p style={{margin:"6px 0 0",color:"#64748b"}}>{selected.order_no} · Transacted by: <b>{selected.transacted_by||"Not recorded"}</b></p></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div><div style={{overflowX:"auto",marginTop:20}}><table className="orders-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>{loadingItems?<tr><td colSpan={4}>Loading items...</td></tr>:items.length===0?<tr><td colSpan={4}>No order items found.</td></tr>:items.map((i)=><tr key={i.id}><td>{i.item_name}</td><td>{i.quantity}</td><td>₱{i.unit_price.toFixed(2)}</td><td>₱{i.line_total.toFixed(2)}</td></tr>)}</tbody></table></div><div style={{marginTop:20,marginLeft:"auto",maxWidth:320}}><div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:20,color:"#dc2626"}}><b>Total</b><b>₱{selected.total.toFixed(2)}</b></div></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24,flexWrap:"wrap"}}><button className="icon-btn" style={{width:"auto",padding:"10px 16px"}} onClick={()=>setSelected(null)}>Close</button><button className="secondary-button" onClick={createCosting} disabled={loadingItems || String(selected.status||"").toLowerCase()==="voided"}><Calculator size={17}/> CREATE COSTING</button><button className="void-order-btn" onClick={requestVoid} disabled={voiding || String(selected.status||"").toLowerCase()==="voided"}><Ban size={17}/> {String(selected.status||"").toLowerCase()==="voided"?"VOIDED":"VOID TRANSACTION"}</button><button className="process-btn" style={{width:"auto",padding:"10px 18px"}} onClick={printOrder} disabled={loadingItems}><Printer size={17}/> PRINT CONTRACT / SAVE AS PDF</button></div></div></div>}{showVoidModal&&selected&&<div className="void-modal-backdrop"><div className="void-modal" role="dialog" aria-modal="true" aria-labelledby="void-title"><button className="void-modal-close" onClick={()=>!voiding&&setShowVoidModal(false)} aria-label="Close"><X size={19}/></button><div className="void-modal-icon"><ShieldCheck size={25}/></div><h2 id="void-title">Admin Authorization Required</h2><p>Enter the <b>admin password</b> before voiding <b>{selected.order_no}</b>.</p><div className="void-warning"><AlertTriangle size={18}/><span>This will mark the transaction as <b>VOIDED</b> and keep the record for order history and audit purposes.</span></div><label className="void-password-label">Admin Password<input autoFocus type="password" value={voidPassword} onChange={(e)=>setVoidPassword(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&confirmVoid()} placeholder="Enter admin password" disabled={voiding}/></label>{voidError&&<div className="void-error">{voidError}</div>}<div className="void-modal-actions"><button onClick={()=>setShowVoidModal(false)} disabled={voiding}>Cancel</button><button className="void-confirm-btn" onClick={confirmVoid} disabled={voiding||!voidPassword}><Ban size={17}/>{voiding?"VOIDING...":"CONFIRM VOID"}</button></div></div></div>}</main>;
}
