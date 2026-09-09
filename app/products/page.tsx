"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Edit3, Grid2X2, Package, Plus, Power, Search, Save, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./products.css";
import Sidebar from "../components/Sidebar";

type Product = {
  id: string; sku: string | null; name: string; category: string; description: string | null;
  unit: string; price: number; icon_key: string; image_url: string | null; is_active: boolean;
  show_in_pos: boolean; track_inventory: boolean; item_type: "product" | "service";
};
type ProductForm = {
  item_type: "product" | "service"; sku: string; name: string; category: string; description: string;
  unit: string; price: string; icon_key: string; image_url: string; show_in_pos: boolean; track_inventory: boolean;
};
const emptyForm: ProductForm = { item_type: "product", sku: "", name: "", category: "", description: "", unit: "piece", price: "", icon_key: "box", image_url: "", show_in_pos: true, track_inventory: false };

const categoryClass = (category: string) => {
  const value = category.toLowerCase();
  if (value.includes("food")) return "food";
  if (value.includes("id") || value.includes("tarjeta")) return "id";
  if (value.includes("sticker")) return "stickers";
  return "";
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true), [message, setMessage] = useState(""), [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false), [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm), [imageFile, setImageFile] = useState<File | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("id,sku,name,category,description,unit,price,icon_key,image_url,is_active,show_in_pos,track_inventory,item_type").order("category").order("name");
    if (error) setMessage(`Unable to load products: ${error.message}`);
    else setProducts((data ?? []).map((p: any) => ({ ...p, price: Number(p.price), item_type: p.item_type === "service" ? "service" : "product" })));
    setLoading(false);
  };

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (!data.user) window.location.href = "/pos"; else loadProducts(); }); }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products]);
  const categoryCounts = useMemo(() => categories.map((category) => ({ category, count: products.filter((p) => p.category === category).length })), [categories, products]);
  const printingCount = products.filter((p) => /print|printing/i.test(p.category)).length;
  const foodCount = products.filter((p) => /food|drink/i.test(p.category)).length;
  const idCount = products.filter((p) => /id|tarjeta/i.test(p.category)).length;
  const stickerCount = products.filter((p) => /sticker/i.test(p.category)).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = !query || `${p.name} ${p.category} ${p.sku || ""}`.toLowerCase().includes(query);
      const matchesType = typeFilter === "all" || p.item_type === typeFilter;
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? p.is_active : !p.is_active);
      const matchesTab = activeCategory === "all" || (activeCategory === "printing" ? /print|printing/i.test(p.category) : activeCategory === "food" ? /food|drink/i.test(p.category) : activeCategory === "id" ? /id|tarjeta/i.test(p.category) : activeCategory === "stickers" ? /sticker/i.test(p.category) : p.category === activeCategory);
      return matchesSearch && matchesType && matchesCategory && matchesStatus && matchesTab;
    }).sort((a, b) => sort === "price-low" ? a.price - b.price : sort === "price-high" ? b.price - a.price : sort === "category" ? a.category.localeCompare(b.category) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  }, [products, search, typeFilter, categoryFilter, statusFilter, activeCategory, sort]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setImageFile(null); setMessage(""); setModalOpen(true); };
  const openEdit = (p: Product) => { setEditingId(p.id); setImageFile(null); setForm({ item_type: p.item_type, sku: p.sku || "", name: p.name, category: p.category, description: p.description || "", unit: p.unit || (p.item_type === "service" ? "service" : "piece"), price: String(p.price), icon_key: p.icon_key || "box", image_url: p.image_url || "", show_in_pos: p.show_in_pos, track_inventory: p.track_inventory }); setMessage(""); setModalOpen(true); };
  const handleImage = (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) return setMessage("Please choose a valid image file."); if (file.size > 5 * 1024 * 1024) return setMessage("Image must be 5MB or smaller."); setImageFile(file); setForm((f) => ({ ...f, image_url: URL.createObjectURL(file) })); };

  const saveProduct = async () => {
    const name = form.name.trim(), category = form.category.trim(), price = Number(form.price);
    if (!name || !category || form.price === "" || Number.isNaN(price) || price < 0) return setMessage("Please enter a product/service name, category, and valid price.");
    setSaving(true); setMessage(""); let imageUrl = form.image_url || null;
    if (imageFile) { const ext = imageFile.name.split(".").pop() || "jpg", safeName = `${Date.now()}-${crypto.randomUUID()}.${ext}`; const { error } = await supabase.storage.from("product-images").upload(safeName, imageFile, { upsert: false, contentType: imageFile.type }); if (error) { setMessage(`Unable to upload image: ${error.message}`); setSaving(false); return; } imageUrl = supabase.storage.from("product-images").getPublicUrl(safeName).data.publicUrl; }
    const payload = { item_type: form.item_type, sku: form.sku.trim() || null, name, category, description: form.description.trim() || null, unit: form.unit.trim() || (form.item_type === "service" ? "service" : "piece"), price, icon_key: form.icon_key.trim() || "box", image_url: imageUrl, show_in_pos: form.show_in_pos, track_inventory: form.item_type === "service" ? false : form.track_inventory };
    const result = editingId ? await supabase.from("products").update(payload).eq("id", editingId) : await supabase.from("products").insert({ ...payload, is_active: true });
    if (result.error) { setMessage(`Unable to save product/service: ${result.error.message}`); setSaving(false); return; }
    const wasEditing = Boolean(editingId); setModalOpen(false); setEditingId(null); setForm(emptyForm); setImageFile(null); setSaving(false); setMessage(wasEditing ? "Product/service updated successfully." : "Product/service added successfully."); await loadProducts();
  };

  const toggle = async (p: Product, field: "is_active" | "show_in_pos") => { setMessage(""); const next = !p[field]; const { error } = await supabase.from("products").update({ [field]: next }).eq("id", p.id); if (error) return setMessage(`Unable to update ${field === "show_in_pos" ? "POS visibility" : "status"}: ${error.message}`); setProducts((current) => current.map((x) => x.id === p.id ? { ...x, [field]: next } : x)); setMessage(field === "show_in_pos" ? `${p.name} is now ${next ? "shown in" : "hidden from"} POS.` : `${p.name} is now ${next ? "Active" : "Inactive"}.`); };

  return <main className="app-shell products-page"><Sidebar/><section className="workspace products-workspace">
    <header className="products-header">
      <div className="products-title-wrap"><div className="products-title-icon"><Package size={25}/></div><div><h1>Products &amp; Services</h1><p>Create and control everything you sell through WISE POS.</p></div></div>
      <button className="products-add" onClick={openAdd}><Plus size={18}/> ADD PRODUCT / SERVICE</button>
    </header>

    <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><div className="products-summary">
      <div className="products-stat"><div className="products-stat-icon"><Package size={15}/></div><div><strong>{products.length}</strong><span>Total Items</span></div></div>
      <div className="products-stat"><div className="products-stat-icon green"><span style={{width:7,height:7,borderRadius:"50%",background:"currentColor"}}/></div><div><strong>{products.filter(p=>p.is_active).length}</strong><span>Active Items</span></div></div>
      <div className="products-stat"><div className="products-stat-icon gray"><span style={{width:7,height:7,borderRadius:"50%",background:"currentColor"}}/></div><div><strong>{products.filter(p=>!p.is_active).length}</strong><span>Inactive Items</span></div></div>
    </div></div>

    <div className="products-toolbar">
      <div className="products-search"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search products and services..."/></div>
      <label className="products-select"><select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}><option value="all">All Types</option><option value="product">Products</option><option value="service">Services</option></select><ChevronDown size={15}/></label>
      <label className="products-select"><select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)}><option value="all">All Categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={15}/></label>
      <label className="products-select"><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select><ChevronDown size={15}/></label>
    </div>

    <div className="products-categories">
      <button className={`products-category ${activeCategory === "all" ? "active" : ""}`} onClick={()=>setActiveCategory("all")}><Grid2X2 size={15}/> All <span className="products-category-count">{products.length}</span></button>
      <button className={`products-category ${activeCategory === "printing" ? "active" : ""}`} onClick={()=>setActiveCategory("printing")}>▣ Printing <span className="products-category-count">{printingCount}</span></button>
      <button className={`products-category ${activeCategory === "food" ? "active" : ""}`} onClick={()=>setActiveCategory("food")}>🍴 Food <span className="products-category-count">{foodCount}</span></button>
      <button className={`products-category ${activeCategory === "id" ? "active" : ""}`} onClick={()=>setActiveCategory("id")}>▣ ID / Tarjetas <span className="products-category-count">{idCount}</span></button>
      <button className={`products-category ${activeCategory === "stickers" ? "active" : ""}`} onClick={()=>setActiveCategory("stickers")}>◇ Stickers <span className="products-category-count">{stickerCount}</span></button>
      {categoryCounts.filter(x=>!["printing","food","id","stickers"].includes(x.category.toLowerCase())).slice(0,3).map(x=><button key={x.category} className={`products-category ${activeCategory===x.category?"active":""}`} onClick={()=>setActiveCategory(x.category)}><SlidersHorizontal size={14}/> {x.category} <span className="products-category-count">{x.count}</span></button>)}
      <label className="products-select" style={{marginLeft:"auto",minWidth:150,height:38}}><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="name">Sort: Name A-Z</option><option value="category">Sort: Category</option><option value="price-low">Sort: Price Low</option><option value="price-high">Sort: Price High</option></select><ChevronDown size={14}/></label>
    </div>

    {message && <div className="products-message">{message}</div>}
    <section className="products-table-card"><div className="products-table-scroll"><table className="products-table"><thead><tr><th className="products-number">#</th><th>Product / Service</th><th>Type</th><th>Category</th><th>Price</th><th>POS</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="products-empty">Loading products and services...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="products-empty">No products or services found.</td></tr> : filtered.map((p,index)=><tr key={p.id}>
        <td className="products-number">{index+1}</td>
        <td><div className="product-cell">{p.image_url ? <img className="product-thumb" src={p.image_url} alt=""/> : <div className="product-thumb-fallback"><Package size={17}/></div>}<div><span className="product-name">{p.name}</span>{p.sku && <span className="product-sku">SKU: {p.sku}</span>}</div></div></td>
        <td className="product-type">{p.item_type === "service" ? "Service" : "Product"}</td>
        <td><span className={`product-category-badge ${categoryClass(p.category)}`}>{p.category}</span></td>
        <td><span className="product-price">₱{p.price.toFixed(2)} <span>/ {p.unit}</span></span></td>
        <td><button className={`products-toggle ${p.show_in_pos ? "on" : ""}`} onClick={()=>toggle(p,"show_in_pos")} aria-label={`Toggle POS visibility for ${p.name}`}><span className="products-switch"><span/></span>{p.show_in_pos ? "Shown" : "Hidden"}</button></td>
        <td><button className={`products-status ${p.is_active ? "" : "off"}`} onClick={()=>toggle(p,"is_active")}><span className="products-status-dot"/>{p.is_active ? "Active" : "Inactive"}</button></td>
        <td><div className="products-actions"><button className="products-action" title="Edit product/service" onClick={()=>openEdit(p)}><Edit3 size={15}/></button><button className="products-action danger" title={p.is_active ? "Deactivate" : "Activate"} onClick={()=>toggle(p,"is_active")}><Power size={15}/></button></div></td>
      </tr>)}
    </tbody></table></div><footer className="products-footer"><span>Showing 1–{filtered.length} of {filtered.length} items</span><div className="products-pagination"><button className="products-page-btn" disabled><ChevronLeft size={15}/></button><button className="products-page-btn current">1</button><button className="products-page-btn" disabled><ChevronRight size={15}/></button></div></footer></section>
  </section>

  {modalOpen && <div className="products-modal-backdrop"><div className="products-modal">
    <div className="products-modal-head"><div><h2>{editingId ? "Edit Product / Service" : "Add Product / Service"}</h2><p>Configure how this item behaves in WISE POS.</p></div><button className="products-modal-close" onClick={()=>setModalOpen(false)}><X size={17}/></button></div>
    <div className="products-modal-body"><div className="products-form-grid">
      <label className="products-form-label">Type<select value={form.item_type} onChange={(e)=>setForm({...form,item_type:e.target.value as "product"|"service",track_inventory:e.target.value === "service" ? false : form.track_inventory,unit:e.target.value === "service" && form.unit === "piece" ? "service" : form.unit})}><option value="product">Product</option><option value="service">Service</option></select></label>
      <label className="products-form-label">Product / Service Name<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="e.g. Iced Coffee, Haircut, T-Shirt"/></label>
      <label className="products-form-label">Category<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} placeholder="e.g. Drinks, Services, Retail"/></label>
      <label className="products-form-label">Selling Price<input type="number" min="0" step="0.01" value={form.price} onChange={(e)=>setForm({...form,price:e.target.value})} placeholder="0.00"/></label>
      <label className="products-form-label">SKU (optional)<input value={form.sku} onChange={(e)=>setForm({...form,sku:e.target.value})} placeholder="Optional SKU / barcode"/></label>
      <label className="products-form-label">Unit<input value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value})} placeholder="piece, cup, hour, service"/></label>
      <label className="products-form-label">POS Icon<select value={form.icon_key} onChange={(e)=>setForm({...form,icon_key:e.target.value})}><option value="box">Box / Default</option><option value="printer">Printer</option><option value="pen">Pen</option><option value="paper">Paper</option><option value="id">ID / Card</option><option value="layers">Laminating</option><option value="mug">Food / Drink</option><option value="photo">Photo</option><option value="shirt">Clothing</option><option value="sticker">Sticker</option></select></label>
      <label className="products-form-label full">Product Picture<input type="file" accept="image/*" onChange={(e)=>handleImage(e.target.files?.[0])}/>{form.image_url && <div className="products-preview"><img src={form.image_url} alt="Product preview"/><button type="button" className="products-remove" onClick={()=>{setImageFile(null);setForm(f=>({...f,image_url:""}))}}><X size={14}/> Remove</button></div>}</label>
      <label className="products-form-label full">Description (optional)<textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} rows={3} placeholder="Optional description or service details"/></label>
    </div><div className="products-form-options"><label className="products-check"><input type="checkbox" checked={form.show_in_pos} onChange={(e)=>setForm({...form,show_in_pos:e.target.checked})}/><span><b>Show in POS</b> — make this item available for checkout.</span></label><label className="products-check"><input type="checkbox" disabled={form.item_type === "service"} checked={form.track_inventory} onChange={(e)=>setForm({...form,track_inventory:e.target.checked})}/><span><b>Track inventory</b> — use stock controls for this item.{form.item_type === "service" && <em style={{marginLeft:6,opacity:.65}}>(Services do not require stock.)</em>}</span></label></div></div>
    <div className="products-modal-actions"><button className="products-cancel" onClick={()=>setModalOpen(false)}>Cancel</button><button className="products-save" disabled={saving} onClick={saveProduct}><Save size={16}/>{saving ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD PRODUCT / SERVICE"}</button></div>
  </div></div>}
  </main>;
}
