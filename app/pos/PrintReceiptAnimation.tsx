"use client";

import { useEffect } from "react";

/**
 * Adds the physical-printer visual feedback to the existing receipt print action
 * without changing the existing POS print implementation.
 */
export default function PrintReceiptAnimation() {
  useEffect(() => {
    const styleId = "wise-receipt-print-animation-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .wise-sale-receipt.wise-receipt-printing {
          position: relative;
          animation: wiseReceiptPrintOut 3.6s cubic-bezier(.22,.72,.18,1) forwards;
          transform-origin: 50% 100%;
          pointer-events: none;
          will-change: transform, opacity, filter;
        }

        @keyframes wiseReceiptPrintOut {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
            filter: blur(0);
          }
          18% {
            transform: translate3d(0, -5px, 0) scale(.998);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, -125vh, 0) scale(.84);
            opacity: 0;
            filter: blur(1px);
          }
        }

        .wise-sale-receipt.wise-receipt-printing::after {
          content: "";
          position: absolute;
          left: 7%;
          right: 7%;
          top: 0;
          height: 3px;
          border-radius: 0 0 4px 4px;
          background: rgba(255,255,255,.95);
          box-shadow: 0 0 12px rgba(255,255,255,.8);
          animation: wiseReceiptPaperFeed 3.6s ease-out forwards;
          pointer-events: none;
        }

        @keyframes wiseReceiptPaperFeed {
          0% { opacity: 0; transform: translateY(0); }
          18% { opacity: 1; transform: translateY(-2px); }
          100% { opacity: 0; transform: translateY(-30px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .wise-sale-receipt.wise-receipt-printing,
          .wise-sale-receipt.wise-receipt-printing::after {
            animation-duration: .15s;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const onPrintClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".wise-sale-actions button, .wise-sale-more-menu button") as HTMLButtonElement | null;
      if (!button) return;

      const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
      if (label !== "print receipt" && label !== "print receipt again") return;

      const receipt = document.querySelector<HTMLElement>(".wise-sale-receipt");
      if (!receipt) return;

      receipt.classList.remove("wise-receipt-printing");
      void receipt.offsetWidth;
      receipt.classList.add("wise-receipt-printing");

      // Open the printer window during the original user gesture so browser
      // popup protection does not block it. The existing printReceipt() then
      // reuses this named window and supplies the real receipt HTML.
      const printWindow = window.open("", "wise-print", "width=420,height=720");
      if (printWindow) {
        try {
          const nativePrint = printWindow.print.bind(printWindow);
          printWindow.print = () => {
            window.setTimeout(() => nativePrint(), 3000);
          };
        } catch {
          // If the browser prevents overriding print(), the normal print flow
          // still runs and the visual animation remains active.
        }
      }

      window.setTimeout(() => {
        receipt.classList.remove("wise-receipt-printing");
      }, 3700);
    };

    document.addEventListener("click", onPrintClick, true);
    return () => document.removeEventListener("click", onPrintClick, true);
  }, []);

  return null;
}
