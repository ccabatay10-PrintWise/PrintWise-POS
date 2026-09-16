"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChefHat,
  Clock3,
  LogOut,
  ReceiptText,
  ShoppingCart,
  Users,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./staff.css";

const cards = [
  { href: "/pos", icon: ShoppingCart, title: "Point of Sale", text: "Create and process customer orders.", tag: "SALES" },
  { href: "/wise-menu", icon: UtensilsCrossed, title: "WISE MENU", text: "Receive customer QR menu orders and send confirmed orders to POS.", tag: "RECEIVING" },
  { href: "/wise-kitchen", icon: ChefHat, title: "WISE KITCHEN", text: "Receive kitchen orders and view recipes, measurements, and preparation details.", tag: "KITCHEN" },
  { href: "/orders", icon: ReceiptText, title: "Orders", text: "View, reopen, print, and manage order records.", tag: "RECORDS" },
  { href: "/gcash-bayad", icon: Wallet, title: "GCash / Bayad", text: "Process and record payment transactions.", tag: "PAYMENTS" },
  { href: "/customers", icon: Users, title: "Customers", text: "Access customer information and order history.", tag: "CUSTOMERS" },
];

export default function StaffPage() {
  const router = useRouter();
  const [name, setName] = useState("Staff");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

      // Business identity belongs to the login profile, not the global company setting.
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name")
        .eq("id", user.id)
        .maybeSingle();

      const configuredBusinessName =
        profile?.business_name ||
        user.user_metadata?.business_name ||
        user.user_metadata?.businessName ||
        user.app_metadata?.business_name ||
        user.app_metadata?.businessName;

      if (active && configuredBusinessName) {
        setBusinessName(String(configuredBusinessName));
      }

      setLoading(false);
    };
    load();

    const updateClock = () => {
      setNow(new Intl.DateTimeFormat("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()));
    };
    updateClock();
    const clock = window.setInterval(updateClock, 30000);

    return () => {
      active = false;
      window.clearInterval(clock);
    };
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/pos");
  };

  if (loading) {
    return (
      <main className="staff-loading">
        <div className="staff-loading-card">
          <div className="staff-logo-mark">W</div>
          <strong>Loading Staff Portal</strong>
          <span>Preparing your assigned tools...</span>
        </div>
      </main>
    );
  }

  const displayBusinessName = businessName || "Staff Workspace";

  return (
    <main className="staff-page">
      <section className="staff-shell">
        <header className="staff-hero">
          <div className="staff-hero-content">
            <div className="staff-eyebrow">{displayBusinessName.toUpperCase()} • STAFF PORTAL</div>
            <div className="staff-welcome-row">
              <div>
                <h1>Welcome, {name}</h1>
                <p>Everything you need for today&apos;s operations, in one place.</p>
              </div>
            </div>
            <div className="staff-hero-meta">
              <span><span className="staff-live-dot" /> Staff account active</span>
              {now && <span><Clock3 size={15} /> {now}</span>}
            </div>
          </div>
          <button className="staff-signout" onClick={signOut} type="button">
            <LogOut size={17} />
            Sign Out
          </button>
        </header>

        <div className="staff-section-heading">
          <div>
            <span className="staff-section-kicker">YOUR WORKSPACE</span>
            <h2>Daily Operations</h2>
          </div>
          <span className="staff-tool-count">{cards.length} available tools</span>
        </div>

        <div className="staff-grid">
          {cards.map(({ href, icon: Icon, title, text, tag }) => (
            <button
              key={href}
              type="button"
              className={`staff-tool-card ${title === "WISE MENU" ? "staff-tool-featured" : ""}`}
              onClick={() => router.push(href)}
            >
              <div className="staff-tool-top">
                <div className="staff-tool-icon"><Icon size={23} strokeWidth={2} /></div>
                <span className="staff-tool-tag">{tag}</span>
              </div>
              <div className="staff-tool-body">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <span className="staff-tool-action">Open <ArrowRight size={16} /></span>
            </button>
          ))}
        </div>

        <section className="staff-access-card">
          <div className="staff-access-icon"><Users size={19} /></div>
          <div>
            <strong>Staff Access</strong>
            <p>Your account has access to POS, WISE MENU, WISE KITCHEN, Orders, Payments, and Customers. Administrative areas remain restricted.</p>
          </div>
        </section>

        <footer className="staff-footer">{displayBusinessName.toUpperCase()} POS • STAFF WORKSPACE</footer>
      </section>
    </main>
  );
}
