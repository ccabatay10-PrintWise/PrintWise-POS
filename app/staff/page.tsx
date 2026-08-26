"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ReceiptText, ShoppingCart, Users, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function StaffPage() {
  const router = useRouter();
  const [name, setName] = useState("Staff");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) {
        router.replace("/pos");
        return;
      }

      const role = user.app_metadata?.role || user.user_metadata?.role;
      if (role !== "staff") {
        router.replace("/dashboard");
        return;
      }

      setName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Staff");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/pos");
  };

  const cards = [
    { href: "/pos", icon: ShoppingCart, title: "Point of Sale", text: "Create and process customer orders." },
    { href: "/orders", icon: ReceiptText, title: "Orders", text: "View and manage order records." },
    { href: "/gcash-bayad", icon: Wallet, title: "GCash / Bayad", text: "Process and record payment transactions." },
    { href: "/customers", icon: Users, title: "Customers", text: "Access customer information." },
  ];

  if (loading) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6fb", color: "#26364b", fontWeight: 700 }}>Loading Staff Portal...</main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fb", color: "#26364b", padding: "28px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(135deg,#1f365d,#38578a)", color: "white", borderRadius: 24, padding: "34px", display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", boxShadow: "0 18px 45px rgba(25,52,90,.18)" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 800, opacity: .8 }}>PRINTWISE STAFF PORTAL</div>
            <h1 style={{ margin: "10px 0 6px", fontSize: 32 }}>Welcome, {name}</h1>
            <p style={{ margin: 0, opacity: .82 }}>Use your assigned tools to process daily PrintWise transactions.</p>
          </div>
          <button onClick={signOut} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><LogOut size={18}/> SIGN OUT</button>
        </header>

        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
          {cards.map(({ href, icon: Icon, title, text }) => (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              style={{ textAlign: "left", color: "inherit", background: "white", border: "1px solid #e2e7ef", borderRadius: 20, padding: 24, boxShadow: "0 8px 25px rgba(31,54,93,.07)", cursor: "pointer", font: "inherit" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#eef3fb", display: "grid", placeItems: "center", marginBottom: 18 }}><Icon size={23}/></div>
              <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{title}</h2>
              <p style={{ margin: 0, color: "#6d7a8d", lineHeight: 1.5 }}>{text}</p>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, background: "#fff4f2", border: "1px solid #ffd8d1", borderRadius: 16, padding: "16px 18px", color: "#9d3023" }}>
          <b>Staff Access:</b> Your account is restricted from Admin Dashboard, Staff Management, Products, Inventory, and Reports.
        </div>
      </section>
    </main>
  );
}
