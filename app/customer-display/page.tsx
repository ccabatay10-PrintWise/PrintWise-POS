"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, ShoppingBag } from "lucide-react";
import "./customer-display.css";

type DisplayItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
};

type DisplayOrder = {
  items: DisplayItem[];
  customer: string;
  subtotal: number;
  discount: number;
  total: number;
  updatedAt: string;
  sourceId?: string;
};

const STORAGE_KEY = "printwise_customer_display_order";
const CHANNEL_NAME = "printwise_customer_display";
const STALE_AFTER_MS = 15000;

const emptyOrder: DisplayOrder = {
  items: [],
  customer: "",
  subtotal: 0,
  discount: 0,
  total: 0,
  updatedAt: "",
};

function normalizeOrder(value: unknown): DisplayOrder {
  if (!value || typeof value !== "object") return emptyOrder;
  const input = value as Partial<DisplayOrder>;
  const items = Array.isArray(input.items)
    ? input.items.map((item: any, index) => ({
        id: String(item?.id ?? `display-item-${index}`),
        name: String(item?.name ?? "Item"),
        price: Number(item?.price) || 0,
        quantity: Math.max(0, Number(item?.quantity) || 0),
        image_url: item?.image_url ? String(item.image_url) : null,
      })).filter((item) => item.quantity > 0)
    : [];

  return {
    items,
    customer: typeof input.customer === "string" ? input.customer : "",
    subtotal: Number(input.subtotal) || 0,
    discount: Number(input.discount) || 0,
    total: Number(input.total) || 0,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : "",
    sourceId: typeof input.sourceId === "string" ? input.sourceId : undefined,
  };
}

export default function CustomerDisplayPage() {
  const [order, setOrder] = useState<DisplayOrder>(emptyOrder);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const apply = (value: unknown) => {
      const next = normalizeOrder(value);
      setOrder(next);
      setConnected(Boolean(next.updatedAt) && Date.now() - new Date(next.updatedAt).getTime() < STALE_AFTER_MS);
    };

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) apply(JSON.parse(raw));
    } catch {
      // Ignore malformed or unavailable browser storage.
    }

    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    const receive = (event: MessageEvent) => {
      if (event.data?.type === "order-update") apply(event.data.order);
    };
    channel?.addEventListener("message", receive);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { apply(JSON.parse(event.newValue)); } catch {}
    };
    window.addEventListener("storage", onStorage);

    const healthTimer = window.setInterval(() => {
      setConnected((current) => {
        if (!order.updatedAt) return false;
        const fresh = Date.now() - new Date(order.updatedAt).getTime() < STALE_AFTER_MS;
        return fresh === current ? current : fresh;
      });
    }, 3000);

    return () => {
      channel?.removeEventListener("message", receive);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.clearInterval(healthTimer);
    };
  }, [order.updatedAt]);

  const itemCount = useMemo(() => order.items.reduce((sum, item) => sum + item.quantity, 0), [order.items]);

  return (
    <main className="customer-display-page">
      <header className="customer-display-header">
        <div className="customer-display-brand">
          <div className="customer-display-logo"><Monitor size={27} /></div>
          <div><strong>PRINTWISE</strong><span>Customer Display</span></div>
        </div>
        <div className={`customer-display-connection ${connected ? "online" : ""}`}>
          <span /> {connected ? "Connected to POS" : "Waiting for POS"}
        </div>
      </header>

      <section className="customer-display-content">
        {order.items.length === 0 ? (
          <div className="customer-display-empty">
            <div className="customer-display-empty-icon"><ShoppingBag size={54} /></div>
            <h1>Welcome to PrintWise</h1>
            <p>{connected ? "Your order will appear here." : "Open Customer Display from the POS to begin."}</p>
          </div>
        ) : (
          <>
            <div className="customer-display-title-row">
              <div><span>YOUR ORDER</span><h1>{order.customer || "Walk-in Customer"}</h1></div>
              <div className="customer-display-count">{itemCount} item{itemCount === 1 ? "" : "s"}</div>
            </div>

            <div className="customer-display-order-card">
              <div className="customer-display-items">
                {order.items.map((item, index) => (
                  <div className="customer-display-item" key={`${item.id}-${index}`}>
                    <div className="customer-display-item-main">
                      <div className="customer-display-item-image">
                        {item.image_url ? <img src={item.image_url} alt="" /> : <ShoppingBag size={25} />}
                      </div>
                      <div><strong>{item.name}</strong><span>{item.quantity} × ₱{item.price.toFixed(2)}</span></div>
                    </div>
                    <strong>₱{(item.price * item.quantity).toFixed(2)}</strong>
                  </div>
                ))}
              </div>

              <div className="customer-display-summary">
                <div><span>Subtotal</span><strong>₱{order.subtotal.toFixed(2)}</strong></div>
                {order.discount > 0 && <div><span>Discount</span><strong>-₱{order.discount.toFixed(2)}</strong></div>}
                <div className="customer-display-total"><span>AMOUNT DUE</span><strong>₱{order.total.toFixed(2)}</strong></div>
              </div>
            </div>
            <p className="customer-display-footer">Please review your order before payment.</p>
          </>
        )}
      </section>
    </main>
  );
}
