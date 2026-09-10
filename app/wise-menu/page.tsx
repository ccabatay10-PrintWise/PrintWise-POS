"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Printer, QrCode, RefreshCw, ScanLine, Send, Smartphone, ChefHat } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Sidebar from "../components/Sidebar";
import "./wise-menu.css";

export default function WiseMenuPage() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const base = origin || "https://print-wise-pos.vercel.app";
  const menuUrl = `${base}/menu/order`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="wise-menu-shell">
      <Sidebar />
      <main className="wise-menu-main">
        <header className="wise-receiving-header">
          <div>
            <div className="wise-menu-kicker"><QrCode size={15} /> WISE MENU RECEIVING PORTAL</div>
            <h1>WISE MENU</h1>
            <p>One universal QR code for all customers. Scan, order, and send the order directly to WISE KITCHEN.</p>
          </div>
          <div className="wise-receiving-actions">
            <button type="button" onClick={() => window.location.reload()}><RefreshCw size={16} /> Refresh</button>
            <button type="button" onClick={() => window.print()}><Printer size={16} /> Print QR</button>
          </div>
        </header>

        <section className="receiving-hero">
          <div className="receiving-hero-icon"><ScanLine size={28} /></div>
          <div className="receiving-hero-copy">
            <span>UNIVERSAL CUSTOMER QR</span>
            <h2>One QR Code. One WISE MENU.</h2>
            <p>Use this single QR code anywhere customers need to order. No table-specific QR codes are required.</p>
          </div>
          <div className="receiving-flow">
            <div><QrCode size={18} /><b>SCAN</b><small>Universal QR</small></div>
            <Send size={16} />
            <div><Smartphone size={18} /><b>ORDER</b><small>Customer phone</small></div>
            <Send size={16} />
            <div><ChefHat size={18} /><b>RECEIVE</b><small>WISE KITCHEN</small></div>
          </div>
        </section>

        <section className="wise-universal-qr-wrap">
          <article className="wise-universal-qr-card">
            <div className="universal-label">WISE MENU</div>
            <h2>SCAN TO ORDER</h2>
            <p className="universal-subtitle">Use your phone camera to open the customer menu</p>

            <div className="universal-qr-box">
              <QRCodeSVG value={menuUrl} size={300} level="M" includeMargin />
            </div>

            <div className="universal-qr-badge"><QrCode size={14} /> UNIVERSAL QR CODE</div>

            <div className="universal-actions">
              <a href={menuUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open Menu</a>
              <button type="button" onClick={copyLink}><Copy size={15} /> {copied ? "Copied" : "Copy Link"}</button>
              <button type="button" onClick={() => window.print()}><Printer size={15} /> Print QR</button>
            </div>

            <div className="universal-url">{menuUrl}</div>
          </article>

          <aside className="wise-universal-info">
            <div className="info-kicker">HOW IT WORKS</div>
            <h3>Customer Ordering Flow</h3>
            <div className="info-step"><span>01</span><div><b>SCAN</b><small>Customer scans the same QR code.</small></div></div>
            <div className="info-step"><span>02</span><div><b>SELECT</b><small>Customer chooses products and quantities.</small></div></div>
            <div className="info-step"><span>03</span><div><b>SEND ORDER</b><small>Customer enters their details and submits.</small></div></div>
            <div className="info-step"><span>04</span><div><b>WISE KITCHEN</b><small>KOT receives the order and recipe details.</small></div></div>
            <div className="info-step"><span>05</span><div><b>WISE POS</b><small>Order and inventory workflow continue in the staff system.</small></div></div>
          </aside>
        </section>
      </main>
    </div>
  );
}
