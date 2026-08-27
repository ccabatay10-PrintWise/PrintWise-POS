"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, FileText, LoaderCircle, ReceiptText, Search } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../../lib/supabase";
import "../../pos/pos.css";

type CompletedJob = {
  id: string;
  reference_no: string;
  customer_name: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  amount_paid: number | null;
  paid_at: string | null;
  pos_order_no: string | null;
  receipt_reference: string | null;
};

export default function CompletedJobsPage() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("received_file_jobs")
        .select("id, reference_no, customer_name, status, payment_status, payment_method, amount_paid, paid_at, pos_order_no, receipt_reference")
        .in("status", ["COMPLETED", "READY"])
        .order("paid_at", { ascending: false, nullsFirst: false });
      setJobs((data ?? []) as CompletedJob[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = jobs.filter((job) => {
    const text = `${job.reference_no} ${job.customer_name} ${job.pos_order_no ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  return (
    <div className="app-shell received-shell">
      <Sidebar />
      <main className="received-main">
        <section className="completed-header">
          <div>
            <span className="eyebrow">STEP 6 · JOB HISTORY</span>
            <h1>Completed File Jobs</h1>
            <p>Track paid jobs, POS order numbers and receipt references in one place.</p>
          </div>
          <div className="completed-summary"><CheckCircle2 size={19} /><b>{jobs.filter((job) => job.payment_status === "PAID").length} Paid</b></div>
        </section>

        <section className="completed-card">
          <div className="completed-tools">
            <div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job, customer or POS order" /></div>
          </div>

          {loading ? <div className="history-empty"><LoaderCircle className="spin" size={28} /><b>Loading completed jobs…</b></div> : filtered.length === 0 ? <div className="history-empty"><FileText size={34} /><b>No completed jobs found</b><span>Paid and completed file jobs will appear here.</span></div> : (
            <div className="history-list">
              {filtered.map((job) => (
                <article className="history-row" key={job.id}>
                  <div className="history-main"><span className="history-icon"><CheckCircle2 size={20} /></span><div><b>{job.reference_no}</b><small>{job.customer_name}</small></div></div>
                  <div><small>PAYMENT</small><b className={job.payment_status === "PAID" ? "paid" : "unpaid"}>{job.payment_status}</b></div>
                  <div><small>AMOUNT PAID</small><b>₱{Number(job.amount_paid ?? 0).toFixed(2)}</b></div>
                  <div><small>POS ORDER</small><b>{job.pos_order_no || "Pending"}</b></div>
                  <div><small>RECEIPT</small><b>{job.receipt_reference || "Not linked"}</b></div>
                  <button className="history-open" onClick={() => (window.location.href = `/received-files/completed/${job.id}`)}><ExternalLink size={17} />View</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <style jsx global>{`
        .received-main{width:100%;max-width:1600px;padding:28px 32px 36px;background:#f4f6f8;min-height:100vh}.completed-header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:20px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;color:#a52a2a}.completed-header h1{margin:5px 0;font-size:31px;color:#25272b}.completed-header p{margin:0;color:#6f7378}.completed-summary{display:flex;align-items:center;gap:9px;padding:11px 14px;border-radius:12px;background:#e7f7ed;color:#237247}.completed-card{background:#fff;border:1px solid #e1e5e9;border-radius:18px;overflow:hidden}.completed-tools{padding:18px;border-bottom:1px solid #e9edf0}.search-box{display:flex;align-items:center;gap:9px;max-width:430px;border:1px solid #dfe3e7;border-radius:10px;padding:10px 12px;color:#6f7378}.search-box input{border:0;outline:0;width:100%;font:inherit}.history-empty{min-height:260px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;color:#737a81}.history-list{display:flex;flex-direction:column}.history-row{display:grid;grid-template-columns:1.5fr .75fr .8fr 1fr 1fr auto;gap:18px;align-items:center;padding:18px 20px;border-bottom:1px solid #eef1f3}.history-row:last-child{border-bottom:0}.history-main{display:flex;align-items:center;gap:11px}.history-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#e7f7ed;color:#237247}.history-row small{display:block;font-size:10px;letter-spacing:.07em;color:#7b8289;margin-bottom:4px}.history-row b{color:#363b41}.history-main small{font-size:12px;letter-spacing:0;margin:3px 0 0}.paid{color:#237247!important}.unpaid{color:#b66408!important}.history-open{display:inline-flex;align-items:center;gap:7px;border:1px solid #efd5d5;background:#fffafa;color:#b12424;border-radius:9px;padding:9px 11px;font-weight:750;cursor:pointer}@media(max-width:1000px){.history-row{grid-template-columns:1fr 1fr 1fr}.history-main{grid-column:1/-1}}@media(max-width:640px){.received-main{padding:18px 12px}.completed-header{align-items:flex-start;flex-direction:column}.history-row{grid-template-columns:1fr 1fr;padding:16px}.history-main{grid-column:1/-1}.history-open{grid-column:1/-1;justify-content:center}}
      `}</style>
    </div>
  );
}
