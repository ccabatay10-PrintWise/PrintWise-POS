"use client";

import { useMemo, useState } from "react";
import { Calculator, ArrowLeft, Plus, Trash2, Save, WalletCards } from "lucide-react";
import "../pos/pos.css";

type CostRow = { id: number; category: string; description: string; amount: number };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function ProjectCostingPage() {
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costs, setCosts] = useState<CostRow[]>([
    { id: 1, category: "Materials", description: "Item / materials", amount: 0 },
    { id: 2, category: "Labor", description: "Design / production labor", amount: 0 },
    { id: 3, category: "Other", description: "Delivery / packaging / other", amount: 0 },
  ]);
  const [message, setMessage] = useState("");

  const totalExpenses = useMemo(() => costs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [costs]);
  const netProfit = sellingPrice - totalExpenses;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
  const costPerItem = quantity > 0 ? totalExpenses / quantity : 0;
  const profitPerItem = quantity > 0 ? netProfit / quantity : 0;

  const updateCost = (id: number, key: keyof CostRow, value: string | number) => {
    setCosts((rows) => rows.map((row) => row.id === id ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row));
  };
  const addCost = () => setCosts((rows) => [...rows, { id: Date.now(), category: "Other", description: "", amount: 0 }]);
  const removeCost = (id: number) => setCosts((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);

  const saveEstimate = () => {
    const record = { projectName, client, quantity, sellingPrice, costs, totalExpenses, netProfit, profitMargin, createdAt: new Date().toISOString() };
    const history = JSON.parse(localStorage.getItem("printwise_project_costing") || "[]");
    localStorage.setItem("printwise_project_costing", JSON.stringify([record, ...history]));
    setMessage("Project costing saved successfully. Orders and POS integration will be connected next.");
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Calculator size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/dashboard"><ArrowLeft size={19} /><span>Dashboard</span></a>
      <a className="nav-item" href="/pos"><WalletCards size={19} /><span>Point of Sale</span></a>
      <a className="nav-item active" href="/project-costing"><Calculator size={19} /><span>Project Costing</span></a>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><h1>Project Costing & Profit</h1><p>Compute expenses and estimated earnings before accepting or producing a project.</p></div></header>
      <div className="pos-layout" style={{ gridTemplateColumns: "minmax(0,1fr) 360px" }}>
        <section className="catalog-panel">
          <h3 style={{ marginTop: 0 }}>Project Information</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label>Project Name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Company Polo Shirts" /></label>
            <label>Client<input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" /></label>
            <label>Quantity<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label>Total Selling Price<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value) || 0)} /></label>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}><h3>Project Expenses</h3><button className="secondary-button" onClick={addCost}><Plus size={16} /> Add Expense</button></div>
          <div style={{ overflowX: "auto" }}><table className="orders-table"><thead><tr><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead><tbody>{costs.map((row) => <tr key={row.id}><td><select value={row.category} onChange={(e) => updateCost(row.id, "category", e.target.value)}><option>Materials</option><option>Labor</option><option>Printing</option><option>Delivery</option><option>Packaging</option><option>GCash Fee</option><option>Other</option></select></td><td><input value={row.description} onChange={(e) => updateCost(row.id, "description", e.target.value)} placeholder="Expense description" /></td><td><input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => updateCost(row.id, "amount", e.target.value)} /></td><td><button className="icon-button" onClick={() => removeCost(row.id)} aria-label="Remove expense"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
          {message && <div className="message" style={{ marginTop: 16 }}>{message}</div>}
          <button className="checkout-button" style={{ marginTop: 18 }} onClick={saveEstimate}><Save size={18} /> SAVE PROJECT COSTING</button>
        </section>
        <aside className="cart-panel"><h2>Profit Summary</h2><div className="summary"><div><span>Total Project Revenue</span><b>{money.format(sellingPrice)}</b></div></div><div className="summary"><div><span>Total Expenses</span><b>{money.format(totalExpenses)}</b></div></div><div className="summary"><div><span>Estimated Net Profit</span><b>{money.format(netProfit)}</b></div></div><div className="summary"><div><span>Profit Margin</span><b>{profitMargin.toFixed(2)}%</b></div></div><div className="summary"><div><span>Cost Per Item</span><b>{money.format(costPerItem)}</b></div></div><div className="summary"><div><span>Profit Per Item</span><b>{money.format(profitPerItem)}</b></div></div></aside>
      </div>
    </section>
  </main>;
}
