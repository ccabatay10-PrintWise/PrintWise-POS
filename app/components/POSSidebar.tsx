"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  FileUp,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings2,
  ShoppingCart,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const posNav = [
  [ShoppingCart, "New Order", "/pos"],
  [ReceiptText, "Transactions", "/orders"],
  [FileUp, "Received Files", "/received-files"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [FileText, "Project Costing", "/project-costing"],
] as const;

export default function POSSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("PrintWise Staff");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const user = data.user;
      setUserName(
        user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          "PrintWise Staff",
      );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/pos");
    router.refresh();
  };

  return (
    <aside className="pos-sidebar">
      <div className="pos-sidebar-brand">
        <div className="pos-sidebar-logo"><ShoppingCart size={21} /></div>
        <div>
          <strong>PRINTWISE POS</strong>
          <small>Sales Terminal</small>
        </div>
      </div>

      <div className="pos-sidebar-section-label">POS MENU</div>
      <nav className="pos-sidebar-nav">
        {posNav.map(([Icon, label, href]) => {
          const active = pathname === href || (href !== "/pos" && pathname.startsWith(`${href}/`));
          return (
            <a className={`pos-sidebar-item ${active ? "active" : ""}`} href={href} key={href}>
              <span className="pos-sidebar-icon"><Icon size={18} /></span>
              <span>{label}</span>
              <ChevronRight className="pos-sidebar-arrow" size={15} />
            </a>
          );
        })}
      </nav>

      <div className="pos-sidebar-divider" />
      <div className="pos-sidebar-section-label">SYSTEM</div>
      <a className="pos-sidebar-item" href="/dashboard">
        <span className="pos-sidebar-icon"><LayoutDashboard size={18} /></span>
        <span>Dashboard</span>
        <ChevronRight className="pos-sidebar-arrow" size={15} />
      </a>
      <a className="pos-sidebar-item" href="/smart-pricing">
        <span className="pos-sidebar-icon"><Settings2 size={18} /></span>
        <span>Smart Pricing</span>
        <ChevronRight className="pos-sidebar-arrow" size={15} />
      </a>

      <div className="pos-sidebar-footer">
        <div className="pos-sidebar-user">
          <span className="pos-sidebar-avatar">{userName.charAt(0).toUpperCase()}</span>
          <div><b>{userName}</b><small>POS Staff</small></div>
        </div>
        <button type="button" className="pos-sidebar-logout" onClick={signOut}>
          <LogOut size={17} />
          <span>Log Out</span>
        </button>
        <a className="pos-sidebar-back" href="/dashboard">
          <ArrowLeft size={16} />
          <span>Back to Navigation</span>
        </a>
      </div>
    </aside>
  );
}
