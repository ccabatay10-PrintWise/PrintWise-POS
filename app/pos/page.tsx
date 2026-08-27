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
    setMessage("");
  };

  const signIn = async () => {
    setAuthMessage("");
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMessage(error.message);
    setAuthLoading(false);
  };

  const processPayment = async () => {
    if (!user) return setMessage("Please sign in before processing an order.");
    if (!cart.length) return setMessage("Add at least one item to the order.");
    if (payment === "Cash" && tendered < total) return setMessage("Amount tendered is not enough.");

    setSaving(true);
    setMessage("");
    const orderNo = `PW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
    const paymentMap: Record<string, "cash" | "gcash" | "bayad_center" | "bank_transfer"> = {
      Cash: "cash", GCash: "gcash", Bayad: "bayad_center", Bank: "bank_transfer",
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
        created_by: user.id,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setMessage(`Unable to save order: ${orderError?.message || "Unknown error"}`);
      setSaving(false);
      return;
    }

    const itemsResult = await supabase.from("pos_order_items").insert(cart.map((item) => ({
      pos_order_id: order.id,
      product_id: item.id.startsWith("received-file-") ? null : item.id,
      item_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
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
      created_by: user.id,
    });

    if (paymentResult.error) {
      setMessage(`Order saved, but payment record failed: ${paymentResult.error.message}`);
      setSaving(false);
      return;
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

    setCompletedReceipt(receipt);
    setMessage(`Payment successful. Order ${orderNo} was saved to PrintWise.`);
    setSaving(false);
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
          <div className="top-actions"><button className="icon-btn"><Menu size={20} /></button><div className="status"><span></span> System Online</div></div>
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
            <div className="order-head"><div><h2>Current Order</h2><span>{cart.length} item{cart.length === 1 ? "" : "s"}</span></div><button className="clear-btn" onClick={clearOrder}><Trash2 size={16} /> Clear</button></div>
            <div className="customer-box"><Users size={18} /><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" /></div>
            <div className="cart-list">
              {cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={34} /><b>Your order is empty</b><span>Select a product or service to begin.</span></div> : cart.map((item) => <div className="cart-item" key={item.id}><div className="cart-item-icon">{item.image_url ? <img src={item.image_url} alt="" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 10 }} /> : <ProductIcon icon={item.icon} />}</div><div className="cart-item-name"><b>{item.name}</b><span>₱{item.price.toFixed(2)} each</span><div className="qty"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button></div></div><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}
            </div>
            <div className="summary"><div><span>Subtotal</span><b>₱{subtotal.toFixed(2)}</b></div><div className="discount-row"><span>Discount</span><input type="number" min="0" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0.00" /></div><div className="total-row"><span>Total</span><b>₱{total.toFixed(2)}</b></div></div>
            <div className="payment-section"><h3>Payment Method</h3><div className="payment-grid">{[[Banknote, "Cash"], [Phone, "GCash"], [ReceiptText, "Bayad"], [CreditCard, "Bank"]].map(([Icon, label]: any) => { const PaymentIcon = Icon; return <button key={label} onClick={() => setPayment(label)} className={`payment-option ${payment === label ? "chosen" : ""}`}><PaymentIcon size={19} /><span>{label}</span></button>; })}</div>{payment === "Cash" && <div className="tendered"><span>Amount Tendered</span><input type="number" min="0" value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value) || 0)} placeholder="0.00" /><small>Change: <b>₱{change.toFixed(2)}</b></small></div>}</div>
            <button className="process-btn" disabled={saving} onClick={processPayment}><ReceiptText size={20} /> {saving ? "SAVING..." : "PROCESS PAYMENT"} <strong>₱{total.toFixed(2)}</strong></button>
          </aside>
        </div>
      </section>

      {completedReceipt && <>
        <div className="receipt-choice-overlay" role="dialog" aria-modal="true"><div className="receipt-choice-card"><div className="receipt-choice-icon"><CheckCircle2 size={30} /></div><div className="receipt-choice-copy"><span>PAYMENT SUCCESSFUL</span><h2>Print customer receipt?</h2><p>Order <b>{completedReceipt.orderNo}</b> has been completed. You can print an 80mm thermal receipt now or continue without printing.</p></div><div className="receipt-choice-total"><small>TOTAL PAID</small><strong>₱{completedReceipt.total.toFixed(2)}</strong></div><div className="receipt-choice-actions"><button className="receipt-skip-btn" onClick={finishCompletedOrder}>NO, CONTINUE WITHOUT PRINTING</button><button className="receipt-print-btn" onClick={printThermalReceipt}><Printer size={19} /> PRINT THERMAL RECEIPT</button></div><button className="receipt-done-link" onClick={finishCompletedOrder}>Done</button></div></div>
        <section className="thermal-receipt" aria-hidden="true"><div className="thermal-inner"><div className="thermal-brand">PRINTWISE</div><div className="thermal-subtitle">Printing & Customized Services</div><div className="thermal-rule" /><div className="thermal-meta"><div><span>ORDER</span><b>{completedReceipt.orderNo}</b></div><div><span>DATE</span><b>{new Date(completedReceipt.createdAt).toLocaleString()}</b></div><div><span>CUSTOMER</span><b>{completedReceipt.customer}</b></div><div><span>TRANSACTED BY</span><b>{completedReceipt.transactedBy}</b></div><div><span>PAYMENT</span><b>{completedReceipt.payment}</b></div></div><div className="thermal-rule dashed" /><div className="thermal-items"><div className="thermal-item-head"><span>ITEM</span><span>AMOUNT</span></div>{completedReceipt.items.map((item, index) => <div className="thermal-item" key={`${item.id}-${index}`}><div><b>{item.name}</b><small>{item.quantity} × ₱{item.price.toFixed(2)}</small></div><strong>₱{(item.price * item.quantity).toFixed(2)}</strong></div>)}</div><div className="thermal-rule dashed" /><div className="thermal-totals"><div><span>Subtotal</span><b>₱{completedReceipt.subtotal.toFixed(2)}</b></div>{completedReceipt.discount > 0 && <div><span>Discount</span><b>-₱{completedReceipt.discount.toFixed(2)}</b></div>}<div className="thermal-grand"><span>TOTAL</span><b>₱{completedReceipt.total.toFixed(2)}</b></div><div><span>Amount Paid</span><b>₱{completedReceipt.amountPaid.toFixed(2)}</b></div>{completedReceipt.payment === "Cash" && <div><span>Change</span><b>₱{completedReceipt.change.toFixed(2)}</b></div>}</div><div className="thermal-rule" /><p className="thermal-thankyou">THANK YOU FOR CHOOSING PRINTWISE!</p><p className="thermal-footer">Please keep this receipt for your records.</p></div></section>
      </>}
    </main>
  );
}
