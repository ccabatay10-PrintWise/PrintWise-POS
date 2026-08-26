"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, CreditCard, ImagePlus, Loader2, ReceiptText, RotateCcw, Save, Settings2, ShieldCheck, Store, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "../pos/pos.css";
import "./settings.css";

type CompanySettings = {
  id?: string;
  business_name: string;
  tagline: string;
  address: string;
  contact_number: string;
  email: string;
  logo_url: string;
  receipt_footer: string;
  currency: string;
  receipt_paper_size: "58mm" | "80mm";
  tax_enabled: boolean;
  tax_rate: number;
  default_discount: number;
};

const STORAGE_KEY = "printwise-company-settings";
const DEFAULTS: CompanySettings = {
  business_name: "PRINTWISE",
  tagline: "Printing & Customized Services",
  address: "Guiguinto, Bulacan, Philippines",
  contact_number: "",
  email: "",
  logo_url: "",
  receipt_footer: "Thank you for choosing PRINTWISE!",
  currency: "PHP",
  receipt_paper_size: "80mm",
  tax_enabled: false,
  tax_rate: 0,
  default_discount: 0,
};

function normalize(row: any): CompanySettings {
  return {
    ...DEFAULTS,
    ...row,
    receipt_paper_size: row?.receipt_paper_size === "58mm" ? "58mm" : "80mm",
    tax_enabled: Boolean(row?.tax_enabled),
    tax_rate: Number(row?.tax_rate || 0),
    default_discount: Number(row?.default_discount || 0),
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const initials = useMemo(() => {
    const words = settings.business_name.trim().split(/\s+/).filter(Boolean);
    return (words.slice(0, 2).map((word) => word[0]).join("") || "PW").toUpperCase();
  }, [settings.business_name]);

  const update = (key: keyof CompanySettings, value: any) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = String(user?.app_metadata?.role || user?.user_metadata?.role || "admin").toLowerCase();
      setIsAdmin(role === "admin");

      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error && !/company_settings/i.test(error.message)) throw error;
        if (data) {
          const next = normalize(data);
          setSettings(next);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } else {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) setSettings(normalize(JSON.parse(cached)));
          if (error) setWarning("Using this browser's saved settings. Run the included SQL once to sync settings to Supabase for all devices.");
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) setSettings(normalize(JSON.parse(cached)));
        setWarning("Using this browser's saved settings. Run the included SQL once to sync settings to Supabase for all devices.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const save = async () => {
    if (isAdmin === false) return;
    setSaving(true);
    setMessage("");
    setWarning("");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    try {
      const payload = { ...settings } as any;
      delete payload.id;
      const { data, error } = await supabase
        .from("company_settings")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        const next = normalize(data);
        setSettings(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      setMessage("Company settings saved successfully and synced to Supabase.");
    } catch (e: any) {
      setMessage("Settings saved in this browser. Database sync is not active yet.");
      setWarning("Run the included company_settings SQL in Supabase to enable cross-device saving.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!confirm("Reset the form to the PrintWise defaults? This will not save until you click Save Changes.")) return;
    setSettings(DEFAULTS);
    setMessage("");
    setWarning("");
  };

  const copyFooter = async () => {
    await navigator.clipboard.writeText(settings.receipt_footer || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (loading) {
    return <main className="app-shell"><Sidebar /><section className="workspace"><div className="settings-loading"><Loader2 className="spin" size={28} /> Loading company settings...</div></section></main>;
  }

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace settings-workspace">
        <header className="topbar settings-topbar">
          <div>
            <div className="settings-eyebrow"><Settings2 size={16} /> SYSTEM CONFIGURATION</div>
            <h1>Settings & Company Profile</h1>
            <p>Manage the PrintWise business information used across receipts, documents, and future reports.</p>
          </div>
          <div className="settings-header-actions">
            <button className="settings-secondary-btn" onClick={reset}><RotateCcw size={17} /> Reset</button>
            <button className="settings-save-btn" disabled={saving || isAdmin === false} onClick={save}>
              {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />} {saving ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        </header>

        {isAdmin === false && <div className="settings-alert error"><ShieldCheck size={18} /> Only administrators can change company settings.</div>}
        {message && <div className="settings-alert success"><Check size={18} /> {message}</div>}
        {warning && <div className="settings-alert warning"><ReceiptText size={18} /> {warning}</div>}

        <div className="settings-grid">
          <section className="settings-card profile-card">
            <div className="settings-card-head"><div className="settings-card-icon"><Store size={21} /></div><div><h2>Company Profile</h2><p>Your official business identity.</p></div></div>
            <div className="logo-editor">
              <div className="company-logo-preview">
                {settings.logo_url ? <img src={settings.logo_url} alt="Company logo" /> : <span>{initials}</span>}
              </div>
              <div className="logo-copy"><b>Business Logo</b><small>Paste a public image URL. A fallback monogram is shown when no logo is set.</small></div>
              {settings.logo_url && <button className="clear-logo" onClick={() => update("logo_url", "")} title="Remove logo"><X size={16} /></button>}
            </div>
            <label className="field full"><span><ImagePlus size={15} /> Logo URL</span><input value={settings.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://.../printwise-logo.png" /></label>
            <div className="field-grid">
              <label className="field"><span>Business Name</span><input value={settings.business_name} onChange={(e) => update("business_name", e.target.value)} /></label>
              <label className="field"><span>Tagline</span><input value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} /></label>
              <label className="field full"><span>Business Address</span><input value={settings.address} onChange={(e) => update("address", e.target.value)} /></label>
              <label className="field"><span>Contact Number</span><input value={settings.contact_number} onChange={(e) => update("contact_number", e.target.value)} placeholder="0917 123 4567" /></label>
              <label className="field"><span>Email Address</span><input type="email" value={settings.email} onChange={(e) => update("email", e.target.value)} placeholder="hello@printwise.com" /></label>
            </div>
          </section>

          <section className="settings-card receipt-card">
            <div className="settings-card-head"><div className="settings-card-icon"><ReceiptText size={21} /></div><div><h2>Receipt Settings</h2><p>Configure your POS thermal receipt defaults.</p></div></div>
            <div className="field-grid">
              <label className="field"><span>Currency</span><select value={settings.currency} onChange={(e) => update("currency", e.target.value)}><option value="PHP">PHP — Philippine Peso</option><option value="USD">USD — US Dollar</option></select></label>
              <label className="field"><span>Thermal Paper Size</span><select value={settings.receipt_paper_size} onChange={(e) => update("receipt_paper_size", e.target.value as "58mm" | "80mm")}><option value="80mm">80mm (Recommended)</option><option value="58mm">58mm</option></select></label>
              <label className="field full"><span>Receipt Footer Message</span><div className="textarea-wrap"><textarea rows={4} value={settings.receipt_footer} onChange={(e) => update("receipt_footer", e.target.value)} placeholder="Thank you for choosing PrintWise!" /><button onClick={copyFooter} title="Copy footer">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div></label>
            </div>
            <div className="receipt-preview">
              <div className="preview-paper preview-paper-80"><div className="preview-brand">{settings.business_name || "PRINTWISE"}</div><small>{settings.tagline}</small><div className="preview-line"/><div className="preview-row"><span>Sample Order</span><b>₱100.00</b></div><div className="preview-row total"><span>TOTAL</span><b>₱100.00</b></div><div className="preview-line"/><p>{settings.receipt_footer || "Thank you for choosing PrintWise!"}</p></div>
              <div><b>Live Receipt Preview</b><small>Preview follows your selected thermal paper size and company branding.</small></div>
            </div>
          </section>

          <section className="settings-card finance-card">
            <div className="settings-card-head"><div className="settings-card-icon"><CreditCard size={21} /></div><div><h2>Pricing & Tax Defaults</h2><p>Set the defaults used when creating new transactions.</p></div></div>
            <div className="toggle-row"><div><b>Enable Tax</b><small>Prepare tax calculations for future POS and reports.</small></div><button className={`toggle ${settings.tax_enabled ? "on" : ""}`} onClick={() => update("tax_enabled", !settings.tax_enabled)} aria-pressed={settings.tax_enabled}><i /></button></div>
            <div className="field-grid compact-fields">
              <label className="field"><span>Tax Rate (%)</span><input type="number" min="0" max="100" step="0.01" disabled={!settings.tax_enabled} value={settings.tax_rate} onChange={(e) => update("tax_rate", Number(e.target.value) || 0)} /></label>
              <label className="field"><span>Default Discount (₱)</span><input type="number" min="0" step="0.01" value={settings.default_discount} onChange={(e) => update("default_discount", Number(e.target.value) || 0)} /></label>
            </div>
          </section>

          <aside className="settings-summary-card">
            <div className="summary-glow" />
            <div className="summary-logo">{settings.logo_url ? <img src={settings.logo_url} alt="" /> : initials}</div>
            <span>COMPANY PROFILE</span>
            <h2>{settings.business_name || "PRINTWISE"}</h2>
            <p>{settings.tagline || "Printing & Customized Services"}</p>
            <div className="summary-details"><div>{settings.address || "No address set"}</div><div>{settings.contact_number || "No contact number set"}</div><div>{settings.email || "No email set"}</div></div>
            <div className="summary-status"><i /> Ready for receipts & documents</div>
          </aside>
        </div>
      </section>
    </main>
  );
}
