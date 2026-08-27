"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type GCashTransaction = {
  id: string;
  transaction_no: string;
  transaction_type: "cash_in" | "cash_out";
  amount: number;
  service_fee: number;
  reference_no: string | null;
  account_number: string | null;
  customer_name: string | null;
  status: "pending" | "successful" | "failed" | "cancelled" | "refunded";
  notes: string | null;
  created_at: string;
};

type TransactionType = "cash_in" | "cash_out";

const feeBrackets = [
  { min: 1, max: 500, fee: 10 },
  { min: 501, max: 1000, fee: 20 },
  { min: 1001, max: 1500, fee: 30 },
  { min: 1501, max: 2000, fee: 40 },
  { min: 2001, max: 2500, fee: 50 },
  { min: 2501, max: 3000, fee: 60 },
  { min: 3001, max: 3500, fee: 70 },
  { min: 3501, max: 4000, fee: 80 },
  { min: 4001, max: 4500, fee: 90 },
  { min: 4501, max: 5000, fee: 100 },
] as const;

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatMobile = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const getChartFee = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return feeBrackets.find((item) => value >= item.min && value <= item.max)?.fee ?? 100;
};

const transactionLabel = (type: TransactionType) => (type === "cash_in" ? "Cash In" : "Cash Out");

const generateTransactionNo = () => {
  const now = new Date();
  const date = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `PW-GC-${date}-${time}${Math.floor(100 + Math.random() * 900)}`;
};

export default function GCashBayadPage() {
  const [transactions, setTransactions] = useState<GCashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [type, setType] = useState<TransactionType>("cash_in");
  const [customerName, setCustomerName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [completedNow, setCompletedNow] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<GCashTransaction | null>(null);
  const [completeReference, setCompleteReference] = useState("");

  const amountNumber = Number(amount || 0);
  const chartFee = getChartFee(amountNumber);
  const additionalFee = amountNumber > 0 ? amountNumber * 0.02 : 0;
  const totalServiceFee = chartFee + additionalFee;
  const customerTotal = amountNumber > 0 ? amountNumber + totalServiceFee : 0;

  const loadTransactions = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setMessage("");
      const { data, error } = await supabase
        .from("payment_transactions")
        .select("id,transaction_no,transaction_type,amount,service_fee,reference_no,account_number,customer_name,status,notes,created_at")
        .eq("channel", "gcash")
        .in("transaction_type", ["cash_in", "cash_out"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions(
        (data ?? []).map((row: any) => ({
          ...row,
          amount: Number(row.amount || 0),
          service_fee: Number(row.service_fee || 0),
        }))
      );
    } catch (error: any) {
      setTransactions([]);
      setMessage(`Unable to load GCash transactions: ${error?.message || "Please check your database connection and permissions."}`);
      setMessageType("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Do not wait on auth.getUser() before clearing the loading state.
    // A slow or failed auth request previously left this page stuck on Loading.
    void loadTransactions();
  }, []);

  const resetForm = () => {
    setCustomerName("");
    setMobileNumber("");
    setAmount("");
    setReferenceNo("");
    setNotes("");
    setCompletedNow(false);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    const cleanMobile = formatMobile(mobileNumber);
    if (!customerName.trim()) {
      setMessage("Please enter the customer's name.");
      setMessageType("error");
      return;
    }
    if (cleanMobile.length < 10) {
      setMessage("Please enter a valid GCash mobile number.");
      setMessageType("error");
      return;
    }
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setMessage("Please enter a valid transaction amount.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Your session has expired. Please sign in again.");

      const { error } = await supabase.from("payment_transactions").insert({
        transaction_no: generateTransactionNo(),
        channel: "gcash",
        transaction_type: type,
        amount: amountNumber,
        service_fee: totalServiceFee,
        reference_no: referenceNo.trim() || null,
        account_number: cleanMobile,
        customer_name: customerName.trim(),
        status: completedNow ? "successful" : "pending",
        notes: notes.trim() || null,
        created_by: auth.user.id,
      });

      if (error) throw error;

      setMessage(`${transactionLabel(type)} saved successfully. Total service fee: ${peso(totalServiceFee)}.`);
      setMessageType("success");
      resetForm();
      await loadTransactions(true);
    } catch (error: any) {
      setMessage(`Unable to save transaction: ${error?.message || "Unknown error."}`);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const markSuccessful = async () => {
    if (!completeTarget) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("payment_transactions")
        .update({
          status: "successful",
          reference_no: completeReference.trim() || completeTarget.reference_no || null,
        })
        .eq("id", completeTarget.id);
      if (error) throw error;

      setMessage("Transaction marked as successful.");
      setMessageType("success");
      setCompleteTarget(null);
      setCompleteReference("");
      await loadTransactions(true);
    } catch (error: any) {
      setMessage(`Unable to complete transaction: ${error?.message || "Unknown error."}`);
      setMessageType("error");
    } finally {
      setUpdating(false);
    }
  };

  const cancelTransaction = async (id: string) => {
    if (!window.confirm("Cancel this pending transaction?")) return;
    try {
      const { error } = await supabase.from("payment_transactions").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      setMessage("Transaction cancelled.");
      setMessageType("success");
      await loadTransactions(true);
    } catch (error: any) {
      setMessage(`Unable to cancel transaction: ${error?.message || "Unknown error."}`);
      setMessageType("error");
    }
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return transactions.filter((transaction) => {
      const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
      const haystack = `${transaction.transaction_no} ${transaction.customer_name || ""} ${transaction.account_number || ""} ${transaction.reference_no || ""}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [transactions, search, statusFilter]);

  const todayKey = new Date().toDateString();
  const todayTransactions = transactions.filter((item) => new Date(item.created_at).toDateString() === todayKey);
  const todayCashIn = todayTransactions.filter((item) => item.status === "successful" && item.transaction_type === "cash_in").reduce((sum, item) => sum + item.amount, 0);
  const todayCashOut = todayTransactions.filter((item) => item.status === "successful" && item.transaction_type === "cash_out").reduce((sum, item) => sum + item.amount, 0);
  const todayFees = todayTransactions.filter((item) => item.status === "successful").reduce((sum, item) => sum + item.service_fee, 0);
  const pendingCount = transactions.filter((item) => item.status === "pending").length;

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="workspace gcash-workspace">
        <header className="topbar gcash-header">
          <div>
            <div className="eyebrow">SERVICE CENTER</div>
            <h1>GCash / Bayad Services</h1>
            <p>Process and record Cash In and Cash Out services with automatic chart-based and 2% transaction fees.</p>
          </div>
          <button className="refresh-btn" onClick={() => void loadTransactions(true)} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
            {refreshing ? "REFRESHING..." : "REFRESH"}
          </button>
        </header>

        <div className="gcash-content">
          <section className="notice-card">
            <Clock3 size={20} />
            <div><strong>Updated automatic fee process</strong><span>Total Service Fee = Chart-Based Fee + 2% of the Transaction Amount.</span></div>
          </section>

          <section className="metric-grid">
            <article className="metric-card"><div className="metric-icon green"><ArrowDownLeft size={21} /></div><div><span>Today's Cash In</span><strong>{peso(todayCashIn)}</strong><small>Successful transactions</small></div></article>
            <article className="metric-card"><div className="metric-icon blue"><ArrowUpRight size={21} /></div><div><span>Today's Cash Out</span><strong>{peso(todayCashOut)}</strong><small>Successful transactions</small></div></article>
            <article className="metric-card"><div className="metric-icon amber"><Banknote size={21} /></div><div><span>Service Fees Today</span><strong>{peso(todayFees)}</strong><small>Fees collected</small></div></article>
            <article className="metric-card"><div className="metric-icon red"><Clock3 size={21} /></div><div><span>Pending</span><strong>{pendingCount}</strong><small>Waiting for completion</small></div></article>
          </section>

          <section className="service-grid">
            <form className="transaction-form-card" onSubmit={handleSave}>
              <div className="form-heading">
                <div><div className="eyebrow">NEW SERVICE</div><h2>{type === "cash_in" ? "Process Cash In" : "Process Cash Out"}</h2><p>Enter the transaction details and PrintWise will calculate the service fee automatically.</p></div>
                <div className="service-icon">{type === "cash_in" ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}</div>
              </div>

              <div className="type-switch">
                <button type="button" className={type === "cash_in" ? "selected" : ""} onClick={() => setType("cash_in")}><ArrowDownLeft size={18} />Cash In</button>
                <button type="button" className={type === "cash_out" ? "selected" : ""} onClick={() => setType("cash_out")}><ArrowUpRight size={18} />Cash Out</button>
              </div>

              <div className="form-grid">
                <label className="full-field">Customer Name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Juan Dela Cruz" required /></label>
                <label>GCash Mobile Number<input inputMode="numeric" value={mobileNumber} onChange={(event) => setMobileNumber(formatMobile(event.target.value))} placeholder="09XXXXXXXXX" required /></label>
                <label>Transaction Amount<div className="money-input"><span>₱</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" required /></div></label>
                <label>Chart-Based Fee<div className="money-input locked"><span>₱</span><input value={chartFee.toFixed(2)} readOnly /></div></label>
                <label>Additional 2% Fee<div className="money-input locked"><span>₱</span><input value={additionalFee.toFixed(2)} readOnly /></div></label>
                <label>Total Service Fee<div className="money-input total"><span>₱</span><input value={totalServiceFee.toFixed(2)} readOnly /></div></label>
                <label>Reference Number <em>(optional)</em><input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder="Enter after successful transfer" /></label>
                <label className="full-field">Notes <em>(optional)</em><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Additional transaction notes..." rows={3} /></label>
              </div>

              <div className="amount-preview">
                <span>TOTAL AMOUNT TO COLLECT</span>
                <strong>{peso(customerTotal)}</strong>
                <small>Transaction {peso(amountNumber)} + Service Fee {peso(totalServiceFee)}</small>
              </div>

              <div className="fee-schedule">
                <div className="fee-schedule-head"><strong>Chart-Based Fee Schedule</strong><span>PLUS 2% ON EVERY TRANSACTION</span></div>
                <div className="fee-grid">{feeBrackets.map((bracket) => <div key={bracket.min} className={amountNumber >= bracket.min && amountNumber <= bracket.max ? "active" : ""}><span>₱{bracket.min.toLocaleString()}–₱{bracket.max.toLocaleString()}</span><b>₱{bracket.fee}</b></div>)}</div>
              </div>

              <label className="completion-check"><input type="checkbox" checked={completedNow} onChange={(event) => setCompletedNow(event.target.checked)} /><span><strong>The actual GCash transaction is already completed.</strong><small>Check only after confirming the wallet transaction.</small></span></label>
              <div className="form-actions"><button type="button" className="secondary-btn" onClick={resetForm}>Clear Form</button><button type="submit" className="primary-btn" disabled={saving}><Plus size={18} />{saving ? "SAVING..." : completedNow ? "RECORD SUCCESSFUL" : "SAVE AS PENDING"}</button></div>
            </form>

            <aside className="workflow-card">
              <Wallet size={24} />
              <h2>Recommended Workflow</h2>
              <ol><li>Enter the transaction amount.</li><li>Review the chart fee and automatic 2% fee.</li><li>Collect the total amount.</li><li>Confirm the actual GCash transaction.</li><li>Mark the record as successful and save the reference number.</li></ol>
              <div className="formula-card"><span>FORMULA</span><strong>Chart Fee + (Amount × 2%)</strong><small>Total Service Fee</small></div>
              <p className="workflow-tip">Never enter your GCash password or OTP into PrintWise.</p>
            </aside>
          </section>

          {message && <div className={`message transaction-message ${messageType}`}>{message}</div>}

          <section className="transactions-card">
            <div className="transactions-head">
              <div><h2>GCash Transaction History</h2><p>{filtered.length} transaction{filtered.length === 1 ? "" : "s"} shown.</p></div>
              <div className="history-tools">
                <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, mobile, reference..." /></div>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="successful">Successful</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option></select>
              </div>
            </div>
            <div className="table-wrap"><table className="payment-table gcash-table"><thead><tr><th>Transaction</th><th>Customer</th><th>Service</th><th>Amount</th><th>Total Fee</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {loading ? <tr><td colSpan={8} className="empty-state">Loading GCash transactions...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="empty-state">No GCash transactions found yet.</td></tr> : filtered.map((transaction) => <tr key={transaction.id}><td><b>{transaction.transaction_no}</b><small>{new Date(transaction.created_at).toLocaleString()}</small></td><td><b>{transaction.customer_name || "Walk-in Customer"}</b><small>{transaction.account_number || "No mobile number"}</small></td><td>{transactionLabel(transaction.transaction_type)}</td><td>{peso(transaction.amount)}</td><td>{peso(transaction.service_fee)}</td><td>{transaction.reference_no || "—"}</td><td><span className={`status-badge ${transaction.status}`}>{transaction.status}</span></td><td>{transaction.status === "pending" && <div className="row-actions"><button className="icon-action complete" title="Mark successful" onClick={() => { setCompleteTarget(transaction); setCompleteReference(transaction.reference_no || ""); }}><Check size={17} /></button><button className="icon-action cancel" title="Cancel transaction" onClick={() => void cancelTransaction(transaction.id)}><X size={17} /></button></div>}</td></tr>)}
            </tbody></table></div>
          </section>
        </div>

        {completeTarget && <div className="modal-backdrop"><div className="complete-modal"><button className="modal-close" onClick={() => setCompleteTarget(null)}><X size={20} /></button><CheckCircle2 size={30} /><h2>Complete Transaction</h2><p>Confirm that the actual GCash transaction has been successfully completed.</p><label>Official Reference Number <em>(optional)</em><input value={completeReference} onChange={(event) => setCompleteReference(event.target.value)} placeholder="Paste the transaction reference" /></label><div className="modal-actions"><button className="secondary-btn" onClick={() => setCompleteTarget(null)}>Cancel</button><button className="primary-btn" onClick={() => void markSuccessful()} disabled={updating}><Check size={18} />{updating ? "UPDATING..." : "MARK SUCCESSFUL"}</button></div></div></div>}

        <style jsx>{`
          .gcash-workspace{background:#f7f8fb;min-height:100vh}.gcash-header{padding:24px 30px;background:#fff;border-bottom:1px solid #e8ecf2}.eyebrow{color:#ef2620;font-size:11px;font-weight:800;letter-spacing:.12em;margin-bottom:4px}.gcash-header h1{margin:0;font-size:30px}.gcash-header p{margin:5px 0 0;color:#64748b}.refresh-btn,.primary-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;padding:13px 18px;background:#e11d1a;color:#fff;font-weight:800;cursor:pointer}.refresh-btn:disabled,.primary-btn:disabled{opacity:.65;cursor:wait}.spin{animation:spin 1s linear infinite}.gcash-content{padding:28px 30px 40px;max-width:1540px;margin:auto}.notice-card{display:flex;gap:12px;background:#fff8e8;border:1px solid #f5d995;border-radius:16px;padding:15px 17px;color:#8a5b00;margin-bottom:18px}.notice-card strong,.notice-card span{display:block}.notice-card span{font-size:13px;margin-top:3px}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.metric-card,.transaction-form-card,.workflow-card,.transactions-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;box-shadow:0 5px 18px rgba(15,23,42,.035)}.metric-card{padding:18px;display:flex;gap:12px}.metric-card span,.metric-card small{display:block;color:#64748b;font-size:12px}.metric-card strong{display:block;font-size:24px;margin:5px 0}.metric-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center}.green{background:#ecfdf3;color:#15803d}.blue{background:#eff6ff;color:#2563eb}.amber{background:#fff8e8;color:#b45309}.red{background:#fff1f0;color:#e11d1a}.service-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.75fr);gap:18px;margin-top:18px}.transaction-form-card{padding:24px}.form-heading{display:flex;justify-content:space-between;gap:18px}.form-heading h2,.workflow-card h2,.transactions-head h2{margin:0}.form-heading p,.transactions-head p{color:#64748b;font-size:13px}.service-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:15px;background:#fff1f0;color:#e11d1a}.type-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f7f8fb;border:1px solid #e8ecf2;border-radius:14px;padding:5px;margin:20px 0}.type-switch button{display:flex;justify-content:center;align-items:center;gap:8px;border:0;background:transparent;padding:12px;border-radius:10px;font-weight:800;color:#64748b;cursor:pointer}.type-switch .selected{background:#fff;color:#e11d1a;box-shadow:0 2px 9px rgba(15,23,42,.08)}.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.form-grid label,.complete-modal label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:800;color:#334155}.full-field{grid-column:1/-1}.form-grid input,.form-grid textarea,.complete-modal input,.history-tools select{width:100%;box-sizing:border-box;border:1px solid #dce3ec;border-radius:10px;padding:11px 12px;font:inherit}.money-input{display:flex;border:1px solid #dce3ec;border-radius:10px;overflow:hidden}.money-input span{padding:11px;background:#f8fafc;border-right:1px solid #e8ecf2}.money-input input{border:0;border-radius:0}.locked{background:#f8fafc}.total{border-color:#f1aaa7;background:#fff8f7}.amount-preview{margin-top:16px;padding:18px;border-radius:14px;background:#18202d;color:#fff}.amount-preview span,.amount-preview small{display:block;font-size:11px;opacity:.75}.amount-preview strong{display:block;font-size:28px;margin:4px 0}.fee-schedule{margin-top:16px;border:1px solid #e8ecf2;border-radius:14px;padding:14px}.fee-schedule-head{display:flex;justify-content:space-between;font-size:12px}.fee-schedule-head span{color:#e11d1a;font-weight:800}.fee-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}.fee-grid div{display:flex;justify-content:space-between;padding:9px;border-radius:8px;background:#f8fafc;font-size:12px}.fee-grid .active{background:#fff1f0;color:#b91c1c}.completion-check{display:flex;gap:10px;margin-top:16px}.completion-check span{display:flex;flex-direction:column}.completion-check small{color:#64748b;margin-top:3px}.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.secondary-btn{border:1px solid #dce3ec;background:#fff;border-radius:12px;padding:13px 18px;font-weight:800;cursor:pointer}.workflow-card{padding:24px}.workflow-card ol{padding-left:20px;color:#475569;line-height:1.8}.formula-card{margin-top:18px;padding:16px;border-radius:14px;background:#fff1f0;color:#991b1b}.formula-card span,.formula-card small{display:block;font-size:11px}.formula-card strong{display:block;margin:5px 0}.workflow-tip{margin-top:16px;color:#64748b;font-size:12px}.transaction-message{margin:18px 0;padding:14px 16px;border-radius:12px}.transaction-message.success{background:#ecfdf3;color:#166534}.transaction-message.error{background:#fff1f0;color:#b91c1c}.transactions-card{padding:22px}.transactions-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}.history-tools{display:flex;gap:10px}.search-box{display:flex;align-items:center;gap:8px;border:1px solid #dce3ec;border-radius:10px;padding:0 10px;background:#fff}.search-box input{border:0;outline:0;padding:10px;width:230px}.table-wrap{overflow:auto}.payment-table{width:100%;border-collapse:collapse}.payment-table th,.payment-table td{padding:13px 10px;border-bottom:1px solid #edf0f4;text-align:left;font-size:13px}.payment-table th{color:#64748b;font-size:11px;text-transform:uppercase}.payment-table td small{display:block;color:#94a3b8;margin-top:3px}.empty-state{text-align:center;padding:35px!important;color:#64748b}.status-badge{padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800;text-transform:capitalize;background:#f1f5f9}.status-badge.successful{background:#ecfdf3;color:#166534}.status-badge.pending{background:#fff8e8;color:#a16207}.status-badge.cancelled,.status-badge.failed{background:#fff1f0;color:#b91c1c}.row-actions{display:flex;gap:6px}.icon-action{width:32px;height:32px;border-radius:8px;border:1px solid #dce3ec;background:#fff;display:grid;place-items:center;cursor:pointer}.complete{color:#15803d}.cancel{color:#dc2626}.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:20px;z-index:50}.complete-modal{position:relative;width:min(460px,100%);background:#fff;border-radius:18px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.2)}.modal-close{position:absolute;right:14px;top:14px;border:0;background:transparent;cursor:pointer}.complete-modal h2{margin:12px 0 6px}.complete-modal p{color:#64748b;font-size:13px}.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1050px){.metric-grid{grid-template-columns:repeat(2,1fr)}.service-grid{grid-template-columns:1fr}}@media(max-width:720px){.gcash-header,.transactions-head{display:block}.gcash-content{padding:18px}.refresh-btn{margin-top:14px}.metric-grid,.form-grid{grid-template-columns:1fr}.history-tools{display:block}.history-tools select,.search-box{margin-top:8px}.search-box input{width:100%}.fee-grid{grid-template-columns:1fr}.payment-table{min-width:900px}}
        `}</style>
      </section>
    </main>
  );
}
