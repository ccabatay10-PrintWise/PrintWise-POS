"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  ChevronRight,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Layers3,
  LogOut,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const nav = [
  [LayoutDashboard, "Dashboard", "/dashboard"],
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Orders", "/orders"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Calculator, "Project Costing", "/project-costing"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [Layers3, "Inventory", "/inventory"],
  [FileText, "Reports", "/reports"],
] as const;

const quickActions = [
  [Plus, "New Order", "Create order", "/pos"],
  [UserPlus, "New Customer", "Open customers", "/customers"],
  [Package, "New Product", "Add product", "/products"],
  [FilePlus2, "New Quotation", "Project costing", "/project-costing"],
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("admin");

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setUserName("Guest User");
        setUserRole("guest");
        return;
      }

      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "PrintWise User";

      const role = String(
        user.app_metadata?.role ||
        user.user_metadata?.role ||
        "admin"
      ).toLowerCase();

      setUserName(displayName);
      setUserRole(role);
    };

    loadCurrentUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (!user) {
        setUserName("Guest User");
        setUserRole("guest");
        return;
      }

      setUserName(
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "PrintWise User"
      );
      setUserRole(
        String(
          user.app_metadata?.role ||
          user.user_metadata?.role ||
          "admin"
        ).toLowerCase()
      );
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const roleLabel =
    userRole === "admin" ? "Admin" :
    userRole === "staff" ? "Staff" :
    userRole.charAt(0).toUpperCase() + userRole.slice(1);

  const avatarLetter = userName.charAt(0).toUpperCase() || "P";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/pos");
    router.refresh();
  };

  return (
    <aside className="sidebar sidebar-enhanced sidebar-compact">
      <div className="sidebar-brand-wrap">
        <a className="brand" href="/dashboard" aria-label="PrintWise Dashboard">
          <div className="brand-mark"><Package size={24} /></div>
          <div className="brand-copy"><strong>PRINTWISE</strong><small>Printing & Customized Services</small></div>
        </a>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-label">MAIN MENU</div>
        <nav className="sidebar-nav">
          {nav.map(([Icon, label, href]) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <a href={href} className={`nav-item ${active ? "active" : ""}`} key={href}>
                <span className="nav-icon"><Icon size={19} /></span>
                <span>{label}</span>
                <ChevronRight className="nav-arrow" size={16} />
              </a>
            );
          })}
        </nav>

        <div className="sidebar-divider" />
        <div className="nav-label quick-label">QUICK ACTIONS</div>
        <div className="quick-actions-grid">
          {quickActions.map(([Icon, title, subtitle, href]) => (
            <a className="quick-action" href={href} key={title}>
              <span className="quick-action-icon"><Icon size={22} /></span>
              <b>{title}</b>
              <small>{subtitle}</small>
            </a>
          ))}
        </div>

        <div className="sidebar-divider" />
        <div className="nav-label">ACCOUNT</div>

        <a
          className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
          href="/settings"
        >
          <span className="nav-icon"><Settings size={19} /></span>
          <span>Settings</span>
          <ChevronRight className="nav-arrow" size={16} />
        </a>

        <a className="sidebar-user-card" href="/dashboard">
          <span className="sidebar-avatar">{avatarLetter}<i /></span>
          <span className="sidebar-user-copy"><b>{userName}</b><small>{roleLabel}</small></span>
          <ChevronRight size={18} />
        </a>

        <button type="button" className="sidebar-logout" onClick={signOut}>
          <LogOut size={18} />
          <span>LOG OUT</span>
        </button>
      </div>

      <style jsx global>{`
        /* Compact PrintWise shell: content ends naturally after LOG OUT. */
        .app-shell:has(.sidebar-compact){align-items:flex-start}
        .sidebar-compact{align-self:flex-start;flex:0 0 300px;height:auto!important;min-height:0!important}
        .sidebar-compact .sidebar-scroll{flex:none!important;overflow:visible!important;padding-bottom:12px!important}
        .sidebar-compact .sidebar-brand-wrap{padding-bottom:14px!important}
        .sidebar-compact .nav-label{padding-top:0!important;margin-bottom:8px!important}
        .sidebar-compact .nav-item{min-height:46px!important;margin:1px 0!important}
        .sidebar-compact .sidebar-divider{margin:12px 0!important}
        .sidebar-compact .quick-actions-grid{gap:8px!important}
        .sidebar-compact .quick-action{min-height:84px!important;padding:12px!important}
        .sidebar-compact .quick-action-icon{width:34px!important;height:34px!important}
        .sidebar-compact .sidebar-user-card{margin-top:6px!important;min-height:58px!important}
        .sidebar-compact .sidebar-logout{margin-top:10px!important;margin-bottom:0!important;min-height:48px!important}

        /* Dashboard follows the compact reference: three recent transactions and no bottom filler/actions. */
        .dashboard-bottom-grid{display:none!important}
        .dashboard-main-grid{padding-bottom:24px!important;align-items:start!important}
        .recent-card .transaction-list>.transaction:nth-child(n+4){display:none!important}
        .recent-card .card-title p{font-size:0!important}
        .recent-card .card-title p::after{content:"Latest 3 transactions from your PrintWise POS.";font-size:12px!important}
        .recent-card .transaction{padding:13px 0!important}
        .recent-card,.inventory-card{min-height:0!important;height:auto!important}
        .dashboard-card{min-height:0!important}
        @media(max-width:1100px){
          .app-shell:has(.sidebar-compact){align-items:stretch}
          .sidebar-compact{align-self:stretch;height:auto!important;min-height:100vh!important;flex-basis:72px!important}
        }
      `}</style>
    </aside>
  );
}
