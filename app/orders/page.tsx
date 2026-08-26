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

  const printOrder = () => { if (!selected) return; const rows = items.map((i) => `<tr><td>${i.item_name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₱${i.unit_price.toFixed(2)}</td><td style="text-align:right">₱${i.line_total.toFixed(2)}</td></tr>`).join(""); const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${selected.order_no}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;padding:28px;margin:0}.receipt{max-width:760px;margin:auto}h1{margin:0;color:#e11d16}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f7f7f7}.totals{margin-left:auto;width:300px;margin-top:20px}.totals div{display:flex;justify-content:space-between;padding:7px 0}.grand{font-size:20px;font-weight:bold;color:#e11d16;border-top:2px solid #222;margin-top:8px;padding-top:10px!important}@media print{body{padding:0}}</style></head><body><div class="receipt"><h1>PRINTWISE</h1><p>Order Receipt / Invoice</p><hr/><p><b>Order No.:</b> ${selected.order_no}<br/><b>Customer:</b> ${selected.customer_name || "Walk-in Customer"}<br/><b>Date & Time:</b> ${new Date(selected.created_at).toLocaleString()}<br/><b>Status:</b> ${selected.status}<br/><b>Transacted By:</b> ${selected.transacted_by || "Not recorded"}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No order items found.</td></tr>'}</tbody></table><div class="totals"><div><span>Subtotal</span><b>₱${selected.subtotal.toFixed(2)}</b></div><div><span>Discount</span><b>₱${selected.discount_amount.toFixed(2)}</b></div><div class="grand"><span>TOTAL</span><span>₱${selected.total.toFixed(2)}</span></div></div></div></body></html>`; const frame = document.createElement("iframe"); frame.style.position="fixed"; frame.style.width="1px"; frame.style.height="1px"; frame.style.opacity="0"; document.body.appendChild(frame); const doc=frame.contentWindow?.document; if(!doc||!frame.contentWindow){document.body.removeChild(frame);alert("Unable to open the print window.");return;} doc.open();doc.write(html);doc.close();setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>{if(document.body.contains(frame))document.body.removeChild(frame)},1500)},350); };
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><ReceiptText size={21}/></div><span>PRINTWISE</span></div><div className="nav-label">MAIN MENU</div><a className="nav-item" href="/pos"><ArrowLeft size={19}/><span>Point of Sale</span></a><a className="nav-item active" href="/orders"><ReceiptText size={19}/><span>Orders</span></a><a className="nav-item" href="/project-costing"><Calculator size={19}/><span>Project Costing</span></a><a className="nav-item" href="/products"><Package size={19}/><span>Products & Services</span></a></aside><section className="workspace"><header className="topbar"><div><h1>Orders</h1><p>View completed PrintWise POS transactions and create project costings.</p></div></header><div className="pos-layout" style={{gridTemplateColumns:"1fr"}}><section className="catalog-panel"><div className="search-box"><Search size={19}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search order number, customer, cashier, or status..."/></div>{error&&<div className="message">{error}</div>}<div style={{overflowX:"auto",marginTop:18}}><table className="orders-table"><thead><tr><th>Order No.</th><th>Customer</th><th>Transacted By</th><th>Date & Time</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead><tbody>{loading?<tr><td colSpan={7}>Loading orders...</td></tr>:filtered.length===0?<tr><td colSpan={7}>No orders found.</td></tr>:filtered.map((o)=><tr key={o.id} onClick={()=>openOrder(o)} style={{cursor:"pointer"}}><td><b>{o.order_no}</b></td><td><User size={14}/> {o.customer_name||"Walk-in Customer"}</td><td><User size={14}/> <b>{o.transacted_by||"Not recorded"}</b></td><td><CalendarDays size={14}/> {new Date(o.created_at).toLocaleString()}</td><td>₱{o.total.toFixed(2)}</td><td>₱{o.amount_paid.toFixed(2)}</td><td><span className={`order-status ${String(o.status || "").toLowerCase()==="voided"?"voided":""}`}>{o.status}</span></td></tr>)}</tbody></table></div></section></div></section>{selected&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}><div style={{width:"min(780px,100%)",maxHeight:"90vh",overflowY:"auto",background:"white",borderRadius:18,padding:24}}><div style={{display:"flex",justifyContent:"space-between",gap:16}}><div><h2 style={{margin:0}}>Order Details</h2><p style={{margin:"6px 0 0",color:"#64748b"}}>{selected.order_no} · Transacted by: <b>{selected.transacted_by||"Not recorded"}</b></p></div><button className="icon-btn" onClick={()=>setSelected(null)}><X size={18}/></button></div><div style={{overflowX:"auto",marginTop:20}}><table className="orders-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>{loadingItems?<tr><td colSpan={4}>Loading items...</td></tr>:items.length===0?<tr><td colSpan={4}>No order items found.</td></tr>:items.map((i)=><tr key={i.id}><td>{i.item_name}</td><td>{i.quantity}</td><td>₱{i.unit_price.toFixed(2)}</td><td>₱{i.line_total.toFixed(2)}</td></tr>)}</tbody></table></div><div style={{marginTop:20,marginLeft:"auto",maxWidth:320}}><div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:20,color:"#dc2626"}}><b>Total</b><b>₱{selected.total.toFixed(2)}</b></div></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24,flexWrap:"wrap"}}><button className="icon-btn" style={{width:"auto",padding:"10px 16px"}} onClick={()=>setSelected(null)}>Close</button><button className="secondary-button" onClick={createCosting} disabled={loadingItems || String(selected.status||"").toLowerCase()==="voided"}><Calculator size={17}/> CREATE COSTING</button><button className="void-order-btn" onClick={requestVoid} disabled={voiding || String(selected.status||"").toLowerCase()==="voided"}><Ban size={17}/> {String(selected.status||"").toLowerCase()==="voided"?"VOIDED":"VOID TRANSACTION"}</button><button className="process-btn" style={{width:"auto",padding:"10px 18px"}} onClick={printOrder} disabled={loadingItems}><Printer size={17}/> PRINT / SAVE AS PDF</button></div></div></div>}{showVoidModal&&selected&&<div className="void-modal-backdrop"><div className="void-modal" role="dialog" aria-modal="true" aria-labelledby="void-title"><button className="void-modal-close" onClick={()=>!voiding&&setShowVoidModal(false)} aria-label="Close"><X size={19}/></button><div className="void-modal-icon"><ShieldCheck size={25}/></div><h2 id="void-title">Admin Authorization Required</h2><p>Enter the <b>admin password</b> before voiding <b>{selected.order_no}</b>.</p><div className="void-warning"><AlertTriangle size={18}/><span>This will mark the transaction as <b>VOIDED</b> and keep the record for order history and audit purposes.</span></div><label className="void-password-label">Admin Password<input autoFocus type="password" value={voidPassword} onChange={(e)=>setVoidPassword(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&confirmVoid()} placeholder="Enter admin password" disabled={voiding}/></label>{voidError&&<div className="void-error">{voidError}</div>}<div className="void-modal-actions"><button onClick={()=>setShowVoidModal(false)} disabled={voiding}>Cancel</button><button className="void-confirm-btn" onClick={confirmVoid} disabled={voiding||!voidPassword}><Ban size={17}/>{voiding?"VOIDING...":"CONFIRM VOID"}</button></div></div></div>}</main>;
}
