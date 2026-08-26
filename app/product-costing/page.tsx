"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ArrowLeft, Package, Plus, Save, Trash2, WalletCards, ReceiptText, Boxes, BadgePhilippinePeso } from "lucide-react";
import "../pos/pos.css";
import "./product-costing.css";

type Component = { id: number; category: string; description: string; cost: number };
type ProductCost = { id: number; name: string; sku: string; notes: string; components: Component[]; createdAt: string };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const emptyComponent = (): Component => ({ id: Date.now() + Math.floor(Math.random() * 1000), category: "Materials", description: "", cost: 0 });

export default function ProductCostingPage() {
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [notes, setNotes] = useState("");
  const [components, setComponents] = useState<Component[]>([emptyComponent()]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try { setProducts(JSON.parse(localStorage.getItem("printwise_product_cost_database") || "[]")); } catch { setProducts([]); }
  }, []);

  const costPerPiece = useMemo(() => components.reduce((sum, item) => sum + (Number(item.cost) || 0), 0), [components]);
  const updateComponent = (id: number, key: keyof Component, value: string) => setComponents((items) => items.map((item) => item.id === id ? { ...item, [key]: key === "cost" ? Number(value) || 0 : value } : item));
  const addComponent = () => setComponents((items) => [...items, emptyComponent()]);
  const removeComponent = (id: number) => setComponents((items) => items.length > 1 ? items.filter((item) => item.id !== id) : items);

  const saveProduct = () => {
    if (!name.trim()) { setMessage("Please enter a product name before saving."); return; }
    const record: ProductCost = { id: Date.now(), name: name.trim(), sku: sku.trim(), notes: notes.trim(), components, createdAt: new Date().toISOString() };
    const next = [record, ...products];
    setProducts(next);
    localStorage.setItem("printwise_product_cost_database", JSON.stringify(next));
    setName(""); setSku(""); setNotes(""); setComponents([emptyComponent()]);
    setMessage(`${record.name} was saved. Its per-piece cost can now be used automatically in Project Costing.`);
  };

  const deleteProduct = (id: number) => {
    const next = products.filter((item) => item.id !== id);
    setProducts(next);
    localStorage.setItem("printwise_product_cost_database", JSON.stringify(next));
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/dashboard"><ArrowLeft size={19} /><span>Dashboard</span></a>
      <a className="nav-item" href="/pos"><WalletCards size={19} /><span>Point of Sale</span></a>
      <a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
      <a className="nav-item" href="/project-costing"><Calculator size={19} /><span>Project Costing</span></a>
      <a className="nav-item active" href="/product-costing"><Boxes size={19} /><span>Product Cost Database</span></a>
    </aside>
    <section className="workspace product-cost-workspace">
      <header className="product-cost-header"><div><div className="product-eyebrow"><BadgePhilippinePeso size={15} /> AUTOMATIC COST SETUP</div><h1>Product Cost Database</h1><p>Save the real cost per piece of each product. PrintWise will use these amounts automatically when creating a project costing.</p></div></header>
      <div className="product-cost-grid">
        <section className="product-editor-card">
          <div className="pc-section-head"><div><h2>Create Product Cost</h2><p>Enter the cost breakdown for one piece.</p></div><div className="pc-cost-badge"><span>Current Cost / PC</span><b>{money.format(costPerPiece)}</b></div></div>
          <div className="pc-form-grid"><label>Product Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Corner Poloshirt" /></label><label>SKU / Code (Optional)<input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. BC-POLO-BLU" /></label></div>
          <label className="pc-notes">Notes (Optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, size, supplier or other details" /></label>
          <div className="pc-component-head"><div><h2>Cost Per Piece Breakdown</h2><p>Each amount below should be the cost for one product only.</p></div><button onClick={addComponent}><Plus size={16} /> ADD COST</button></div>
          <div className="pc-table-wrap"><table className="pc-table"><thead><tr><th>CATEGORY</th><th>DESCRIPTION</th><th>COST / PC</th><th></th></tr></thead><tbody>{components.map((item) => <tr key={item.id}><td><select value={item.category} onChange={(e) => updateComponent(item.id, "category", e.target.value)}><option>Materials</option><option>Product Base Cost</option><option>Printing</option><option>Embroidery</option><option>Labor</option><option>Packaging</option><option>Other</option></select></td><td><input value={item.description} onChange={(e) => updateComponent(item.id, "description", e.target.value)} placeholder="e.g. Blue Corner Polo" /></td><td><input type="number" min="0" step="0.01" value={item.cost} onChange={(e) => updateComponent(item.id, "cost", e.target.value)} /></td><td><button className="pc-delete" onClick={() => removeComponent(item.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
          {message && <div className="pc-message">✓ {message}</div>}
          <button className="pc-save" onClick={saveProduct}><Save size={18} /> SAVE PRODUCT COST</button>
        </section>
        <aside className="saved-products-card"><div className="saved-products-head"><div><h2>Saved Products</h2><p>{products.length} product cost{products.length === 1 ? "" : "s"} available</p></div></div>{products.length === 0 ? <div className="pc-empty"><Package size={30} /><h3>No products yet</h3><p>Save Blue Corner Poloshirt or any product to start automatic costing.</p></div> : <div className="saved-product-list">{products.map((product) => { const total = product.components.reduce((sum, item) => sum + (Number(item.cost) || 0), 0); return <div className="saved-product" key={product.id}><div className="saved-product-top"><div><h3>{product.name}</h3><span>{product.sku || "No SKU"}</span></div><button onClick={() => deleteProduct(product.id)} title="Delete product"><Trash2 size={16} /></button></div><div className="saved-product-cost"><span>Automatic Cost / PC</span><b>{money.format(total)}</b></div><small>{product.components.length} saved cost component{product.components.length === 1 ? "" : "s"}</small></div>; })}</div>}</aside>
      </div>
    </section>
  </main>;
}
