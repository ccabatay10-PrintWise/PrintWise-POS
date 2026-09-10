"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Printer, QrCode, RefreshCw, ScanLine, Send, Smartphone, Table2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Sidebar from "../components/Sidebar";
import "./wise-menu.css";

export default function WiseMenuPage() {
  const [count, setCount] = useState(12);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const base = origin || "https://print-wise-pos.vercel.app";
  const tables = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(50, count || 1)) }, (_, i) => `Table ${String(i + 1).padStart(2, "0")}`),
    [count]
  );
  const menuUrl = (table: string) => `${base}/menu/order?table=${encodeURIComponent(table)}`;

  const copyLink = async (table: string) => {
    try {
      await navigator.clipboard.writeText(menuUrl(table));
      setCopied(table);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
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
            <p>Generate table QR codes for customers to scan and open the digital menu on their phone.</p>
          </div>
          <div className="wise-receiving-actions">
            <button type="button" onClick={() => window.print()}><Printer size={16} /> Print QR Codes</button>
            <a href="/wise-menu/qr"><QrCode size={16} /> QR Manager</a>
          </div>
        </header>

        <section className="receiving-hero">
          <div className="receiving-hero-icon"><ScanLine size={28} /></div>
          <div className="receiving-hero-copy">
            <span>RECEIVING PORTAL</span>
            <h2>Generate & Manage Customer QR Codes</h2>
            <p>Each table gets a unique QR code. Customers scan it using their phone camera, place their order, and the order is received by WISE KITCHEN for preparation.</p>
          </div>
          <div className="receiving-flow">
            <div><QrCode size={18} /><b>SCAN</b><small>Table QR</small></div>
            <Send size={16} />
            <div><Smartphone size={18} /><b>ORDER</b><small>Customer phone</small></div>
            <Send size={16} />
            <div><Table2 size={18} /><b>RECEIVE</b><small>WISE KITCHEN</small></div>
          </div>
        </section>

        <section className="receiving-toolbar">
          <div>
            <span>TABLE QR GENERATOR</span>
            <h2>Customer Ordering QR Codes</h2>
            <p>Set the number of table QR codes, then print and place one at each table.</p>
          </div>
          <div className="qr-count-control">
            <label htmlFor="table-count">Number of tables</label>
            <input id="table-count" type="number" min={1} max={50} value={count} onChange={e => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            <button type="button" onClick={() => setCount(12)} title="Reset to 12 tables"><RefreshCw size={15} /></button>
          </div>
        </section>

        <section className="wmqr-grid receiving-grid">
          {tables.map(table => (
            <article className="wmqr-card" key={table}>
              <div className="wmqr-code">
                <QRCodeSVG value={menuUrl(table)} size={180} level="M" includeMargin />
                <span>SCAN TO ORDER</span>
              </div>
              <h2>{table}</h2>
              <p>WISE MENU</p>
              <div className="wmqr-actions">
                <a href={menuUrl(table)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>
                <button type="button" onClick={() => copyLink(table)}><Copy size={14} /> {copied === table ? "Copied" : "Copy Link"}</button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
