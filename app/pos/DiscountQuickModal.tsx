"use client";

import { useEffect, useMemo, useState } from "react";
import { Accessibility, Medal, Percent, UserRound, UsersRound, X, CircleDollarSign } from "lucide-react";

type DiscountKey = "senior" | "pwd" | "athlete" | "solo" | "percentage" | "amount";

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const parsePeso = (value: string) => Number(value.replace(/[^0-9.-]+/g, "")) || 0;

function currentSubtotal() {
  if (typeof document === "undefined") return 0;
  return Array.from(document.querySelectorAll(".wise-cart-controls strong"))
    .map((node) => parsePeso(node.textContent || ""))
    .reduce((sum, value) => sum + value, 0);
}

function setDiscountInput(amount: number) {
  if (typeof document === "undefined") return;
  const input = document.getElementById("wise-discount-input") as HTMLInputElement | null;
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, String(Math.max(0, amount)));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function DiscountQuickModal() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DiscountKey | null>(null);
  const [rate, setRate] = useState(20);
  const [customValue, setCustomValue] = useState(0);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest(".wise-quick-action") as HTMLElement | null;
      if (!action?.textContent?.toLowerCase().includes("discount")) return;
      if (currentSubtotal() <= 0) return;
      event.preventDefault();
      setSelected(null);
      setCustomValue(0);
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const subtotal = useMemo(() => open ? currentSubtotal() : 0, [open]);
  const previewAmount = useMemo(() => {
    if (selected === "senior" || selected === "pwd") return subtotal * rate / 100;
    if (selected === "athlete") return subtotal * 0.2;
    if (selected === "solo") return subtotal * 0.1;
    if (selected === "percentage") return subtotal * Math.max(0, Math.min(100, customValue)) / 100;
    if (selected === "amount") return Math.max(0, Math.min(subtotal, customValue));
    return 0;
  }, [selected, rate, customValue, subtotal]);

  const select = (key: DiscountKey) => {
    setSelected(key);
    if (key === "senior" || key === "pwd") setRate(20);
    if (key === "athlete") setCustomValue(20);
    if (key === "solo") setCustomValue(10);
  };

  const apply = () => {
    if (!selected || subtotal <= 0) return;
    setDiscountInput(previewAmount);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="wise-discount-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="wise-discount-modal" role="dialog" aria-modal="true" aria-labelledby="wise-discount-title">
        <div className="wise-discount-head">
          <div><strong id="wise-discount-title">Select Discount</strong><span>This will be applied to all line items</span></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close discount dialog"><X size={20} /></button>
        </div>
        <div className="wise-discount-body">
          <section className="wise-discount-options">
            <div className="wise-discount-section-title">GOVERNMENT DISCOUNTS<span>For eligible customers with valid government-issued proof.</span></div>
            <div className="wise-discount-grid">
              <button type="button" className={selected === "senior" ? "selected" : ""} onClick={() => select("senior")}><span className="wise-discount-icon"><UserRound size={19} /></span><b>Senior</b><small>5% or 20% off</small></button>
              <button type="button" className={selected === "pwd" ? "selected" : ""} onClick={() => select("pwd")}><span className="wise-discount-icon"><Accessibility size={19} /></span><b>PWD</b><small>5% or 20% off</small></button>
              <button type="button" className={selected === "athlete" ? "selected" : ""} onClick={() => select("athlete")}><span className="wise-discount-icon"><Medal size={19} /></span><b>National Athlete</b><small>20% off</small></button>
              <button type="button" className={selected === "solo" ? "selected" : ""} onClick={() => select("solo")}><span className="wise-discount-icon"><UsersRound size={19} /></span><b>Solo Parent</b><small>10% off</small></button>
            </div>
            <div className="wise-discount-section-title custom">CUSTOM DISCOUNTS<span>Manual discount value for promos and discretionary cases.</span></div>
            <div className="wise-discount-grid">
              <button type="button" className={selected === "percentage" ? "selected" : ""} onClick={() => select("percentage")}><span className="wise-discount-icon"><Percent size={19} /></span><b>Percentage</b><small>% off item total</small></button>
              <button type="button" className={selected === "amount" ? "selected" : ""} onClick={() => select("amount")}><span className="wise-discount-icon"><CircleDollarSign size={19} /></span><b>Amount</b><small>Fixed peso amount</small></button>
            </div>
          </section>
          <section className="wise-discount-detail">
            {!selected && <span>Select a discount type to see additional options.</span>}
            {(selected === "senior" || selected === "pwd") && <div className="wise-discount-detail-inner"><strong>{selected === "senior" ? "Senior Citizen" : "PWD"}</strong><p>Select the applicable discount rate.</p><div className="wise-rate-row"><button type="button" className={rate === 5 ? "active" : ""} onClick={() => setRate(5)}>5%</button><button type="button" className={rate === 20 ? "active" : ""} onClick={() => setRate(20)}>20%</button></div><div className="wise-discount-preview">Discount <b>{peso(previewAmount)}</b></div></div>}
            {selected === "athlete" && <div className="wise-discount-detail-inner"><strong>National Athlete</strong><p>Fixed government discount.</p><div className="wise-fixed-rate">20% OFF</div><div className="wise-discount-preview">Discount <b>{peso(previewAmount)}</b></div></div>}
            {selected === "solo" && <div className="wise-discount-detail-inner"><strong>Solo Parent</strong><p>Fixed discount rate.</p><div className="wise-fixed-rate">10% OFF</div><div className="wise-discount-preview">Discount <b>{peso(previewAmount)}</b></div></div>}
            {selected === "percentage" && <div className="wise-discount-detail-inner"><strong>Custom Percentage</strong><p>Enter the percentage to deduct from the item total.</p><div className="wise-custom-input"><input type="number" min="0" max="100" value={customValue || ""} onChange={(e) => setCustomValue(Number(e.target.value) || 0)} placeholder="0" /><span>%</span></div><div className="wise-discount-preview">Discount <b>{peso(previewAmount)}</b></div></div>}
            {selected === "amount" && <div className="wise-discount-detail-inner"><strong>Custom Amount</strong><p>Enter a fixed peso amount to deduct.</p><div className="wise-custom-input"><span>₱</span><input type="number" min="0" max={subtotal} value={customValue || ""} onChange={(e) => setCustomValue(Number(e.target.value) || 0)} placeholder="0.00" /></div><div className="wise-discount-preview">Discount <b>{peso(previewAmount)}</b></div></div>}
          </section>
        </div>
        <div className="wise-discount-actions"><button type="button" className="wise-discount-apply" disabled={!selected || subtotal <= 0} onClick={apply}>Apply Discount</button></div>
      </div>
    </div>
  );
}
