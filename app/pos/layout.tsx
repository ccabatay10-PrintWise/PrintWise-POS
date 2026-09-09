"use client";

import DiscountQuickModal from "./DiscountQuickModal";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <><DiscountQuickModal />{children}</>;
}
