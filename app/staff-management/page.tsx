"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, Plus, ShieldCheck, UserCheck, UserPlus, UserX, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import "./staff-management.css";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
};

const emptyForm = { name: "", email: "", password: "", confirmPassword: "" };

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [businessName, setBusinessName] = useState("WISE POS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    };
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pos");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_active,business_name")
        .eq("id", user.id)
        .maybeSingle();

      const role = String(profile?.role || user.app_metadata?.role || user.user_metadata?.role || "").toLowerCase();
      if (role !== "admin" || profile?.is_active === false) {
        router.replace("/dashboard");
        return;
      }

      if (profile?.business_name) setBusinessName(profile.business_name);
      else if (user.user_metadata?.business_name) setBusinessName(String(user.user_metadata.business_name));

      const res = await fetch("/api/staff", { headers: await authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to load staff accounts.");
      setStaff(json.staff || []);
      if (json.businessName) setBusinessName(json.businessName);
    } catch (e: any) {
      setError(e.message || "Unable to load staff accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(() => staff.filter(s => s.active).length, [staff]);
  const inactiveCount = staff.length - activeCount;

  const createStaff = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Enter the staff member's full name and email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          action: "create",
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unable to create staff account.");
      setMessage(json.created === false ? "The existing account was restored as a staff account." : `${form.name.trim()} can now sign in as Staff.`);
      setForm(emptyForm);
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.message || "Unable to create staff account.");
    } finally {
      setSaving(false);
    }
  };

  const staffAction = async (member: Staff, action: "toggle_active" | "reset_password") => {
    setError("");
    setMessage("");
    let password = "";
    if (action === "reset_password") {
      password = window.prompt(`New password for ${member.name} (minimum 6 characters):`) || "";
      if (!password) return;
      if (password.length < 6) {
        setError("Password must contain at least 6 characters.");
        return;
      }
    }

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          action,
          staffId: member.id,
          active: action === "toggle_active" ? !member.active : undefined,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Staff account update failed.");
      setMessage(action === "reset_password" ? `Password updated for ${member.name}.` : `${member.name} is now ${member.active ? "inactive" : "active"}.`);
      await load();
    } catch (e: any) {
      setError(e.message || "Staff account update failed.");
    }
  };

  if (loading) {
    return <main className="staff-management-loading"><Loader2 className="spin" size={24} /><strong>Loading Staff Accounts</strong><span>Checking administrator access...</span></main>;
  }

  return (
    <main className="staff-management-page">
      <div className="staff-management-shell">
        <header className="staff-management-hero">
          <div>
            <button type="button" className="back-link" onClick={() => router.push("/dashboard")}><ArrowLeft size={16} /> Back to Dashboard</button>
            <div className="staff-management-kicker"><ShieldCheck size={14} /> {businessName.toUpperCase()} • ADMINISTRATION</div>
            <h1>Staff Accounts</h1>
            <p>Create and manage secure Staff logins for your daily operations.</p>
          </div>
          <button type="button" className="primary-staff-button" onClick={() => { setError(""); setMessage(""); setShowCreate(true); }}><UserPlus size={18} /> Add Staff Account</button>
        </header>

        {(message || error) && (
          <div className={message ? "staff-notice success" : "staff-notice error"}>
            {message ? <CheckCircle2 size={18} /> : <X size={18} />}
            <span>{message || error}</span>
          </div>
        )}

        <section className="staff-management-stats">
          <article><span className="stat-icon"><Users size={20} /></span><div><small>Total Staff</small><strong>{staff.length}</strong></div></article>
          <article><span className="stat-icon"><UserCheck size={20} /></span><div><small>Active</small><strong>{activeCount}</strong></div></article>
          <article><span className="stat-icon"><UserX size={20} /></span><div><small>Inactive</small><strong>{inactiveCount}</strong></div></article>
        </section>

        <section className="staff-management-card">
          <div className="card-heading"><div><span>USER ACCESS</span><h2>Staff Directory</h2><p>Staff accounts can use the operational tools assigned to them. Administrative areas stay restricted.</p></div><div className="secure-pill"><ShieldCheck size={15} /> Admin controlled</div></div>
          <div className="staff-table-wrap">
            <div className="staff-table-head"><span>STAFF MEMBER</span><span>ROLE</span><span>STATUS</span><span>CREATED</span><span>ACTIONS</span></div>
            {staff.length === 0 ? (
              <div className="staff-empty"><UserPlus size={30} /><strong>No staff accounts yet</strong><p>Add your first staff login to get started.</p><button type="button" onClick={() => setShowCreate(true)}>Add Staff Account</button></div>
            ) : staff.map(member => (
              <div className="staff-row" key={member.id}>
                <div className="member-cell"><span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span><div><strong>{member.name}</strong><small><Mail size={12} /> {member.email}</small></div></div>
                <span className="role-pill">{member.role}</span>
                <span className={`status-pill ${member.active ? "active" : "inactive"}`}><i /> {member.active ? "Active" : "Inactive"}</span>
                <span className="created-date">{new Date(member.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</span>
                <div className="row-actions"><button type="button" onClick={() => void staffAction(member, "reset_password")} title="Reset password"><KeyRound size={15} /></button><button type="button" className={member.active ? "danger-action" : ""} onClick={() => void staffAction(member, "toggle_active")} title={member.active ? "Deactivate" : "Activate"}>{member.active ? <UserX size={15} /> : <UserCheck size={15} />}</button></div>
              </div>
            ))}
          </div>
        </section>

        <section className="staff-management-help"><div className="help-icon"><ShieldCheck size={20} /></div><div><strong>How Staff Login Works</strong><p>Each staff member receives an individual email and password. After signing in, they are sent to the Staff Portal. They can access POS, WISE MENU, WISE KITCHEN, Orders, Payments, and Customers, while administrative navigation remains locked.</p></div></section>
      </div>

      {showCreate && (
        <div className="staff-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title">
            <div className="modal-header"><div><span className="modal-kicker"><UserPlus size={14} /> NEW STAFF</span><h2 id="staff-modal-title">Create Staff Account</h2><p>The account will be confirmed automatically and ready for login.</p></div><button type="button" className="modal-close" onClick={() => setShowCreate(false)}><X size={19} /></button></div>
            <form onSubmit={createStaff}>
              <label>Full Name<input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Juan Dela Cruz" autoComplete="name" required /></label>
              <label>Email Address<input value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} type="email" placeholder="juan@example.com" autoComplete="email" required /></label>
              <div className="form-grid"><label>Password<input value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} type="password" placeholder="Minimum 6 characters" autoComplete="new-password" required minLength={6} /></label><label>Confirm Password<input value={form.confirmPassword} onChange={e => setForm(v => ({ ...v, confirmPassword: e.target.value }))} type="password" placeholder="Repeat password" autoComplete="new-password" required minLength={6} /></label></div>
              <div className="modal-security-note"><KeyRound size={16} /><span>Password is used only by Supabase Auth and is never displayed in the staff directory.</span></div>
              {error && <div className="modal-error">{error}</div>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="primary-staff-button" disabled={saving}>{saving ? <><Loader2 size={16} className="spin" /> Creating...</> : <><Plus size={17} /> Create Staff Account</>}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
