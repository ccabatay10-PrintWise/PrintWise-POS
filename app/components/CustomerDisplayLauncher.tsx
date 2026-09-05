"use client";

import { useEffect, useRef } from "react";
import { Monitor } from "lucide-react";

type DisplayItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
};

type CustomerDisplayLauncherProps = {
  cart: DisplayItem[];
  customer: string;
  subtotal: number;
  discount: number;
  total: number;
};

type DisplayOrder = {
  items: DisplayItem[];
  customer: string;
  subtotal: number;
  discount: number;
  total: number;
  updatedAt: string;
  sourceId: string;
};

const STORAGE_KEY = "printwise_customer_display_order";
const CHANNEL_NAME = "printwise_customer_display";

export default function CustomerDisplayLauncher({
  cart,
  customer,
  subtotal,
  discount,
  total,
}: CustomerDisplayLauncherProps) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const orderRef = useRef<DisplayOrder | null>(null);
  const sourceIdRef = useRef("");

  useEffect(() => {
    sourceIdRef.current = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const order: DisplayOrder = {
      items: cart.map(({ id, name, price, quantity, image_url }) => ({ id, name, price, quantity, image_url })),
      customer: customer.trim(),
      subtotal,
      discount,
      total,
      updatedAt: new Date().toISOString(),
      sourceId: sourceIdRef.current,
    };

    orderRef.current = order;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      channelRef.current?.postMessage({ type: "order-update", order });
    } catch {
      // Customer display is an optional companion. Storage failures must never affect POS.
    }
  }, [cart, customer, subtotal, discount, total]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => {
      const order = orderRef.current;
      if (!order) return;

      const refreshed = { ...order, updatedAt: new Date().toISOString() };
      orderRef.current = refreshed;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refreshed));
        channelRef.current?.postMessage({ type: "order-update", order: refreshed });
      } catch {
        // Keep the POS independent from customer-display transport failures.
      }
    }, 5000);

    return () => window.clearInterval(heartbeat);
  }, []);

  const openDisplay = () => {
    try {
      const displayWindow = window.open(
        "/customer-display",
        "PrintWiseCustomerDisplay",
        "popup=yes,width=1280,height=800,resizable=yes,scrollbars=yes"
      );
      if (displayWindow) displayWindow.focus();
    } catch {
      // Ignore popup errors so the POS remains usable.
    }
  };

  return (
    <button
      className="icon-btn customer-display-launcher"
      onClick={openDisplay}
      title="Open Customer Display"
      aria-label="Open Customer Display"
    >
      <Monitor size={20} />
    </button>
  );
}
