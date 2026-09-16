"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const staffAllowedRoutes = [
  "/staff",
  "/pos",
  "/orders",
  "/gcash-bayad",
  "/customers",
  "/wise-menu",
  "/wise-kitchen",
  "/wise-kitchen/recipes",
];

function roleOf(user: any) {
  return user?.app_metadata?.role || user?.user_metadata?.role || "unknown";
}

function isStaffAllowedRoute(pathname: string) {
  return staffAllowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default function AuthRoleRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const enforceCurrentRoute = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      const role = roleOf(user);

      if (role === "staff") {
        if (!isStaffAllowedRoute(pathname)) {
          router.replace("/staff");
        }
        return;
      }

      if (pathname === "/staff" || pathname.startsWith("/staff/")) {
        router.replace("/dashboard");
      }
    };

    enforceCurrentRoute();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const role = roleOf(session.user);
        if (role === "staff" && !isStaffAllowedRoute(pathname)) router.replace("/staff");
        if (role !== "staff" && (pathname === "/staff" || pathname.startsWith("/staff/"))) router.replace("/dashboard");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return <>{children}</>;
}
