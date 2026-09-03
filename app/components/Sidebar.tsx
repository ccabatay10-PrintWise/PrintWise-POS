"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  ChevronRight,
  FilePlus2,
  FileText,
  FileUp,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const nav = [
  [LayoutDashboard, "Dashboard", "/dashboard"],
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Transactions", "/orders"],
  [FileUp, "Received Files", "/received-files"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Calculator, "Project Costing", "/project-costing"],
  [Sparkles, "Smart Pricing Settings", "/smart-pricing"],
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!user) {
        setUserName("Guest User");
        setUserRole("guest");
        return;
      }

      setUserName(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "PrintWise User",
      );
      setUserRole(
        String(user.app_metadata?.role || user.user_metadata?.role || "admin").toLowerCase(),
      );
    };

    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
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
          "PrintWise User",
      );
      setUserRole(
        String(user.app_metadata?.role || user.user_metadata?.role || "admin").toLowerCase(),
      );
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("printwise-menu-open", mobileOpen);
    return () => document.body.classList.remove("printwise-menu-open");
  }, [mobileOpen]);

  const roleLabel =
    userRole === "admin"
      ? "Admin"
      : userRole === "staff"
        ? "Staff"
        : userRole.charAt(0).toUpperCase() + userRole.slice(1);
  const avatarLetter = userName.charAt(0).toUpperCase() || "P";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/pos");
    router.refresh();
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <aside className={`sidebar sidebar-enhanced sidebar-compact ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand-wrap">
          <a className="brand" href="/dashboard" onClick={closeMobile}>
            <div className="brand-mark"><Package size={24} /></div>
            <div className="brand-copy">
              <strong>PRINTWISE</strong>
              <small>Printing & Customized Services</small>
            </div>
          </a>
        </div>

        <div className="sidebar-scroll">
          <div className="nav-label">MAIN MENU</div>
          <nav className="sidebar-nav">
            {nav.map(([Icon, label, href]) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <a
                  href={href}
                  className={`nav-item ${active ? "active" : ""}`}
                  key={href}
                  onClick={closeMobile}
                >
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
              <a className="quick-action" href={href} key={title} onClick={closeMobile}>
                <span className="quick-action-icon"><Icon size={22} /></span>
                <b>{title}</b>
                <small>{subtitle}</small>
              </a>
            ))}
          </div>

          <div className="sidebar-divider" />
          <div className="nav-label">ACCOUNT</div>
          <a className={`nav-item ${pathname === "/settings" ? "active" : ""}`} href="/settings" onClick={closeMobile}>
            <span className="nav-icon"><Settings size={19} /></span>
            <span>Settings</span>
            <ChevronRight className="nav-arrow" size={16} />
          </a>

          <a className="sidebar-user-card" href="/dashboard" onClick={closeMobile}>
            <span className="sidebar-avatar">{avatarLetter}<i /></span>
            <span className="sidebar-user-copy"><b>{userName}</b><small>{roleLabel}</small></span>
            <ChevronRight size={18} />
          </a>

          <button type="button" className="sidebar-logout" onClick={signOut}>
            <LogOut size={18} /><span>LOG OUT</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="mobile-sidebar-toggle"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((value) => !value)}
      >
        {mobileOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      <button
        type="button"
        className={`mobile-sidebar-backdrop ${mobileOpen ? "visible" : ""}`}
        aria-label="Close navigation menu"
        onClick={closeMobile}
      />

      <style jsx global>{`
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
        .mobile-sidebar-toggle,.mobile-sidebar-backdrop{display:none}

        @media(max-width:1100px){
          .app-shell:has(.sidebar-compact){align-items:stretch}
          .sidebar-compact{align-self:stretch;height:auto!important;min-height:100vh!important;flex-basis:72px!important}
          .sidebar-compact .sidebar-scroll{overflow:visible!important}
        }

        @media(max-width:700px){
          body.printwise-menu-open{overflow:hidden}
          .sidebar-compact{display:flex!important;position:fixed!important;left:0;top:0;bottom:0;width:min(88vw,320px)!important;height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;flex:0 0 auto!important;z-index:3000!important;overflow:hidden!important;padding:18px 12px!important;transform:translateX(-105%);transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s ease!important;box-shadow:0 18px 50px rgba(0,0,0,.24)!important}
          .sidebar-compact.mobile-open{transform:translateX(0)!important}
          .sidebar-compact .sidebar-scroll{flex:1!important;overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:24px!important;-webkit-overflow-scrolling:touch}
          .sidebar-compact .sidebar-brand-wrap{padding-bottom:14px!important}
          .sidebar-compact .brand{justify-content:flex-start!important;padding:7px 10px 18px!important}
          .sidebar-compact .brand-copy,.sidebar-compact .nav-label,.sidebar-compact .nav-item>span:not(.nav-icon),.sidebar-compact .nav-arrow,.sidebar-compact .quick-action b,.sidebar-compact .quick-action small,.sidebar-compact .sidebar-user-copy,.sidebar-compact .sidebar-logout span{display:initial!important}
          .sidebar-compact .nav-label{display:block!important}
          .sidebar-compact .nav-item{justify-content:flex-start!important;min-height:46px!important;padding:10px 13px!important}
          .sidebar-compact .quick-actions-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
          .sidebar-compact .quick-action{min-height:82px!important;padding:11px!important;display:flex!important}
          .sidebar-compact .sidebar-user-card{display:flex!important}
          .sidebar-compact .sidebar-logout{display:flex!important}
          .mobile-sidebar-toggle{display:grid;place-items:center;position:fixed;left:12px;top:12px;width:44px;height:44px;border:1px solid #dfe4ea;border-radius:12px;background:#fff;color:#344054;box-shadow:0 8px 22px rgba(15,23,42,.12);z-index:2999;cursor:pointer}
          .mobile-sidebar-toggle:hover{transform:translateY(-1px)}
          .mobile-sidebar-toggle:active{transform:scale(.97)}
          .mobile-sidebar-backdrop{display:block;position:fixed;inset:0;border:0;padding:0;background:rgba(15,23,42,.48);opacity:0;pointer-events:none;z-index:2998;transition:opacity .2s ease;cursor:pointer}
          .mobile-sidebar-backdrop.visible{opacity:1;pointer-events:auto}
        }
      `}</style>
    </>
  );
}
