"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Banknote, CreditCard, LogIn, Minus, Plus, ReceiptText, Search, ShoppingCart, Smartphone, Trash2, WalletCards, X, Percent, ClipboardList, Clock3, Eraser, Printer, Settings2, RefreshCw, CircleDollarSign, UserRound, Accessibility, Medal, UsersRound, Info } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "./pos.css";

type Product = { id: string; name: string; category: string; price: number; unit?: string; image_url: string | null; item_type: "product" | "service" };
type CartItem = Product & { quantity: number };
type Receipt = { orderNo: string; payment: string; amountPaid: number; change: number; total: number; items: CartItem[] };
type ShiftData = { sales: number; discounts: number; orders: number; cash: number; nonCash: number; voided: number; loading: boolean };
type DiscountType = "senior" | "pwd" | "athlete" | "solo_parent" | "percentage" | "amount" | null;

const payments = [
  { key: "Cash", icon: Banknote }, { key: "GCash", icon: Smartphone }, { key: "Maya", icon: Smartphone },
  { key: "Credit Card", icon: CreditCard }, { key: "eWallet", icon: WalletCards },
];
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function POSPage() {
  const [user, setUser] = useState<User | null>(null), [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [authMessage, setAuthMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]), [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState(""), [category, setCategory] = useState("All"), [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState(""), [discount, setDiscount] = useState(0), [payment, setPayment] = useState("Cash"), [tendered, setTendered] = useState(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false), [shiftData, setShiftData] = useState<ShiftData>({ sales: 0, discounts: 0, orders: 0, cash: 0, nonCash: 0, voided: 0, loading: false });
  const [discountOpen, setDiscountOpen] = useState(false), [discountType, setDiscountType] = useState<DiscountType>(null), [discountRate, setDiscountRate] = useState(20);
  const [discountCustomerName, setDiscountCustomerName] = useState(""), [discountId, setDiscountId] = useState(""), [discountTin, setDiscountTin] = useState("");
  const [childName, setChildName] = useState(""), [childDob, setChildDob] = useState(""), [childAge, setChildAge] = useState("");
  const [customDiscountValue, setCustomDiscountValue] = useState("");
  const discountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setProductsLoading(true); setMessage("");
      try {
        const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` }, cache: "default" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Unable to load products and services.");
        setProducts((payload.products ?? []).map((p: any) => ({ ...p, price: Number(p.price), item_type: p.item_type === "service" ? "service" : "product" })));
      } catch (error: any) { setMessage(error?.message || "Unable to load products and services."); }
      finally { setProductsLoading(false); }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!shiftOpen || !user) return;
    let cancelled = false;
    const loadShift = async () => {
      setShiftData((current) => ({ ...current, loading: true }));
      const start = new Date(); start.setHours(0, 0, 0, 0);
      try {
        const [{ data: orders, error: ordersError }, { data: paymentsRows, error: paymentsError }] = await Promise.all([
          supabase.from("pos_orders").select("id,total,discount_amount,status,created_by,created_at").eq("created_by", user.id).gte("created_at", start.toISOString()).order("created_at", { ascending: false }),
          supabase.from("payment_transactions").select("amount,channel,transaction_type,status,created_by,created_at").eq("created_by", user.id).gte("created_at", start.toISOString()).eq("status", "successful"),
        ]);
        if (ordersError) throw ordersError;
        if (paymentsError) throw paymentsError;
        const completed = (orders ?? []).filter((row: any) => row.status === "completed");
        const voided = (orders ?? []).filter((row: any) => row.status === "voided").length;
        const sales = completed.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
        const discounts = completed.reduce((sum: number, row: any) => sum + Number(row.discount_amount || 0), 0);
        const paymentsOnly = (paymentsRows ?? []).filter((row: any) => row.transaction_type === "payment");
        const cash = paymentsOnly.filter((row: any) => row.channel === "cash").reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
        const nonCash = paymentsOnly.filter((row: any) => row.channel !== "cash").reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
        if (!cancelled) setShiftData({ sales, discounts, orders: completed.length, cash, nonCash, voided, loading: false });
      } catch { if (!cancelled) setShiftData((current) => ({ ...current, loading: false })); }
    };
    loadShift();
    return () => { cancelled = true; };
  }, [shiftOpen, user]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return products.filter((p) => (category === "All" || p.category === category) && (!term || `${p.name} ${p.category} ${p.item_type}`.toLowerCase().includes(term))); }, [products, search, category]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, discount));
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, tendered - total);

  const add = (product: Product) => setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; });
  const qty = (id: string, delta: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  const clear = () => { setCart([]); setCustomer(""); setDiscount(0); setTendered(0); setPayment("Cash"); setMessage(""); };

  const signIn = async () => { setAuthMessage(""); setAuthLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setAuthMessage(error.message); setAuthLoading(false); };
  const openCheckout = () => { if (!cart.length) { setMessage("Add an item to the cart before checkout."); return; } if (payment !== "Cash") setTendered(total); setMessage(""); setCheckoutOpen(true); };
  const focusDiscount = () => {
    if (!cart.length) { setMessage("Add an item before applying a discount."); return; }
    setDiscountType("senior"); setDiscountRate(20); setDiscountCustomerName(""); setDiscountId(""); setDiscountTin(""); setChildName(""); setChildDob(""); setChildAge(""); setCustomDiscountValue(""); setDiscountOpen(true);
  };
  const selectDiscountType = (type: Exclude<DiscountType, null>) => {
    setDiscountType(type);
    if (type === "senior" || type === "pwd") setDiscountRate(20);
  };
  const openOrders = () => window.location.assign("/orders");
  const openSettings = () => window.location.assign("/settings");

  const applyDiscount = () => {
    if (!cart.length) { setDiscountOpen(false); setMessage("Add an item before applying a discount."); return; }
    let amount = 0;
    if (discountType === "senior" || discountType === "pwd") {
      if (!discountCustomerName.trim() || !discountId.trim()) { setMessage(`Enter the customer's name and ${discountType === "senior" ? "Senior Citizen" : "PWD"} ID number.`); return; }
      amount = subtotal * (discountRate / 100);
    } else if (discountType === "athlete") {
      if (!discountCustomerName.trim() || !discountId.trim()) { setMessage("Enter the customer's name and National Athlete ID number."); return; }
      amount = subtotal * 0.20;
    } else if (discountType === "solo_parent") {
      if (!discountCustomerName.trim() || !discountId.trim() || !childName.trim() || !childDob || !childAge) { setMessage("Complete the Solo Parent and child information."); return; }
      amount = subtotal * 0.10;
    } else if (discountType === "percentage") {
      const value = Number(customDiscountValue);
      if (!Number.isFinite(value) || value < 1 || value > 100) { setMessage("Enter a percentage between 1 and 100."); return; }
      amount = subtotal * (value / 100);
    } else if (discountType === "amount") {
      const value = Number(customDiscountValue);
      if (!Number.isFinite(value) || value <= 0) { setMessage("Enter a valid discount amount."); return; }
      amount = value;
    } else {
      setMessage("Select a discount type first."); return;
    }
    const applied = Math.min(subtotal, Math.max(0, Number(amount.toFixed(2))));
    setDiscount(applied);
    if (discountCustomerName.trim()) setCustomer(discountCustomerName.trim());
    setDiscountOpen(false); setMessage("");
  };

  const checkout = async () => {
    if (!user) { setMessage("Please sign in before completing a sale."); return; }
    if (payment === "Cash" && tendered < total) { setMessage("Amount received is not enough for this sale."); return; }
    setSaving(true); setMessage("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const now = Date.now();
      const orderNo = `WISE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(now).slice(-6)}`;
      const transactionNo = `W-${now}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const amountPaid = payment === "Cash" ? tendered : total;
      const response = await fetch("/api/pos/checkout", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderNo, transactionNo, customerName: customer.trim() || null, subtotal, discountAmount,
          discountType: discountAmount > 0 ? "amount" : null, discountValue: discountAmount,
          total, amountPaid, channel: payment.toLowerCase().replace(/\s+/g, "_"),
          items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, lineTotal: item.price * item.quantity })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.order_id) throw new Error(payload.error || "Unable to save the sale.");
      setReceipt({ orderNo, payment, amountPaid, change: payment === "Cash" ? change : 0, total, items: [...cart] }); setCheckoutOpen(false);
    } catch (error: any) { setMessage(error?.message || "Unable to complete checkout."); }
    finally { setSaving(false); }
  };

  if (authLoading && !user) return <main className="wise-auth"><div className="wise-auth-card"><div className="wise-logo">W</div><h1>WISE POS</h1><p>Loading your workspace...</p></div></main>;
  if (!user) return <main className="wise-auth"><div className="wise-auth-card"><div className="wise-logo">W</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && signIn()} />{authMessage && <div className="wise-error">{authMessage}</div>}<button className="wise-primary" onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={17} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button></div></main>;

  const discountLabel = discountType === "senior" ? "Senior" : discountType === "pwd" ? "PWD" : discountType === "athlete" ? "National Athlete" : discountType === "solo_parent" ? "Solo Parent" : discountType === "percentage" ? "Percentage" : discountType === "amount" ? "Amount" : "";
  const discountHint = discountType === "senior" || discountType === "pwd" ? "5% or 20% off" : discountType === "athlete" ? "20% off" : discountType === "solo_parent" ? "10% off" : discountType === "percentage" ? "% off item total" : discountType === "amount" ? "Fixed peso amount" : "";

  return <main className="app-shell"><Sidebar /><section className="wise-pos-page">
    <header className="wise-header"><div><div className="wise-eyebrow">POINT OF SALE</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p></div><div className="wise-header-pill">GENERAL BUSINESS MODE</div></header>
    <div className="wise-layout"><section className="wise-catalog"><div className="wise-toolbar"><div className="wise-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or services..." /></div>{categories.length > 1 && <div className="wise-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>}</div>
      {message && <div className="wise-notice">{message}</div>}
      {productsLoading ? <div className="wise-empty"><ShoppingCart size={34} /><strong>Loading products & services...</strong><span>WISE POS is loading the items enabled for checkout.</span></div> : filtered.length ? <div className="wise-product-grid">{filtered.map((product) => <button className="wise-product" key={product.id} onClick={() => add(product)}>{product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" /> : <div className="wise-product-letter">{product.name.charAt(0).toUpperCase()}</div>}<div className="wise-product-info"><strong>{product.name}</strong><span>{product.item_type === "service" ? "Service" : product.category}</span><b>{money(product.price)}{product.unit ? ` / ${product.unit}` : ""}</b></div><span className="wise-add"><Plus size={16} /></span></button>)}</div> : <div className="wise-empty"><ShoppingCart size={34} /><strong>No products or services are enabled for POS</strong><span>Go to Products & Services and turn on “Show in POS” for the items you want to sell.</span></div>}
    </section>
    <aside className="wise-cart"><div className="wise-cart-head"><div><strong>Current Sale</strong><span>{cart.length} item{cart.length === 1 ? "" : "s"}</span></div><button onClick={clear} disabled={!cart.length}><Trash2 size={17} /> Clear</button></div><div className="wise-cart-body">{cart.length ? cart.map((item) => <div className="wise-cart-item" key={item.id}><div className="wise-cart-item-main"><strong>{item.name}</strong><span>{money(item.price)} each</span></div><div className="wise-cart-controls"><button onClick={() => qty(item.id, -1)}><Minus size={14} /></button><b>{item.quantity}</b><button onClick={() => qty(item.id, 1)}><Plus size={14} /></button><strong>{money(item.price * item.quantity)}</strong></div></div>) : <div className="wise-cart-empty"><ShoppingCart size={38} /><strong>Your cart is empty</strong><span>Select products or services to start a sale.</span></div>}</div><div className="wise-cart-footer"><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" /><div className="wise-summary"><span>Subtotal</span><b>{money(subtotal)}</b><span>Discount</span><b>- {money(discountAmount)}</b><strong>Total</strong><strong>{money(total)}</strong></div><div className="wise-discount"><label>Discount</label><input ref={discountRef} id="wise-discount-input" type="number" min="0" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0.00" /></div><button className="wise-checkout" disabled={!cart.length} onClick={openCheckout}><ReceiptText size={19} /> CHECKOUT <span>{money(total)}</span></button></div></aside>
    <nav className="wise-quick-actions" aria-label="POS quick actions">
      <button type="button" className="wise-quick-action" onClick={focusDiscount} title="Apply discount"><Percent size={21} /><span>Discount</span></button>
      <button type="button" className="wise-quick-action" onClick={openOrders} title="View orders"><ClipboardList size={21} /><span>Orders</span></button>
      <button type="button" className="wise-quick-action wise-quick-action-active" onClick={() => setShiftOpen(true)} title="View current shift"><Clock3 size={21} /><span>Shift</span></button>
      <button type="button" className="wise-quick-action" onClick={clear} disabled={!cart.length} title="Clear current sale"><Eraser size={21} /><span>Clear</span></button>
      <button type="button" className="wise-quick-action" onClick={() => window.print()} title="Print current POS screen"><Printer size={21} /><span>Printer</span></button>
      <button type="button" className="wise-quick-action" onClick={openSettings} title="Open POS settings"><Settings2 size={21} /><span>Settings</span></button>
      <button type="button" className="wise-quick-action" onClick={() => window.location.reload()} title="Refresh POS"><RefreshCw size={21} /><span>Refresh</span></button>
    </nav></div>

    {discountOpen && <div className="wise-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscountOpen(false); }}><div className="wise-modal wise-discount-modal">
      <div className="wise-modal-head"><div><strong>Select Discount</strong><span>This will be applied to all line items</span></div><button onClick={() => setDiscountOpen(false)}><X size={20} /></button></div>
      <div className="wise-discount-layout">
        <div className="wise-discount-left">
          <div className="wise-discount-section-title">GOVERNMENT DISCOUNTS</div><p className="wise-discount-description">For eligible customers with valid government-issued proof.</p>
          <div className="wise-discount-tiles">
            <button type="button" className={`wise-discount-tile ${discountType === "senior" ? "selected" : ""}`} onClick={() => selectDiscountType("senior")}><span className="wise-discount-icon"><UserRound size={20} /></span><strong>Senior</strong><small>5% or 20% off</small></button>
            <button type="button" className={`wise-discount-tile ${discountType === "pwd" ? "selected" : ""}`} onClick={() => selectDiscountType("pwd")}><span className="wise-discount-icon"><Accessibility size={20} /></span><strong>PWD</strong><small>5% or 20% off</small></button>
            <button type="button" className={`wise-discount-tile ${discountType === "athlete" ? "selected" : ""}`} onClick={() => selectDiscountType("athlete")}><span className="wise-discount-icon"><Medal size={20} /></span><strong>National Athlete</strong><small>20% off</small></button>
            <button type="button" className={`wise-discount-tile ${discountType === "solo_parent" ? "selected" : ""}`} onClick={() => selectDiscountType("solo_parent")}><span className="wise-discount-icon"><UsersRound size={20} /></span><strong>Solo Parent</strong><small>10% off</small></button>
          </div>
          <div className="wise-discount-section-title custom">CUSTOM DISCOUNTS</div><p className="wise-discount-description">Manual discount value for promos and discretionary cases.</p>
          <div className="wise-discount-tiles custom-grid">
            <button type="button" className={`wise-discount-tile ${discountType === "percentage" ? "selected" : ""}`} onClick={() => selectDiscountType("percentage")}><span className="wise-discount-icon"><Percent size={20} /></span><strong>Percentage</strong><small>% off item total</small></button>
            <button type="button" className={`wise-discount-tile ${discountType === "amount" ? "selected" : ""}`} onClick={() => selectDiscountType("amount")}><span className="wise-discount-icon">₱</span><strong>Amount</strong><small>Fixed peso amount</small></button>
          </div>
        </div>
        <div className="wise-discount-right">
          {discountType === "senior" && <><div className="wise-discount-section-title">CUSTOMER INFORMATION</div><label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label><label>Senior Citizen ID Number<input value={discountId} onChange={(e) => setDiscountId(e.target.value)} placeholder="Enter ID number" /></label><label>TIN Number <em>(optional)</em><input value={discountTin} onChange={(e) => setDiscountTin(e.target.value)} placeholder="Enter TIN number" /></label><div className="wise-discount-rate"><span>Senior discount rate</span><div><button type="button" className={discountRate === 5 ? "active" : ""} onClick={() => setDiscountRate(5)}>5%</button><button type="button" className={discountRate === 20 ? "active" : ""} onClick={() => setDiscountRate(20)}>20%</button></div></div><div className="wise-discount-info"><Info size={17} />A valid Senior Citizen ID must be presented at the time of purchase.</div></>}
          {discountType === "pwd" && <><div className="wise-discount-section-title">CUSTOMER INFORMATION</div><label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label><label>PWD ID Number<input value={discountId} onChange={(e) => setDiscountId(e.target.value)} placeholder="Enter ID number" /></label><label>TIN Number <em>(optional)</em><input value={discountTin} onChange={(e) => setDiscountTin(e.target.value)} placeholder="Enter TIN number" /></label><div className="wise-discount-rate"><span>PWD discount rate</span><div><button type="button" className={discountRate === 5 ? "active" : ""} onClick={() => setDiscountRate(5)}>5%</button><button type="button" className={discountRate === 20 ? "active" : ""} onClick={() => setDiscountRate(20)}>20%</button></div></div><div className="wise-discount-info"><Info size={17} />A valid PWD ID must be presented at the time of purchase.</div></>}
          {discountType === "athlete" && <><div className="wise-discount-section-title">CUSTOMER INFORMATION</div><label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label><label>National Athlete ID Number<input value={discountId} onChange={(e) => setDiscountId(e.target.value)} placeholder="Enter ID number" /></label><div className="wise-discount-info"><Info size={17} />A valid National Athlete ID must be presented at the time of purchase.</div></>}
          {discountType === "solo_parent" && <><div className="wise-discount-section-title">CUSTOMER INFORMATION</div><label>Customer Name<input value={discountCustomerName} onChange={(e) => setDiscountCustomerName(e.target.value)} placeholder="Full name as on ID" /></label><label>Solo Parent ID Number<input value={discountId} onChange={(e) => setDiscountId(e.target.value)} placeholder="Enter ID number" /></label><div className="wise-discount-section-title child">CHILD INFORMATION</div><label>Child Name<input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Child's full name" /></label><div className="wise-child-row"><label>Date of Birth<input value={childDob} onChange={(e) => setChildDob(e.target.value)} type="date" /></label><label>Age<input value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder="Age" inputMode="numeric" /></label></div></>}
          {discountType === "percentage" && <><div className="wise-discount-section-title">PERCENTAGE DISCOUNT</div><p className="wise-discount-description">Enter a value between 1 and 100.</p><label>Enter percentage<input value={customDiscountValue} onChange={(e) => setCustomDiscountValue(e.target.value)} placeholder="Enter percentage" type="number" min="1" max="100" /></label></>}
          {discountType === "amount" && <><div className="wise-discount-section-title">AMOUNT DISCOUNT</div><p className="wise-discount-description">Enter a fixed peso amount to deduct.</p><label>Enter amount<input value={customDiscountValue} onChange={(e) => setCustomDiscountValue(e.target.value)} placeholder="Enter amount" type="number" min="0.01" step="0.01" /></label></>}
        </div>
      </div>
      <div className="wise-discount-footer"><div>{discountLabel && <><strong>{discountLabel}</strong><span>{discountHint}</span></>}</div><button className="wise-primary" type="button" onClick={applyDiscount} disabled={!discountType}>Apply Discount</button></div>
    </div></div>}

    {shiftOpen && <div className="wise-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShiftOpen(false); }}><div className="wise-modal wise-shift-modal"><div className="wise-modal-head"><div><strong>Current Shift</strong><span>Today's live POS activity for your account</span></div><button onClick={() => setShiftOpen(false)}><X size={20} /></button></div><div className="wise-shift-content">{shiftData.loading ? <div className="wise-empty"><Clock3 size={30} /><strong>Loading shift data...</strong></div> : <><div className="wise-shift-total"><CircleDollarSign size={23} /><div><span>Today's completed sales</span><strong>{money(shiftData.sales)}</strong></div></div><div className="wise-shift-grid"><div><span>Orders</span><b>{shiftData.orders}</b></div><div><span>Cash</span><b>{money(shiftData.cash)}</b></div><div><span>Non-cash</span><b>{money(shiftData.nonCash)}</b></div><div><span>Discounts</span><b>{money(shiftData.discounts)}</b></div><div><span>Voided orders</span><b>{shiftData.voided}</b></div></div></>}</div><div className="wise-modal-actions"><button className="wise-secondary" onClick={() => setShiftOpen(false)}>Close</button><button className="wise-primary" onClick={() => window.location.reload()}>Refresh Shift</button></div></div></div>}

    {checkoutOpen && <div className="wise-modal-backdrop"><div className="wise-modal"><div className="wise-modal-head"><div><strong>Complete Sale</strong><span>WISE POS</span></div><button onClick={() => !saving && setCheckoutOpen(false)}><X size={20} /></button></div><div className="wise-modal-content"><div className="wise-total-card"><span>Total to collect</span><strong>{money(total)}</strong></div><label>Payment method</label><div className="wise-payment-grid">{payments.map(({ key, icon: Icon }) => <button key={key} className={payment === key ? "active" : ""} onClick={() => { setPayment(key); if (key !== "Cash") setTendered(total); }}><Icon size={18} />{key}</button>)}</div>{payment === "Cash" && <><label>Amount received</label><input className="wise-tendered" type="number" min={total} value={tendered || ""} onChange={(e) => setTendered(Number(e.target.value) || 0)} placeholder={money(total)} /><div className="wise-change"><span>Change</span><strong>{money(change)}</strong></div></>}</div><div className="wise-modal-actions"><button className="wise-secondary" onClick={() => setCheckoutOpen(false)} disabled={saving}>Cancel</button><button className="wise-primary" onClick={checkout} disabled={saving || (payment === "Cash" && tendered < total)}>{saving ? "PROCESSING..." : `COMPLETE SALE · ${money(total)}`}</button></div></div></div>}
    {receipt && <div className="wise-modal-backdrop"><div className="wise-receipt-modal"><div className="wise-success">✓</div><h2>Sale Complete</h2><p>{receipt.orderNo}</p><div className="wise-receipt-lines">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b></div>)}<hr /><div><span>Total</span><b>{money(receipt.total)}</b></div><div><span>Paid via</span><b>{receipt.payment}</b></div>{receipt.payment === "Cash" && <div><span>Change</span><b>{money(receipt.change)}</b></div>}</div><button className="wise-primary" onClick={() => { setReceipt(null); clear(); }}>NEW SALE</button></div></div>}
  </section></main>;
}
