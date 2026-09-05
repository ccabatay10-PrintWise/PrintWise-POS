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
};

const emptyOrder: DisplayOrder = {
  items: [],
  customer: "",
  subtotal: 0,
  discount: 0,
  total: 0,
  updatedAt: "",
};

export default function CustomerDisplayPage() {
  const [order, setOrder] = useState<DisplayOrder>(emptyOrder);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("printwise_customer_display_order");
        if (raw) setOrder({ ...emptyOrder, ...JSON.parse(raw) });
      } catch {}
    };

    load();
    setConnected(true);

    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("printwise_customer_display") : null;
    const receive = (event: MessageEvent) => {
      if (event.data?.type === "order-update" && event.data.order) {
        setOrder({ ...emptyOrder, ...event.data.order });
      }
    };
    channel?.addEventListener("message", receive);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "printwise_customer_display_order" || !event.newValue) return;
      try { setOrder({ ...emptyOrder, ...JSON.parse(event.newValue) }); } catch {}
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.removeEventListener("message", receive);
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const itemCount = useMemo(() => order.items.reduce((sum, item) => sum + item.quantity, 0), [order.items]);

  return (
    <main className="customer-display-page">
      <header className="customer-display-header">
        <div className="customer-display-brand">
          <div className="customer-display-logo"><Monitor size={27} /></div>
          <div><strong>PRINTWISE</strong><span>Customer Display</span></div>
        </div>
        <div className={`customer-display-connection ${connected ? "online" : ""}`}><span /> {connected ? "Connected to POS" : "Waiting for POS"}</div>
      </header>

      <section className="customer-display-content">
        {order.items.length === 0 ? (
          <div className="customer-display-empty">
            <div className="customer-display-empty-icon"><ShoppingBag size={54} /></div>
            <h1>Welcome to PrintWise</h1>
            <p>Your order will appear here.</p>
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
