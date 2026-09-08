"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus,
  PenLine, Phone, Plus, Printer, ReceiptText, Search, Shirt, ShoppingCart, Sticker,
  Trash2, Users, X, CupSoda, Layers3
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./pos.css";
import Sidebar from "../components/Sidebar";
import CustomerDisplayLauncher from "../components/CustomerDisplayLauncher"; // PRINTWISE_CUSTOMER_DISPLAY_SAFE

type Product = { id: string; name: string; category: string; price: number; icon: string; image_url: string | null };
type CartItem = Product & { quantity: number };
type CompletedReceipt = {
  orderNo: string; customer: string; payment: string; amountPaid: number; change: number;
  subtotal: number; discount: number; total: number; createdAt: string; transactedBy: string; items: CartItem[];
};
type ReceivedFileHandoff = {
  jobId: string; referenceNo: string; customerName: string; contactNumber: string;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
};

function ProductIcon({ icon }: { icon: string }) {
  const p = { size: 26, strokeWidth: 1.8 };
  if (icon === "shirt") return <Shirt {...p} />;
  if (icon === "mug") return <CupSoda {...p} />;
  if (icon === "sticker") return <Sticker {...p} />;
  if (icon === "photo") return <Image {...p} />;
  if (icon === "paper") return <FileText {...p} />;
  if (icon === "id") return <Barcode {...p} />;
  if (icon === "layers") return <Layers3 {...p} />;
  if (icon === "pen") return <PenLine {...p} />;
  return <Printer {...p} />;
}

function ProductVisual({ product, small = false }: { product: Product; small?: boolean }) {
  const size = small ? 42 : 58;
  return product.image_url
    ? <img src={product.image_url} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: 12 }} />
    : <div className="product-icon"><ProductIcon icon={product.icon} /></div>;
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
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<CompletedReceipt | null>(null);
  const [handoffLoaded, setHandoffLoaded] = useState(false);

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
    const load = async () => {
      setLoadingProducts(true);
      setMessage("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          setMessage("Your session has expired. Please sign in again.");
          setProducts([]);
          return;
        }
        const response = await fetch("/api/products", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to load products.");
        setProducts((payload.products ?? []).map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          price: Number(i.price),
          icon: i.icon_key || "box",
          image_url: i.image_url || null,
        })));
      } catch (error: any) {
        setProducts([]);
        setMessage(`Unable to load products: ${error?.message || "Unknown error"}`);
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user || handoffLoaded) return;
    const raw = sessionStorage.getItem("printwise_received_file_cart");
    if (!raw) {
      setHandoffLoaded(true);
      return;
    }

    try {
      const handoff = JSON.parse(raw) as ReceivedFileHandoff;
      const incomingItems: CartItem[] = (handoff.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        category: `Received Files · ${handoff.referenceNo}`,
        price: Number(item.price),
        quantity: Math.max(1, Number(item.quantity) || 1),
        icon: "paper",
        image_url: null,
      }));

      if (incomingItems.length) {
        setCart(incomingItems);
        setCustomer(handoff.customerName || "");
        setMessage(`Received file job ${handoff.referenceNo} was added to the current order.`);
      }
      sessionStorage.removeItem("printwise_received_file_cart");
    } catch {
      sessionStorage.removeItem("printwise_received_file_cart");
      setMessage("Unable to load the received file job into the POS.");
    } finally {
      setHandoffLoaded(true);
    }
  }, [user, handoffLoaded]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filtered = useMemo(
    () => products.filter((p) =>
      (activeCategory === "All" || p.category === activeCategory) &&
      p.name.toLowerCase().includes(search.toLowerCase())
    ),
    [activeCategory, search, products]
  );

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, discount);
  const total = subtotal - discountAmount;
  const change = Math.max(0, tendered - total);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const clearOrder = () => {
    setCart([]);
    setCustomer("");
    setDiscount(0);
    setTendered(0);
    setPaymentModalOpen(false);
    setMessage("");
  };

  const signIn = async () => {
    setAuthMessage("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
    setAuthLoading(false);
  };

  const openPaymentModal = () => {
    if (!cart.length) return setMessage("Add at least one item to the order.");
    setMessage("");
    if (payment !== "Cash") setTendered(total);
    setPaymentModalOpen(true);
  };

  const processPayment = async () => {
    if (!user) return setMessage("Please sign in before processing an order.");
    if (!cart.length) return setMessage("Add at least one item to the order.");
    if (payment === "Cash" && tendered < total) return setMessage("Amount paid is not enough.");

    setSaving(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setMessage("Your session has expired. Please sign in again.");
        return;
      }

      const orderNo = `PW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
      const transactionNo = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const paymentMap: Record<string, "cash" | "gcash" | "bayad_center" | "bank_transfer"> = {
        Cash: "cash", GCash: "gcash", Bayad: "bayad_center", Bank: "bank_transfer",
      };
      const amountPaid = payment === "Cash" ? tendered : total;

      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderNo,
          transactionNo,
          customerName: customer.trim() || null,
          subtotal,
          discountAmount,
          total,
          amountPaid,
          channel: paymentMap[payment],
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

      const receipt: CompletedReceipt = {
        orderNo,
        customer: customer.trim() || "Walk-in Customer",
        payment,
        amountPaid,
        change: payment === "Cash" ? Math.max(0, tendered - total) : 0,
        subtotal,
        discount: discountAmount,
        total,
        createdAt: new Date().toISOString(),
        transactedBy: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "PrintWise Staff",
        items: cart.map((item) => ({ ...item })),
      };

      setPaymentModalOpen(false);
      setCompletedReceipt(receipt);
      setMessage(`Payment successful. Order ${orderNo} was saved to PrintWise.`);
    } catch (error: any) {
      setMessage(error?.message || "Unable to save the sale.");
    } finally {
      setSaving(false);
    }
  };

  const finishCompletedOrder = () => {
    clearOrder();
    setCompletedReceipt(null);
  };

  const printThermalReceipt = () => {
    const root = document.documentElement;
    root.classList.add("thermal-print-measure");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const receipt = document.querySelector(".thermal-inner") as HTMLElement | null;
      const contentHeight = Math.max(180, Math.ceil(receipt?.scrollHeight || 0) + 12);
      let pageStyle = document.getElementById("thermal-page-size") as HTMLStyleElement | null;
      if (!pageStyle) {
        pageStyle = document.createElement("style");
        pageStyle.id = "thermal-page-size";
        document.head.appendChild(pageStyle);
      }
      pageStyle.textContent = `@page{size:80mm ${contentHeight}px;margin:0}`;
      root.classList.remove("thermal-print-measure");
      window.setTimeout(() => window.print(), 120);
    }));
  };

  if (authLoading && !user) {
    return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Loading PrintWise...</h1></div></main>;
  }

  if (!user) {
    return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Welcome to PrintWise POS</h1><p>Sign in to access products, orders, and payment transactions.</p><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && signIn()} />{authMessage && <div className="auth-error">{authMessage}</div>}<button onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={18} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button></div></main>;
  }

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace">
        <header className="topbar">
          <div><h1>Point of Sale</h1><p>Fast, simple, and connected to your PrintWise database.</p></div>
          <div className="top-actions"><CustomerDisplayLauncher cart={cart} customer={customer} subtotal={subtotal} discount={discountAmount} total={total} /><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>
        </header>

        <div className="pos-layout">
          <section className="catalog-panel">
            <div className="search-row"><div className="search-box"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products and services..." /><button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button></div></div>
            <div className="category-row">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`category ${activeCategory === category ? "selected" : ""}`}>{category}</button>)}</div>
            {message && <div className="message">{message}</div>}
            <div className="product-grid">
              {loadingProducts ? <div className="loading-products">Loading products...</div> : filtered.length === 0 ? <div className="loading-products">No active products available. Please ask the administrator to add or activate products.</div> : filtered.map((product) => <button className="product-card" onClick={() => addToCart(product)} key={product.id}><ProductVisual product={product} /><div className="product-info"><b>{product.name}</b><span>{product.category}</span><strong>₱{product.price.toFixed(2)}</strong></div><div className="add-circle"><Plus size={18} /></div></button>)}
            </div>
          </section>

          <aside className="order-panel">
            <div className="order-head"><div><span>Current Order</span><strong>{cart.length} item{cart.length === 1 ? "" : "s"}</strong></div><button onClick={clearOrder} disabled={!cart.length}>Clear</button></div>
            <div className="customer-row"><Users size={17} /><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" /></div>
            <div className="cart-list">
              {cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={32} /><p>No items in the current order.</p><span>Select a product to begin.</span></div> : cart.map((item) => <div className="cart-item" key={item.id}><ProductVisual product={item} small /><div className="cart-item-info"><b>{item.name}</b><span>₱{item.price.toFixed(2)} each</span></div><div className="qty"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button></div><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}
            </div>
            <div className="summary"><div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div><div><span>Discount</span><b>₱{discountAmount.toFixed(2)}</b></div><div className="total"><span>Total</span><strong>₱{total.toFixed(2)}</strong></div></div>
            <div className="payment-method"><span>Payment Method</span><div>{["Cash", "GCash", "Bayad", "Bank"].map((method) => <button key={method} className={payment === method ? "selected" : ""} onClick={() => setPayment(method)}>{method}</button>)}</div></div>
            <div className="tendered-row"><label>Amount Tendered</label><input type="number" min="0" value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value))} /><span>Change: ₱{change.toFixed(2)}</span></div>
            <button className="pay-button" onClick={openPaymentModal} disabled={saving || !cart.length}><CreditCard size={18} /> Proceed to Payment</button>
          </aside>
        </div>
      </section>

      {paymentModalOpen && (
        <div className="pos-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
          <div className="pos-modal payment-modal">
            <div className="pos-modal-header">
              <div><span className="pos-modal-kicker">CHECKOUT</span><h2 id="payment-modal-title">Confirm Payment</h2></div>
              <button className="pos-modal-close" onClick={() => !saving && setPaymentModalOpen(false)} disabled={saving} aria-label="Close payment dialog"><X size={20} /></button>
            </div>
            <div className="payment-confirm-card">
              <div><span>Payment Method</span><strong>{payment}</strong></div>
              <div><span>Total Amount</span><strong>₱{total.toFixed(2)}</strong></div>
              {payment === "Cash" && <>
                <div><span>Amount Tendered</span><strong>₱{tendered.toFixed(2)}</strong></div>
                <div className="payment-change"><span>Change</span><strong>₱{change.toFixed(2)}</strong></div>
              </>}
              {customer.trim() && <div><span>Customer</span><strong>{customer.trim()}</strong></div>}
            </div>
            <div className="payment-items-preview">
              <span>{cart.length} item{cart.length === 1 ? "" : "s"} in this order</span>
              {cart.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>₱{(item.price * item.quantity).toFixed(2)}</b></div>)}
            </div>
            <div className="pos-modal-actions">
              <button className="secondary-modal-btn" onClick={() => setPaymentModalOpen(false)} disabled={saving}>Back</button>
              <button className="primary-modal-btn" onClick={processPayment} disabled={saving || (payment === "Cash" && tendered < total)}>
                {saving ? "PROCESSING..." : <><CheckCircle2 size={18} /> Confirm & Pay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {completedReceipt && (
        <div className="pos-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
          <div className="pos-modal receipt-modal">
            <div className="pos-modal-header receipt-modal-header">
              <div><span className="success-icon"><CheckCircle2 size={25} /></span><div><span className="pos-modal-kicker">PAYMENT COMPLETE</span><h2 id="receipt-modal-title">Sale Completed</h2></div></div>
              <button className="pos-modal-close" onClick={finishCompletedOrder} aria-label="Close receipt dialog"><X size={20} /></button>
            </div>
            <div className="thermal-inner">
              <div className="receipt-brand">PRINTWISE</div>
              <div className="receipt-title">OFFICIAL SALES RECEIPT</div>
              <div className="receipt-meta"><span>Order No.</span><b>{completedReceipt.orderNo}</b></div>
              <div className="receipt-meta"><span>Customer</span><b>{completedReceipt.customer}</b></div>
              <div className="receipt-meta"><span>Payment</span><b>{completedReceipt.payment}</b></div>
              <div className="receipt-items">
                {completedReceipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>₱{(item.price * item.quantity).toFixed(2)}</b></div>)}
              </div>
              <div className="receipt-total"><span>Total</span><b>₱{completedReceipt.total.toFixed(2)}</b></div>
              <div className="receipt-meta"><span>Amount Paid</span><b>₱{completedReceipt.amountPaid.toFixed(2)}</b></div>
              {completedReceipt.payment === "Cash" && <div className="receipt-meta"><span>Change</span><b>₱{completedReceipt.change.toFixed(2)}</b></div>}
              <div className="receipt-footer">Thank you for choosing PrintWise.</div>
            </div>
            <div className="pos-modal-actions">
              <button className="secondary-modal-btn" onClick={printThermalReceipt}><Printer size={18} /> Print Receipt</button>
              <button className="primary-modal-btn" onClick={finishCompletedOrder}>New Order</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
