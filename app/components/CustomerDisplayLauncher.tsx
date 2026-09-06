"use client";

import { useCallback, useEffect, useRef } from "react";
import { Monitor } from "lucide-react";

type DisplayItem = { id: string; name: string; price: number; quantity: number; image_url?: string | null };
type CustomerDisplayLauncherProps = { cart: DisplayItem[]; customer: string; subtotal: number; discount: number; total: number };
type DisplayOrder = { items: DisplayItem[]; customer: string; subtotal: number; discount: number; total: number; updatedAt: string; sourceId: string };
type ExtendedScreen = { left: number; top: number; width: number; height: number; isPrimary?: boolean };
type ScreenDetailsLike = { screens: ExtendedScreen[]; currentScreen?: ExtendedScreen; addEventListener?: (type: "screenschange", listener: () => void) => void; removeEventListener?: (type: "screenschange", listener: () => void) => void };

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetailsLike>;
    printwiseDesktop?: { isElectron: true; openCustomerDisplay: () => Promise<boolean>; closeCustomerDisplay: () => Promise<boolean> };
  }
}

const STORAGE_KEY = "printwise_customer_display_order";
const CHANNEL_NAME = "printwise_customer_display";
const DISPLAY_WINDOW_NAME = "PrintWiseCustomerDisplay";
const DISPLAY_WIDTH = 1280;
const DISPLAY_HEIGHT = 800;

export default function CustomerDisplayLauncher({ cart, customer, subtotal, discount, total }: CustomerDisplayLauncherProps) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const orderRef = useRef<DisplayOrder | null>(null);
  const sourceIdRef = useRef("");
  const displayWindowRef = useRef<Window | null>(null);
  const screenDetailsRef = useRef<ScreenDetailsLike | null>(null);

  useEffect(() => {
    sourceIdRef.current = `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    return () => { channel.close(); channelRef.current = null; };
  }, []);

  useEffect(() => {
    const order: DisplayOrder = {
      items: cart.map(({ id, name, price, quantity, image_url }) => ({ id, name, price, quantity, image_url })),
      customer: customer.trim(), subtotal, discount, total,
      updatedAt: new Date().toISOString(), sourceId: sourceIdRef.current,
    };
    orderRef.current = order;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
      channelRef.current?.postMessage({ type: "order-update", order });
    } catch {}
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
      } catch {}
    }, 5000);
    return () => window.clearInterval(heartbeat);
  }, []);

  const getExtendedScreen = useCallback(async (): Promise<ExtendedScreen | null> => {
    try {
      if (typeof window === "undefined" || typeof window.getScreenDetails !== "function") return null;
      const details = screenDetailsRef.current ?? await window.getScreenDetails();
      screenDetailsRef.current = details;
      const current = details.currentScreen;
      return details.screens.find((screen) => screen !== current && screen.width > 0 && screen.height > 0) ?? null;
    } catch { return null; }
  }, []);

  const maximizeDisplayWindow = useCallback((displayWindow: Window) => {
    try {
      if (displayWindow.closed) return;
      const target = screenDetailsRef.current?.screens.find((screen) => screen.width > 0 && screen.height > 0);
      if (target) {
        displayWindow.resizeTo(target.width, target.height);
        displayWindow.moveTo(target.left, target.top);
      } else {
        displayWindow.moveTo(0, 0);
        displayWindow.resizeTo(window.screen.availWidth, window.screen.availHeight);
      }
      displayWindow.focus();
    } catch {}
  }, []);

  const openDisplay = useCallback(async () => {
    if (window.printwiseDesktop?.isElectron) {
      await window.printwiseDesktop.openCustomerDisplay();
      return;
    }
    try {
      const target = await getExtendedScreen();
      const features = [
        "popup=yes",
        `width=${target?.width ?? DISPLAY_WIDTH}`,
        `height=${target?.height ?? DISPLAY_HEIGHT}`,
        "resizable=yes",
        "scrollbars=yes",
      ].join(",");
      const displayWindow = window.open("/customer-display", DISPLAY_WINDOW_NAME, features);
      if (!displayWindow) return;
      displayWindowRef.current = displayWindow;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      maximizeDisplayWindow(displayWindow);
    } catch {}
  }, [getExtendedScreen, maximizeDisplayWindow]);

  useEffect(() => {
    if (window.printwiseDesktop?.isElectron) return;
    let disposed = false;
    let retryTimer: number | undefined;
    const autoOpenAndMaximize = async () => {
      if (disposed || typeof window === "undefined") return;
      const target = await getExtendedScreen();
      if (!target) return;
      if (displayWindowRef.current && !displayWindowRef.current.closed) {
        maximizeDisplayWindow(displayWindowRef.current);
        return;
      }
      await openDisplay();
    };
    retryTimer = window.setTimeout(() => void autoOpenAndMaximize(), 800);
    const onScreensChange = () => void autoOpenAndMaximize();
    window.addEventListener("resize", onScreensChange);
    if (typeof window.getScreenDetails === "function") {
      void window.getScreenDetails().then((details) => {
        if (disposed) return;
        screenDetailsRef.current = details;
        details.addEventListener?.("screenschange", onScreensChange);
        void autoOpenAndMaximize();
      }).catch(() => undefined);
    }
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("resize", onScreensChange);
      screenDetailsRef.current?.removeEventListener?.("screenschange", onScreensChange);
    };
  }, [getExtendedScreen, maximizeDisplayWindow, openDisplay]);

  return (
    <button className="icon-btn customer-display-launcher" onClick={openDisplay} title="Open Customer Display" aria-label="Open Customer Display">
      <Monitor size={20} />
    </button>
  );
}
