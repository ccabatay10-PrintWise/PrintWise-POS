"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Banknote, CreditCard, LogIn, Minus, Plus, ReceiptText, Search, ShoppingCart, Smartphone, Trash2, WalletCards, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "./pos.css";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit?: string;
  image_url: string | null;
  item_type: "product" | "service";
};

type CartItem = Product & { quantity: number };
type Receipt = { orderNo: string; payment: string; amountPaid: number; change: number; total: number; items: CartItem[] };

const payments = [
  { key: "Cash", icon: Banknote },
  { key: "GCash", icon: Smartphone },
  { key: "Maya", icon: Smartphone },
  { key: "Credit Card", icon: CreditCard },
  { key: "eWallet", icon: WalletCards },
];

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function POSPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("Cash");
  const [tendered, setTendered] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
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
    const load = async () => {
      setProductsLoading(true);
      setMessage("");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch("/api/products", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "default",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to load products and services.");
        setProducts((payload.products ?? []).map((p: any) => ({
          ...p,
          price: Number(p.price),
          item_type: p.item_type === "service" ? "service" : "product",
        })));
      } catch (error: any) {
        setMessage(error?.message || "Unable to load products and services.");
      } finally {
        setProductsLoading(false);
      }
    };
    load();
  }, [user]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))],
    [products],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) =>
      (category === "All" || p.category === category) &&
      (!term || `${p.name} ${p.category} ${p.item_type}`.toLowerCase().includes(term)),
    );
  }, [products, search, category]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, discount));
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, tendered - total);

  const add = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
  };

  const qty = (id: string, delta: number) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const clear = () => {
    setCart([]);
    setCustomer("");
    setDiscount(0);
    setTendered(0);
    setPayment("Cash");
    setMessage("");
  };

  const signIn = async () => {
    setAuthMessage("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
    setAuthLoading(false);
  };

  const openCheckout = () => {
    if (!cart.length) {
      setMessage("Add an item to the cart before checkout.");
      return;
    }
    if (payment !== "Cash") setTendered(total);
    setMessage("");
    setCheckoutOpen(true);
  };

  const checkout = async () => {
    if (!user) {
      setMessage("Please sign in before completing a sale.");
      return;
    }
    if (payment === "Cash" && tendered < total) {
      setMessage("Amount received is not enough for this sale.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const now = Date.now();
      const orderNo = `WISE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(now).slice(-6)}`;
      const transactionNo = `W-${now}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const amountPaid = payment === "Cash" ? tendered : total;
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderNo,
          transactionNo,
          customerName: customer.trim() || null,
          subtotal,
          discountAmount,
          total,
          amountPaid,
          channel: payment.toLowerCase().replace(/\s+/g, "_"),
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            lineTotal: item.price * item.quantity,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.order_id) {
        throw new Error(payload.error || "Unable to save the sale.");
      }
      setReceipt({ orderNo, payment, amountPaid, change: payment === "Cash" ? change : 0, total, items: [...cart] });
      setCheckoutOpen(false);
    } catch (error: any) {
      setMessage(error?.message || "Unable to complete checkout.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading && !user) {
    return <main className="wise-auth"><div className="wise-auth-card"><div className="wise-logo">W</div><h1>WISE POS</h1><p>Loading your workspace...</p></div></main>;
  }

  if (!user) {
    return <main className="wise-auth"><div className="wise-auth-card">
      <div className="wise-logo">W</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && signIn()} />
      {authMessage && <div className="wise-error">{authMessage}</div>}
      <button className="wise-primary" onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={17} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button>
    </div></main>;
  }

  return <main className="app-shell">
    <Sidebar />
    <section className="wise-pos-page">
      <header className="wise-header">
        <div><div className="wise-eyebrow">POINT OF SALE</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p></div>
        <div className="wise-header-pill">GENERAL BUSINESS MODE</div>
      </header>

      <div className="wise-layout">
        <section className="wise-catalog">
          <div className="wise-toolbar">
            <div className="wise-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or services..." /></div>
            {categories.length > 1 && <div className="wise-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}
          </div>

          {message && <div className="wise-notice">{message}</div>}

          {productsLoading ? <div className="wise-empty"><ShoppingCart size={34} /><strong>Loading products & services...</strong><span>WISE POS is loading the items enabled for checkout.</span></div> : filtered.length ? <div className="wise-product-grid">
            {filtered.map((product) => <button className="wise-product" key={product.id} onClick={() => add(product)}>
              {product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" /> : <div className="wise-product-letter">{product.name.charAt(0).toUpperCase()}</div>}
              <div className="wise-product-info"><strong>{product.name}</strong><span>{product.item_type === "service" ? "Service" : product.category}</span><b>{money(product.price)}{product.unit ? ` / ${product.unit}` : ""}</b></div>
              <span className="wise-add"><Plus size={16} /></span>
            </button>)}
          </div> : <div className="wise-empty"><ShoppingCart size={34} /><strong>No products or services are enabled for POS</strong><span>Go to Products & Services and turn on “Show in POS” for the items you want to sell.</span></div>}
        </section>

        <aside className="wise-cart">
          <div className="wise-cart-head"><div><strong>Current Sale</strong><span>{cart.length} item{cart.length === 1 ? "" : "s"}</span></div><button onClick={clear} disabled={!cart.length}><Trash2 size={17} /> Clear</button></div>
          <div className="wise-cart-body">
            {cart.length ? cart.map((item) => <div className="wise-cart-item" key={item.id}><div className="wise-cart-item-main"><strong>{item.name}</strong><span>{money(item.price)} each</span></div><div className="wise-cart-controls"><button onClick={() => qty(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => qty(item.id, 1)}><Plus size={14} /></button><strong>{money(item.price * item.quantity)}</strong></div></div>) : <div className="wise-cart-empty"><ShoppingCart size={38} /><strong>Your cart is empty</strong><span>Select products or services to start a sale.</span></div>}
          </div>
          <div className="wise-cart-footer">
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" />
            <div className="wise-summary"><span>Subtotal</span><b>{money(subtotal)}</b><span>Discount</span><b>- {money(discountAmount)}</b><strong>Total</strong><strong>{money(total)}</strong></div>
            <div className="wise-discount"><label>Discount</label><input type="number" min="0" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0.00" /></div>
            <button className="wise-checkout" disabled={!cart.length} onClick={openCheckout}><ReceiptText size={19} /> CHECKOUT <span>{money(total)}</span></button>
          </div>
        </aside>
      </div>

      {checkoutOpen && <div className="wise-modal-backdrop"><div className="wise-modal">
        <div className="wise-modal-head"><div><strong>Complete Sale</strong><span>WISE POS</span></div><button onClick={() => !saving && setCheckoutOpen(false)}><X size={20} /></button></div>
        <div className="wise-modal-content">
          <div className="wise-total-card"><span>Total to collect</span><strong>{money(total)}</strong></div>
          <label>Payment method</label>
          <div className="wise-payment-grid">{payments.map(({ key, icon: Icon }) => <button key={key} className={payment === key ? "active" : ""} onClick={() => { setPayment(key); if (key !== "Cash") setTendered(total); }}><Icon size={18} />{key}</button>)}</div>
          {payment === "Cash" && <><label>Amount received</label><input className="wise-tendered" type="number" min={total} value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value) || 0)} placeholder={money(total)} /><div className="wise-change"><span>Change</span><strong>{money(change)}</strong></div></>}
        </div>
        <div className="wise-modal-actions"><button className="wise-secondary" onClick={() => setCheckoutOpen(false)} disabled={saving}>Cancel</button><button className="wise-primary" onClick={checkout} disabled={saving || (payment === "Cash" && tendered < total)}>{saving ? "PROCESSING..." : `COMPLETE SALE · ${money(total)}`}</button></div>
      </div></div>}

      {receipt && <div className="wise-modal-backdrop"><div className="wise-receipt-modal"><div className="wise-success">✓</div><h2>Sale Complete</h2><p>{receipt.orderNo}</p><div className="wise-receipt-lines">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></div>)}<hr /><div><span>Total</span><b>{money(receipt.total)}</b></div><div><span>Paid via</span><b>{receipt.payment}</b></div>{receipt.payment === "Cash" && <div><span>Change</span><b>{money(receipt.change)}</b></div>}</div><button className="wise-primary" onClick={() => { setReceipt(null); clear(); }}>NEW SALE</button></div></div>}
    </section>
  </main>;
}
