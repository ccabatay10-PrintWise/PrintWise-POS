"use client";

import DiscountQuickModal from "./DiscountQuickModal";
import OrdersQuickModal from "./OrdersQuickModal";
import PrinterQuickModal from "./PrinterQuickModal";
import SettingsQuickModal from "./SettingsQuickModal";
import "./sale-complete.css";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <><DiscountQuickModal /><OrdersQuickModal /><PrinterQuickModal /><SettingsQuickModal />{children}</>;
}
