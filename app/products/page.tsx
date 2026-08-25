"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Package, Plus, Search, Pencil, Power } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type Product = { id: string; name: string; category: string; price: number; is_active: boolean };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("id,name,category,price,is_active").order("category").order("name");
    if (error) setMessage(error.message);
    else setProducts((data ?? []).map((p: any) => ({ ...p, price: Number(p.price) })));
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/pos";
      else loadProducts();
    });
  }, []);

  const filtered = useMemo(() => products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/pos"><ArrowLeft size={19} /><span>Point of Sale</span></a>
      <a className="nav-item" href="/orders"><Package size={19} /><span>Orders</span></a>
      <a className="nav-item active" href="/products"><Package size={19} /><span>Products & Services</span></a>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><h1>Products & Services</h1><p>Manage the products and services available in PrintWise POS.</p></div><button className="process-btn" style={{width:"auto"}} onClick={() => setMessage("Add Product form will be the next management feature.")}><Plus size={18}/> ADD PRODUCT</button></header>
      <div className="pos-layout" style={{gridTemplateColumns:"1fr"}}><section className="catalog-panel">
        <div className="search-box"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products and services..."/></div>
        {message && <div className="message">{message}</div>}
        <div style={{overflowX:"auto",marginTop:18}}><table className="orders-table"><thead><tr><th>Product / Service</th><th>Category</th><th>Price</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={5}>Loading products...</td></tr> : filtered.length === 0 ? <tr><td colSpan={5}>No products found.</td></tr> : filtered.map(p => <tr key={p.id}><td><b>{p.name}</b></td><td>{p.category}</td><td>₱{p.price.toFixed(2)}</td><td><span className="order-status">{p.is_active ? "Active" : "Inactive"}</span></td><td><button className="icon-btn" title="Edit"><Pencil size={16}/></button> <button className="icon-btn" title="Status"><Power size={16}/></button></td></tr>)}
        </tbody></table></div>
      </section></div>
    </section>
  </main>;
}
