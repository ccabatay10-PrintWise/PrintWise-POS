"use client";

import { useMemo, useState } from "react";
import {
  Banknote, Barcode, CreditCard, FileText, Image, LayoutDashboard, Menu,
  Minus, Package, PenLine, Phone, Plus, Printer, ReceiptText, Search,
  Shirt, ShoppingCart, Sticker, Trash2, Users, Wallet, X, CupSoda, Layers3
} from "lucide-react";
import "./pos.css";

type Product = { id: number; name: string; category: string; price: number; icon: string };
type CartItem = Product & { quantity: number };

const products: Product[] = [
  { id: 1, name: "Tarpaulin Printing", category: "Tarpaulin", price: 60, icon: "banner" },
  { id: 2, name: "T-Shirt Printing", category: "Apparel", price: 150, icon: "shirt" },
  { id: 3, name: "Mug Printing", category: "Giveaways", price: 120, icon: "mug" },
  { id: 4, name: "Stickers (A3)", category: "Stickers", price: 30, icon: "sticker" },
  { id: 5, name: "Photo Printing (4R)", category: "Photos", price: 10, icon: "photo" },
  { id: 6, name: "Invitations", category: "Paper", price: 25, icon: "paper" },
  { id: 7, name: "ID / Tarjeta", category: "IDs", price: 20, icon: "id" },
  { id: 8, name: "Laminating", category: "Paper", price: 15, icon: "layers" },
  { id: 9, name: "Polo Shirt Printing", category: "Apparel", price: 180, icon: "shirt" },
  { id: 10, name: "Canvas Printing", category: "Tarpaulin", price: 350, icon: "photo" },
  { id: 11, name: "Ballpen Printing", category: "Giveaways", price: 25, icon: "pen" }
];

const categories = ["All", "Tarpaulin", "Apparel", "Giveaways", "Stickers", "Photos", "Paper", "IDs"];

function ProductIcon({ icon }: { icon: string }) {
  const props = { size: 26, strokeWidth: 1.8 };
  if (icon === "shirt") return <Shirt {...props} />;
  if (icon === "mug") return <CupSoda {...props} />;
  if (icon === "sticker") return <Sticker {...props} />;
  if (icon === "photo") return <Image {...props} />;
  if (icon === "paper") return <FileText {...props} />;
  if (icon === "id") return <Barcode {...props} />;
  if (icon === "layers") return <Layers3 {...props} />;
  if (icon === "pen") return <PenLine {...props} />;
  return <Printer {...props} />;
}

export default function POSPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("Cash");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tendered, setTendered] = useState(0);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => products.filter(p =>
    (activeCategory === "All" || p.category === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  ), [activeCategory, search]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, discount);
  const total = subtotal - discountAmount;
  const change = Math.max(0, tendered - total);

  const addToCart = (product: Product) => {
    setCart(current => {
      const found = current.find(item => item.id === product.id);
      if (found) return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(current => current
      .map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0));
  };

  const clearOrder = () => {
    setCart([]); setCustomer(""); setDiscount(0); setTendered(0); setMessage("");
  };

  const processPayment = () => {
    if (!cart.length) return setMessage("Add at least one item to the order.");
    if (payment === "Cash" && tendered < total) return setMessage("Amount tendered is not enough.");
    setMessage(`Payment recorded as ${payment}. Order is ready to save to the PrintWise database.`);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Printer size={21} /></div><span>PRINTWISE</span></div>
        <div className="nav-label">MAIN MENU</div>
        {[
          [LayoutDashboard, "Dashboard"], [ShoppingCart, "Point of Sale"], [ReceiptText, "Orders"],
          [Wallet, "GCash / Bayad"], [Package, "Products & Services"], [Users, "Customers"],
          [Layers3, "Inventory"], [FileText, "Reports"]
        ].map(([Icon, label]) => <button className={`nav-item ${label === "Point of Sale" ? "active" : ""}`} key={String(label)}><Icon size={19} /><span>{String(label)}</span></button>)}
        <div className="sidebar-footer"><button className="profile"><div className="avatar">PW</div><div><b>PrintWise Admin</b><small>Administrator</small></div></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><h1>Point of Sale</h1><p>Fast, simple, and professional order processing.</p></div>
          <div className="top-actions"><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>
        </header>

        <div className="pos-layout">
          <section className="catalog-panel">
            <div className="search-row"><div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products and services..." /><button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button></div></div>
            <div className="category-row">{categories.map(category => <button key={category} onClick={() => setActiveCategory(category)} className={`category ${activeCategory === category ? "selected" : ""}`}>{category}</button>)}</div>
            <div className="product-grid">
              {filtered.map(product => <button className="product-card" onClick={() => addToCart(product)} key={product.id}><div className="product-icon"><ProductIcon icon={product.icon} /></div><div className="product-info"><b>{product.name}</b><span>{product.category}</span><strong>₱{product.price.toFixed(2)}</strong></div><div className="add-circle"><Plus size={18} /></div></button>)}
            </div>
          </section>

          <aside className="order-panel">
            <div className="order-head"><div><h2>Current Order</h2><span>{cart.length} item{cart.length === 1 ? "" : "s"}</span></div><button className="clear-btn" onClick={clearOrder}><Trash2 size={16} /> Clear</button></div>
            <div className="customer-box"><Users size={18} /><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name (optional)" /></div>
            <div className="cart-list">{cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={34} /><b>Your order is empty</b><span>Select a product or service to begin.</span></div> : cart.map(item => <div className="cart-item" key={item.id}><div className="cart-item-icon"><ProductIcon icon={item.icon} /></div><div className="cart-item-name"><b>{item.name}</b><span>₱{item.price.toFixed(2)} each</span><div className="qty"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button></div></div><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}</div>
            <div className="summary">
              <div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div>
              <div className="discount-row"><span>Discount</span><input type="number" min="0" value={discount || ""} onChange={e => setDiscount(Number(e.target.value) || 0)} placeholder="0.00" /></div>
              <div className="total-row"><span>Total</span><b>₱{total.toFixed(2)}</b></div>
            </div>
            <div className="payment-section"><h3>Payment Method</h3><div className="payment-grid">{[[Banknote, "Cash"], [Phone, "GCash"], [ReceiptText, "Bayad"], [CreditCard, "Bank"]].map(([Icon, label]) => <button key={String(label)} onClick={() => setPayment(String(label))} className={`payment-option ${payment === label ? "chosen" : ""}`}><Icon size={19} /><span>{String(label)}</span></button>)}</div>
              {payment === "Cash" && <div className="tendered"><span>Amount Tendered</span><input type="number" min="0" value={tendered || ""} onChange={e => setTendered(Number(e.target.value) || 0)} placeholder="0.00" /><small>Change: <b>₱{change.toFixed(2)}</b></small></div>}
            </div>
            {message && <div className="message">{message}</div>}
            <button className="process-btn" onClick={processPayment}><ReceiptText size={20} /> PROCESS PAYMENT <strong>₱{total.toFixed(2)}</strong></button>
          </aside>
        </div>
      </section>
    </main>
  );
}
