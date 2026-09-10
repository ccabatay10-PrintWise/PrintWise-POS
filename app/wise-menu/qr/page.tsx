"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Printer, QrCode, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./qr.css";

export default function WiseMenuQrPage(){
  const [count,setCount]=useState(12); const [origin,setOrigin]=useState("");
  useEffect(()=>setOrigin(window.location.origin),[]);
  const base=origin||"https://print-wise-pos.vercel.app";
  const tables=useMemo(()=>Array.from({length:Math.max(1,Math.min(50,count))},(_,i)=>`Table ${String(i+1).padStart(2,"0")}`),[count]);
  const url=(table:string)=>`${base}/menu/order?table=${encodeURIComponent(table)}`;
  const copy=(table:string)=>navigator.clipboard?.writeText(url(table));
  return <main className="wmqr"><header><div><div className="wmqr-kicker"><QrCode size={15}/> WISE MENU</div><h1>Table QR Codes</h1><p>Customers scan the QR code beside their table to open the menu and send their order directly to the kitchen.</p></div><div className="wmqr-controls"><label>Tables <input type="number" min={1} max={50} value={count} onChange={e=>setCount(Number(e.target.value)||1)}/></label><button onClick={()=>window.print()}><Printer size={16}/> Print QR Codes</button></div></header><div className="wmqr-flow"><b>SCAN</b><span>→</span><b>SELECT</b><span>→</span><b>REVIEW</b><span>→</span><b>SEND TO KITCHEN</b></div><section className="wmqr-grid">{tables.map(table=><article className="wmqr-card" key={table}><div className="wmqr-code"><QRCodeSVG value={url(table)} size={180} level="M" includeMargin/><span>SCAN TO ORDER</span></div><h2>{table}</h2><p>WISE MENU</p><div className="wmqr-actions"><a href={url(table)} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open</a><button onClick={()=>copy(table)}><Copy size={14}/> Copy Link</button></div></article>)}</section></main>;
}
