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
];

function roleOf(user: any) {
  return user?.app_metadata?.role || user?.user_metadata?.role || "admin";
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
        // Staff may freely use only their assigned working tools.
        if (!isStaffAllowedRoute(pathname)) {
          router.replace("/staff");
        }
        return;
      }

      // Non-staff users should not stay inside the staff portal.
      if (pathname === "/staff" || pathname.startsWith("/staff/")) {
        router.replace("/dashboard");
      }
    };

    enforceCurrentRoute();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Do not redirect on token/session refresh or when the user switches browser tabs.
      // Only route after an actual sign-in, and preserve the current page when already signed in.
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
