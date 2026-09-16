"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

/** Adds receipt animation and shows the WISE MENU status QR on the customer receipt. */
export default function PrintReceiptAnimation() {
  const [receipt, setReceipt] = useState<HTMLElement | null>(null);
  const [orderNo, setOrderNo] = useState("");
  const qrHost = useRef<HTMLDivElement>(null);

  const readWiseMenuOrder = (element: HTMLElement | null) => {
    if (!element) return "";
    const meta = Array.from(element.querySelectorAll(".wise-sale-meta span")).map((el) => el.textContent?.trim() || "");
    const orderText = meta.find((text) => text.toLowerCase().startsWith("order #:")) || "";
    const value = orderText.replace(/^order\s*#:\s*/i, "").trim();
    return value.startsWith("WM-") ? value : "";
  };

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
        .wise-receipt-status-qr { margin:18px 0 2px; padding:14px 0 0; border-top:1px dashed #b8c3cf; text-align:center; font-family:Arial,sans-serif; color:#123b66; }
        .wise-receipt-status-qr .qr-title { font-size:10px; font-weight:800; letter-spacing:1px; }
        .wise-receipt-status-qr svg { width:30mm; height:30mm; display:block; margin:8px auto; shape-rendering:crispEdges; }
        .wise-receipt-status-qr .qr-order { font-size:10px; font-weight:700; }
        .wise-receipt-status-qr .qr-hint { font-size:8px; color:#667085; margin-top:3px; }
        @media (max-width:480px) { .wise-receipt-status-qr { margin-top:14px; padding-top:12px; } .wise-receipt-status-qr svg { width:110px; height:110px; } }
        @media (prefers-reduced-motion:reduce) { .wise-sale-receipt.wise-receipt-printing,.wise-sale-receipt.wise-receipt-printing::after{animation-duration:.15s} }
      `;
      document.head.appendChild(style);
    }

    const syncReceipt = () => {
      const element = document.querySelector<HTMLElement>(".wise-sale-receipt");
      setReceipt(element);
      setOrderNo(readWiseMenuOrder(element));
    };

    syncReceipt();
    const observer = new MutationObserver(syncReceipt);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setTimeout(syncReceipt, 100);
    window.setTimeout(syncReceipt, 500);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!orderNo || !receipt) return;
    // Keep a hidden QR source available for the print popup as a fallback.
    const value = `${window.location.origin}/menu/status?order=${encodeURIComponent(orderNo)}`;
    const host = qrHost.current;
    if (host) host.dataset.value = value;
  }, [orderNo, receipt]);

  useEffect(() => {
    const onPrintClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".wise-sale-actions button, .wise-sale-more-menu button") as HTMLButtonElement | null;
      if (!button) return;
      const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
      if (label !== "print receipt" && label !== "print receipt again") return;

      const currentReceipt = document.querySelector<HTMLElement>(".wise-sale-receipt");
      if (!currentReceipt) return;
      const currentOrderNo = readWiseMenuOrder(currentReceipt);

      // Only WISE MENU orders receive a customer status QR. Normal POS receipts keep the existing print flow.
      if (!currentOrderNo) {
        currentReceipt.classList.remove("wise-receipt-printing");
        void currentReceipt.offsetWidth;
        currentReceipt.classList.add("wise-receipt-printing");
        const printWindow = window.open("", "wise-print", "width=420,height=720");
        if (printWindow) {
          try {
            const nativePrint = printWindow.print.bind(printWindow);
            printWindow.print = () => window.setTimeout(() => nativePrint(), 3000);
          } catch {}
        }
        window.setTimeout(() => currentReceipt.classList.remove("wise-receipt-printing"), 3700);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      currentReceipt.classList.remove("wise-receipt-printing");
      void currentReceipt.offsetWidth;
      currentReceipt.classList.add("wise-receipt-printing");

      const printWindow = window.open("", "wise-print", "width=420,height=760");
      if (!printWindow) {
        window.setTimeout(() => currentReceipt.classList.remove("wise-receipt-printing"), 3700);
        return;
      }

      // The visible QR is already inside the receipt via the portal. Clone it exactly as shown on screen.
      const clone = currentReceipt.cloneNode(true) as HTMLElement;
      clone.classList.remove("wise-receipt-printing");
      const qrSvg = clone.querySelector(".wise-receipt-status-qr svg");
      if (qrSvg) {
        qrSvg.setAttribute("width", "30mm");
        qrSvg.setAttribute("height", "30mm");
      }

      printWindow.document.open();
      printWindow.document.write(`<html><head><title>RECEIPT ${currentOrderNo}</title><style>@page{size:72mm auto;margin:0}body{margin:0;padding:8mm 5mm;font-family:Arial,sans-serif;color:#111;background:#fff}.wise-sale-receipt{width:100%;box-sizing:border-box}.wise-sale-receipt h3{text-align:center;margin:0 0 8px}.wise-sale-meta{display:flex;flex-direction:column;gap:3px;font-size:11px}.wise-sale-items>div,.wise-sale-totals>div{display:flex;justify-content:space-between;gap:8px;margin:6px 0}.wise-sale-grand,.wise-sale-balance{font-weight:700}.wise-sale-receipt footer{display:block;text-align:center;margin-top:14px;font-size:11px}.wise-receipt-status-qr{margin:18px 0 2px;padding:14px 0 0;border-top:1px dashed #888;text-align:center;font-family:Arial,sans-serif;color:#111}.wise-receipt-status-qr .qr-title{font-size:10px;font-weight:800;letter-spacing:1px}.wise-receipt-status-qr svg{width:30mm;height:30mm;display:block;margin:8px auto;shape-rendering:crispEdges}.wise-receipt-status-qr .qr-order{font-size:10px;font-weight:700}.wise-receipt-status-qr .qr-hint{font-size:8px;color:#666;margin-top:3px}</style></head><body>${clone.outerHTML}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
      printWindow.document.close();

      window.setTimeout(() => currentReceipt.classList.remove("wise-receipt-printing"), 3700);
    };

    document.addEventListener("click", onPrintClick, true);
    return () => document.removeEventListener("click", onPrintClick, true);
  }, []);

  const statusUrl = orderNo ? `${typeof window !== "undefined" ? window.location.origin : ""}/menu/status?order=${encodeURIComponent(orderNo)}` : "";

  return (
    <>
      <div ref={qrHost} aria-hidden="true" style={{ position:"fixed", left:-10000, top:-10000, width:1, height:1, overflow:"hidden", pointerEvents:"none" }}>
        {statusUrl && <QRCodeSVG value={statusUrl} size={180} level="M" />}
      </div>
      {orderNo && receipt && createPortal(
        <div className="wise-receipt-status-qr">
          <div className="qr-title">ORDER STATUS</div>
          <QRCodeSVG value={statusUrl} size={180} level="M" />
          <div className="qr-order">{orderNo}</div>
          <div className="qr-hint">Scan to view your order status</div>
        </div>,
        receipt
      )}
    </>
  );
}
