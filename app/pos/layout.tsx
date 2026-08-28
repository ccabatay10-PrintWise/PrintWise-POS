"use client";

import { useEffect } from "react";

const CHECKOUT_TOTAL_KEY = "printwise_pos_last_checkout_total";

function readMoney(value: string | null | undefined) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export default function POSLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const getCheckoutTotal = () => {
      const saved = Number(sessionStorage.getItem(CHECKOUT_TOTAL_KEY) || 0);
      return Number.isFinite(saved) ? saved : 0;
    };

    const captureCheckoutTotal = () => {
      const displayedTotal = readMoney(document.querySelector(".total-row b")?.textContent);
      const tendered = readMoney((document.querySelector(".tendered input") as HTMLInputElement | null)?.value);
      const amount = displayedTotal > 0 ? displayedTotal : tendered;
      if (amount > 0) sessionStorage.setItem(CHECKOUT_TOTAL_KEY, String(amount));
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
        const checkoutTotal = getCheckoutTotal();

        if (method === "POST" && checkoutTotal > 0 && init?.body && /\/rest\/v1\/(pos_orders|payment_transactions)(?:\?|$)/.test(url)) {
          const bodyText = typeof init.body === "string" ? init.body : null;
          if (bodyText) {
            const parsed = JSON.parse(bodyText);
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            const isOrder = /\/rest\/v1\/pos_orders(?:\?|$)/.test(url);
            const fixed = rows.map((row: any) => {
              if (!row || typeof row !== "object") return row;
              const next = { ...row };
              if (isOrder) {
                if (Number(next.total || 0) <= 0) next.total = checkoutTotal;
                if (Number(next.amount_paid || 0) <= 0) next.amount_paid = checkoutTotal;
                if (Number(next.subtotal || 0) <= 0) next.subtotal = checkoutTotal;
                if (Number(next.balance || 0) < 0) next.balance = 0;
              } else if (Number(next.amount || 0) <= 0) {
                next.amount = checkoutTotal;
              }
              return next;
            });
            const nextBody = Array.isArray(parsed) ? fixed : fixed[0];
            return originalFetch(input, { ...init, body: JSON.stringify(nextBody) });
          }
        }
      } catch {
        // Keep the original POS request untouched if the safety fallback cannot inspect it.
      }
      return originalFetch(input, init);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const processButton = target.closest(".process-btn") as HTMLButtonElement | null;
      if (processButton) captureCheckoutTotal();

      const button = target.closest(".nav-item") as HTMLAnchorElement | null;
      if (!button) return;
      const label = button.textContent?.trim();
      const routeMap: Record<string,string> = {
        Dashboard: "/dashboard",
        Orders: "/orders",
        "GCash / Bayad": "/gcash-bayad",
        "Products & Services": "/products",
        Customers: "/customers",
        Inventory: "/inventory",
        Reports: "/reports",
        "Project Costing": "/project-costing"
      };
      const route = routeMap[label || ""];
      if (route) {
        event.preventDefault();
        window.location.href = route;
      }
    };

    const fixReceiptAmounts = () => {
      const checkoutTotal = getCheckoutTotal();
      if (checkoutTotal <= 0) return;

      const choiceTotal = document.querySelector(".receipt-choice-total strong");
      if (choiceTotal && readMoney(choiceTotal.textContent) <= 0) {
        choiceTotal.textContent = `₱${checkoutTotal.toFixed(2)}`;
      }

      const thermalRows = Array.from(document.querySelectorAll(".thermal-totals > div"));
      thermalRows.forEach((row) => {
        const label = row.querySelector("span")?.textContent?.trim().toLowerCase();
        const value = row.querySelector("b");
        if (value && (label === "total" || label === "amount paid") && readMoney(value.textContent) <= 0) {
          value.textContent = `₱${checkoutTotal.toFixed(2)}`;
        }
      });
    };

    const observer = new MutationObserver(fixReceiptAmounts);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return <>{children}</>;
}
