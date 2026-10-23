"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChefHat, ExternalLink, ArrowLeft, Banknote, ChevronDown, CreditCard, LogIn, Minus, Plus, ReceiptText, Search, ShoppingCart, Smartphone, Trash2, WalletCards, X, Percent, ClipboardList, Clock3, Eraser, Printer, PauseCircle, Play, Settings2, RefreshCw, CircleDollarSign, UserRound, Accessibility, Medal, UsersRound, Info } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "./pos.css";

type Product = { id: string; name: string; category: string; price: number; unit?: string; image_url: string | null; item_type: "product" | "service"; track_inventory?: boolean; inventory_ready?: boolean; recipe_required?: boolean };
type CartItem = Product & { quantity: number; orderType?: "dine_in" | "take_out" };
type PendingSale = { id: string; customer: string; notes: string; orderType: "dine_in" | "take_out"; discount: number; payment: string; cart: CartItem[]; wiseMenuOrderId: string; wiseMenuOrderNo: string; savedAt: string };
type Receipt = { orderNo: string; payment: string; amountPaid: number; change: number; total: number; subtotal: number; customer: string; cashier: string; createdAt: string; items: CartItem[] };
type ShiftData = { sales: number; discounts: number; orders: number; cash: number; nonCash: number; voided: number; loading: boolean };
type DiscountType = "senior" | "pwd" | "athlete" | "solo_parent" | "percentage" | "amount" | null;
type WiseMenuOrder = { id: string; order_no: string; customer_name: string | null; total: number; amount_paid: number; balance: number; notes: string | null; created_at: string; items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number }> };

const payments = [
  { key: "Cash", icon: Banknote }, { key: "GCash", icon: Smartphone }, { key: "Maya", icon: Smartphone },
  { key: "Credit Card", icon: CreditCard }, { key: "eWallet", icon: WalletCards },
];
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function POSPage() {
  const [user, setUser] = useState<User | null>(null), [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [authMessage, setAuthMessage] = useState("");
  const [products, setProducts] = useState<Product[]>([]), [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState(""), [category, setCategory] = useState("All"), [productPage, setProductPage] = useState(1), [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState(""), [customerNotes, setCustomerNotes] = useState(""), [orderType, setOrderType] = useState<"dine_in"|"take_out">("take_out"), [discount, setDiscount] = useState(0), [payment, setPayment] = useState("Cash"), [tendered, setTendered] = useState(0);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]), [pendingOpen, setPendingOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [receipt, setReceipt] = useState<Receipt | null>(null), [moreOpen, setMoreOpen] = useState(false), [kitchenPromptOpen, setKitchenPromptOpen] = useState(false);
  const [wiseMenuOrderId, setWiseMenuOrderId] = useState(""), [wiseMenuOrderNo, setWiseMenuOrderNo] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false), [shiftData, setShiftData] = useState<ShiftData>({ sales: 0, discounts: 0, orders: 0, cash: 0, nonCash: 0, voided: 0, loading: false });
  const [discountOpen, setDiscountOpen] = useState(false), [discountType, setDiscountType] = useState<DiscountType>(null), [discountRate, setDiscountRate] = useState(20);
  const [discountCustomerName, setDiscountCustomerName] = useState(""), [discountId, setDiscountId] = useState(""), [discountTin, setDiscountTin] = useState("");
  const [childName, setChildName] = useState(""), [childDob, setChildDob] = useState(""), [childAge, setChildAge] = useState("");
  const [customDiscountValue, setCustomDiscountValue] = useState("");
  const [printerOpen, setPrinterOpen] = useState(false), [printerScanning, setPrinterScanning] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false), [printerName, setPrinterName] = useState("No receipt printer detected");
  const [printerType, setPrinterType] = useState("Browser Print");
  const [receiptAlignment, setReceiptAlignment] = useState(0);
  const [receiptContentWidth, setReceiptContentWidth] = useState(72);
  const discountRef = useRef<HTMLInputElement>(null);
  const cartBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wise_pos_pending_sales");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setPendingSales(parsed.filter((item: any) => item && typeof item.id === "string" && Array.isArray(item.cart)));
      }
    } catch (error) {
      console.error("Unable to restore pending sales:", error);
    }
  }, []);

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
        setProductPage(1); setProducts((payload.products ?? []).map((p: any) => ({ ...p, price: Number(p.price), item_type: p.item_type === "service" ? "service" : "product" })));
      } catch (error: any) { setMessage(error?.message || "Unable to load products and services."); }
      finally { setProductsLoading(false); }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!user || !products.length) return;
    const orderId = new URLSearchParams(window.location.search).get("wiseMenuOrder")?.trim();
    if (!orderId || orderId === wiseMenuOrderId) return;
    let cancelled = false;
    const loadWiseMenuSale = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const response = await fetch(`/api/pos/wise-menu?orderId=${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || !payload.order) throw new Error(payload.error || "Unable to load the WISE MENU order into Current Sale.");
        if (cancelled) return;
        const order: WiseMenuOrder = payload.order;
        const loadedItems: CartItem[] = order.items.map((item) => {
          const product = products.find((p) => p.id === item.product_id);
          return { id: item.product_id, name: item.product_name, category: product?.category || "WISE MENU", price: Number(item.unit_price), unit: product?.unit, image_url: product?.image_url || null, item_type: product?.item_type || "product", quantity: Number(item.quantity) };
        }).filter((item) => item.quantity > 0);
        if (!loadedItems.length) throw new Error("The WISE MENU order has no valid items.");
        setCart(loadedItems.map((item: CartItem) => ({ ...item, orderType: item.orderType || orderType })));
        setCustomer(order.customer_name || ""); setCustomerNotes(order.notes || "");
        setDiscount(0);
        setPayment("Cash");
        setTendered(0);
        setWiseMenuOrderId(order.id);
        setWiseMenuOrderNo(order.order_no);
        setMessage(`WISE MENU ${order.order_no} loaded into Current Sale. Select payment and complete the sale.`);
        window.history.replaceState({}, "", "/pos");
      } catch (error: any) {
        if (!cancelled) setMessage(error?.message || "Unable to load the WISE MENU order into Current Sale.");
      }
    };
    loadWiseMenuSale();
    return () => { cancelled = true; };
  }, [user, products, wiseMenuOrderId]);

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
  const PRODUCTS_PER_PAGE = 20;
  const productPageCount = Math.max(1, Math.ceil(filtered.length / PRODUCTS_PER_PAGE));
  const visibleProducts = useMemo(() => filtered.slice((productPage - 1) * PRODUCTS_PER_PAGE, productPage * PRODUCTS_PER_PAGE), [filtered, productPage]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, discount));
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, tendered - total);

  const add = (product: Product) => {
    setMessage("");
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      const updated: CartItem = found
        ? { ...found, quantity: found.quantity + 1 }
        : { ...product, quantity: 1, orderType };
      return [...current.filter((item) => item.id !== product.id), updated];
    });
    requestAnimationFrame(() => {
      if (cartBodyRef.current) {
        cartBodyRef.current.scrollTo({ top: cartBodyRef.current.scrollHeight, behavior: "smooth" });
      }
    });
  };
  const setAllItemOrderTypes = (type: "dine_in" | "take_out") => { setOrderType(type); setCart((current) => current.map((item) => ({ ...item, orderType: type }))); };
  const setItemOrderType = (id: string, type: "dine_in" | "take_out") => setCart((current) => current.map((item) => item.id === id ? { ...item, orderType: type } : item));
  const qty = (id: string, delta: number) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0));
  const clear = () => { setCart([]); setCustomer(""); setCustomerNotes(""); setOrderType("take_out"); setDiscount(0); setTendered(0); setPayment("Cash"); setWiseMenuOrderId(""); setWiseMenuOrderNo(""); setMessage(""); };

  const signIn = async () => { setAuthMessage(""); setAuthLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) setAuthMessage(error.message); setAuthLoading(false); };
  const openCheckout = () => { if (!cart.length) { setMessage("Add an item to the cart before checkout."); return; } if (payment !== "Cash") setTendered(total); setMessage(""); setCheckoutOpen(true); };
  const focusDiscount = () => {
    if (!cart.length) { setMessage("Add an item before applying a discount."); return; }
    setDiscountType("senior"); setDiscountRate(20); setDiscountCustomerName(""); setDiscountId(""); setDiscountTin(""); setChildName(""); setChildDob(""); setChildAge(""); setCustomDiscountValue(""); setDiscountOpen(true);
  };
  const selectDiscountType = (type: Exclude<DiscountType, null>) => { setDiscountType(type); if (type === "senior" || type === "pwd") setDiscountRate(20); };
  const savePendingSale = () => {
    if (!cart.length) { setMessage("Add items before marking this sale as pending."); return; }
    const draft: PendingSale = { id: crypto.randomUUID(), customer: customer.trim(), notes: customerNotes.trim(), orderType, discount: discountAmount, payment, cart: [...cart], wiseMenuOrderId, wiseMenuOrderNo, savedAt: new Date().toISOString() };
    const next = [draft, ...pendingSales];
    setPendingSales(next); localStorage.setItem("wise_pos_pending_sales", JSON.stringify(next));
    clear(); setMessage("Sale saved as PENDING. Resume it from the Pending button when the customer is ready.");
  };
  const resumePendingSale = (draft: PendingSale) => {
    if (cart.length && !window.confirm("Replace the current sale with this pending sale? The current cart is not saved.")) return;
    setCart(draft.cart); setCustomer(draft.customer); setCustomerNotes(draft.notes || ""); setOrderType(draft.orderType); setDiscount(draft.discount); setPayment(draft.payment); setTendered(0); setWiseMenuOrderId(draft.wiseMenuOrderId || ""); setWiseMenuOrderNo(draft.wiseMenuOrderNo || "");
    const next = pendingSales.filter(item => item.id !== draft.id);
    setPendingSales(next); localStorage.setItem("wise_pos_pending_sales", JSON.stringify(next)); setPendingOpen(false); setMessage("Pending sale restored to Current Sale.");
  };
  const removePendingSale = (id: string) => { const next = pendingSales.filter(item => item.id !== id); setPendingSales(next); localStorage.setItem("wise_pos_pending_sales", JSON.stringify(next)); };
  const openOrders = () => window.location.assign("/orders");
  const openSettings = () => window.location.assign("/settings");

  const applyDiscount = () => {
    if (!cart.length) { setDiscountOpen(false); setMessage("Add an item before applying a discount."); return; }
    let amount = 0;
    if (discountType === "senior" || discountType === "pwd") { if (!discountCustomerName.trim() || !discountId.trim()) { setMessage(`Enter the customer's name and ${discountType === "senior" ? "Senior Citizen" : "PWD"} ID number.`); return; } amount = subtotal * (discountRate / 100); }
    else if (discountType === "athlete") { if (!discountCustomerName.trim() || !discountId.trim()) { setMessage("Enter the customer's name and National Athlete ID number."); return; } amount = subtotal * 0.20; }
    else if (discountType === "solo_parent") { if (!discountCustomerName.trim() || !discountId.trim() || !childName.trim() || !childDob || !childAge) { setMessage("Complete the Solo Parent and child information."); return; } amount = subtotal * 0.10; }
    else if (discountType === "percentage") { const value = Number(customDiscountValue); if (!Number.isFinite(value) || value < 1 || value > 100) { setMessage("Enter a percentage between 1 and 100."); return; } amount = subtotal * (value / 100); }
    else if (discountType === "amount") { const value = Number(customDiscountValue); if (!Number.isFinite(value) || value <= 0) { setMessage("Enter a valid discount amount."); return; } amount = value; }
    else { setMessage("Select a discount type first."); return; }
    const applied = Math.min(subtotal, Math.max(0, Number(amount.toFixed(2))));
    setDiscount(applied); if (discountCustomerName.trim()) setCustomer(discountCustomerName.trim()); setDiscountOpen(false); setMessage("");
  };

  const scanReceiptPrinters = async (allowPicker = false) => {
    setPrinterScanning(true);
    setPrinterConnected(false);
    setPrinterName("Scanning for receipt printers...");
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      let foundName = "";
      let foundType = "";

      if (nav?.usb?.getDevices) {
        try {
          const devices = await nav.usb.getDevices();
          const printer = devices.find((device: any) => device.productName || device.manufacturerName);
          if (printer) {
            foundName = printer.productName || printer.manufacturerName || "USB Receipt Printer";
            foundType = "USB";
          }
        } catch {}
      }

      if (!foundName && nav?.serial?.getPorts) {
        try {
          const ports = await nav.serial.getPorts();
          if (ports.length) {
            foundName = "Serial Receipt Printer";
            foundType = "Serial";
          }
        } catch {}
      }

      if (!foundName && allowPicker && nav?.usb?.requestDevice) {
        try {
          const device = await nav.usb.requestDevice({ filters: [] });
          if (device) {
            foundName = device.productName || device.manufacturerName || "USB Receipt Printer";
            foundType = "USB";
          }
        } catch {}
      }

      if (!foundName && allowPicker && nav?.serial?.requestPort) {
        try {
          const port = await nav.serial.requestPort();
          if (port) {
            foundName = "Serial Receipt Printer";
            foundType = "Serial";
          }
        } catch {}
      }

      if (foundName) {
        setPrinterConnected(true);
        setPrinterName(foundName);
        setPrinterType(foundType);
      } else {
        setPrinterConnected(false);
        setPrinterName("No receipt printer detected");
        setPrinterType("Browser Print");
      }
    } finally {
      setPrinterScanning(false);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wise_pos_receipt_alignment");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Number.isFinite(Number(parsed.offset))) setReceiptAlignment(Math.max(-5, Math.min(5, Number(parsed.offset))));
        if (Number.isFinite(Number(parsed.width))) setReceiptContentWidth(Math.max(60, Math.min(76, Number(parsed.width))));
      }
    } catch {}
  }, []);

  const saveReceiptAlignment = (offset: number, width: number) => {
    const safeOffset = Math.max(-5, Math.min(5, offset));
    const safeWidth = Math.max(60, Math.min(76, width));
    setReceiptAlignment(safeOffset);
    setReceiptContentWidth(safeWidth);
    try { localStorage.setItem("wise_pos_receipt_alignment", JSON.stringify({ offset: safeOffset, width: safeWidth })); } catch {}
  };
  const openCashDrawerViaQZ = async () => {
    const w = window as any;
    const loadQZ = () => new Promise<void>((resolve, reject) => {
      if (w.qz) { resolve(); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-qz-tray="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Unable to load QZ Tray browser library.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js";
      script.async = true;
      script.dataset.qzTray = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load QZ Tray browser library. Check your internet connection."));
      document.head.appendChild(script);
    });
    await loadQZ();
    const qz = w.qz;
    if (!qz) throw new Error("QZ Tray library is unavailable.");
    if (!w.qzSigningConfigured) {
      qz.security.setCertificatePromise((resolve: (value: string) => void, reject: (reason: any) => void) => {
        fetch("/api/qz/certificate", { cache: "no-store" })
          .then(async (response) => response.ok ? resolve(await response.text()) : reject(await response.text()))
          .catch(reject);
      });
      qz.security.setSignatureAlgorithm("SHA512");
      qz.security.setSignaturePromise((toSign: string) => (resolve: (value: string) => void, reject: (reason: any) => void) => {
        void (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            if (!token) throw new Error("Please sign in again before using QZ Tray.");
            const response = await fetch("/api/qz/sign", {
              method: "POST",
              cache: "no-store",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ request: toSign }),
            });
            const signature = await response.text();
            if (!response.ok) throw new Error(signature || "QZ Tray signing failed.");
            resolve(signature);
          } catch (error) { reject(error); }
        })();
      });
      w.qzSigningConfigured = true;
    }
    if (!qz.websocket.isActive()) await qz.websocket.connect();
    const printers: string[] = await qz.printers.find();
    const printerName = printers.find((name) => /GL\s*Printer\s*80|R80A/i.test(name));
    if (!printerName) {
      throw new Error(`QZ Tray is connected, but GL Printer 80/R80A was not found. Detected printers: ${printers.length ? printers.join(", ") : "none"}`);
    }
    const config = qz.configs.create(printerName, { forceRaw: true });
    await qz.print(config, [{ type: "raw", format: "command", data: "\x1B\x70\x00\x19\xFA\x1B\x70\x01\x19\xFA" }]);
    setMessage(`Receipt print dialog closed. Cash drawer command sent to ${printerName}.`);
  };

  const printReceipt = (slip = false, openDrawerAfterPrint = false) => {
    if (!receipt) return;
    const created = new Date(receipt.createdAt);
    const dateText = created.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
    const title = slip ? "ORDER SLIP" : "RECEIPT";
    const escapeHtml = (value: unknown) => String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/\'/g, "&#039;");
    const discountValue = Math.max(0, receipt.subtotal - receipt.total);
    const itemRows = receipt.items.map((item) => `<tr><td class="item-name">${escapeHtml(item.name)}${item.name.toLowerCase().includes("with fries") ? "" : ""}</td><td class="num">${Number(item.quantity)}</td><td class="num">${money(item.price)}</td><td class="num">${money(item.price * item.quantity)}</td>${slip ? "" : ""}</tr>`).join("");
    const merchantRows = receipt.items.map((item) => `<tr><td class="item-name">${escapeHtml(item.name)}</td><td class="num">${Number(item.quantity)}</td><td class="num">${money(item.price)}</td><td class="num">${money(item.price * item.quantity)}</td><td class="type"><span>${(item.orderType || "take_out") === "dine_in" ? "DINE-IN" : "TAKEOUT"}</span></td></tr>`).join("");
    const businessHeader = `<header class="brand"><h1>ESPACIO</h1><h3>CAFÉ &amp; RESTAURANT</h3><div class="tagline">STUDY · WORK · COFFEE</div><p>Cabio Bakal, Balucuc, Apalit, Pampanga</p><p>Tel: 09773330211 / 09289035440</p><p>hello@printwise.com</p><p class="social">● f　◎　@espacio.ph</p></header>`;
    const details = `<section class="details"><div><span>Receipt No.</span><b>${escapeHtml(receipt.orderNo)}</b></div><div><span>Date &amp; Time</span><b>${escapeHtml(dateText)}</b></div><div><span>Cashier</span><b>${escapeHtml(receipt.cashier || "Cashier")}</b></div>${receipt.customer ? `<div><span>Customer</span><b>${escapeHtml(receipt.customer)}</b></div>` : ""}</section>`;
    const totals = `<section class="totals"><div><span>Subtotal</span><b>${money(receipt.subtotal)}</b></div>${discountValue > 0 ? `<div><span>Discount</span><b>-${money(discountValue)}</b></div>` : ""}<div class="grand"><span>TOTAL</span><b>${money(receipt.total)}</b></div><div><span>Payment Method</span><b>${escapeHtml(receipt.payment)}</b></div><div><span>Amount Received</span><b>${money(receipt.amountPaid)}</b></div><div><span>Change</span><b>${money(receipt.change)}</b></div></section>`;
    const customerCopy = `<main class="receipt">${businessHeader}<div class="copy-title"><strong>OFFICIAL RECEIPT</strong><b>CUSTOMER COPY</b></div>${details}<div class="items"><table><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr></thead><tbody>${itemRows}</tbody></table></div>${totals}<footer class="customer-thanks"><strong>Thank you for choosing</strong><b>ESPACIO!</b><span>Study · Work · Coffee.</span><span>Come Again Soon!</span><span class="social">● f　◎　@espacio.ph</span></footer></main>`;
    const merchantCopy = `<main class="receipt">${businessHeader}<div class="copy-title"><strong>SALES RECEIPT</strong><b>MERCHANT COPY</b></div>${details}<div class="items"><table class="merchant-items"><thead><tr><th>ITEM</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th><th>TYPE</th></tr></thead><tbody>${merchantRows}</tbody></table></div>${totals}<footer class="merchant-thanks"><div class="motto"><span>☕<small>GOOD<br>COFFEE</small></span><span>♧<small>GREAT<br>PEOPLE</small></span><span>▤<small>PRODUCTIVE<br>DAYS</small></span><span>♧<small>A BRIGHTER<br>TOMORROW</small></span></div><p>ESPACIO Café &amp; Restaurant</p></footer></main>`;
    const kitchenCategories = new Set(["food", "pasta", "sandwiches", "clubhouse sandwiches", "silog meal", "snacks", "add ons", "addons"]);
    const kitchenItems = receipt.items.filter((item) => kitchenCategories.has(String(item.category || "").trim().toLowerCase()));
    const kitchenCopy = `<main class="receipt kitchen-copy"><header class="kitchen-head"><strong>ESPACIO · KITCHEN</strong><b>KOT</b></header><section class="kitchen-meta"><div><span>ORDER</span><b>${escapeHtml(receipt.orderNo)}</b></div><div><span>TIME</span><b>${escapeHtml(created.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }))}</b></div><div><span>CUSTOMER</span><b>${escapeHtml(receipt.customer || "Walk-in")}</b></div></section><div class="kitchen-items">${kitchenItems.length ? kitchenItems.map((item) => `<article class="kitchen-item"><b class="kitchen-qty">${Number(item.quantity)}×</b><div><strong>${escapeHtml(item.name)}</strong><span>${(item.orderType || "take_out") === "dine_in" ? "DINE-IN" : "TAKEOUT"}</span></div></article>`).join("") : `<p class="kitchen-empty">NO FOOD / MEAL ITEMS IN THIS ORDER</p>`}</div><footer class="kitchen-footer">PLEASE PREPARE</footer></main>`;
    const printContents = slip ? [kitchenCopy] : [customerCopy];
    const buildHtml = (content: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${title} ${escapeHtml(receipt.orderNo)}</title><style>
      @page{size:80mm auto;margin:0}
      *{box-sizing:border-box}
      html,body{width:80mm!important;min-width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10px;overflow-wrap:anywhere}
      .receipt{display:block;width:min(${receiptContentWidth}mm,100%);max-width:${receiptContentWidth}mm;margin-left:auto!important;margin-right:auto!important;position:relative;left:0;transform:translateX(${receiptAlignment}mm);padding:3mm 0;box-sizing:border-box;overflow-wrap:anywhere}
      .brand{display:block;width:100%;max-width:100%;margin:0 auto 2mm;text-align:center!important;border-bottom:1px dashed #333;padding-bottom:3mm;overflow-wrap:anywhere}.brand h1{font-size:27px;letter-spacing:1px;margin:0;font-weight:900}.brand h3{font-size:11px;letter-spacing:3px;margin:0 0 5px}.brand .tagline{border-top:1px solid #333;display:inline-block;padding-top:3px;font-size:9px;font-weight:700;letter-spacing:1px}.brand p{font-size:10px;margin:2px 0}.brand .social{font-weight:700}
      .copy-title{display:flex;justify-content:space-between;align-items:center;gap:4px;border-bottom:1px dashed #333;padding:2mm 0;font-size:12px}.copy-title b{background:#111;color:#fff;padding:1.5mm;font-size:10px;white-space:nowrap}
      .details{border-bottom:1px dashed #333;padding:2mm 0;display:grid;gap:1mm}.details div{display:grid;grid-template-columns:minmax(21mm,24mm) minmax(0,1fr);gap:1.5mm;min-width:0}.details b{min-width:0}.details span{font-size:10px}.details b{font-size:10px;font-weight:500;overflow-wrap:anywhere}
      table{width:100%;max-width:100%;border-collapse:collapse;table-layout:auto;font-size:9px;overflow:visible}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}td,th{overflow:visible;word-break:normal;overflow-wrap:anywhere}
      .items{width:100%;max-width:100%;min-width:0;overflow:visible;break-inside:auto;page-break-inside:auto}
      .items table:not(.merchant-items) th:nth-child(1),.items table:not(.merchant-items) td:nth-child(1){width:42%;text-align:left}
      .items table:not(.merchant-items) th:nth-child(2),.items table:not(.merchant-items) td:nth-child(2){width:12%;text-align:center}
      .items table:not(.merchant-items) th:nth-child(3),.items table:not(.merchant-items) td:nth-child(3){width:20%;text-align:right}
      .items table:not(.merchant-items) th:nth-child(4),.items table:not(.merchant-items) td:nth-child(4){width:26%;text-align:right}
      .items table.merchant-items th:nth-child(1),.items table.merchant-items td:nth-child(1){width:34%;text-align:left}
      .items table.merchant-items th:nth-child(2),.items table.merchant-items td:nth-child(2){width:9%;text-align:center}
      .items table.merchant-items th:nth-child(3),.items table.merchant-items td:nth-child(3){width:17%;text-align:right}
      .items table.merchant-items th:nth-child(4),.items table.merchant-items td:nth-child(4){width:23%;text-align:right}
      .items table.merchant-items th:nth-child(5),.items table.merchant-items td:nth-child(5){width:17%;text-align:center}.items{padding:2mm 0;border-bottom:1px dashed #333}th{text-align:left;font-size:9px;border-bottom:1px dashed #333;padding:1.5mm .5mm}td{padding:1.5mm .5mm;vertical-align:top;border-bottom:0}.num{text-align:right;white-space:normal;overflow-wrap:anywhere;word-break:normal}.item-name{overflow-wrap:anywhere}.type{text-align:center}.type span{border:1px solid #777;border-radius:3px;padding:1px 2px;font-size:7px;font-weight:800;white-space:nowrap}
      .totals{padding:2mm 0;border-bottom:1px dashed #333;display:grid;gap:1.5mm}.totals div{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;min-width:0}.totals div>span,.totals div>b,.totals div>strong{min-width:0;overflow-wrap:anywhere}.totals div>b,.totals div>strong{text-align:right}.totals b{font-weight:500;text-align:right}.totals .grand{border-top:1px dashed #333;border-bottom:1px dashed #333;padding:2mm 0;font-size:17px;font-weight:900}.totals .grand b{font-weight:900}
      .customer-thanks{text-align:center;padding-top:3mm;display:grid;gap:1mm;font-size:10px}.customer-thanks strong{font-size:11px}.customer-thanks b{font-size:16px}.customer-thanks .social{font-weight:800;margin-top:1mm}.merchant-thanks{padding-top:3mm;text-align:center}.motto{display:grid;grid-template-columns:repeat(4,1fr);gap:1mm}.motto span{font-size:18px;display:flex;flex-direction:column;align-items:center}.motto small{font-size:7px;line-height:1.2;font-weight:700}.merchant-thanks p{font-size:10px;margin:3mm 0 0}
      .copy-break{height:0;break-before:page;page-break-before:always}.kitchen-copy{padding:2mm 0}.kitchen-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #333;padding:0 0 2mm;font-size:13px}.kitchen-head b{font-size:11px;border:1px solid #111;padding:1mm 2mm}.kitchen-meta{display:grid;gap:1mm;padding:2mm 0;border-bottom:1px dashed #333}.kitchen-meta div{display:flex;justify-content:space-between;gap:2mm;font-size:9px}.kitchen-meta span{font-weight:700}.kitchen-meta b{text-align:right;overflow-wrap:anywhere}.kitchen-items{padding-top:1mm}.kitchen-item{display:flex;gap:2mm;align-items:flex-start;padding:2mm 0;border-bottom:1px dashed #333;break-inside:avoid}.kitchen-qty{font-size:19px;min-width:10mm}.kitchen-item>div{display:flex;flex-direction:column;gap:1mm;min-width:0}.kitchen-item strong{font-size:13px;overflow-wrap:anywhere}.kitchen-item span{font-size:10px;font-weight:900;border:1px solid #111;padding:.5mm 1.5mm;align-self:flex-start}.kitchen-footer{text-align:center;font-weight:900;font-size:9px;padding-top:2mm}
      @media print{@page{size:80mm auto;margin:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.receipt{margin-left:auto!important;margin-right:auto!important}}
    </style></head><body>${content}</body></html>`;
    const combinedContent = printContents.join("");
    // Print the receipt from a temporary hidden iframe. This keeps the receipt
    // document isolated from POS page styles and avoids an extra about:blank window.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.title = "Receipt print";
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    frame.style.pointerEvents = "none";
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow;
    const frameDocument = frame.contentDocument;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      setMessage("Unable to prepare receipt printing. Please try again.");
      return;
    }
    frameDocument.open();
    frameDocument.write(buildHtml(combinedContent));
    frameDocument.close();
    let cleaned = false;
    const cleanupPrint = () => {
      if (cleaned) return;
      cleaned = true;
      frame.remove();
    };
    frameWindow.addEventListener("afterprint", () => {
      cleanupPrint();
      if (!slip && openDrawerAfterPrint && receipt.payment === "Cash") {
        const desktop = (window as any).printwiseDesktop;
        if (desktop?.openCashDrawer) {
          desktop.openCashDrawer().catch(async (error: unknown) => {
            try { await openCashDrawerViaQZ(); }
            catch (qzError: unknown) {
              const detail = qzError instanceof Error ? qzError.message : error instanceof Error ? error.message : "Unknown error";
              setMessage(`Receipt printed, but cash drawer did not open: ${detail}`);
            }
          });
        } else {
          openCashDrawerViaQZ().catch((error: unknown) => {
            setMessage(error instanceof Error ? `Receipt printed, but cash drawer did not open: ${error.message}` : "Receipt printed, but cash drawer did not open. Make sure QZ Tray is running.");
          });
        }
      }
    }, { once: true });
    try {
      frame.onload = () => {
        window.setTimeout(() => {
          try {
            frameWindow.focus();
            frameWindow.print();
            if (!slip) setKitchenPromptOpen(true);
            window.setTimeout(cleanupPrint, 15000);
          } catch {
            cleanupPrint();
            setMessage("Unable to start printing. Please try again.");
          }
        }, 150);
      };
      // Some browsers fire load before the handler is attached; use a guarded fallback.
      if (frameDocument.readyState === "complete") {
        window.setTimeout(() => {
          if (cleaned) return;
          try {
            frameWindow.focus();
            frameWindow.print();
            if (!slip) setKitchenPromptOpen(true);
            window.setTimeout(cleanupPrint, 15000);
          } catch {
            cleanupPrint();
            setMessage("Unable to start printing. Please try again.");
          }
        }, 250);
      }
    } catch {
      cleanupPrint();
      setMessage("Unable to start printing. Please try again.");
    }
  };

  useEffect(() => {
    if (!receipt) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyK" || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setKitchenPromptOpen(false);
      printReceipt(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [receipt]);

  const finishNewSale = () => { setMoreOpen(false); setKitchenPromptOpen(false); setReceipt(null); clear(); };

  useEffect(() => {
    if (!receipt) return;
    const onShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        printReceipt(false);
      } else if (key === "n") {
        event.preventDefault();
        finishNewSale();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [receipt]);

  const checkout = async () => {
    if (!customer.trim()) { setMessage("Customer name is required. Please enter the customer’s name."); return; }
    if (!user) { setMessage("Please sign in before completing a sale."); return; }
    const totalCents = Math.round(Number(total) * 100); const tenderedCents = Math.round(Number(tendered) * 100); if (payment === "Cash" && tenderedCents < totalCents) { setMessage("Amount received is not enough for this sale."); return; }
    setSaving(true); setMessage("");
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const now = Date.now(); const transactionNo = `W-${now}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; const amountPaid = payment === "Cash" ? tendered : total; const createdAt = new Date().toISOString();

      if (wiseMenuOrderId) {
        const response = await fetch("/api/pos/wise-menu", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ posOrderId: wiseMenuOrderId, channel: payment.toLowerCase().replace(/\s+/g, "_"), amountPaid, transactionNo, subtotal, discountType: discountAmount > 0 ? "amount" : null, discountValue: discountAmount, discountAmount, total }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to complete WISE MENU payment.");
        const completedOrderNo = payload.order_no || wiseMenuOrderNo || `WISE-${wiseMenuOrderId.slice(0, 8)}`;
        setReceipt({ orderNo: completedOrderNo, payment, amountPaid, change: payment === "Cash" ? change : 0, total, subtotal, customer: customer.trim(), cashier: user?.email || "Cashier", createdAt, items: [...cart] });
        setCheckoutOpen(false); setMoreOpen(false); setWiseMenuOrderId(""); setWiseMenuOrderNo(""); window.history.replaceState({}, "", "/pos"); return;
      }

      const orderNo = `WISE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(now).slice(-6)}`;
      const response = await fetch("/api/pos/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ orderNo, transactionNo, customerName: customer.trim() || null, notes: customerNotes.trim() || null, orderType, subtotal, discountAmount, discountType: discountAmount > 0 ? "amount" : null, discountValue: discountAmount, total, amountPaid, channel: payment.toLowerCase().replace(/\s+/g, "_"), items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, lineTotal: item.price * item.quantity, orderType: item.orderType || orderType, options: { order_type: item.orderType || orderType } })) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.order_id) throw new Error(payload.error || "Unable to save the sale.");
      setReceipt({ orderNo, payment, amountPaid, change: payment === "Cash" ? change : 0, total, subtotal, customer: customer.trim(), cashier: user?.email || "Cashier", createdAt, items: [...cart] }); const inventoryWarnings = Array.isArray(payload.warnings) ? payload.warnings.filter(Boolean).join(" • ") : ""; setMessage(inventoryWarnings ? "SALE COMPLETED — INVENTORY ATTENTION: " + inventoryWarnings : "Sale completed successfully."); setCheckoutOpen(false); setMoreOpen(false);
    } catch (error: any) { setMessage(error?.message || "Unable to complete checkout."); }
    finally { setSaving(false); }
  };

  if (authLoading && !user) return <main className="wise-auth"><div className="wise-auth-card"><div className="wise-logo">W</div><h1>WISE POS</h1><p>Loading your workspace...</p></div></main>;
  if (!user) return <main className="wise-auth"><div className="wise-auth-card"><div className="wise-logo">W</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" onKeyDown={(e) => e.key === "Enter" && signIn()} />{authMessage && <div className="wise-error">{authMessage}</div>}<button className="wise-primary" onClick={signIn} disabled={authLoading || !email || !password}><LogIn size={17} /> {authLoading ? "SIGNING IN..." : "SIGN IN"}</button></div></main>;

  const discountLabel = discountType === "senior" ? "Senior" : discountType === "pwd" ? "PWD" : discountType === "athlete" ? "National Athlete" : discountType === "solo_parent" ? "Solo Parent" : discountType === "percentage" ? "Percentage" : discountType === "amount" ? "Amount" : "";
  const discountHint = discountType === "senior" || discountType === "pwd" ? "5% or 20% off" : discountType === "athlete" ? "20% off" : discountType === "solo_parent" ? "10% off" : discountType === "percentage" ? "% off item total" : discountType === "amount" ? "Fixed peso amount" : "";

  return <main className="app-shell"><Sidebar /><section className="wise-pos-page">
    <header className="wise-header"><div><div className="wise-eyebrow">POINT OF SALE</div><h1>WISE POS</h1><p>Smart point of sale for every business.</p></div><div className="wise-header-actions"><button type="button" className="wise-kitchen-open" onClick={() => window.open("/wise-kitchen","_blank","noopener,noreferrer")}><ChefHat size={17}/> Open WISE Kitchen <ExternalLink size={14}/></button><div className="wise-header-pill">GENERAL BUSINESS MODE</div></div></header>
    <div className="wise-layout"><section className="wise-catalog"><div className="wise-toolbar"><div className="wise-search"><Search size={18} /><input value={search} onChange={(e) => { setSearch(e.target.value); setProductPage(1); if (message) setMessage(""); }} placeholder="Search products or services..." /></div>{categories.length > 1 && <div className="wise-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setProductPage(1); setMessage(""); }}>{item}</button>)}</div>}</div>
      {message && <div className="wise-notice" role="alert"><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}
      {productsLoading ? <div className="wise-empty"><ShoppingCart size={34} /><strong>Loading products & services...</strong><span>WISE POS is loading the items enabled for checkout.</span></div> : filtered.length ? <div className="wise-product-grid">{visibleProducts.map((product) => <button className="wise-product" key={product.id} onClick={() => add(product)}>{product.image_url ? <img src={product.image_url} alt="" loading="lazy" decoding="async" /> : <div className="wise-product-letter">{product.name.charAt(0).toUpperCase()}</div>}<div className="wise-product-info"><strong>{product.name}</strong><span>{product.recipe_required ? "Recipe / Inventory Check Needed" : product.item_type === "service" ? "Service" : product.category}</span><b>{money(product.price)}{product.unit ? ` / ${product.unit}` : ""}</b></div><span className="wise-add">{product.recipe_required ? <span className="wise-product-warning-icon" title="Recipe or inventory setup needs attention">!</span> : <Plus size={16} />}</span></button>)}</div> : <div className="wise-empty"><ShoppingCart size={34} /><strong>No products or services are enabled for POS</strong><span>Go to Products & Services and turn on “Show in POS” for the items you want to sell.</span></div>}
    </section>
    <aside className="wise-cart"><div className="wise-cart-head"><div><strong>Current Sale</strong><span>{cart.length} item{cart.length === 1 ? "" : "s"}{wiseMenuOrderNo ? ` · ${wiseMenuOrderNo}` : ""}</span></div><button onClick={clear} disabled={!cart.length}><Trash2 size={17} /> Clear</button></div><div className="wise-cart-body" ref={cartBodyRef}>{cart.length ? cart.map((item) => <div className="wise-cart-item" key={item.id}><div className="wise-cart-item-main"><strong>{item.name}</strong><span>{money(item.price)} each</span></div><div className="wise-cart-item-actions"><div className="wise-cart-controls"><button aria-label="Decrease quantity" onClick={() => qty(item.id, -1)}><Minus size={13} /></button><b>{item.quantity}</b><button aria-label="Increase quantity" onClick={() => qty(item.id, 1)}><Plus size={13} /></button></div><div className="wise-item-order-type"><button type="button" className={(item.orderType || orderType)==="dine_in"?"active dine-in":""} onClick={()=>setItemOrderType(item.id,"dine_in")}>Dine-In</button><button type="button" className={(item.orderType || orderType)==="take_out"?"active take-out":""} onClick={()=>setItemOrderType(item.id,"take_out")}>Take-Out</button></div><strong className="wise-cart-line-total">{money(item.price * item.quantity)}</strong></div></div>) : <div className="wise-cart-empty"><ShoppingCart size={38} /><strong>Your cart is empty</strong><span>Select products or services to start a sale.</span></div>}</div><div className="wise-cart-footer">{cart.some((item) => item.recipe_required) && <div className="wise-inventory-reminder"><strong>⚠ Inventory / Recipe Reminder</strong><span>Some items in this sale have missing or incomplete recipe/inventory setup. Payment can still be processed. Please add or correct the recipe, ingredient mapping, units, or inventory after the sale.</span></div>}<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name (optional)" /><textarea className="wise-customer-instructions" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} placeholder="Additional instructions (e.g. less sweet, no ice, extra hot)" rows={2} maxLength={500} aria-label="Customer additional instructions" /><div className="wise-order-type"><span>Order Type</span><div><button type="button" className={orderType==="dine_in"?"active":""} onClick={()=>setAllItemOrderTypes("dine_in")}><span>🍽</span> Dine In</button><button type="button" className={orderType==="take_out"?"active":""} onClick={()=>setAllItemOrderTypes("take_out")}><span>🥡</span> Take Out</button></div></div><div className="wise-summary"><span>Subtotal</span><b>{money(subtotal)}</b><span>Discount</span><b>- {money(discountAmount)}</b><strong>Total</strong><strong>{money(total)}</strong></div><div className="wise-discount"><label>Discount</label><input ref={discountRef} id="wise-discount-input" type="number" min="0" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0.00" /></div><div className="wise-sale-footer-actions"><button className="wise-pending-button" disabled={!cart.length || saving} onClick={savePendingSale}><PauseCircle size={18}/> PENDING</button><button className="wise-checkout" disabled={!cart.length} onClick={openCheckout}><ReceiptText size={19} /> CHECKOUT <span>{money(total)}</span></button></div></div></aside>
    <nav className="wise-quick-actions" aria-label="POS quick actions">
      <button type="button" className="wise-quick-action" onClick={focusDiscount} title="Apply discount"><Percent size={21} /><span>Discount</span></button>
      <button type="button" className="wise-quick-action" onClick={openOrders} title="View orders"><ClipboardList size={21} /><span>Orders</span></button>\n      <button type="button" className="wise-quick-action" onClick={() => setPendingOpen(true)} title="View pending sales"><PauseCircle size={21} /><span>Pending ({pendingSales.length})</span></button>
      <button type="button" className="wise-quick-action wise-quick-action-active" onClick={() => setShiftOpen(true)} title="View current shift"><Clock3 size={21} /><span>Shift</span></button>
      <button type="button" className="wise-quick-action" onClick={clear} disabled={!cart.length} title="Clear current sale"><Eraser size={21} /><span>Clear</span></button>
      <button type="button" className="wise-quick-action" onClick={() => { setPrinterOpen(true); void scanReceiptPrinters(false); }} title="Detect receipt printer"><Printer size={21} /><span>Printer</span></button>
      
      <button type="button" className="wise-quick-action" onClick={openSettings} title="Open POS settings"><Settings2 size={21} /><span>Settings</span></button>
      <button type="button" className="wise-quick-action" onClick={() => window.location.reload()} title="Refresh POS"><RefreshCw size={21} /><span>Refresh</span></button>
    </nav></div>

    {pendingOpen && <div className="wise-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingOpen(false); }}><div className="wise-modal wise-pending-modal"><div className="wise-modal-head"><div><strong>Pending Sales</strong><span>Saved carts waiting to be resumed</span></div><button onClick={() => setPendingOpen(false)}><X size={20}/></button></div><div className="wise-pending-list">{pendingSales.length ? pendingSales.map((draft) => <article key={draft.id} className="wise-pending-card"><div><strong>{draft.customer || "Walk-in Customer"}</strong><span>{draft.cart.length} item types · {new Date(draft.savedAt).toLocaleString()}</span><b>{money(draft.cart.reduce((sum,item)=>sum+item.price*item.quantity,0)-draft.discount)}</b></div><button type="button" onClick={() => resumePendingSale(draft)}><Play size={15}/> Resume</button><button type="button" className="wise-pending-remove" onClick={() => removePendingSale(draft.id)}><Trash2 size={15}/></button></article>) : <div className="wise-empty"><PauseCircle size={30}/><strong>No pending sales</strong><span>Use the PENDING button in Current Sale to save a cart.</span></div>}</div></div></div>}\n    {printerOpen && <div className="wise-printer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPrinterOpen(false); }}>
      <div className="wise-printer-modal">
        <div className="wise-printer-head">
          <div className="wise-printer-title-row"><Printer size={27} /><h2>Receipt Printer</h2></div>
          <button className="wise-printer-close" type="button" onClick={() => setPrinterOpen(false)} aria-label="Close"><X size={20} /></button>
          <p>Detect and connect a receipt printer for WISE POS.</p>
        </div>
        <div className="wise-printer-tabs">
          <button type="button" className="active"><Printer size={17} />Receipt Printer</button>
          <button type="button" onClick={() => window.print()}><ReceiptText size={17} />Browser Print</button>
        </div>
        <div className="wise-printer-status-card">
          <div className="wise-printer-status-label">PRINTER STATUS</div>
          <div className={`wise-printer-status ${printerConnected ? "connected" : ""}`}><span className="wise-printer-status-dot" />{printerConnected ? "Connected" : printerScanning ? "Checking..." : "Not Connected"}</div>
          <p>{printerConnected ? <><strong>{printerName}</strong><br /><span>{printerType} printer detected and available to this browser.</span></> : <>WISE POS can detect USB/Serial receipt printers that the browser has permission to access. Windows-installed/network printers may not appear here.</>}</p>
          <div className="wise-printer-guide"><span>Tip: Use Chrome or Edge over HTTPS for USB/Serial detection.</span></div>
          <button className="wise-printer-scan" type="button" onClick={() => void scanReceiptPrinters(true)} disabled={printerScanning}><RefreshCw size={18} className={printerScanning ? "wise-spin" : ""} />{printerScanning ? "DETECTING PRINTER..." : printerConnected ? "SCAN AGAIN" : "DETECT / CONNECT PRINTER"}</button>
          <button className="wise-printer-test" type="button" disabled={!printerConnected} onClick={() => window.print()}><Printer size={17} />TEST PRINT</button>
          <div className="wise-receipt-alignment-settings">
            <div className="wise-printer-status-label">RECEIPT ALIGNMENT</div>
            <p>Adjust the printed content to match your 80mm paper. Changes save automatically on this browser.</p>
            <label>Horizontal position <strong>{receiptAlignment > 0 ? "+" : ""}{receiptAlignment} mm</strong><input type="range" min={-5} max={5} step={0.5} value={receiptAlignment} onChange={(e) => saveReceiptAlignment(Number(e.target.value), receiptContentWidth)} /><span className="wise-alignment-hint">Move left (−) or right (+)</span></label>
            <label>Receipt content width <strong>{receiptContentWidth} mm</strong><input type="range" min={60} max={76} step={1} value={receiptContentWidth} onChange={(e) => saveReceiptAlignment(receiptAlignment, Number(e.target.value))} /><span className="wise-alignment-hint">Narrower content gives more side margin</span></label>
            <button type="button" className="wise-printer-scan" onClick={() => saveReceiptAlignment(0,72)}>RESET ALIGNMENT</button>
          </div>
        </div>
      </div>
    </div>}

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

    {checkoutOpen && <div className="wise-modal-backdrop"><div className="wise-modal"><div className="wise-modal-head"><div><strong>{wiseMenuOrderId ? "Complete WISE MENU Sale" : "Complete Sale"}</strong><span>{wiseMenuOrderId ? `POS payment for ${wiseMenuOrderNo}` : "WISE POS"}</span></div><button onClick={() => !saving && setCheckoutOpen(false)}><X size={20} /></button></div><div className="wise-modal-content"><div className="wise-total-card"><span>Total to collect</span><strong>{money(total)}</strong></div><label htmlFor="wise-checkout-customer">Customer name <em>(required)</em></label><input id="wise-checkout-customer" className="wise-tendered" type="text" autoComplete="name" value={customer} onChange={(e) => { setCustomer(e.target.value); setMessage(""); }} placeholder="Enter customer’s full name" required aria-required="true" />{message && <div className="wise-checkout-error" role="alert">{message}</div>}<label>Payment method</label><div className="wise-payment-grid">{payments.map(({ key, icon: Icon }) => <button key={key} className={payment === key ? "active" : ""} onClick={() => { setPayment(key); if (key !== "Cash") setTendered(total); }}><Icon size={18} />{key}</button>)}</div>{payment === "Cash" && <><label>Amount received</label><input className="wise-tendered" type="number" min={total} value={tendered || ""} onChange={(e) => { setTendered(Number(e.target.value) || 0); setMessage(""); }} placeholder={money(total)} /><div className="wise-change"><span>Change</span><strong>{money(change)}</strong></div></>}</div><div className="wise-modal-actions"><button className="wise-secondary" onClick={() => setCheckoutOpen(false)} disabled={saving}>Cancel</button><button className="wise-primary" onClick={checkout} disabled={saving || !customer.trim() || (payment === "Cash" && Math.round(Number(tendered) * 100) < Math.round(Number(total) * 100))}>{saving ? "PROCESSING..." : `COMPLETE SALE · ${money(total)}`}</button></div></div></div>}

    {kitchenPromptOpen && receipt && <div role="dialog" aria-modal="true" aria-labelledby="wise-kitchen-prompt-title" style={{position:"fixed",right:24,bottom:24,zIndex:10000,width:"min(360px,calc(100vw - 32px))",background:"#fff",color:"#111",borderRadius:18,boxShadow:"0 18px 60px rgba(0,0,0,.28)",border:"1px solid #e5e7eb",padding:22}}>
      <button type="button" aria-label="Close kitchen receipt prompt" onClick={() => setKitchenPromptOpen(false)} style={{position:"absolute",right:12,top:12,border:0,background:"transparent",fontSize:22,cursor:"pointer",color:"#6b7280"}}>×</button>
      <div style={{width:46,height:46,borderRadius:14,background:"#fff7ed",color:"#c2410c",display:"grid",placeItems:"center",marginBottom:12}}><ChefHat size={25}/></div>
      <h2 id="wise-kitchen-prompt-title" style={{fontSize:18,fontWeight:800,margin:"0 24px 6px 0"}}>Customer receipt printed?</h2>
      <p style={{fontSize:13,lineHeight:1.5,color:"#4b5563",margin:"0 0 16px"}}>Print the kitchen order for <strong>Order #{receipt.orderNo.replace(/^WISE-/, "S")}</strong> when you are ready.</p>
      <button type="button" onClick={() => { setKitchenPromptOpen(false); printReceipt(true); }} style={{width:"100%",minHeight:46,border:0,borderRadius:11,background:"#111827",color:"#fff",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:9,cursor:"pointer"}}><Printer size={18}/> PRINT KITCHEN RECEIPT</button>
      <button type="button" onClick={() => setKitchenPromptOpen(false)} style={{width:"100%",marginTop:8,minHeight:38,border:0,borderRadius:10,background:"#f3f4f6",color:"#374151",fontWeight:700,cursor:"pointer"}}>Not now</button>
    </div>}
    {receipt && <div className="wise-sale-complete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreOpen(false); }}>
      <div className="wise-sale-complete-page">
        <button className="wise-sale-back" type="button" onClick={() => setMoreOpen(false)} aria-label="Back"><ArrowLeft size={25} /></button>
        <div className="wise-sale-success-icon"><span>▣</span></div>
        <h2>Order Created!</h2>
        <p className="wise-sale-success-text">Order #{receipt.orderNo.replace(/^WISE-/, "S") } has been successfully created.</p>
        <div className="wise-sale-actions">
          <button type="button" onClick={() => printReceipt(false, true)}><Printer size={18} />Print Receipt <kbd className="wise-shortcut-key">P</kbd></button>
          <button type="button" onClick={() => printReceipt(true)}><ReceiptText size={18} />Print Slip</button>
          <div className="wise-sale-more-wrap"><button type="button" onClick={() => setMoreOpen((open) => !open)}>More <ChevronDown size={17} className={moreOpen ? "wise-more-open" : ""} /></button>{moreOpen && <div className="wise-sale-more-menu"><button type="button" onClick={finishNewSale}>New Sale <kbd className="wise-shortcut-key">N</kbd></button><button type="button" onClick={() => printReceipt(false, false)}>Print Receipt Again</button></div>}</div>
        </div>
        <article className="wise-sale-receipt">
          <h3>Espacio</h3>
          <div className="wise-sale-meta">
            <span>{new Date(receipt.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span>Order #: {receipt.orderNo}</span>
            <span>Payment: {receipt.payment}</span>
            <span>Customer: {receipt.customer || "Walk-in Customer"}</span>
          </div>
          <div className="wise-sale-items">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} {item.name}<small className="wise-receipt-order-type">{(item.orderType || "take_out") === "dine_in" ? "DINE-IN" : "TAKE-OUT"}</small></span><b>{money(item.price * item.quantity)}</b></div>)}</div>
          <div className="wise-sale-totals"><div><span>Items:</span><b>{receipt.items.reduce((sum, item) => sum + item.quantity, 0)}</b></div><div><span>Subtotal:</span><b>{money(receipt.subtotal)}</b></div><div className="wise-sale-grand"><strong>Total Amount:</strong><strong>{money(receipt.total)}</strong></div><div><span>Total Paid:</span><b>{money(receipt.amountPaid)}</b></div><div className="wise-sale-balance"><strong>{receipt.amountPaid >= receipt.total ? "Change:" : "Balance:"}</strong><strong>{money(receipt.amountPaid >= receipt.total ? receipt.change : receipt.total - receipt.amountPaid)}</strong></div></div>
          <footer>THANK YOU! COME AGAIN!</footer>
        </article>
      </div>
    </div>}
  </section></main>;
}