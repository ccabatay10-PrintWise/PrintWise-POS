"use client";

import { useCallback, useEffect, useRef } from "react";
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

type ExtendedScreen = {
  left: number;
  top: number;
  width: number;
  height: number;
  isPrimary?: boolean;
};

type ScreenDetailsLike = {
  screens: ExtendedScreen[];
  currentScreen?: ExtendedScreen;
  addEventListener?: (type: "screenschange", listener: () => void) => void;
  removeEventListener?: (type: "screenschange", listener: () => void) => void;
};

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetailsLike>;
  }
}

const STORAGE_KEY = "printwise_customer_display_order";
const CHANNEL_NAME = "printwise_customer_display";
const DISPLAY_WINDOW_NAME = "PrintWiseCustomerDisplay";
const DISPLAY_WIDTH = 1280;
const DISPLAY_HEIGHT = 800;

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
  const displayWindowRef = useRef<Window | null>(null);
  const screenDetailsRef = useRef<ScreenDetailsLike | null>(null);

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

  const getExtendedScreen = useCallback(async (): Promise<ExtendedScreen | null> => {
    try {
      if (typeof window === "undefined") return null;

      // Modern Chromium browsers expose the Window Management API. It lets
      // PrintWise identify the physical screen that is not the POS screen.
      if (typeof window.getScreenDetails === "function") {
        const details = screenDetailsRef.current ?? await window.getScreenDetails();
        screenDetailsRef.current = details;

        const current = details.currentScreen;
        const secondary = details.screens.find((screen) => {
          if (screen === current) return false;
          if (screen.isPrimary === true) return false;
          return screen.width > 0 && screen.height > 0;
        });

        if (secondary) return secondary;

        const nonPrimary = details.screens.find(
          (screen) => screen.isPrimary !== true && screen.width > 0 && screen.height > 0
        );
        if (nonPrimary) return nonPrimary;
      }

      // Fallback: screen.isExtended is useful even when detailed screen
      // enumeration is unavailable. In that case we cannot safely determine
      // the secondary monitor's coordinates, so let the browser choose them.
      if ("isExtended" in window.screen && window.screen.isExtended) return null;
    } catch {
      // Permission denied / unsupported browser: retain normal popup behavior.
    }

    return null;
  }, []);

  const positionDisplayWindow = useCallback(async (displayWindow: Window) => {
    try {
      const target = await getExtendedScreen();
      if (!target || displayWindow.closed) return;

      const width = Math.min(DISPLAY_WIDTH, target.width);
      const height = Math.min(DISPLAY_HEIGHT, target.height);
      const left = target.left + Math.max(0, Math.round((target.width - width) / 2));
      const top = target.top + Math.max(0, Math.round((target.height - height) / 2));

      displayWindow.resizeTo(width, height);
      displayWindow.moveTo(left, top);
      displayWindow.focus();
    } catch {
      // Browser window-management restrictions must never interrupt POS use.
    }
  }, [getExtendedScreen]);

  const openDisplay = useCallback(async () => {
    try {
      const target = await getExtendedScreen();
      const features = [
        "popup=yes",
        `width=${target ? Math.min(DISPLAY_WIDTH, target.width) : DISPLAY_WIDTH}`,
        `height=${target ? Math.min(DISPLAY_HEIGHT, target.height) : DISPLAY_HEIGHT}`,
        "resizable=yes",
        "scrollbars=yes",
      ].join(",");

      const displayWindow = window.open("/customer-display", DISPLAY_WINDOW_NAME, features);
      if (!displayWindow) return;

      displayWindowRef.current = displayWindow;
      await positionDisplayWindow(displayWindow);
      displayWindow.focus();
    } catch {
      // Ignore popup errors so the POS remains usable.
    }
  }, [getExtendedScreen, positionDisplayWindow]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;

    const autoOpenOnExtendedMonitor = async () => {
      if (disposed || typeof window === "undefined") return;

      try {
        const hasMultipleScreens = "isExtended" in window.screen && window.screen.isExtended;
        if (!hasMultipleScreens && typeof window.getScreenDetails !== "function") return;

        // Do not create a duplicate customer-display window.
        if (displayWindowRef.current && !displayWindowRef.current.closed) {
          await positionDisplayWindow(displayWindowRef.current);
          return;
        }

        // This is intentionally automatic. If the browser blocks an automatic
        // popup, the existing monitor button remains available as the fallback.
        await openDisplay();
      } catch {
        // Popup blocking or unsupported window management is non-fatal.
      }
    };

    // Give the POS a moment to finish mounting before attempting the companion
    // window, while keeping the existing manual button untouched.
    retryTimer = window.setTimeout(() => void autoOpenOnExtendedMonitor(), 800);

    const onScreensChange = () => {
      void autoOpenOnExtendedMonitor();
    };

    window.addEventListener("resize", onScreensChange);

    if (typeof window.getScreenDetails === "function") {
      void window.getScreenDetails().then((details) => {
        if (disposed) return;
        screenDetailsRef.current = details;
        details.addEventListener?.("screenschange", onScreensChange);
      }).catch(() => {
        // Window Management permission is optional.
      });
    }

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener("resize", onScreensChange);
      screenDetailsRef.current?.removeEventListener?.("screenschange", onScreensChange);
    };
  }, [openDisplay, positionDisplayWindow]);

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
