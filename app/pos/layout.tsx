"use client";

import DiscountQuickModal from "./DiscountQuickModal";
import OrdersQuickModal from "./OrdersQuickModal";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <><DiscountQuickModal /><OrdersQuickModal />{children}</>;
}
