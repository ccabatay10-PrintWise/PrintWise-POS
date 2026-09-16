"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/** Adds receipt animation and puts the WISE MENU status QR on printed receipts. */
export default function PrintReceiptAnimation() {
  const [qrValue, setQrValue] = useState("");
  const qrHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const styleId = "wise-receipt-print-animation-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .wise-sale-receipt.wise-receipt-printing { position:relative; animation:wiseReceiptPrintOut 3.6s cubic-bezier(.22,.72,.18,1) forwards; transform-origin:50% 100%; pointer-events:none; will-change:transform,opacity,filter; }
        @keyframes wiseReceiptPrintOut { 0%{transform:translate3d(0,0,0) scale(1);opacity:1;filter:blur(0)} 18%{transform:translate3d(0,-5px,0) scale(.998);opacity:1} 100%{transform:translate3d(0,-125vh,0) scale(.84);opacity:0;filter:blur(1px)} }
        .wise-sale-receipt.wise-receipt-printing::after { content:"";position:absolute;left:7%;right:7%;top:0;height:3px;border-radius:0 0 4px 4px;background:rgba(255,255,255,.95);box-shadow:0 0 12px rgba(255,255,255,.8);animation:wiseReceiptPaperFeed 3.6s ease-out forwards;pointer-events:none; }
        @keyframes wiseReceiptPaperFeed { 0%{opacity:0;transform:translateY(0)} 18%{opacity:1;transform:translateY(-2px)} 100%{opacity:0;transform:translateY(-30px)} }
        @media (prefers-reduced-motion:reduce) { .wise-sale-receipt.wise-receipt-printing,.wise-sale-receipt.wise-receipt-printing::after{animation-duration:.15s} }
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
      const meta = Array.from(receipt.querySelectorAll(".wise-sale-meta span")).map((el) => el.textContent?.trim() || "");
      const orderText = meta.find((text) => text.toLowerCase().startsWith("order #:")) || "";
      const orderNo = orderText.replace(/^order\s*#:\s*/i, "").trim();

      // Only WISE MENU orders receive a customer status QR. Normal POS receipts keep the existing print flow.
      if (!orderNo.startsWith("WM-")) {
        receipt.classList.remove("wise-receipt-printing");
        void receipt.offsetWidth;
        receipt.classList.add("wise-receipt-printing");
        const printWindow = window.open("", "wise-print", "width=420,height=720");
        if (printWindow) {
          try {
            const nativePrint = printWindow.print.bind(printWindow);
            printWindow.print = () => window.setTimeout(() => nativePrint(), 3000);
          } catch {}
        }
        window.setTimeout(() => receipt.classList.remove("wise-receipt-printing"), 3700);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      receipt.classList.remove("wise-receipt-printing");
      void receipt.offsetWidth;
      receipt.classList.add("wise-receipt-printing");

      // Open immediately from the user gesture, then populate the QR after React renders it.
      const printWindow = window.open("", "wise-print", "width=420,height=760");
      if (!printWindow) {
        window.setTimeout(() => receipt.classList.remove("wise-receipt-printing"), 3700);
        return;
      }

      setQrValue(`${window.location.origin}/menu/status?order=${encodeURIComponent(orderNo)}`);
      window.setTimeout(() => {
        const svg = qrHost.current?.querySelector("svg")?.outerHTML || "";
        const clone = receipt.cloneNode(true) as HTMLElement;
        clone.classList.remove("wise-receipt-printing");
        const qr = `<div class="wise-print-qr"><div class="qr-title">ORDER STATUS</div>${svg}<div class="qr-order">${orderNo}</div><div class="qr-hint">Scan to view your order status</div></div>`;
        clone.insertAdjacentHTML("beforeend", qr);
        printWindow.document.open();
        printWindow.document.write(`<html><head><title>RECEIPT ${orderNo}</title><style>@page{size:72mm auto;margin:0}body{margin:0;padding:8mm 5mm;font-family:Arial,sans-serif;color:#111;background:#fff}.wise-sale-receipt{width:100%;box-sizing:border-box}.wise-sale-receipt h3{text-align:center;margin:0 0 8px}.wise-sale-meta{display:flex;flex-direction:column;gap:3px;font-size:11px}.wise-sale-items>div,.wise-sale-totals>div{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.wise-sale-grand,.wise-sale-balance{font-weight:700}.wise-sale-receipt footer{display:block;text-align:center;margin-top:14px;font-size:11px}.wise-print-qr{margin:16px auto 0;padding-top:12px;border-top:1px dashed #888;text-align:center}.wise-print-qr svg{width:30mm;height:30mm;display:block;margin:7px auto}.qr-title{font-size:10px;font-weight:800;letter-spacing:1px}.qr-order{font-size:10px;font-weight:700}.qr-hint{font-size:8px;color:#666;margin-top:3px}</style></head><body>${clone.outerHTML}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
        printWindow.document.close();
      }, 80);

      window.setTimeout(() => {
        receipt.classList.remove("wise-receipt-printing");
        setQrValue("");
      }, 3700);
    };

    document.addEventListener("click", onPrintClick, true);
    return () => document.removeEventListener("click", onPrintClick, true);
  }, []);

  return <div ref={qrHost} aria-hidden="true" style={{ position:"fixed", left:-10000, top:-10000, width:1, height:1, overflow:"hidden", pointerEvents:"none" }}>{qrValue && <QRCodeSVG value={qrValue} size={180} level="M" />}</div>;
}
