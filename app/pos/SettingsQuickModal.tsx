"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Save, Settings2, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./settings-quick.css";

type ReceiptSettings = {
  store: string;
  title: string;
  header: string;
  footer: string;
  paperSize: "58mm" | "80mm";
  includeNotes: boolean;
  autoPrint: boolean;
};

const STORAGE_KEY = "printwise-pos-receipt-settings";
const DEFAULTS: ReceiptSettings = {
  store: "Espacio",
  title: "Espacio",
  header: "",
  footer: "THANK YOU! COME AGAIN!",
  paperSize: "58mm",
  includeNotes: true,
  autoPrint: true,
};

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);

export default function SettingsQuickModal() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULTS);
  const [stores, setStores] = useState<string[]>([DEFAULTS.store]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest(".wise-quick-action") as HTMLElement | null;
      if (!button) return;
      const label = button.querySelector("span")?.textContent?.trim().toLowerCase();
      if (label !== "settings") return;
      event.preventDefault();
      event.stopPropagation();
      setMessage("");
      setError("");
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (!cancelled) setSettings({ ...DEFAULTS, ...parsed, paperSize: parsed.paperSize === "80mm" ? "80mm" : "58mm" });
          } catch {}
        }

        const { data, error: dbError } = await supabase
          .from("company_settings")
          .select("business_name,receipt_footer,receipt_paper_size,address,contact_number,email")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (dbError) throw dbError;
        if (!cancelled && data) {
          const cachedSettings = localStorage.getItem(STORAGE_KEY);
          let local: Partial<ReceiptSettings> = {};
          try { local = cachedSettings ? JSON.parse(cachedSettings) : {}; } catch {}
          const business = String(data.business_name || DEFAULTS.store);
          const headerFromCompany = [data.address, data.contact_number, data.email].filter(Boolean).join(" · ");
          setStores([business]);
          setSettings({
            ...DEFAULTS,
            ...local,
            store: business,
            title: local.title || business,
            header: local.header ?? headerFromCompany,
            footer: local.footer ?? String(data.receipt_footer || DEFAULTS.footer),
            paperSize: local.paperSize || (data.receipt_paper_size === "80mm" ? "80mm" : "58mm"),
          });
        }
      } catch {
        if (!cancelled) setError("Unable to load synced settings. Browser-saved receipt settings are still available.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open]);

  const update = (key: keyof ReceiptSettings, value: string | boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!settings.title.trim()) { setError("Receipt title is required."); return; }
    if (!settings.store.trim()) { setError("Please select a store."); return; }
    setSaving(true);
    setMessage("");
    setError("");
    const next = { ...settings, title: settings.title.trim(), store: settings.store.trim(), footer: settings.footer.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      const { error: dbError } = await supabase.from("company_settings").update({ business_name: next.store, receipt_footer: next.footer, receipt_paper_size: next.paperSize }).not("id", "is", null);
      if (dbError) throw dbError;
      setMessage("Receipt settings saved successfully.");
    } catch {
      setMessage("Receipt settings saved on this device. Database sync is not available for this account.");
    } finally {
      setSettings(next);
      setSaving(false);
    }
  };

  const previewItems = useMemo(() => [
    { name: "Classic Burger", qty: 2, price: 300, sub: "@₱166.50 ea", modifier: "+ Extra Cheese, Bacon", discount: 30 },
    { name: "Iced Coffee", qty: 1, price: 80, sub: "", modifier: "+ Extra Shot", discount: 0 },
    { name: "French Fries", qty: 3, price: 180, sub: "@₱60.00 ea", modifier: "", discount: 0 },
  ], []);

  if (!open) return null;

  return (
    <div className="wise-settings-backdrop" role="dialog" aria-modal="true" aria-labelledby="wise-settings-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="wise-settings-modal">
        <header className="wise-settings-head">
          <div className="wise-settings-title-row"><Settings2 size={25} strokeWidth={2.2} /><div><h2 id="wise-settings-title">POS Settings</h2><p>Manage your point of sale preferences.</p></div></div>
          <button className="wise-settings-close" onClick={() => setOpen(false)} aria-label="Close"><X size={21} /></button>
        </header>

        <div className="wise-settings-content">
          <section className="wise-settings-form">
            <div className="wise-settings-section-head"><h3>Receipt</h3><p>Personalize your receipt and preview how it prints.</p></div>
            {error && <div className="wise-settings-error">{error}</div>}
            {message && <div className="wise-settings-success">{message}</div>}

            <label>Store
              <div className="wise-settings-select-wrap"><select value={settings.store} onChange={(e) => update("store", e.target.value)}>{stores.map((store) => <option key={store} value={store}>{store}</option>)}</select><ChevronDown size={17} /></div>
            </label>
            <label>Title<input value={settings.title} onChange={(e) => update("title", e.target.value)} placeholder="Receipt title" /></label>
            <label>Header<textarea value={settings.header} onChange={(e) => update("header", e.target.value)} placeholder="Shown at the top of receipts (e.g., store address · phone number · email)" rows={2} /></label>
            <label>Footer<textarea value={settings.footer} onChange={(e) => update("footer", e.target.value)} placeholder="Thank you message" rows={2} /></label>
            <label>Printer Size
              <div className="wise-settings-select-wrap"><select value={settings.paperSize} onChange={(e) => update("paperSize", e.target.value as "58mm" | "80mm")}><option value="58mm">58mm</option><option value="80mm">80mm</option></select><ChevronDown size={17} /></div>
            </label>

            <label className="wise-settings-toggle-row"><input type="checkbox" checked={settings.includeNotes} onChange={(e) => update("includeNotes", e.target.checked)} /><span className="wise-toggle"><i /></span><span>Include notes in receipt by default</span></label>
            <label className="wise-settings-toggle-row"><input type="checkbox" checked={settings.autoPrint} onChange={(e) => update("autoPrint", e.target.checked)} /><span className="wise-toggle"><i /></span><span>Automatically print receipt after order completion</span></label>

            <button className="wise-settings-save" onClick={save} disabled={saving || loading}>{saving ? <Loader2 size={18} className="wise-spin" /> : <Save size={18} />} {saving ? "Saving..." : "Save"}</button>
          </section>

          <section className="wise-settings-preview-wrap">
            <h3>Preview</h3>
            <div className={`wise-settings-receipt ${settings.paperSize === "80mm" ? "wide" : "narrow"}`}>
              <strong className="wise-receipt-title">{settings.title || settings.store}</strong>
              {settings.header && <div className="wise-receipt-header">{settings.header}</div>}
              <div className="wise-receipt-meta">Sep 09, 2026, 9:29 PM<br />Order #: 12345<br />Payment: Cash<br />Cashier: John Doe<br />Customer: Jane Smith<br />Service: Dine In</div>
              <hr />
              {previewItems.map((item) => <div className="wise-receipt-item" key={item.name}><div className="wise-receipt-line"><span>{item.qty} {item.name}</span><span>{money(item.price)}</span></div><small>{item.sub}</small>{item.modifier && <small>{item.modifier}</small>}{item.discount > 0 && <small className="discount">10% off: <b>-{money(item.discount)}</b></small>}</div>)}
              <hr />
              <div className="wise-receipt-totals"><span>Items: <b>6</b></span><span>Subtotal: <b>₱560.00</b></span><span className="discount">Discount (5%): <b>-₱28.00</b></span><strong>Total Amount: <b>₱593.60</b></strong></div>
              <hr />
              <div className="wise-receipt-payment"><span>Payment: <b>₱600.00</b></span><span>Change: <b>₱6.40</b></span></div>
              {settings.includeNotes && <p className="wise-receipt-note">This is a sample note</p>}
              <p className="wise-receipt-footer">{settings.footer || "THANK YOU! COME AGAIN!"}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
