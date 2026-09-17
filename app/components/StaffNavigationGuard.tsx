"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

const STAFF_ALLOWED = new Set([
  "/staff",
  "/pos",
  "/orders",
  "/gcash-bayad",
  "/customers",
  "/wise-menu",
  "/wise-kitchen",
  "/wise-kitchen/recipes",
]);

function allowedPath(href: string) {
  try {
    const path = new URL(href, window.location.origin).pathname;
    return Array.from(STAFF_ALLOWED).some(
      (route) => path === route || path.startsWith(`${route}/`)
    );
  } catch {
    return true;
  }
}

function lockStaffNavigation() {
  document.querySelectorAll<HTMLElement>(
    ".sidebar a[href], .sidebar button, .quick-action[href], .brand[href]"
  ).forEach((element) => {
    const href = element.getAttribute("href");
    const shouldLock = href ? !allowedPath(href) : false;

    element.classList.toggle("staff-nav-disabled", shouldLock);
    if (shouldLock) {
      element.setAttribute("aria-disabled", "true");
      element.setAttribute("tabindex", "-1");
      element.style.pointerEvents = "none";
      element.style.cursor = "not-allowed";
      element.setAttribute("title", "Not available for Staff");
    }
  });
}

export default function StaffNavigationGuard() {
  useEffect(() => {
    let mounted = true;
    let observer: MutationObserver | null = null;

    const apply = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      const role = String(
        profile?.role || user.app_metadata?.role || user.user_metadata?.role || ""
      ).toLowerCase();

      if (role === "staff" && profile?.is_active !== false) {
        lockStaffNavigation();
        observer = new MutationObserver(lockStaffNavigation);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    void apply();
    return () => {
      mounted = false;
      observer?.disconnect();
    };
  }, []);

  return (
    <style jsx global>{`
      .staff-nav-disabled {
        opacity: 0.38 !important;
        filter: grayscale(0.65) !important;
        pointer-events: none !important;
        user-select: none !important;
      }
      .staff-nav-disabled .nav-arrow {
        opacity: 0.35 !important;
      }
    `}</style>
  );
}
