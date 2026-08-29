"use client";

import { useEffect } from "react";

export default function SmartPriceApprovalBridge() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest?.("button.use-price-btn") as HTMLButtonElement | null;
      if (!button || button.disabled) return;
      if (!window.location.pathname.includes("/received-files/") || !window.location.pathname.endsWith("/smart-pricing")) return;

      const parts = window.location.pathname.split("/").filter(Boolean);
      const receivedIndex = parts.indexOf("received-files");
      const jobId = receivedIndex >= 0 ? parts[receivedIndex + 1] : "";
      const fileId = new URLSearchParams(window.location.search).get("fileId") || "";
      const card = button.closest(".smart-card");
      const suggestedText = card?.querySelector(".suggested strong")?.textContent || "";
      const suggested = Number(suggestedText.replace(/[^0-9.]/g, ""));
      const copiesInput = card?.querySelector(".copies-field input") as HTMLInputElement | null;
      const copies = Math.max(1, Number(copiesInput?.value || 1));

      if (!jobId || !fileId || !Number.isFinite(suggested) || suggested <= 0) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      const params = new URLSearchParams({
        fileId,
        suggested: suggested.toFixed(2),
        copies: String(copies),
      });
      window.location.href = `/received-files/${jobId}/smart-pricing/approval?${params.toString()}`;
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
