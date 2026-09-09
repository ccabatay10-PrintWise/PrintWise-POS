"use client";

import DiscountQuickModal from "./DiscountQuickModal";
import OrdersQuickModal from "./OrdersQuickModal";
import PrinterQuickModal from "./PrinterQuickModal";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <><DiscountQuickModal /><OrdersQuickModal /><PrinterQuickModal />{children}</>;
}
