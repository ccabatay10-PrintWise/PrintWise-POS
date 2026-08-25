"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, Plus, Search, Pencil, Power, ReceiptText, X, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price: number;
  icon_key: string;
  is_active: boolean;
};

type ProductForm = {
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: string;
  icon_key: string;
};

const emptyForm: ProductForm = {
  sku: "",
  name: "",
  category: "",
  description: "",
  unit: "piece",
  price: "",
  icon_key: "box",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,sku,name,category,description,unit,price,icon_key,is_active")
      .order("category")
      .order("name");
    if (error) setMessage(`Unable to load products: ${error.message}`);
    else setProducts((data ?? []).map((p: any) => ({ ...p, price: Number(p.price) })));
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/pos";
      else loadProducts();
    });
  }, []);

  const filtered = useMemo(
    () => products.filter(p => `${p.name} ${p.category} ${p.sku || ""}`.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      sku: product.sku || "",
      name: product.name,
      category: product.category,
      description: product.description || "",
      unit: product.unit || "piece",
      price: String(product.price),
      icon_key: product.icon_key || "box",
    });
    setMessage("");
    setModalOpen(true);
  };

  const saveProduct = async () => {
    const name = form.name.trim();
    const category = form.category.trim();
    const price = Number(form.price);

    if (!name || !category || form.price === "" || Number.isNaN(price) || price < 0) {
      setMessage("Please enter a product name, category, and valid price.");
      return;
    }

    setSaving(true);
    setMessage("");
    const payload = {
      sku: form.sku.trim() || null,
      name,
      category,
      description: form.description.trim() || null,
      unit: form.unit.trim() || "piece",
      price,
      icon_key: form.icon_key.trim() || "box",
    };

    const result = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert({ ...payload, is_active: true });

    if (result.error) {
      setMessage(`Unable to save product: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    setMessage(editingId ? "Product updated successfully." : "Product added successfully.");
    await loadProducts();
  };

  const toggleStatus = async (product: Product) => {
    setMessage("");
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) {
      setMessage(`Unable to change status: ${error.message}`);
      return;
    }
    setProducts(current => current.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
    setMessage(`${product.name} is now ${product.is_active ? "Inactive" : "Active"}.`);
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/pos"><ArrowLeft size={19} /><span>Point of Sale</span></a>
      <a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
      <a className="nav-item active" href="/products"><Package size={19} /><span>Products & Services</span></a>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div><h1>Products & Services</h1><p>Manage the products and services available in PrintWise POS.</p></div>
        <button className="process-btn" style={{ width: "auto" }} onClick={openAdd}><Plus size={18} /> ADD PRODUCT</button>
      </header>

      <div className="pos-layout" style={{ gridTemplateColumns: "1fr" }}>
        <section className="catalog-panel">
          <div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products and services..." /></div>
          {message && <div className="message">{message}</div>}
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table className="orders-table">
              <thead><tr><th>Product / Service</th><th>Category</th><th>Price</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5}>Loading products...</td></tr> :
                  filtered.length === 0 ? <tr><td colSpan={5}>No products found.</td></tr> :
                  filtered.map(p => <tr key={p.id}>
                    <td><b>{p.name}</b>{p.sku && <small style={{ display: "block", opacity: 0.65, marginTop: 3 }}>SKU: {p.sku}</small>}</td>
                    <td>{p.category}</td>
                    <td>₱{p.price.toFixed(2)}</td>
                    <td><span className="order-status">{p.is_active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <button className="icon-btn" title="Edit product" onClick={() => openEdit(p)}><Pencil size={16} /></button>{" "}
                      <button className="icon-btn" title={p.is_active ? "Deactivate product" : "Activate product"} onClick={() => toggleStatus(p)}><Power size={16} /></button>
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>

    {modalOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ width: "min(680px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div><h2 style={{ margin: 0 }}>{editingId ? "Edit Product" : "Add Product"}</h2><p style={{ margin: "6px 0 0", color: "#64748b" }}>Save this product directly to your PrintWise database.</p></div>
          <button className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
          <label style={{ gridColumn: "1 / -1", display: "grid", gap: 6 }}>Product / Service Name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ballpen Printing" /></label>
          <label style={{ display: "grid", gap: 6 }}>Category<input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Printing" /></label>
          <label style={{ display: "grid", gap: 6 }}>Price<input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" /></label>
          <label style={{ display: "grid", gap: 6 }}>SKU (optional)<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Optional SKU" /></label>
          <label style={{ display: "grid", gap: 6 }}>Unit<input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="piece" /></label>
          <label style={{ gridColumn: "1 / -1", display: "grid", gap: 6 }}>POS Icon<select value={form.icon_key} onChange={e => setForm({ ...form, icon_key: e.target.value })}><option value="box">Box / Default</option><option value="printer">Printer</option><option value="pen">Pen</option><option value="paper">Paper</option><option value="id">ID / Card</option><option value="layers">Laminating</option><option value="mug">Mug</option><option value="photo">Photo</option><option value="shirt">Shirt</option><option value="sticker">Sticker</option></select></label>
          <label style={{ gridColumn: "1 / -1", display: "grid", gap: 6 }}>Description (optional)<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional product description" /></label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button className="icon-btn" style={{ padding: "10px 16px", width: "auto" }} onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="process-btn" style={{ width: "auto", padding: "10px 18px" }} disabled={saving} onClick={saveProduct}><Save size={17} /> {saving ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD PRODUCT"}</button>
        </div>
      </div>
    </div>}
  </main>;
}
