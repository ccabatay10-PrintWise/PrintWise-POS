"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./qr.css";

export default function WiseMenuQrPage(){
  const [origin,setOrigin]=useState("");
  const [copied,setCopied]=useState(false);
  useEffect(()=>setOrigin(window.location.origin),[]);
  const base=origin||"https://print-wise-pos.vercel.app";
  const url=`${base}/menu/order`;
  const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1600)}catch{}};
  return <main className="wmqr"><header><div><div className="wmqr-kicker"><QrCode size={15}/> WISE MENU</div><h1>Universal QR Code</h1><p>One QR code for the entire WISE MENU customer ordering system.</p></div><button onClick={()=>window.print()}><Printer size={16}/> Print QR</button></header><div className="wmqr-flow"><b>SCAN</b><span>→</span><b>SELECT</b><span>→</span><b>REVIEW</b><span>→</span><b>SEND TO KITCHEN</b></div><section className="wmqr-single"><div className="wmqr-card"><div className="wmqr-code"><QRCodeSVG value={url} size={310} level="M" includeMargin/><span>SCAN TO ORDER</span></div><h2>WISE MENU</h2><p>UNIVERSAL CUSTOMER QR</p><div className="wmqr-actions"><a href={url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open Menu</a><button onClick={copy}><Copy size={14}/> {copied?"Copied":"Copy Link"}</button><button onClick={()=>window.print()}><Printer size={14}/> Print QR</button></div><div className="wmqr-url">{url}</div></div><aside><h3>ONE QR • ALL CUSTOMERS</h3><p>Place this QR code anywhere customers can see it. Every scan opens the same WISE MENU.</p><div className="wmqr-note"><b>Customer</b><span>Scan → Select → Customize → Send Order</span></div><div className="wmqr-note"><b>WISE KITCHEN</b><span>Receive KOT → Prepare → Ready</span></div><div className="wmqr-note"><b>WISE POS</b><span>Continue staff-side order and sales workflow</span></div></aside></section></main>;
}
