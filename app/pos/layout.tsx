"use client";

import { useEffect } from "react";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest(".nav-item") as HTMLButtonElement | null;
      if (!button) return;
      const label = button.textContent?.trim();
      if (label === "Orders") {
        event.preventDefault();
        window.location.href = "/orders";
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
  return <>{children}</>;
}
