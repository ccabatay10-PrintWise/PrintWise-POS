"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Banknote, Barcode, CreditCard, FileText, Image, LayoutDashboard, LogIn, LogOut,
  Menu, Minus, Package, PenLine, Phone, Plus, Printer, ReceiptText, Search,
  Shirt, ShoppingCart, Sticker, Trash2, Users, Wallet, X, CupSoda, Layers3
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./pos.css";

type Product = { id: string; name: string; category: string; price: number; icon: string };
type CartItem = Product & { quantity: number };

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
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("Cash");
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tendered, setTendered] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadProducts = async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,price,icon_key")
        .eq("is_active", true)
        .order("category")
        .order("name");
      if (error) setMessage(`Unable to load products: ${error.message}`);
      else setProducts((data ?? []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price),
        icon: item.icon_key || "box"
      })));
      setLoadingProducts(false);
    };
    loadProducts();
  }, [user]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const filtered = useMemo(() => products.filter(p =>
    (activeCategory === "All" || p.category === activeCategory) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  ), [activeCategory, search, products]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, discount);
  const total = subtotal - discountAmount;
  const change = Math.max(0, tendered - total);

  const addToCart = (product: Product) => setCart(current => {
    const found = current.find(item => item.id === product.id);
    if (found) return current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
    return [...current, { ...product, quantity: 1 }];
  });

  const updateQuantity = (id: string, delta: number) => setCart(current => current
    .map(item => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
    .filter(item => item.quantity > 0));

  const clearOrder = () => {
    setCart([]); setCustomer(""); setDiscount(0); setTendered(0); setMessage("");
  };

  const signIn = async () => {
    setAuthMessage("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
    setAuthLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearOrder();
    setProducts([]);
  };

  const processPayment = async () => {
    if (!user) return setMessage("Please sign in before processing an order.");
    if (!cart.length) return setMessage("Add at least one item to the order.");
    if (payment === "Cash" && tendered < total) return setMessage("Amount tendered is not enough.");
    setSaving(true);
    setMessage("");

    const orderNo = `PW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
    const paymentMap: Record<string, "cash" | "gcash" | "bayad_center" | "bank_transfer"> = {
      Cash: "cash", GCash: "gcash", Bayad: "bayad_center", Bank: "bank_transfer"
    };
    const amountPaid = payment === "Cash" ? tendered : total;

    const { data: order, error: orderError } = await supabase
      .from("pos_orders")
      .insert({
        order_no: orderNo,
        customer_name: customer.trim() || null,
        status: "completed",
        subtotal,
        discount_type: discount > 0 ? "amount" : null,
        discount_value: discount,
        discount_amount: discountAmount,
        total,
        amount_paid: amountPaid,
        balance: 0,
        created_by: user.id
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setMessage(`Unable to save order: ${orderError?.message || "Unknown error"}`);
      setSaving(false);
      return;
    }

    const itemsResult = await supabase.from("pos_order_items").insert(cart.map(item => ({
      pos_order_id: order.id,
      product_id: item.id,
      item_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity
    })));

    if (itemsResult.error) {
      setMessage(`Order saved, but items failed: ${itemsResult.error.message}`);
      setSaving(false);
      return;
    }

    const paymentResult = await supabase.from("payment_transactions").insert({
      transaction_no: `TXN-${Date.now()}`,
      pos_order_id: order.id,
      channel: paymentMap[payment],
      transaction_type: "payment",
      amount: total,
      service_fee: 0,
      customer_name: customer.trim() || null,
      status: "successful",
      created_by: user.id
    });

    if (paymentResult.error) {
      setMessage(`Order saved, but payment record failed: ${paymentResult.error.message}`);
      setSaving(false);
      return;
    }

    setMessage(`Payment successful. Order ${orderNo} was saved to PrintWise.`);
    setCart([]); setCustomer(""); setDiscount(0); setTendered(0);
    setSaving(false);
  };

  if (authLoading && !user) return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Loading PrintWise...</h1></div></main>;

  if (!user) return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Welcome to PrintWise POS</h1><p>Sign in to access products, orders, and payment transactions.</p><input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email" /><input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={e => e.key === "Enter" && signIn()} />{authMessage && <div className="auth-error">{authMessage}</div>}<button onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={18} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button></div></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Printer size={21} /></div><span>PRINTWISE</span></div>
        <div className="nav-label">MAIN MENU</div>
        {[[LayoutDashboard,"Dashboard"],[ShoppingCart,"Point of Sale"],[ReceiptText,"Orders"],[Wallet,"GCash / Bayad"],[Package,"Products & Services"],[Users,"Customers"],[Layers3,"Inventory"],[FileText,"Reports"]].map(([Icon,label]) => { const NavIcon = Icon as typeof LayoutDashboard; return <button className={`nav-item ${label === "Point of Sale" ? "active" : ""}`} key={String(label)}><NavIcon size={19} /><span>{String(label)}</span></button>; })}
        <div className="sidebar-footer"><button className="profile"><div className="avatar">PW</div><div><b>{user.email?.split("@")[0] || "PrintWise Admin"}</b><small>Authenticated User</small></div></button><button className="signout-btn" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </aside>
      <section className="workspace">
        <header className="topbar"><div><h1>Point of Sale</h1><p>Fast, simple, and connected to your PrintWise database.</p></div><div className="top-actions"><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div></header>
        <div className="pos-layout">
          <section className="catalog-panel">
            <div className="search-row"><div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products and services..." /><button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button></div></div>
            <div className="category-row">{categories.map(category => <button key={category} onClick={() => setActiveCategory(category)} className={`category ${activeCategory === category ? "selected" : ""}`}>{category}</button>)}</div>
            <div className="product-grid">{loadingProducts ? <div className="loading-products">Loading products...</div> : filtered.map(product => <button className="product-card" onClick={() => addToCart(product)} key={product.id}><div className="product-icon"><ProductIcon icon={product.icon} /></div><div className="product-info"><b>{product.name}</b><span>{product.category}</span><strong>₱{product.price.toFixed(2)}</strong></div><div className="add-circle"><Plus size={18} /></div></button>)}</div>
          </section>
          <aside className="order-panel">
            <div className="order-head"><div><h2>Current Order</h2><span>{cart.length} item{cart.length === 1 ? "" : "s"}</span></div><button className="clear-btn" onClick={clearOrder}><Trash2 size={16} /> Clear</button></div>
            <div className="customer-box"><Users size={18} /><input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Customer name (optional)" /></div>
            <div className="cart-list">{cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={34} /><b>Your order is empty</b><span>Select a product or service to begin.</span></div> : cart.map(item => <div className="cart-item" key={item.id}><div className="cart-item-icon"><ProductIcon icon={item.icon} /></div><div className="cart-item-name"><b>{item.name}</b><span>₱{item.price.toFixed(2)} each</span><div className="qty"><button onClick={() => updateQuantity(item.id,-1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id,1)}><Plus size={14} /></button></div></div><strong>₱{(item.price*item.quantity).toFixed(2)}</strong></div>)}</div>
            <div className="summary"><div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div><div className="discount-row"><span>Discount</span><input type="number" min="0" value={discount || ""} onChange={e => setDiscount(Number(e.target.value)||0)} placeholder="0.00" /></div><div className="total-row"><span>Total</span><b>₱{total.toFixed(2)}</b></div></div>
            <div className="payment-section"><h3>Payment Method</h3><div className="payment-grid">{[[Banknote,"Cash"],[Phone,"GCash"],[ReceiptText,"Bayad"],[CreditCard,"Bank"]].map(([Icon,label]) => { const PaymentIcon = Icon as typeof Banknote; return <button key={String(label)} onClick={() => setPayment(String(label))} className={`payment-option ${payment===label?"chosen":""}`}><PaymentIcon size={19}/><span>{String(label)}</span></button>; })}</div>{payment === "Cash" && <div className="tendered"><span>Amount Tendered</span><input type="number" min="0" value={tendered || ""} onChange={e => setTendered(Number(e.target.value)||0)} placeholder="0.00" /><small>Change: <b>₱{change.toFixed(2)}</b></small></div>}</div>
            {message && <div className="message">{message}</div>}
            <button className="process-btn" disabled={saving} onClick={processPayment}><ReceiptText size={20} /> {saving ? "SAVING..." : "PROCESS PAYMENT"} <strong>₱{total.toFixed(2)}</strong></button>
          </aside>
        </div>
      </section>
    </main>
  );
}
