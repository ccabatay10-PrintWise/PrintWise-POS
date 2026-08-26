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
    <aside className="sidebar sidebar-enhanced">
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
        <div className="nav-label">SYSTEM</div>
        <a className="nav-item" href="/dashboard#settings">
          <span className="nav-icon"><Settings size={19} /></span>
          <span>Settings</span>
          <ChevronRight className="nav-arrow" size={16} />
        </a>
      </div>

      <div className="sidebar-footer">
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
    </aside>
  );
}
