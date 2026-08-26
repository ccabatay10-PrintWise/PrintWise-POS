"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ArrowLeft, Plus, Trash2, Save, WalletCards, ReceiptText, BriefcaseBusiness, Package, CircleDollarSign, TrendingUp, Link2, Users } from "lucide-react";
import "../pos/pos.css";
import "./project-costing.css";

type CostRow = { id: number; category: string; description: string; amount: number };
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
      setOrderId(order.id);
      setOrderNo(order.order_no);
      setClient(order.customer_name || "Walk-in Customer");
      setSellingPrice(Number(order.total || 0));
      setQuantity(Math.max(1, Number(order.quantity || 1)));
      setProjectName(order.projectName || `Costing - ${order.order_no}`);
      setMessage(`Order ${order.order_no} was imported. Add the actual project expenses to calculate your estimated profit.`);
    } catch {
      setMessage("Unable to import the selected order.");
    }
  }, []);

  const totalExpenses = useMemo(() => costs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [costs]);
  const netProfit = sellingPrice - totalExpenses;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
  const costPerItem = quantity > 0 ? totalExpenses / quantity : 0;
  const profitPerItem = quantity > 0 ? netProfit / quantity : 0;
  const isLoss = netProfit < 0;

  const updateCost = (id: number, key: keyof CostRow, value: string | number) => {
    setCosts((rows) => rows.map((row) => row.id === id ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row));
  };

  const addCost = () => {
    setCosts((rows) => [...rows, { id: Date.now(), category: "Other", description: "", amount: 0 }]);
  };

  const removeCost = (id: number) => {
    setCosts((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);
  };

  const saveEstimate = () => {
    const record = {
      id: Date.now(),
      projectName,
      client,
      quantity,
      sellingPrice,
      orderId,
      orderNo,
      costs,
      totalExpenses,
      netProfit,
      profitMargin,
      createdAt: new Date().toISOString()
    };
    const history = JSON.parse(localStorage.getItem("printwise_project_costing") || "[]");
    const next = [record, ...history.filter((item: any) => !(orderId && item.orderId === orderId))];
    localStorage.setItem("printwise_project_costing", JSON.stringify(next));
    setMessage("Project costing saved successfully. Your expenses and estimated profit are now recorded.");
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/dashboard"><ArrowLeft size={19} /><span>Dashboard</span></a>
      <a className="nav-item" href="/pos"><WalletCards size={19} /><span>Point of Sale</span></a>
      <a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
      <a className="nav-item active" href="/project-costing"><Calculator size={19} /><span>Project Costing</span></a>
    </aside>

    <section className="workspace project-workspace">
      <header className="project-topbar">
        <div>
          <div className="project-eyebrow"><Calculator size={15} /> SMART BUSINESS TOOL</div>
          <h1>Project Costing &amp; Profit</h1>
          <p>{orderNo ? `Linked to POS Order ${orderNo}` : "Compute your real project expenses and estimated earnings before production."}</p>
        </div>
        <div className="project-topbar-badge">
          {orderNo ? <><Link2 size={17} /> POS ORDER LINKED</> : <><BriefcaseBusiness size={17} /> NEW PROJECT ESTIMATE</>}
        </div>
      </header>

      <div className="project-content">
        <section className="costing-card">
          <div className="section-heading"><div><h2>Project Information</h2><p>Enter the project details and selling value.</p></div></div>
          <div className="project-form-grid">
            <label className="project-field">Project Name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Company Polo Shirts" /></label>
            <label className="project-field">Client<input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client or customer name" /></label>
            <label className="project-field">Quantity<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label className="project-field">Total Selling Price<input className="money-input" type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value) || 0)} /></label>
          </div>

          <div className="expense-section">
            <div className="expense-title-row">
              <div>
                <h2><ReceiptText size={20} /> Project Expenses</h2>
                <p className="expense-help">Add the actual costs for materials, labor, printing, delivery, and other project expenses.</p>
              </div>
              <button className="add-expense-btn" onClick={addCost}><Plus size={17} /> ADD EXPENSE</button>
            </div>
            <div className="expense-table-wrap">
              <table className="expense-table">
                <thead><tr><th>CATEGORY</th><th>DESCRIPTION</th><th>AMOUNT</th><th></th></tr></thead>
                <tbody>{costs.map((row) => <tr key={row.id}>
                  <td><select value={row.category} onChange={(e) => updateCost(row.id, "category", e.target.value)}>
                    <option>Materials</option><option>Product Base Cost</option><option>Labor</option><option>Printing</option><option>Embroidery</option><option>Delivery</option><option>Packaging</option><option>GCash Fee</option><option>Other</option>
                  </select></td>
                  <td><input value={row.description} onChange={(e) => updateCost(row.id, "description", e.target.value)} placeholder="What is this expense for?" /></td>
                  <td className="amount-cell"><input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => updateCost(row.id, "amount", e.target.value)} /></td>
                  <td><button className="delete-expense" title="Remove expense" onClick={() => removeCost(row.id)}><Trash2 size={17} /></button></td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>

          {message && <div className="costing-message">✓ {message}</div>}
          <button className="save-costing-btn" onClick={saveEstimate}><Save size={18} /> SAVE PROJECT COSTING</button>
        </section>

        <aside className="costing-card profit-card">
          <div className="profit-card-head"><h2>Profit Summary</h2><p>Live calculation based on your inputs.</p></div>
          <div className="profit-hero"><span>{isLoss ? "Estimated Loss" : "Estimated Net Profit"}</span><strong>{money.format(netProfit)}</strong><small>{isLoss ? "Your expenses are higher than your selling price." : "Estimated earnings after all project expenses."}</small></div>
          <div className="profit-rows">
            <div className="profit-row"><span>Total Project Revenue</span><b>{money.format(sellingPrice)}</b></div>
            <div className="profit-row"><span>Total Expenses</span><b>{money.format(totalExpenses)}</b></div>
            <div className={`profit-row ${isLoss ? "loss" : "highlight"}`}><span>Estimated Net Profit</span><b>{money.format(netProfit)}</b></div>
            <div className="profit-row"><span>Profit Margin</span><b className="margin-pill">{profitMargin.toFixed(2)}%</b></div>
            <div className="profit-row"><span>Cost Per Item</span><b>{money.format(costPerItem)}</b></div>
            <div className="profit-row"><span>Profit Per Item</span><b>{money.format(profitPerItem)}</b></div>
          </div>
          <div className="project-link-note">
            {orderNo ? <Link2 size={17} /> : <TrendingUp size={17} />}
            <span>{orderNo ? `This costing is connected to ${orderNo}. Saving will update the stored estimate for this project.` : "Enter your project expenses to see the estimated profit and profit margin in real time."}</span>
          </div>
        </aside>
      </div>
    </section>
  </main>;
}
