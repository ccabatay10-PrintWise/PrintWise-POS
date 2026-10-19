"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CircleDollarSign, Clock3, Loader2, Plus, RefreshCw, Save, ShieldCheck, Users, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";
import "./payroll.css";

type Employee = { id: string; employee_code: string | null; full_name: string; position_title: string; daily_rate: number; is_active: boolean; notes: string | null };
type Attendance = { id?: string; employee_id: string; work_date: string; attendance_status: "present" | "absent" | "rest_day" | "leave" | "half_day"; time_in: string | null; time_out: string | null; notes: string | null };
type Settings = { id: string; business_name: string; sales_threshold: number; incentive_per_threshold: number; incentive_distribution: "equal" };
const roles = [
  { title: "Team Leader", rate: 400 },
  { title: "Barista", rate: 300 },
  { title: "Service Staff", rate: 250 },
  { title: "Dishwasher", rate: 300 },
];
const todayLocal = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
const money = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(n || 0));
const emptyEmployee = { full_name: "", position_title: "Barista", daily_rate: "300", employee_code: "", notes: "" };

export default function PayrollPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [completedSales, setCompletedSales] = useState(0);
  const [date, setDate] = useState(todayLocal());
  const [form, setForm] = useState(emptyEmployee);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("Administrator");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/pos"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (String(profile?.role || user.app_metadata?.role || user.user_metadata?.role || "").toLowerCase() !== "admin" || profile?.is_active === false) {
        router.replace("/dashboard"); return;
      }
      setUserName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Administrator");
      const start = new Date(`${date}T00:00:00+08:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const [employeeResult, attendanceResult, settingsResult, salesResult] = await Promise.all([
        supabase.from("payroll_employees").select("*").order("full_name"),
        supabase.from("payroll_attendance").select("*").eq("work_date", date),
        supabase.from("payroll_settings").select("*").limit(1).maybeSingle(),
        supabase.from("pos_orders").select("total").eq("status", "completed").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
      ]);
      if (employeeResult.error) throw employeeResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (settingsResult.error) throw settingsResult.error;
      if (salesResult.error) throw salesResult.error;
      setEmployees((employeeResult.data || []) as Employee[]);
      setAttendance(Object.fromEntries((attendanceResult.data || []).map((a: Attendance) => [a.employee_id, a])));
      setSettings(settingsResult.data as Settings | null);
      setCompletedSales((salesResult.data || []).reduce((sum: number, order: { total: number | string }) => sum + Number(order.total || 0), 0));
    } catch (e: any) { setError(e.message || "Could not load payroll data."); }
    finally { setLoading(false); }
  }, [date, router]);

  useEffect(() => { void load(); }, [load]);

  const presentCount = useMemo(() => employees.filter(e => e.is_active && ["present", "half_day"].includes(attendance[e.id]?.attendance_status || "")).length, [employees, attendance]);
  const activeCount = employees.filter(e => e.is_active).length;
  const estimatedDailyPay = useMemo(() => employees.filter(e => e.is_active).reduce((sum, e) => {
    const status = attendance[e.id]?.attendance_status;
    return sum + (status === "present" ? Number(e.daily_rate) : status === "half_day" ? Number(e.daily_rate) / 2 : 0);
  }, 0), [employees, attendance]);

  const addEmployee = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!form.full_name.trim() || !form.position_title || Number(form.daily_rate) < 0) { setError("Enter a name, position, and valid daily rate."); return; }
    setSaving(true);
    try {
      const { error: saveError } = await supabase.from("payroll_employees").insert({
        full_name: form.full_name.trim(), position_title: form.position_title, daily_rate: Number(form.daily_rate),
        employee_code: form.employee_code.trim() || null, notes: form.notes.trim() || null,
      });
      if (saveError) throw saveError;
      setMessage("Employee record added.");
      setForm(emptyEmployee); setShowAdd(false); await load();
    } catch (e: any) { setError(e.message || "Unable to add employee."); }
    finally { setSaving(false); }
  };

  const updateAttendance = (employee: Employee, field: keyof Attendance, value: string) => {
    setAttendance(current => ({
      ...current,
      [employee.id]: {
        ...(current[employee.id] || { employee_id: employee.id, work_date: date, attendance_status: "present", time_in: null, time_out: null, notes: null }),
        employee_id: employee.id, work_date: date, [field]: value || null,
      } as Attendance,
    }));
  };

  const saveAttendance = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const rows = employees.filter(e => e.is_active).map(e => {
        const a = attendance[e.id] || { employee_id: e.id, work_date: date, attendance_status: "present", time_in: null, time_out: null, notes: null };
        return { employee_id: e.id, work_date: date, attendance_status: a.attendance_status, time_in: a.time_in || null, time_out: a.time_out || null, notes: a.notes || null, updated_at: new Date().toISOString() };
      });
      if (rows.length) {
        const { error: saveError } = await supabase.from("payroll_attendance").upsert(rows, { onConflict: "employee_id,work_date" });
        if (saveError) throw saveError;
      }
      setMessage("Attendance saved for " + date + ".");
      await load();
    } catch (e: any) { setError(e.message || "Unable to save attendance."); }
    finally { setSaving(false); }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const { error: saveError } = await supabase.from("payroll_settings").update({
        sales_threshold: Number(settings.sales_threshold), incentive_per_threshold: Number(settings.incentive_per_threshold),
        incentive_distribution: "equal", updated_at: new Date().toISOString(),
      }).eq("id", settings.id);
      if (saveError) throw saveError;
      setMessage("Incentive settings saved."); await load();
    } catch (e: any) { setError(e.message || "Unable to save incentive settings."); }
    finally { setSaving(false); }
  };

  const changeRole = (role: string) => {
    const preset = roles.find(r => r.title === role);
    setForm(current => ({ ...current, position_title: role, daily_rate: preset ? String(preset.rate) : current.daily_rate }));
  };

  return <div className="app-shell payroll-shell">
    <Sidebar />
    <main className="payroll-main">
      <header className="payroll-header">
        <div><div className="payroll-kicker"><ShieldCheck size={14}/> ESPACIO CAFÉ & RESTAURANT</div><h1>Payroll & Attendance</h1><p>Employee records, daily attendance, and equal-share incentive settings.</p></div>
        <div className="payroll-header-actions"><button className="payroll-btn secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button><button className="payroll-btn primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add Employee</button></div>
      </header>
      {error && <div className="payroll-alert error">{error}</div>}
      {message && <div className="payroll-alert success"><Check size={16}/>{message}</div>}
      <section className="payroll-stats">
        <article><span className="payroll-stat-icon"><Users size={19}/></span><div><small>Active Employees</small><strong>{activeCount}</strong></div></article>
        <article><span className="payroll-stat-icon"><CalendarDays size={19}/></span><div><small>Present / Half Day</small><strong>{presentCount}</strong></div></article>
        <article><span className="payroll-stat-icon"><Wallet size={19}/></span><div><small>Estimated Daily Basic Pay</small><strong>{money(estimatedDailyPay)}</strong></div></article>
        <article><span className="payroll-stat-icon"><CircleDollarSign size={19}/></span><div><small>Incentive Rule</small><strong>{money(Number(settings?.incentive_per_threshold || 100))} / {money(Number(settings?.sales_threshold || 3000))}</strong></div></article>
      </section>
      <section className="payroll-card">
        <div className="payroll-card-head"><div><span>DAILY RECORD</span><h2>Attendance register</h2><p>Set attendance status for each active employee and save the selected date.</p></div><label className="payroll-date"><CalendarDays size={16}/><input type="date" value={date} onChange={e => setDate(e.target.value)}/></label></div>
        {loading ? <div className="payroll-loading"><Loader2 className="spin" size={22}/> Loading payroll data…</div> : employees.filter(e => e.is_active).length === 0 ? <div className="payroll-empty"><Users size={30}/><strong>No employee records yet</strong><p>Add your ESPACIO team members to begin recording attendance.</p><button className="payroll-btn primary" onClick={() => setShowAdd(true)}><Plus size={16}/> Add first employee</button></div> : <>
          <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>EMPLOYEE</th><th>POSITION</th><th>DAILY RATE</th><th>ATTENDANCE</th><th>TIME IN</th><th>TIME OUT</th></tr></thead><tbody>
          {employees.filter(e => e.is_active).map(employee => { const a = attendance[employee.id] || { attendance_status: "present", time_in: "", time_out: "" }; return <tr key={employee.id}>
            <td><strong>{employee.full_name}</strong><small>{employee.employee_code || "No employee code"}</small></td><td>{employee.position_title}</td><td className="payroll-money">{money(Number(employee.daily_rate))}</td>
            <td><select value={a.attendance_status} onChange={e => updateAttendance(employee, "attendance_status", e.target.value)}><option value="present">Present</option><option value="half_day">Half day</option><option value="absent">Absent</option><option value="rest_day">Rest day</option><option value="leave">Leave</option></select></td>
            <td><input aria-label={employee.full_name + " time in"} type="time" value={a.time_in || ""} onChange={e => updateAttendance(employee, "time_in", e.target.value)}/></td>
            <td><input aria-label={employee.full_name + " time out"} type="time" value={a.time_out || ""} onChange={e => updateAttendance(employee, "time_out", e.target.value)}/></td>
          </tr>; })}
          </tbody></table></div>
          <div className="payroll-card-footer"><span><Clock3 size={15}/> Attendance changes are saved only when you click Save Attendance.</span><button className="payroll-btn primary" onClick={() => void saveAttendance()} disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save Attendance"}</button></div>
        </>}
      </section>
      <section className="payroll-card incentive-card">
        <div className="payroll-card-head"><div><span>INCENTIVE SETTINGS</span><h2>Equal-sharing rule</h2><p>Only complete sales thresholds are counted. The final pool is divided equally among eligible employees.</p></div></div>
        {!settings ? <p className="payroll-note">Settings will appear after the payroll database migration is applied.</p> : <div className="payroll-settings-grid">
          <label>Completed sales threshold (₱)<input type="number" min="1" step="100" value={settings.sales_threshold} onChange={e => setSettings({ ...settings, sales_threshold: Number(e.target.value) })}/></label>
          <label>Incentive per threshold (₱)<input type="number" min="0" step="10" value={settings.incentive_per_threshold} onChange={e => setSettings({ ...settings, incentive_per_threshold: Number(e.target.value) })}/></label>
          <div className="payroll-rule-preview"><small>Example at ₱25,453 sales</small><strong>{money(Math.floor(25453 / Number(settings.sales_threshold || 3000)) * Number(settings.incentive_per_threshold || 0))} incentive pool</strong><span>Equal split among eligible employees. Example only; live sales above are read directly from completed POS orders.</span></div>
          <div className="payroll-settings-actions"><button className="payroll-btn secondary" onClick={() => setSettings({ ...settings, sales_threshold: 3000, incentive_per_threshold: 100 })}>Reset defaults</button><button className="payroll-btn primary" onClick={() => void saveSettings()} disabled={saving}><Save size={16}/> Save settings</button></div>
        </div>}
      </section>
      <section className="payroll-note"><strong>Next integration step</strong><p>This first module establishes employee records, attendance, and live daily incentive estimates from completed POS orders. Payroll-period generation, approval controls, deductions, and payslip printing remain the next implementation phase.</p></section>
    </main>
    {showAdd && <div className="payroll-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAdd(false); }}><section className="payroll-modal" role="dialog" aria-modal="true" aria-labelledby="payroll-add-title">
      <header><div><span>TEAM RECORD</span><h2 id="payroll-add-title">Add ESPACIO employee</h2><p>Daily rates are editable before saving.</p></div><button className="payroll-icon-btn" onClick={() => setShowAdd(false)} aria-label="Close"><X size={18}/></button></header>
      <form onSubmit={addEmployee}>
        <label>Full name<input autoFocus required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Employee full name"/></label>
        <div className="payroll-form-row"><label>Position<select value={form.position_title} onChange={e => changeRole(e.target.value)}>{roles.map(r => <option key={r.title} value={r.title}>{r.title} — {money(r.rate)}/day</option>)}</select></label><label>Daily rate (₱)<input required type="number" min="0" step="0.01" value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })}/></label></div>
        <label>Employee code (optional)<input value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} placeholder="e.g. ESP-001"/></label>
        <label>Notes (optional)<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes"/></label>
        <footer><button type="button" className="payroll-btn secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="payroll-btn primary" type="submit" disabled={saving}><Plus size={16}/>{saving ? "Saving…" : "Save Employee"}</button></footer>
      </form>
    </section></div>}
    <div className="payroll-user-tag">{userName}</div>
  </div>;
}
