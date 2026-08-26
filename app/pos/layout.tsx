"use client";

import { useEffect } from "react";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest(".nav-item") as HTMLAnchorElement | null;
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
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
  return <>{children}</>;
}
