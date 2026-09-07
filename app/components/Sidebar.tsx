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
  const [userRole, setUserRole] = useState("user");
  const [mobileOpen, setMobileOpen] = useState(false);

  const applyUser = async (user: { id: string; email?: string | null; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> } | null) => {
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

    // The profile table is the authoritative source for application roles.
    // Metadata is only a display fallback when the profile cannot be read.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || user.app_metadata?.role || user.user_metadata?.role || "user").toLowerCase();
    setUserRole(profile?.is_active === false ? "inactive" : role);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      await applyUser(user);
    };

    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      void applyUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

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
      ? "Administrator"
      : userRole === "staff"
        ? "Staff"
        : userRole === "cashier"
          ? "Cashier"
          : userRole === "inactive"
            ? "Inactive"
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
          <a className="brand" href="/dashboard" onClick={closeMobile} aria-label="PrintWise Dashboard">
            <div className="brand-mark"><Package size={22} /></div>
            <div className="brand-copy">
              <strong>PRINTWISE</strong>
              <small>Printing & Customized Services</small>
            </div>
          </a>
        </div>

        <div className="sidebar-scroll">
          <div className="nav-label">MAIN MENU</div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {nav.map(([Icon, label, href]) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <a
                  href={href}
                  className={`nav-item ${active ? "active" : ""}`}
                  key={href}
                  onClick={closeMobile}
                  aria-current={active ? "page" : undefined}
                  title={label}
                >
                  <span className="nav-icon"><Icon size={18} strokeWidth={2} /></span>
                  <span className="nav-text">{label}</span>
                  <ChevronRight className="nav-arrow" size={15} />
                </a>
              );
            })}
          </nav>

          <div className="sidebar-divider" />
          <div className="nav-label quick-label">QUICK ACTIONS</div>
          <div className="quick-actions-grid">
            {quickActions.map(([Icon, title, subtitle, href]) => (
              <a className="quick-action" href={href} key={title} onClick={closeMobile} title={subtitle}>
                <span className="quick-action-icon"><Icon size={19} strokeWidth={2.1} /></span>
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
            onClick={closeMobile}
            aria-current={pathname === "/settings" ? "page" : undefined}
            title="Settings"
          >
            <span className="nav-icon"><Settings size={18} /></span>
            <span className="nav-text">Settings</span>
            <ChevronRight className="nav-arrow" size={15} />
          </a>

          <a className="sidebar-user-card" href="/dashboard" onClick={closeMobile} title="Open dashboard">
            <span className="sidebar-avatar">{avatarLetter}<i /></span>
            <span className="sidebar-user-copy"><b>{userName}</b><small>{roleLabel}</small></span>
            <ChevronRight size={17} />
          </a>

          <button type="button" className="sidebar-logout" onClick={signOut}>
            <LogOut size={17} /><span>LOG OUT</span>
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
        .app-shell:has(.sidebar-compact){align-items:stretch}
        .sidebar-compact{
          align-self:stretch;flex:0 0 268px;width:268px!important;min-height:100vh!important;height:100vh!important;
          position:sticky;top:0;box-sizing:border-box;padding:16px 12px!important;background:linear-gradient(180deg,#25272c 0%,#202226 100%)!important;
          border-right:1px solid rgba(255,255,255,.055);box-shadow:8px 0 30px rgba(15,23,42,.08);z-index:100;
        }
        .sidebar-compact .sidebar-brand-wrap{padding:0 2px 15px!important}
        .sidebar-compact .brand{min-height:54px;box-sizing:border-box;padding:7px 8px 13px!important;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);text-decoration:none}
        .sidebar-compact .brand-mark{width:38px!important;height:38px!important;min-width:38px;border-radius:11px!important;box-shadow:0 5px 14px rgba(215,25,32,.2)}
        .sidebar-compact .brand-copy{min-width:0}.sidebar-compact .brand-copy strong{display:block;font-size:15px;line-height:1.1;letter-spacing:1.35px}
        .sidebar-compact .brand-copy small{display:block;margin-top:4px;font-size:9px;line-height:1.2;color:#8f96a0;letter-spacing:.15px;white-space:nowrap}
        .sidebar-compact .sidebar-scroll{flex:1!important;min-height:0;overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin;scrollbar-color:#454950 transparent;padding:2px 2px 14px!important}
        .sidebar-compact .nav-label{padding:13px 9px 7px!important;margin:0!important;color:#777e89!important;font-size:9px!important;font-weight:800;letter-spacing:1.15px!important}
        .sidebar-compact .nav-item{position:relative;width:100%;min-height:43px!important;box-sizing:border-box;margin:2px 0!important;padding:9px 10px!important;border-radius:9px!important;gap:10px!important;color:#b9bec7!important;text-decoration:none;transition:background .15s ease,color .15s ease,transform .15s ease}
        .sidebar-compact .nav-item:hover{background:rgba(255,255,255,.065)!important;color:#fff!important;transform:translateX(1px)}
        .sidebar-compact .nav-item.active{background:linear-gradient(90deg,rgba(215,25,32,.20),rgba(215,25,32,.08))!important;color:#fff!important;box-shadow:none!important}
        .sidebar-compact .nav-item.active::before{content:"";position:absolute;left:-2px;top:8px;bottom:8px;width:3px;border-radius:0 4px 4px 0;background:#e1252b;box-shadow:0 0 10px rgba(225,37,43,.28)}
        .sidebar-compact .nav-icon{width:32px;height:32px;min-width:32px;border-radius:8px;display:grid;place-items:center;color:#8f96a0;transition:background .15s ease,color .15s ease}
        .sidebar-compact .nav-item:hover .nav-icon{color:#fff;background:rgba(255,255,255,.055)}.sidebar-compact .nav-item.active .nav-icon{color:#fff;background:rgba(215,25,32,.18)}
        .sidebar-compact .nav-text{font-size:12px;font-weight:650;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sidebar-compact .nav-arrow{margin-left:auto;flex:none;color:#555b64;transition:transform .15s ease,color .15s ease}
        .sidebar-compact .nav-item:hover .nav-arrow,.sidebar-compact .nav-item.active .nav-arrow{color:#9299a3;transform:translateX(2px)}.sidebar-compact .sidebar-divider{height:1px;margin:11px 4px!important;background:rgba(255,255,255,.075);border:0}
        .sidebar-compact .quick-actions-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;padding:1px 3px}.sidebar-compact .quick-action{min-height:79px!important;box-sizing:border-box;padding:10px!important;border:1px solid rgba(255,255,255,.065)!important;border-radius:10px!important;background:rgba(255,255,255,.025)!important;text-decoration:none;color:#fff;display:flex!important;flex-direction:column;align-items:flex-start;gap:4px!important;transition:background .15s ease,border-color .15s ease,transform .15s ease}
        .sidebar-compact .quick-action:hover{background:rgba(255,255,255,.065)!important;border-color:rgba(255,255,255,.12)!important;transform:translateY(-1px)}.sidebar-compact .quick-action-icon{width:31px!important;height:31px!important;border-radius:8px!important;display:grid!important;place-items:center;background:rgba(215,25,32,.15);color:#ff5b60!important}
        .sidebar-compact .quick-action b{font-size:10px;line-height:1.15;color:#e8eaf0}.sidebar-compact .quick-action small{font-size:8px;line-height:1.15;color:#7f8791}
        .sidebar-compact .sidebar-user-card{display:flex!important;align-items:center;gap:9px;margin:7px 3px 0!important;padding:9px!important;min-height:56px!important;box-sizing:border-box;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:rgba(255,255,255,.035);color:#fff;text-decoration:none;transition:background .15s ease,border-color .15s ease}
        .sidebar-compact .sidebar-user-card:hover{background:rgba(255,255,255,.065);border-color:rgba(255,255,255,.12)}.sidebar-compact .sidebar-avatar{position:relative;width:34px;height:34px;min-width:34px;border-radius:50%;display:grid;place-items:center;background:#d71920;color:#fff;font-size:12px;font-weight:800}
        .sidebar-compact .sidebar-avatar i{position:absolute;right:-1px;bottom:0;width:8px;height:8px;border:2px solid #25272c;border-radius:50%;background:#22c55e}.sidebar-compact .sidebar-user-copy{min-width:0;flex:1}.sidebar-compact .sidebar-user-copy b{display:block;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#f2f3f5}.sidebar-compact .sidebar-user-copy small{display:block;margin-top:3px;font-size:9px;color:#858c97}.sidebar-compact .sidebar-user-card>svg{color:#606771;flex:none}
        .sidebar-compact .sidebar-logout{width:calc(100% - 6px)!important;margin:7px 3px 0!important;min-height:42px!important;box-sizing:border-box;display:flex!important;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.08)!important;border-radius:9px!important;background:transparent!important;color:#9da3ad!important;font-size:10px!important;font-weight:800;letter-spacing:.7px;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}
        .sidebar-compact .sidebar-logout:hover{background:rgba(215,25,32,.10)!important;border-color:rgba(215,25,32,.25)!important;color:#ff6a6f!important}.mobile-sidebar-toggle,.mobile-sidebar-backdrop{display:none}
        @media(max-width:1100px){.app-shell:has(.sidebar-compact){align-items:stretch}.sidebar-compact{flex-basis:76px!important;width:76px!important;padding:16px 9px!important}.sidebar-compact .brand-copy,.sidebar-compact .nav-label,.sidebar-compact .nav-text,.sidebar-compact .nav-arrow,.sidebar-compact .quick-action b,.sidebar-compact .quick-action small,.sidebar-compact .sidebar-user-copy,.sidebar-compact .sidebar-user-card>svg,.sidebar-compact .sidebar-logout span{display:none!important}.sidebar-compact .brand{justify-content:center;padding-left:0!important;padding-right:0!important}.sidebar-compact .nav-item{justify-content:center;padding:7px!important}.sidebar-compact .nav-item.active::before{left:-1px}.sidebar-compact .nav-icon{width:38px;height:38px}.sidebar-compact .quick-actions-grid{grid-template-columns:1fr!important;padding:0}.sidebar-compact .quick-action{min-height:46px!important;align-items:center;justify-content:center;padding:7px!important}.sidebar-compact .quick-action-icon{width:34px!important;height:34px!important}.sidebar-compact .sidebar-user-card{justify-content:center;padding:7px!important;margin-left:0!important;margin-right:0!important}.sidebar-compact .sidebar-avatar{width:34px;height:34px}.sidebar-compact .sidebar-logout{width:100%!important;margin-left:0!important;margin-right:0!important;padding:0!important}}
        @media(max-width:700px){body.printwise-menu-open{overflow:hidden}.sidebar-compact{display:flex!important;position:fixed!important;left:0;top:0;bottom:0;width:min(88vw,320px)!important;height:100dvh!important;min-height:100dvh!important;max-height:100dvh!important;flex:0 0 auto!important;z-index:3000!important;overflow:hidden!important;padding:16px 12px!important;transform:translateX(-105%);transition:transform .24s cubic-bezier(.2,.8,.2,1),box-shadow .24s ease!important;box-shadow:0 18px 50px rgba(0,0,0,.28)!important}.sidebar-compact.mobile-open{transform:translateX(0)!important}.sidebar-compact .sidebar-scroll{flex:1!important;overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:24px!important;-webkit-overflow-scrolling:touch}.sidebar-compact .sidebar-brand-wrap{padding-bottom:14px!important}.sidebar-compact .brand{justify-content:flex-start!important;padding:7px 10px 15px!important}.sidebar-compact .brand-copy,.sidebar-compact .nav-label,.sidebar-compact .nav-text,.sidebar-compact .nav-arrow,.sidebar-compact .quick-action b,.sidebar-compact .quick-action small,.sidebar-compact .sidebar-user-copy,.sidebar-compact .sidebar-user-card>svg,.sidebar-compact .sidebar-logout span{display:initial!important}.sidebar-compact .nav-label{display:block!important}.sidebar-compact .nav-item{justify-content:flex-start!important;min-height:46px!important;padding:8px 10px!important}.sidebar-compact .nav-icon{width:32px;height:32px}.sidebar-compact .quick-actions-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.sidebar-compact .quick-action{min-height:82px!important;padding:11px!important;display:flex!important;align-items:flex-start!important}.sidebar-compact .sidebar-user-card{display:flex!important}.sidebar-compact .sidebar-logout{display:flex!important}.mobile-sidebar-toggle{display:grid;place-items:center;position:fixed;left:12px;top:12px;width:44px;height:44px;border:1px solid #dfe4ea;border-radius:12px;background:#fff;color:#344054;box-shadow:0 8px 22px rgba(15,23,42,.12);z-index:2999;cursor:pointer}.mobile-sidebar-toggle:hover{transform:translateY(-1px)}.mobile-sidebar-toggle:active{transform:scale(.97)}.mobile-sidebar-backdrop{display:block;position:fixed;inset:0;border:0;padding:0;background:rgba(15,23,42,.48);opacity:0;pointer-events:none;z-index:2998;transition:opacity .2s ease;cursor:pointer}.mobile-sidebar-backdrop.visible{opacity:1;pointer-events:auto}}
      `}</style>
    </>
  );
}
