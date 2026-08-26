"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
import Sidebar from "../components/Sidebar";
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";

type GCashTransaction = {
  id: string;
  transaction_no: string;
  channel: string;
  transaction_type: "cash_in" | "cash_out" | "bills_payment" | "payment" | "other";
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

const nav = [
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Orders", "/orders"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [Layers3, "Inventory", "/inventory"],
  [FileText, "Reports", "/reports"],
] as const;

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

const getChartFee = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return feeBrackets.find((bracket) => value >= bracket.min && value <= bracket.max)?.fee ?? 100;
};

const getFeeLabel = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "Enter an amount to calculate the chart fee + additional 2% fee.";
  const bracket = feeBrackets.find((item) => value >= item.min && value <= item.max);
  return bracket
    ? `Chart fee for ₱${bracket.min.toLocaleString()}–₱${bracket.max.toLocaleString()} plus 2% of the transaction amount.`
    : "₱5,001+ uses the maximum ₱100 chart fee plus 2% of the transaction amount.";
};

const peso = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const formatMobile = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const transactionLabel = (type: string) =>
  type === "cash_in" ? "Cash In" : type === "cash_out" ? "Cash Out" : type.replaceAll("_", " ");

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
  const [updating, setUpdating] = useState(false);

  const amountNumber = Number(amount || 0);
  const chartFee = getChartFee(amountNumber);
  const additionalFee = amountNumber > 0 ? amountNumber * 0.02 : 0;
  const totalServiceFee = chartFee + additionalFee;
  const customerTotal = amountNumber > 0 ? amountNumber + totalServiceFee : 0;

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase
      .from("payment_transactions")
      .select("id,transaction_no,channel,transaction_type,amount,service_fee,reference_no,account_number,customer_name,status,notes,created_at")
      .eq("channel", "gcash")
      .in("transaction_type", ["cash_in", "cash_out"])
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Unable to load GCash transactions: ${error.message}`);
      setMessageType("error");
    } else {
      setTransactions((data ?? []).map((row: any) => ({ ...row, amount: Number(row.amount || 0), service_fee: Number(row.service_fee || 0) })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/pos";
        return;
      }
      load();
    });
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

    if (!customerName.trim()) return void (setMessage("Please enter the customer's name."), setMessageType("error"));
    if (cleanMobile.length < 10) return void (setMessage("Please enter a valid GCash mobile number."), setMessageType("error"));
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return void (setMessage("Please enter a valid transaction amount."), setMessageType("error"));

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      window.location.href = "/pos";
      return;
    }

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

    if (error) {
      setMessage(`Unable to save transaction: ${error.message}`);
      setMessageType("error");
    } else {
      setMessage(`${transactionLabel(type)} saved. Chart fee ${peso(chartFee)} + 2% fee ${peso(additionalFee)} = total service fee ${peso(totalServiceFee)}.`);
      setMessageType("success");
      resetForm();
      await load();
    }
    setSaving(false);
  };

  const markSuccessful = async () => {
    if (!completeTarget) return;
    setUpdating(true);
    const { error } = await supabase
      .from("payment_transactions")
      .update({ status: "successful", reference_no: completeReference.trim() || completeTarget.reference_no || null })
      .eq("id", completeTarget.id);

    if (error) {
      setMessage(`Unable to complete transaction: ${error.message}`);
      setMessageType("error");
    } else {
      setMessage("Transaction marked as successful.");
      setMessageType("success");
      setCompleteTarget(null);
      setCompleteReference("");
      await load();
    }
    setUpdating(false);
  };

  const cancelTransaction = async (id: string) => {
    if (!window.confirm("Cancel this pending transaction?")) return;
    const { error } = await supabase.from("payment_transactions").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      setMessage(`Unable to cancel transaction: ${error.message}`);
      setMessageType("error");
    } else {
      setMessage("Transaction cancelled.");
      setMessageType("success");
      await load();
    }
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return transactions.filter((transaction) => {
      const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
      const matchesSearch = !query || `${transaction.transaction_no} ${transaction.customer_name || ""} ${transaction.account_number || ""} ${transaction.reference_no || ""}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [transactions, search, statusFilter]);

  const todayKey = new Date().toDateString();
  const todayTransactions = transactions.filter((t) => new Date(t.created_at).toDateString() === todayKey);
  const todayCashIn = todayTransactions.filter((t) => t.status === "successful" && t.transaction_type === "cash_in").reduce((sum, t) => sum + t.amount, 0);
  const todayCashOut = todayTransactions.filter((t) => t.status === "successful" && t.transaction_type === "cash_out").reduce((sum, t) => sum + t.amount, 0);
  const todayFees = todayTransactions.filter((t) => t.status === "successful").reduce((sum, t) => sum + t.service_fee, 0);
  const pendingCount = transactions.filter((t) => t.status === "pending").length;

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="workspace gcash-workspace">
        <header className="topbar gcash-header">
          <div><div className="eyebrow">SERVICE CENTER</div><h1>GCash / Bayad Services</h1><p>Process and record Cash In and Cash Out services with chart-based fees plus an automatic 2% transaction fee.</p></div>
          <button className="refresh-btn" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={18} className={refreshing ? "spin" : ""} />{refreshing ? "REFRESHING..." : "REFRESH"}</button>
        </header>

        <div className="gcash-content">
          <section className="notice-card"><Clock3 size={20} /><div><strong>Updated automatic fee process</strong><span><b>Total Service Fee = Chart-Based Fee + 2% of the Transaction Amount.</b> This is applied automatically to every Cash In and Cash Out transaction.</span></div></section>

          <section className="metric-grid gcash-metrics">
            <article className="metric-card"><div className="metric-icon soft-green"><ArrowDownLeft size={21} /></div><div className="metric-copy"><span>Today's Cash In</span><strong>{peso(todayCashIn)}</strong><small>Successful transactions</small></div></article>
            <article className="metric-card"><div className="metric-icon soft-blue"><ArrowUpRight size={21} /></div><div className="metric-copy"><span>Today's Cash Out</span><strong>{peso(todayCashOut)}</strong><small>Successful transactions</small></div></article>
            <article className="metric-card"><div className="metric-icon soft-amber"><Banknote size={21} /></div><div className="metric-copy"><span>Service Fees Today</span><strong>{peso(todayFees)}</strong><small>Chart fee + 2% collected</small></div></article>
            <article className="metric-card"><div className="metric-icon soft-red"><Clock3 size={21} /></div><div className="metric-copy"><span>Pending</span><strong>{pendingCount}</strong><small>Waiting for completion</small></div></article>
          </section>

          <section className="service-grid">
            <form className="transaction-form-card" onSubmit={handleSave}>
              <div className="form-heading"><div><div className="eyebrow">NEW SERVICE</div><h2>{type === "cash_in" ? "Process Cash In" : "Process Cash Out"}</h2><p>Enter the amount and PrintWise will calculate the chart fee, additional 2%, total service fee, and total amount to collect.</p></div><div className={`service-icon ${type === "cash_in" ? "cash-in" : "cash-out"}`}>{type === "cash_in" ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}</div></div>

              <div className="type-switch"><button type="button" onClick={() => setType("cash_in")} className={type === "cash_in" ? "selected" : ""}><ArrowDownLeft size={18} />Cash In</button><button type="button" onClick={() => setType("cash_out")} className={type === "cash_out" ? "selected" : ""}><ArrowUpRight size={18} />Cash Out</button></div>

              <div className="form-grid">
                <label className="full-field">Customer Name<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required /></label>
                <label>GCash Mobile Number<input inputMode="numeric" value={mobileNumber} onChange={(e) => setMobileNumber(formatMobile(e.target.value))} placeholder="09XXXXXXXXX" required /></label>
                <label>{type === "cash_in" ? "Cash-In Amount" : "Cash-Out Amount"}<div className="money-input"><span>₱</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" required /></div></label>
                <label>Chart-Based Fee<div className="money-input fee-locked"><span>₱</span><input value={chartFee.toFixed(2)} readOnly aria-label="Chart-based fee" /></div><small className="fee-help">{getFeeLabel(amountNumber)}</small></label>
                <label>Additional 2% Transaction Fee<div className="money-input fee-locked"><span>₱</span><input value={additionalFee.toFixed(2)} readOnly aria-label="Additional two percent transaction fee" /></div><small className="fee-help">Automatically computed as 2% × transaction amount.</small></label>
                <label>Total Service Fee<div className="money-input fee-total"><span>₱</span><input value={totalServiceFee.toFixed(2)} readOnly aria-label="Total service fee" /></div><small className="fee-help total-help">Chart-based fee + additional 2% transaction fee.</small></label>
                <label>Reference Number <em>(optional)</em><input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Enter after successful transfer" /></label>
                <label className="full-field">Notes <em>(optional)</em><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional transaction notes..." rows={3} /></label>
              </div>

              <div className="amount-preview">
                <div><span>TOTAL AMOUNT TO COLLECT</span><strong>{peso(customerTotal)}</strong></div>
                <div className="preview-detail"><small>Transaction Amount</small><b>{peso(amountNumber)}</b><small>Chart-Based Fee</small><b>{peso(chartFee)}</b><small>Additional 2%</small><b>{peso(additionalFee)}</b><small>Total Service Fee</small><b className="highlight-fee">{peso(totalServiceFee)}</b></div>
                {type === "cash_out" && <small className="release-note">Cash to release to customer: <b>{peso(amountNumber)}</b></small>}
              </div>

              <div className="fee-schedule"><div className="fee-schedule-head"><strong>Chart-Based Fee Schedule</strong><span>PLUS 2% ON EVERY TRANSACTION</span></div><div className="fee-grid">{feeBrackets.map((bracket) => <div key={bracket.min} className={amountNumber >= bracket.min && amountNumber <= bracket.max ? "active" : ""}><span>₱{bracket.min.toLocaleString()}–₱{bracket.max.toLocaleString()}</span><b>₱{bracket.fee}</b></div>)}</div><div className="fee-footer">After the chart fee is selected, PrintWise automatically adds <b>2% of the transaction amount</b>.</div></div>

              <label className="completion-check"><input type="checkbox" checked={completedNow} onChange={(e) => setCompletedNow(e.target.checked)} /><span><strong>The actual GCash transaction is already completed.</strong><small>Check this only after confirming the wallet transaction outside PrintWise.</small></span></label>
              <div className="form-actions"><button type="button" className="secondary-btn" onClick={resetForm}>Clear Form</button><button type="submit" className="primary-btn" disabled={saving}><Plus size={18} />{saving ? "SAVING..." : completedNow ? "RECORD SUCCESSFUL" : "SAVE AS PENDING"}</button></div>
            </form>

            <aside className="workflow-card">
              <div className="workflow-head"><CheckCircle2 size={21} /><div><h2>Recommended Workflow</h2><p>Use this process for safe manual tracking.</p></div></div>
              <ol className="workflow-list"><li><span>1</span><div><strong>Enter the amount</strong><p>PrintWise finds the chart-based fee and calculates the additional 2% automatically.</p></div></li><li><span>2</span><div><strong>Review the breakdown</strong><p>Confirm the transaction amount, chart fee, 2% fee, total service fee, and total amount to collect.</p></div></li><li><span>3</span><div><strong>Collect the total</strong><p>Collect the transaction amount plus the complete service fee before or according to your chosen workflow.</p></div></li><li><span>4</span><div><strong>Complete and save reference</strong><p>Mark successful only after the actual wallet transaction is confirmed.</p></div></li></ol>
              <div className="formula-card"><span>FORMULA</span><strong>Chart Fee + (Amount × 2%)</strong><small>Total Service Fee</small></div>
              <div className="workflow-tip"><Wallet size={18} />Never enter your GCash password or OTP into PrintWise.</div>
            </aside>
          </section>

          {message && <div className={`message transaction-message ${messageType}`}>{message}</div>}

          <section className="transactions-card gcash-history">
            <div className="transactions-head"><div><h2>GCash Transaction History</h2><p>{filtered.length} transaction{filtered.length === 1 ? "" : "s"} shown • New transactions save the combined chart fee + 2% fee.</p></div><div className="history-tools"><div className="search-box payment-search"><Search size={19} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, reference..." /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="pending">Pending</option><option value="successful">Successful</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option></select></div></div>
            <div className="table-wrap"><table className="payment-table gcash-table"><thead><tr><th>Transaction</th><th>Customer</th><th>Service</th><th>Amount</th><th>Total Fee</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {loading ? <tr><td colSpan={8} className="empty-state">Loading GCash transactions...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="empty-state">No GCash transactions found yet.</td></tr> : filtered.map((transaction) => <tr key={transaction.id}><td><span className="order-number">{transaction.transaction_no}</span><small className="table-date">{new Date(transaction.created_at).toLocaleString()}</small></td><td><strong>{transaction.customer_name || "Walk-in Customer"}</strong><small className="table-date">{transaction.account_number || "No mobile number"}</small></td><td><span className={`service-badge ${transaction.transaction_type}`}>{transaction.transaction_type === "cash_in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{transactionLabel(transaction.transaction_type)}</span></td><td className="amount-cell">{peso(transaction.amount)}</td><td className="fee-cell">{peso(transaction.service_fee)}</td><td>{transaction.reference_no || <span className="muted">—</span>}</td><td><span className={`status-badge ${transaction.status}`}>{transaction.status}</span></td><td><div className="row-actions">{transaction.status === "pending" && <><button className="icon-action complete" title="Mark successful" onClick={() => { setCompleteTarget(transaction); setCompleteReference(transaction.reference_no || ""); }}><Check size={17} /></button><button className="icon-action cancel" title="Cancel transaction" onClick={() => cancelTransaction(transaction.id)}><X size={17} /></button></>}</div></td></tr>)}
            </tbody></table></div>
          </section>
        </div>

        {completeTarget && <div className="modal-backdrop"><div className="complete-modal"><button className="modal-close" onClick={() => setCompleteTarget(null)}><X size={20} /></button><div className="modal-icon"><CheckCircle2 size={26} /></div><h2>Complete Transaction</h2><p>Confirm that the actual GCash transaction has been successfully completed.</p><div className="modal-summary"><span>{transactionLabel(completeTarget.transaction_type)}</span><strong>{peso(completeTarget.amount)}</strong><small>Total fee saved: {peso(completeTarget.service_fee)} • {completeTarget.customer_name} • {completeTarget.account_number}</small></div><label>Official Reference Number <em>(optional)</em><input value={completeReference} onChange={(e) => setCompleteReference(e.target.value)} placeholder="Paste the transaction reference" /></label><div className="modal-actions"><button className="secondary-btn" onClick={() => setCompleteTarget(null)}>Cancel</button><button className="primary-btn" onClick={markSuccessful} disabled={updating}><Check size={18} />{updating ? "UPDATING..." : "MARK SUCCESSFUL"}</button></div></div></div>}

        <style jsx>{`
          .gcash-workspace{background:#f7f8fb;min-height:100vh}.gcash-header{padding:24px 30px;background:#fff;border-bottom:1px solid #e8ecf2}.eyebrow{color:#ef2620;font-size:11px;font-weight:800;letter-spacing:.12em;margin-bottom:4px}.gcash-header h1{margin:0;font-size:30px}.gcash-header p{margin:5px 0 0;color:#64748b;max-width:850px;line-height:1.5}.refresh-btn,.primary-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:14px;padding:14px 20px;background:linear-gradient(135deg,#ff2720,#e71611);color:#fff;font-weight:800;cursor:pointer;box-shadow:0 10px 22px rgba(229,22,17,.18)}.refresh-btn:disabled,.primary-btn:disabled{opacity:.7;cursor:wait}.spin{animation:spin 1s linear infinite}.gcash-content{padding:28px 30px 40px;max-width:1540px;width:100%;margin:0 auto;box-sizing:border-box}.notice-card{display:flex;gap:13px;align-items:flex-start;background:#fff8e8;border:1px solid #f5d995;border-radius:16px;padding:15px 17px;color:#9a6700;margin-bottom:18px}.notice-card strong{display:block;font-size:14px;margin-bottom:3px}.notice-card span{display:block;font-size:13px;line-height:1.5;color:#8a6a22}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.metric-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:19px;display:flex;gap:14px}.metric-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;flex:0 0 auto}.soft-green{color:#15803d;background:#ecfdf3}.soft-blue{color:#2563eb;background:#eff6ff}.soft-amber{color:#b45309;background:#fff8e8}.soft-red{color:#e11d1a;background:#fff1f0}.metric-copy{display:flex;flex-direction:column}.metric-copy span{font-size:12px;color:#64748b;font-weight:700}.metric-copy strong{font-size:24px;margin:5px 0 4px;color:#18202d}.metric-copy small{color:#94a3b8;font-size:11px}.service-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(310px,.75fr);gap:18px;margin-top:18px}.transaction-form-card,.workflow-card,.transactions-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;box-shadow:0 5px 18px rgba(15,23,42,.035)}.transaction-form-card{padding:24px}.form-heading{display:flex;justify-content:space-between;gap:18px}.form-heading h2,.workflow-head h2,.transactions-head h2{margin:0;font-size:21px;color:#18202d}.form-heading p,.workflow-head p,.transactions-head p{margin:5px 0 0;color:#64748b;font-size:13px}.service-icon{width:52px;height:52px;border-radius:15px;display:grid;place-items:center}.service-icon.cash-in{color:#15803d;background:#ecfdf3}.service-icon.cash-out{color:#2563eb;background:#eff6ff}.type-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f7f8fb;border:1px solid #e8ecf2;border-radius:14px;padding:5px;margin:20px 0}.type-switch button{display:flex;align-items:center;justify-content:center;gap:8px;border:0;background:transparent;border-radius:10px;padding:12px;color:#64748b;font-weight:800;cursor:pointer}.type-switch button.selected{background:#fff;color:#e11d1a;box-shadow:0 2px 9px rgba(15,23,42,.08)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.form-grid label,.complete-modal label{display:flex;flex-direction:column;gap:7px;color:#334155;font-size:13px;font-weight:800}.form-grid .full-field{grid-column:1/-1}.form-grid em,.complete-modal em{font-style:normal;font-weight:600;color:#94a3b8}.form-grid input,.form-grid textarea,.complete-modal input{width:100%;box-sizing:border-box;border:1px solid #dce3ec;border-radius:11px;padding:12px 13px;background:#fff;color:#18202d;font:inherit;outline:none}.form-grid input:focus,.form-grid textarea:focus,.complete-modal input:focus{border-color:#ef2620;box-shadow:0 0 0 3px rgba(239,38,32,.08)}.form-grid textarea{resize:vertical}.money-input{display:flex;align-items:center;border:1px solid #dce3ec;border-radius:11px;overflow:hidden;background:#fff}.money-input:focus-within{border-color:#ef2620}.money-input span{padding:12px;border-right:1px solid #e8ecf2;color:#64748b;background:#f8fafc}.money-input input{border:0!important;box-shadow:none!important;padding-left:11px}.fee-locked{background:#f8fafc}.fee-locked input{background:#f8fafc;color:#a16207;font-weight:900}.fee-total{border-color:#f5b4b0;background:#fff7f6}.fee-total span,.fee-total input{background:#fff7f6!important;color:#b42318!important;font-weight:900}.fee-help{font-size:10px;color:#a16207;font-weight:700;margin-top:-2px}.total-help{color:#b42318}.amount-preview{margin-top:17px;background:#f8fafc;border:1px dashed #d9e1eb;border-radius:14px;padding:15px 17px;display:grid;grid-template-columns:1fr auto;gap:10px}.amount-preview span{display:block;font-size:12px;font-weight:900;color:#64748b}.amount-preview strong{display:block;font-size:28px;color:#b42318;margin-top:4px}.preview-detail{display:grid;grid-template-columns:auto auto;gap:4px 14px;align-content:center}.preview-detail small{color:#94a3b8;font-size:10px}.preview-detail b{text-align:right;color:#334155;font-size:12px}.preview-detail .highlight-fee{color:#b42318}.release-note{grid-column:1/-1;color:#2563eb;font-size:11px}.fee-schedule{margin-top:16px;border:1px solid #e8ecf2;border-radius:14px;overflow:hidden}.fee-schedule-head{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e8ecf2}.fee-schedule-head strong{font-size:12px;color:#334155}.fee-schedule-head span{font-size:10px;color:#e11d1a;font-weight:900}.fee-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.fee-grid div{display:flex;justify-content:space-between;gap:10px;padding:9px 13px;border-bottom:1px solid #eef1f5;color:#64748b;font-size:11px}.fee-grid div:nth-last-child(-n+2){border-bottom:0}.fee-grid div:nth-child(odd){border-right:1px solid #eef1f5}.fee-grid div.active{background:#fff1f0;color:#b42318;font-weight:900}.fee-grid b{color:#a16207}.fee-grid .active b{color:#e11d1a}.fee-footer{padding:11px 13px;background:#fff8e8;border-top:1px solid #f5e2ae;color:#8a6a22;font-size:11px}.completion-check{display:flex;gap:11px;align-items:flex-start;margin-top:16px;padding:13px 14px;border:1px solid #e8ecf2;border-radius:13px;cursor:pointer}.completion-check input{width:18px;height:18px;accent-color:#e11d1a}.completion-check strong{display:block;color:#334155;font-size:13px}.completion-check small{display:block;color:#94a3b8;font-size:11px;margin-top:3px}.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.secondary-btn{border:1px solid #dce3ec;border-radius:13px;padding:13px 18px;background:#fff;color:#475569;font-weight:800;cursor:pointer}.workflow-card{padding:23px}.workflow-head{display:flex;gap:12px}.workflow-head>svg{color:#e11d1a}.workflow-list{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:17px}.workflow-list li{display:flex;gap:12px}.workflow-list li>span{width:27px;height:27px;display:grid;place-items:center;border-radius:50%;background:#fff1f0;color:#e11d1a;font-size:12px;font-weight:900}.workflow-list strong{font-size:13px;color:#334155}.workflow-list p{margin:4px 0 0;color:#94a3b8;font-size:12px;line-height:1.45}.formula-card{margin-top:20px;padding:14px;border:1px solid #fecaca;border-radius:13px;background:#fff7f6}.formula-card span,.formula-card small{display:block;font-size:10px;color:#b42318;font-weight:900}.formula-card strong{display:block;margin:5px 0;color:#7f1d1d;font-size:14px}.workflow-tip{display:flex;gap:9px;margin-top:14px;padding:12px;border-radius:12px;background:#f8fafc;color:#64748b;font-size:11px}.transaction-message{margin-top:18px;border-radius:13px;padding:13px 15px;font-size:13px;font-weight:700}.transaction-message.success{background:#ecfdf3;color:#15803d;border:1px solid #bbf7d0}.transaction-message.error{background:#fff1f0;color:#b42318;border:1px solid #fecaca}.gcash-history{margin-top:18px;padding:20px}.transactions-head{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}.history-tools{display:flex;gap:9px}.payment-search{width:min(360px,100%);margin:0;background:#f8fafc;border:1px solid #e4e9f0;border-radius:13px;min-height:46px}.payment-search input{background:transparent}.history-tools select{height:46px;border:1px solid #dce3ec;border-radius:12px;padding:0 12px;background:#fff}.table-wrap{overflow-x:auto;border:1px solid #eef1f5;border-radius:14px}.payment-table{width:100%;min-width:1080px;border-collapse:collapse}.payment-table th{text-align:left;padding:13px 14px;background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;border-bottom:1px solid #eef1f5}.payment-table td{padding:14px;border-bottom:1px solid #eef1f5;color:#334155;font-size:13px}.order-number{display:block;font-weight:800;color:#1e293b}.table-date{display:block;color:#94a3b8;font-size:10px;margin-top:4px}.amount-cell{font-weight:800}.fee-cell{color:#a16207;font-weight:700}.muted{color:#94a3b8}.service-badge,.status-badge{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900;text-transform:capitalize}.service-badge.cash_in{background:#ecfdf3;color:#15803d}.service-badge.cash_out{background:#eff6ff;color:#2563eb}.status-badge.pending{background:#fff8e8;color:#a16207}.status-badge.successful{background:#ecfdf3;color:#15803d}.status-badge.cancelled,.status-badge.failed{background:#fff1f0;color:#b42318}.row-actions{display:flex;gap:6px}.icon-action{width:34px;height:34px;border-radius:10px;border:1px solid #dce3ec;background:#fff;display:grid;place-items:center;cursor:pointer}.icon-action.complete{color:#15803d}.icon-action.cancel{color:#b42318}.empty-state{padding:34px!important;text-align:center;color:#94a3b8!important}.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:20px;z-index:50}.complete-modal{position:relative;width:min(480px,100%);background:#fff;border-radius:20px;padding:28px;box-shadow:0 24px 70px rgba(15,23,42,.28)}.modal-close{position:absolute;right:16px;top:16px;width:38px;height:38px;border:1px solid #dce3ec;border-radius:10px;background:#fff;display:grid;place-items:center;cursor:pointer}.modal-icon{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:#ecfdf3;color:#15803d}.complete-modal h2{margin:15px 0 5px;color:#18202d}.complete-modal>p{margin:0;color:#64748b;font-size:13px}.modal-summary{margin:18px 0;padding:15px;background:#f8fafc;border:1px solid #e8ecf2;border-radius:14px}.modal-summary span,.modal-summary small{display:block;color:#64748b;font-size:11px}.modal-summary strong{display:block;font-size:24px;color:#18202d;margin:4px 0}.modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:19px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1180px){.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.service-grid{grid-template-columns:1fr}}@media(max-width:900px){.gcash-header,.gcash-content{padding-left:18px;padding-right:18px}.transactions-head,.history-tools{flex-direction:column}.history-tools{align-items:stretch}.payment-search{width:100%}}@media(max-width:640px){.metric-grid,.form-grid{grid-template-columns:1fr}.form-grid .full-field{grid-column:auto}.form-heading{flex-direction:column}.form-actions{flex-direction:column-reverse}.form-actions button{width:100%}.amount-preview{grid-template-columns:1fr}.fee-grid{grid-template-columns:1fr}.fee-grid div:nth-child(odd){border-right:0}.fee-grid div:nth-last-child(-n+2){border-bottom:1px solid #eef1f5}.fee-grid div:last-child{border-bottom:0}}
        `}</style>
      </section>
    </main>
  );
}