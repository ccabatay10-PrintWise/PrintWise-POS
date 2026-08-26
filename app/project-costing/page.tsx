"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ArrowLeft, Plus, Trash2, Save, WalletCards, ReceiptText } from "lucide-react";
import "../pos/pos.css";

type CostRow = { id: number; category: string; description: string; amount: number };
type OrderItem = { id: string; item_name: string; quantity: number; line_total: number };
type Order = { id: string; order_no: string; customer_name: string | null; total: number };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function ProjectCostingPage() {
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [orderNo, setOrderNo] = useState("");
  const [orderId, setOrderId] = useState("");
  const [costs, setCosts] = useState<CostRow[]>([{ id: 1, category: "Materials", description: "Item / materials", amount: 0 }]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId") || "";
    if (!id) return;
    const raw = sessionStorage.getItem(`printwise_costing_order_${id}`);
    if (!raw) return;
    try {
      const order = JSON.parse(raw) as { id: string; order_no: string; customer_name: string | null; total: number; quantity: number; projectName: string };
      setOrderId(order.id); setOrderNo(order.order_no); setClient(order.customer_name || "Walk-in Customer");
      setSellingPrice(Number(order.total || 0)); setQuantity(Math.max(1, Number(order.quantity || 1)));
      setProjectName(order.projectName || `Costing - ${order.order_no}`);
      setMessage(`Order ${order.order_no} was imported. Add the actual expenses to calculate your profit.`);
    } catch { setMessage("Unable to import the selected order."); }
  }, []);

  const totalExpenses = useMemo(() => costs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [costs]);
  const netProfit = sellingPrice - totalExpenses;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
  const costPerItem = quantity > 0 ? totalExpenses / quantity : 0;
  const profitPerItem = quantity > 0 ? netProfit / quantity : 0;

  const updateCost = (id: number, key: keyof CostRow, value: string | number) => setCosts((rows) => rows.map((row) => row.id === id ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row));
  const addCost = () => setCosts((rows) => [...rows, { id: Date.now(), category: "Other", description: "", amount: 0 }]);
  const removeCost = (id: number) => setCosts((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);

  const saveEstimate = () => {
    const record = { id: Date.now(), projectName, client, quantity, sellingPrice, orderId, orderNo, costs, totalExpenses, netProfit, profitMargin, createdAt: new Date().toISOString() };
    const history = JSON.parse(localStorage.getItem("printwise_project_costing") || "[]");
    const next = [record, ...history.filter((item: any) => !(orderId && item.orderId === orderId))];
    localStorage.setItem("printwise_project_costing", JSON.stringify(next));
    setMessage("Project costing saved. This record is now linked to the selected POS order.");
  };

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Calculator size={21} /></div><span>PRINTWISE</span></div><div className="nav-label">MAIN MENU</div><a className="nav-item" href="/dashboard"><ArrowLeft size={19} /><span>Dashboard</span></a><a className="nav-item" href="/pos"><WalletCards size={19} /><span>Point of Sale</span></a><a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a><a className="nav-item active" href="/project-costing"><Calculator size={19} /><span>Project Costing</span></a></aside><section className="workspace"><header className="topbar"><div><h1>Project Costing & Profit</h1><p>{orderNo ? `Linked to POS Order ${orderNo}` : "Compute expenses and estimated earnings before accepting or producing a project."}</p></div></header><div className="pos-layout" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}><section className="catalog-panel"><h3 style={{ marginTop: 0 }}>Project Information</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><label>Project Name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} /></label><label>Client<input value={client} onChange={(e) => setClient(e.target.value)} /></label><label>Quantity<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} /></label><label>Total Selling Price<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value) || 0)} /></label></div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}><h3>Project Expenses</h3><button className="secondary-button" onClick={addCost}><Plus size={16} /> Add Expense</button></div><div style={{ overflowX: "auto" }}><table className="orders-table"><thead><tr><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead><tbody>{costs.map((row) => <tr key={row.id}><td><select value={row.category} onChange={(e) => updateCost(row.id, "category", e.target.value)}><option>Materials</option><option>Labor</option><option>Printing</option><option>Delivery</option><option>Packaging</option><option>GCash Fee</option><option>Other</option></select></td><td><input value={row.description} onChange={(e) => updateCost(row.id, "description", e.target.value)} placeholder="Expense description" /></td><td><input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => updateCost(row.id, "amount", e.target.value)} /></td><td><button className="icon-button" onClick={() => removeCost(row.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>{message && <div className="message" style={{ marginTop: 16 }}>{message}</div>}<button className="checkout-button" style={{ marginTop: 18 }} onClick={saveEstimate}><Save size={18} /> SAVE PROJECT COSTING</button></section><aside className="cart-panel"><h2>Profit Summary</h2><div className="summary"><div><span>Total Project Revenue</span><b>{money.format(sellingPrice)}</b></div></div><div className="summary"><div><span>Total Expenses</span><b>{money.format(totalExpenses)}</b></div></div><div className="summary"><div><span>Estimated Net Profit</span><b>{money.format(netProfit)}</b></div></div><div className="summary"><div><span>Profit Margin</span><b>{profitMargin.toFixed(2)}%</b></div></div><div className="summary"><div><span>Cost Per Item</span><b>{money.format(costPerItem)}</b></div></div><div className="summary"><div><span>Profit Per Item</span><b>{money.format(profitPerItem)}</b></div></div></aside></div></section></main>;
}
