"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Banknote, Barcode, CheckCircle2, CreditCard, FileText, Image, LogIn, Menu, Minus,
  PenLine, Plus, Printer, Search, Shirt, ShoppingCart, Sticker,
  Users, X, CupSoda, Layers3, Smartphone, WalletCards, MoreHorizontal
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

const paymentChoices = [
  { key: "Cash", label: "Cash", icon: Banknote },
  { key: "Credit Card", label: "Credit Card", icon: CreditCard },
  { key: "GCash", label: "GCash", icon: Smartphone },
  { key: "Maya", label: "Maya", icon: Smartphone },
  { key: "eWallet", label: "eWallet", icon: WalletCards },
  { key: "More Payments", label: "More Payments", icon: MoreHorizontal },
];

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
  const [paymentStep, setPaymentStep] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<CompletedReceipt | null>(null);
  const [handoffLoaded, setHandoffLoaded] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"Order Details" | "Customer">("Order Details");
  const [orderSource, setOrderSource] = useState("Physical Store");
  const [reference, setReference] = useState("");

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
        setReference(handoff.referenceNo || "");
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
    if (paymentStep) return;
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
  };
  const updateQuantity = (id: string, delta: number) => {
    if (paymentStep) return;
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };
  const clearOrder = () => {
    setCart([]);
    setCustomer("");
    setDiscount(0);
    setTendered(0);
    setPaymentStep(false);
    setMessage("");
    setReference("");
    setOrderSource("Physical Store");
  };
  const signIn = async () => {
    setAuthMessage("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
    setAuthLoading(false);
  };
  const openPaymentStep = () => {
    if (!cart.length) return setMessage("Add at least one item to the order.");
    setMessage("");
    if (payment !== "Cash") setTendered(total);
    setPaymentStep(true);
  };
  const choosePayment = (method: string) => {
    setPayment(method);
    if (method !== "Cash") setTendered(total);
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
        Cash: "cash", GCash: "gcash", "Credit Card": "bank_transfer", Maya: "bank_transfer", eWallet: "bank_transfer", "More Payments": "bank_transfer",
      };
      const amountPaid = payment === "Cash" ? tendered : total;
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderNo, transactionNo, customerName: customer.trim() || null,
          subtotal, discountAmount, total, amountPaid,
          channel: paymentMap[payment] || "bank_transfer",
          items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, lineTotal: item.price * item.quantity })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.order_id) throw new Error(payload.error || "Unable to save the sale.");
      const receipt: CompletedReceipt = {
        orderNo, customer: customer.trim() || "Walk-in Customer", payment, amountPaid,
        change: payment === "Cash" ? Math.max(0, tendered - total) : 0,
        subtotal, discount: discountAmount, total, createdAt: new Date().toISOString(),
        transactedBy: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "PrintWise Staff",
        items: cart.map((item) => ({ ...item })),
      };
      setPaymentStep(false);
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

  if (authLoading && !user) return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Loading PrintWise...</h1></div></main>;
  if (!user) return <main className="auth-page"><div className="auth-card"><div className="brand-mark"><Printer size={26} /></div><h1>Welcome to PrintWise POS</h1><p>Sign in to access products, orders, and payment transactions.</p><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && signIn()} />{authMessage && <div className="auth-error">{authMessage}</div>}<button onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={18} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button></div></main>;

  return (
    <main className="app-shell">
      <style>{`
.payment-details-panel{background:#fff;border:1px solid #dfe4ea;border-radius:0;display:flex;flex-direction:column;min-height:calc(100vh - 136px);position:sticky;top:12px;overflow:hidden;color:#13213a}
.payment-details-header{height:58px;box-sizing:border-box;padding:0 15px;border-bottom:1px solid #e1e6eb;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}
.payment-details-header strong{font-size:18px;font-weight:600;color:#101828}
.payment-details-header span{font-size:11px;background:#e7ecff;color:#3546c4;border-radius:999px;padding:6px 9px;white-space:nowrap}
.payment-details-scroll{flex:1;overflow:auto;padding:20px 15px 12px}
.payment-details-scroll h3{margin:0 0 16px;font-size:18px;font-weight:500;color:#18345f}
.payment-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.payment-choice{min-height:51px;border:1px solid #dce3ed;background:#fff;border-radius:12px;padding:0 15px;display:flex;align-items:center;gap:11px;color:#243b62;font-size:15px;text-align:left;cursor:pointer;transition:.15s}
.payment-choice:hover{border-color:#0998e6;background:#f8fcff}
.payment-choice.active{border:1.5px solid #0798e6;color:#078fdb;background:#fff;box-shadow:0 0 0 1px rgba(7,152,230,.03)}
.cash-payment-section{margin-top:30px}
.cash-payment-section h3{margin-bottom:10px}
.cash-amount-input{width:100%;box-sizing:border-box;height:48px;border:1px solid #dfe3e8;border-radius:10px;padding:0 14px;font-size:16px;color:#101828;outline:0;background:#fff}
.cash-amount-input:focus{border-color:#0798e6;box-shadow:0 0 0 3px rgba(7,152,230,.1)}
.cash-amount-input:disabled{background:#f7f8fa;color:#667085}
.change-line{margin-top:10px;font-size:14px;color:#315a88}
.change-line.insufficient{color:#c92a2a}
.details-tabs{margin-top:30px}
.details-tab-list{height:48px;background:#f2f3f5;border-radius:11px;padding:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;box-sizing:border-box}
.details-tab-list button{border:0;background:transparent;border-radius:8px;color:#667085;font-size:15px;cursor:pointer}
.details-tab-list button.active{background:#fff;color:#101828;box-shadow:0 1px 4px rgba(16,24,40,.08);font-weight:500}
.details-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
.details-fields label{display:flex;flex-direction:column;gap:8px;color:#344054;font-size:14px}
.details-fields input,.details-fields select{height:45px;box-sizing:border-box;border:1px solid #dfe3e8;border-radius:9px;padding:0 12px;background:#fff;color:#344054;font-size:14px;outline:0}
.details-fields input:focus,.details-fields select:focus{border-color:#0798e6}
.payment-cart-preview{margin-top:26px;border-top:1px solid #edf0f3;padding-top:18px}
.payment-cart-preview h3{font-size:15px;margin-bottom:10px}
.payment-cart-preview>div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;font-size:13px;color:#475467}
.payment-cart-preview strong{color:#101828}
.payment-details-footer{border-top:1px solid #dfe4ea;background:#fff;flex-shrink:0;padding:14px 15px 12px}
.payment-summary-line{display:flex;justify-content:space-between;margin:7px 0;font-size:14px;color:#526581}
.payment-summary-line b{color:#101828;font-weight:500}
.payment-summary-total{border-top:1px solid #dfe4ea;margin:11px 0 12px;padding-top:12px;display:flex;justify-content:space-between;align-items:center}
.payment-summary-total span,.payment-summary-total strong{font-size:22px;font-weight:700;color:#101828}
.payment-action-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.payment-back-button,.complete-order-button{height:50px;border-radius:10px;font-size:16px;font-weight:600;cursor:pointer}
.payment-back-button{border:1px solid #dfe3e8;background:#fff;color:#101828}
.complete-order-button{border:0;background:#0798e6;color:#fff}
.complete-order-button:disabled,.payment-back-button:disabled{opacity:.6;cursor:not-allowed}
.payment-step-active .catalog-panel{min-height:calc(100vh - 136px)}
@media(max-width:1100px){.payment-details-panel{position:static;min-height:620px;border-radius:12px}.payment-step-active .catalog-panel{min-height:auto}}
@media(max-width:700px){.payment-details-header{padding:0 13px}.payment-details-header strong{font-size:16px}.payment-details-scroll{padding:16px 13px 10px}.payment-choice-grid{gap:10px}.payment-choice{min-height:49px;padding:0 12px;font-size:14px}.details-fields{grid-template-columns:1fr}.payment-details-footer{padding:12px}.payment-action-row{gap:10px}.payment-summary-total span,.payment-summary-total strong{font-size:20px}}
`}</style>
      <Sidebar />
      <section className="workspace">
        <header className="topbar">
          <div><h1>Point of Sale</h1><p>Fast, simple, and connected to your PrintWise database.</p></div>
          <div className="top-actions"><CustomerDisplayLauncher cart={cart} customer={customer} subtotal={subtotal} discount={discountAmount} total={total} /><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>
        </header>
        <div className={`pos-layout ${paymentStep ? "payment-step-active" : ""}`}>
          <section className="catalog-panel">
            <div className="search-row"><div className="search-box"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products and services..." /><button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button></div></div>
            <div className="category-row">{categories.map((category) => <button key={category} onClick={() => setActiveCategory(category)} className={`category ${activeCategory === category ? "selected" : ""}`}>{category}</button>)}</div>
            {message && <div className="message">{message}</div>}
            <div className="product-grid">
              {loadingProducts ? <div className="loading-products">Loading products...</div> : filtered.length === 0 ? <div className="loading-products">No active products available. Please ask the administrator to add or activate products.</div> : filtered.map((product) => <button className="product-card" onClick={() => addToCart(product)} key={product.id}><ProductVisual product={product} /><div className="product-info"><b>{product.name}</b><span>{product.category}</span><strong>₱{product.price.toFixed(2)}</strong></div><div className="add-circle"><Plus size={18} /></div></button>)}
            </div>
          </section>

          {!paymentStep ? (
            <aside className="order-panel">
              <div className="order-head"><div><span>Current Order</span><strong>{cart.length} item{cart.length === 1 ? "" : "s"}</strong></div><button onClick={clearOrder} disabled={!cart.length}>Clear</button></div>
              <div className="customer-row"><Users size={17} /><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" /></div>
              <div className="cart-list">
                {cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={32} /><p>No items in the current order.</p><span>Select a product to begin.</span></div> : cart.map((item) => <div className="cart-item" key={item.id}><ProductVisual product={item} small /><div className="cart-item-info"><b>{item.name}</b><span>₱{item.price.toFixed(2)} each</span></div><div className="qty"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button></div><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}
              </div>
              <div className="summary"><div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div><div><span>Discount</span><b>₱{discountAmount.toFixed(2)}</b></div><div className="total-row"><span>Total</span><strong>₱{total.toFixed(2)}</strong></div></div>
              <div className="payment-method"><span>Payment Method</span><div>{["Cash", "GCash", "Bayad", "Bank"].map((method) => <button key={method} className={payment === method ? "selected" : ""} onClick={() => choosePayment(method)}>{method}</button>)}</div></div>
              <div className="tendered-row"><label>Amount Tendered</label><input type="number" min="0" value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value))} /><span>Change: ₱{change.toFixed(2)}</span></div>
              <button className="pay-button" onClick={openPaymentStep} disabled={saving || !cart.length}><CreditCard size={18} /> Proceed to Payment</button>
            </aside>
          ) : (
            <aside className="payment-details-panel">
              <div className="payment-details-header"><strong>Payment &amp; Order Details</strong><span>Editing S{String(Date.now()).slice(-6)}</span></div>
              <div className="payment-details-scroll">
                <section className="payment-choice-section">
                  <h3>Payment Method</h3>
                  <div className="payment-choice-grid">
                    {paymentChoices.map(({ key, label, icon: Icon }) => <button key={key} className={`payment-choice ${payment === key ? "active" : ""}`} onClick={() => choosePayment(key)}><Icon size={19} /><span>{label}</span></button>)}
                  </div>
                </section>
                <section className="cash-payment-section">
                  <h3>{payment === "Cash" ? "Cash Payment" : `${payment} Payment`}</h3>
                  <input className="cash-amount-input" type="number" min="0" value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value))} disabled={payment !== "Cash"} />
                  <div className={`change-line ${change < 0 ? "insufficient" : ""}`}>Change: ₱{change.toFixed(2)}</div>
                </section>
                <section className="details-tabs">
                  <div className="details-tab-list"><button className={detailsTab === "Order Details" ? "active" : ""} onClick={() => setDetailsTab("Order Details")}>Order Details</button><button className={detailsTab === "Customer" ? "active" : ""} onClick={() => setDetailsTab("Customer")}>Customer</button></div>
                  {detailsTab === "Order Details" ? <div className="details-fields"><label>Order Source<select value={orderSource} onChange={(e) => setOrderSource(e.target.value)}><option>Physical Store</option><option>Online</option><option>Walk-in</option><option>Social Media</option><option>Other</option></select></label><label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Table number, etc" /></label></div> : <div className="details-fields customer-details"><label>Customer Name<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" /></label><label>Contact Number<input placeholder="Contact number" /></label></div>}
                </section>
                <section className="payment-cart-preview"><h3>Order Items</h3>{cart.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}</section>
              </div>
              <div className="payment-details-footer">
                <div className="payment-summary-line"><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div>
                <div className="payment-summary-line"><span>Discounts</span><b>₱{discountAmount.toFixed(2)}</b></div>
                <div className="payment-summary-total"><span>Total</span><strong>₱{total.toFixed(2)}</strong></div>
                <div className="payment-action-row"><button className="payment-back-button" onClick={() => !saving && setPaymentStep(false)} disabled={saving}>Back</button><button className="complete-order-button" onClick={processPayment} disabled={saving || (payment === "Cash" && tendered < total)}>{saving ? "Processing..." : "Complete Order"}</button></div>
              </div>
            </aside>
          )}
        </div>
      </section>

      {completedReceipt && (
        <div className="pos-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
          <div className="pos-modal receipt-modal">
            <div className="pos-modal-header receipt-modal-header"><div><span className="success-icon"><CheckCircle2 size={25} /></span><div><span className="pos-modal-kicker">PAYMENT COMPLETE</span><h2 id="receipt-modal-title">Sale Completed</h2></div></div><button className="pos-modal-close" onClick={finishCompletedOrder} aria-label="Close receipt dialog"><X size={20} /></button></div>
            <div className="thermal-inner">
              <div className="receipt-brand">PRINTWISE</div><div className="receipt-title">OFFICIAL SALES RECEIPT</div>
              <div className="receipt-meta"><span>Order No.</span><b>{completedReceipt.orderNo}</b></div><div className="receipt-meta"><span>Customer</span><b>{completedReceipt.customer}</b></div><div className="receipt-meta"><span>Payment</span><b>{completedReceipt.payment}</b></div>
              <div className="receipt-items">{completedReceipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>₱{(item.price * item.quantity).toFixed(2)}</b></div>)}</div>
              <div className="receipt-total"><span>Total</span><b>₱{completedReceipt.total.toFixed(2)}</b></div><div className="receipt-meta"><span>Amount Paid</span><b>₱{completedReceipt.amountPaid.toFixed(2)}</b></div>{completedReceipt.payment === "Cash" && <div className="receipt-meta"><span>Change</span><b>₱{completedReceipt.change.toFixed(2)}</b></div>}
              <div className="receipt-footer">Thank you for choosing PrintWise.</div>
            </div>
            <div className="pos-modal-actions"><button className="secondary-modal-btn" onClick={printThermalReceipt}><Printer size={18} /> Print Receipt</button><button className="primary-modal-btn" onClick={finishCompletedOrder}>New Order</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
