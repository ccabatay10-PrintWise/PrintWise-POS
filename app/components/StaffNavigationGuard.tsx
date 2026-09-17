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
    const isNavigation = Boolean(href);
    const shouldLock = isNavigation ? !allowedPath(href as string) : false;

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
      if (!mounted) return;

      const role = String(
        user?.app_metadata?.role || user?.user_metadata?.role || ""
      ).toLowerCase();

      const { data: profile } = user
        ? await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle()
        : { data: null };

      if (!mounted) return;
      const effectiveRole = String(profile?.role || role).toLowerCase();

      if (effectiveRole === "staff" && profile?.is_active !== false) {
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

  return null;
}
