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

function isStaffAllowedRoute(pathname: string) {
  return staffAllowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

async function effectiveRole(user: any) {
  if (!user) return "";
  const metadataRole = user.app_metadata?.role || user.user_metadata?.role;
  if (metadataRole) return String(metadataRole).toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_active === false) return "inactive";
  return String(profile?.role || "").toLowerCase();
}

export default function AuthRoleRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const enforce = async (user: any, forceStaffLanding = false) => {
      if (!user) return;
      const role = await effectiveRole(user);
      if (!active) return;

      if (role === "staff") {
        // Staff always starts at the Staff Portal after authentication.
        if (forceStaffLanding || !isStaffAllowedRoute(pathname)) {
          router.replace("/staff");
        }
        return;
      }

      if (pathname === "/staff" || pathname.startsWith("/staff/")) {
        router.replace("/dashboard");
      }
    };

    supabase.auth.getUser().then(({ data }) => void enforce(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session?.user) return;
      void enforce(session.user, event === "SIGNED_IN");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return <>{children}</>;
}
