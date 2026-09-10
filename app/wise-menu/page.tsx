"use client";

import { useEffect, useMemo, useState } from "react";
import { ChefHat, ChevronDown, CircleCheck, ClipboardList, Clock3, Coffee, Eye, Film, PackageCheck, Play, Printer, Search, Settings2, ShoppingBag, Sparkles, Tag, Utensils, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "./wise-menu.css";

type Product = { id: string; name: string; category: string; price: number; unit?: string; image_url: string | null; item_type: "product" | "service" };
type TicketItem = Product & { quantity: number; size: string; custom: string };

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function WiseMenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<TicketItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [activePanel, setActivePanel] = useState<"menu" | "kitchen" | "sticker">("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orderNo] = useState(() => `WM-${String(Math.floor(Math.random() * 90000) + 10000)}`);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please sign in to manage WISE MENU.");
        const response = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to load products.");
        if (mounted) setProducts(payload.products ?? []);
      } catch (e: any) { if (mounted) setError(e?.message || "Unable to load products."); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))], [products]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter(p => (category === "All" || p.category === category) && (!term || `${p.name} ${p.category}`.toLowerCase().includes(term)));
  }, [products, search, category]);

  const addProduct = (product: Product) => setSelected(current => {
    const found = current.find(item => item.id === product.id);
    if (found) return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
    return [...current, { ...product, quantity: 1, size: "Regular", custom: "Normal Ice · Normal Sugar" }];
  });
  const removeProduct = (id: string) => setSelected(current => current.filter(item => item.id !== id));
  const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const first = selected[0] ?? products[0];

  return (
    <div className="wise-menu-shell">
      <Sidebar />
      <main className="wise-menu-main">
        <header className="wise-menu-header">
          <div>
            <div className="wise-menu-kicker"><Sparkles size={14}/> SMART DIGITAL MENU & KITCHEN</div>
            <h1>WISE MENU</h1>
            <p>Video-first menu, customer ordering, kitchen tickets and cup sticker labels — all connected to WISE POS.</p>
          </div>
          <div className="wise-menu-header-actions"><button type="button"><Eye size={16}/> Customer Preview</button><button type="button"><Settings2 size={16}/> Menu Settings</button></div>
        </header>

        <div className="wise-menu-tabs" role="tablist">
          <button className={activePanel === "menu" ? "active" : ""} onClick={() => setActivePanel("menu")}><ShoppingBag size={17}/> Smart Menu</button>
          <button className={activePanel === "kitchen" ? "active" : ""} onClick={() => setActivePanel("kitchen")}><ChefHat size={17}/> Kitchen Ticket</button>
          <button className={activePanel === "sticker" ? "active" : ""} onClick={() => setActivePanel("sticker")}><Tag size={17}/> Cup Sticker</button>
        </div>

        {error && <div className="wise-menu-alert"><X size={16}/>{error}</div>}

        {activePanel === "menu" && <section className="wise-menu-grid">
          <div className="menu-catalog">
            <div className="catalog-toolbar"><div className="menu-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."/></div><div className="menu-category"><Tag size={15}/><select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={14}/></div></div>
            <div className="menu-category-pills">{categories.map(c => <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
            {loading ? <div className="menu-empty"><Clock3 size={24}/>Loading products...</div> : <div className="video-product-grid">{visible.map(product => <button className="video-product-card" key={product.id} onClick={() => addProduct(product)}>
              <div className="video-product-media">{product.image_url ? <img src={product.image_url} alt=""/> : <div className="video-placeholder"><Film size={28}/><span>PRODUCT VIDEO</span></div>}<span className="video-badge"><Play size={10} fill="currentColor"/> VIDEO</span><span className="video-add">+</span></div>
              <div className="video-product-copy"><span>{product.category || "Menu"}</span><strong>{product.name}</strong><b>{money(product.price)}</b></div>
            </button>)}</div>}
          </div>
          <aside className="menu-order-preview">
            <div className="order-preview-head"><div><span>LIVE ORDER PREVIEW</span><h2>{orderNo}</h2></div><CircleCheck size={22}/></div>
            <div className="order-preview-list">{selected.length ? selected.map(item => <div className="order-preview-item" key={item.id}><div><b>{item.quantity} × {item.name}</b><small>{item.size} · {item.custom}</small></div><strong>{money(item.price * item.quantity)}</strong><button onClick={() => removeProduct(item.id)} aria-label={`Remove ${item.name}`}><X size={14}/></button></div>) : <div className="order-preview-empty"><ShoppingBag size={28}/><b>No items yet</b><span>Select a product to preview the order.</span></div>}</div>
            <div className="order-preview-total"><span>Total</span><strong>{money(total)}</strong></div>
            <button className="send-kitchen" disabled={!selected.length} onClick={() => setActivePanel("kitchen")}><ChefHat size={18}/> Preview Kitchen Ticket</button>
          </aside>
        </section>}

        {activePanel === "kitchen" && <KitchenTicket items={selected.length ? selected : (first ? [{ ...first, quantity: 1, size: "Regular", custom: "Normal Ice · Normal Sugar" }] : [])} orderNo={orderNo} total={total || (first ? first.price : 0)} onSticker={() => setActivePanel("sticker")} />}
        {activePanel === "sticker" && <StickerPreview item={selected[0] ?? (first ? { ...first, quantity: 1, size: "Regular", custom: "Normal Ice · Normal Sugar" } : null)} orderNo={orderNo} onKitchen={() => setActivePanel("kitchen")} />}
      </main>
    </div>
  );
}

function KitchenTicket({ items, orderNo, total, onSticker }: { items: TicketItem[]; orderNo: string; total: number; onSticker: () => void }) {
  return <section className="production-stage">
    <div className="stage-toolbar"><div><span className="stage-kicker">KITCHEN PRODUCTION</span><h2>Kitchen Order Ticket <small>KOT</small></h2><p>Detailed preparation ticket generated from the customer order.</p></div><div className="stage-actions"><button type="button"><Printer size={16}/> Print KOT</button><button type="button" onClick={onSticker}><Tag size={16}/> View Cup Sticker</button></div></div>
    <div className="ticket-layout"><div className="ticket-paper">
      <div className="ticket-brand"><strong>ESPACIO</strong><span>CAFE & RESTAURANT</span></div><div className="ticket-title">KITCHEN ORDER</div>
      <div className="ticket-meta"><span><b>Order #</b>{orderNo}</span><span><b>Date</b>{new Date().toLocaleDateString("en-PH")}</span><span><b>Table</b>05</span><span><b>Type</b>DINE-IN</span><span><b>Time</b>{new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</span><span><b>Guests</b>2</span></div>
      {items.map((item, index) => <div className="ticket-item" key={`${item.id}-${index}`}><div className="ticket-item-heading"><span>{index + 1}</span><strong>{item.name}</strong><b>{item.quantity} × {item.size}</b></div><div className="recipe-columns"><div><label>INGREDIENTS / RECIPE</label><div className="recipe-row"><span>Recipe to be configured</span><b>—</b></div><div className="recipe-row"><span>Measurement</span><b>—</b></div><small>Recipe data will print here once ingredients and measurements are assigned to this product.</small></div><div className="custom-box"><label>CUSTOMIZATION</label><strong>{item.custom}</strong></div></div></div>)}
      <div className="ticket-special"><b>SPECIAL INSTRUCTIONS</b><span>Prepare according to recipe and customer customization.</span></div><div className="ticket-footer"><span><Utensils size={18}/> KITCHEN USE ONLY</span><strong>GOOD FOOD BRINGS PEOPLE TOGETHER ♥</strong></div>
    </div><div className="ticket-side-info"><div><ChefHat size={20}/><b>Recipe-driven KOT</b><p>Each product will pull its configured ingredients and exact measurements automatically.</p></div><div><PackageCheck size={20}/><b>Production Ready</b><p>Kitchen can identify item, quantity, size and customization at a glance.</p></div><div><ClipboardList size={20}/><b>Next</b><p>Configure recipes, then connect KOT and inventory deduction.</p></div></div></div>
  </section>;
}

function StickerPreview({ item, orderNo, onKitchen }: { item: TicketItem | null; orderNo: string; onKitchen: () => void }) {
  return <section className="production-stage sticker-stage"><div className="stage-toolbar"><div><span className="stage-kicker">CUP IDENTIFICATION</span><h2>Square Sticker Label</h2><p>Compact label designed to sit beside the cup lid, inspired by modern café labeling.</p></div><div className="stage-actions"><button type="button"><Printer size={16}/> Print Sticker</button><button type="button" onClick={onKitchen}><ChefHat size={16}/> View KOT</button></div></div><div className="sticker-workspace"><div className="cup-scene"><div className="cup"><div className="cup-lid"></div><div className="cup-body"><div className="drink"></div><div className="sticker"><div className="sticker-brand">ESPACIO <small>CAFE & RESTAURANT</small></div><div className="sticker-order">{orderNo}</div><div className="sticker-product">{item?.name || "PRODUCT NAME"}</div><div className="sticker-size">{item?.size || "REGULAR"}</div><div className="sticker-meta"><span>Table: <b>05</b></span><span>Qty: <b>{item?.quantity || 1}</b></span></div><div className="sticker-custom">{item?.custom || "Normal Ice · Normal Sugar"}</div><div className="sticker-footer">Enjoy! ♥</div></div></div></div></div><div className="sticker-spec"><div className="spec-card"><Tag size={20}/><div><b>SQUARE FORMAT</b><span>Designed for placement beside the cap/lid.</span></div></div><div className="spec-card"><Clock3 size={20}/><div><b>AUTO-PRINT READY</b><span>One sticker per drink or prepared item.</span></div></div><div className="spec-card"><ClipboardList size={20}/><div><b>CLEAR IDENTIFICATION</b><span>Order number, product, size, quantity and customizations.</span></div></div><div className="sticker-dimensions"><strong>Suggested size</strong><b>60 × 60 mm</b><span>Adjustable to your thermal label printer.</span></div></div></div></section>;
}
