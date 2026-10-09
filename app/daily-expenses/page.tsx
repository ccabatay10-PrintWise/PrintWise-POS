"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, ExternalLink, FileText, Plus, Receipt, Search, Trash2, Wallet, X, Pencil, TrendingUp, ShoppingCart } from "lucide-react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../components/Sidebar";

type Expense={id:string;expense_date:string;category:string;description:string;amount:number;payment_method:string;receipt_url:string|null;notes:string|null;created_by:string|null;created_at:string};
type Sale={id:string;total:number;status:string;created_at:string};
type Form={expense_date:string;category:string;description:string;amount:string;payment_method:string;receipt_url:string;notes:string};
const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const emptyForm=():Form=>({expense_date:todayLocal(),category:"Ingredients & Supplies",description:"",amount:"",payment_method:"Cash",receipt_url:"",notes:""});
const peso=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"});
const categories=["Ingredients & Supplies","Packaging","Staff Meals","Transportation & Delivery","Electricity","Water","Internet","Rent","Salaries & Wages","Repairs & Maintenance","Marketing","Cleaning Supplies","Other"];
const methods=["Cash","GCash","Bank Transfer","Debit/Credit Card","Other"];

export default function DailyExpensesPage(){
 const [expenses,setExpenses]=useState<Expense[]>([]),[sales,setSales]=useState<Sale[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[search,setSearch]=useState(""),[dateFilter,setDateFilter]=useState(todayLocal()),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<Form>(emptyForm()),[saving,setSaving]=useState(false),[role,setRole]=useState(""),[userId,setUserId]=useState<string|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setMessage("");
  const {data:userData}=await supabase.auth.getUser();const user=userData.user;
  if(!user){window.location.href="/pos";return}
  setUserId(user.id);
  const {data:profile}=await supabase.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
  setRole(String(profile?.role||"").toLowerCase());
  const [e,s]=await Promise.all([
   supabase.from("daily_expenses").select("*").order("expense_date",{ascending:false}).order("created_at",{ascending:false}),
   supabase.from("pos_orders").select("id,total,status,created_at").eq("status","completed").gte("created_at",dateFilter+"T00:00:00").lte("created_at",dateFilter+"T23:59:59.999")
  ]);
  if(e.error)setMessage("Unable to load expenses: "+e.error.message);else setExpenses((e.data||[]).map((x:any)=>({...x,amount:Number(x.amount||0)})));
  if(s.error)setMessage(v=>v||"Unable to load sales summary: "+s.error.message);else setSales((s.data||[]).map((x:any)=>({...x,total:Number(x.total||0)})));
  setLoading(false);
 },[dateFilter]);
 useEffect(()=>{void load()},[load]);
 const selectedExpenses=useMemo(()=>expenses.filter(e=>e.expense_date===dateFilter&&`${e.description} ${e.category} ${e.payment_method} ${e.notes||""}`.toLowerCase().includes(search.toLowerCase())),[expenses,dateFilter,search]);
 const totalExpenses=selectedExpenses.reduce((a,e)=>a+e.amount,0),totalSales=sales.reduce((a,s)=>a+s.total,0),net=totalSales-totalExpenses;
 const canEdit=["admin","manager"].includes(role),canDelete=role==="admin";
 const openNew=()=>{setEditing(null);setForm({...emptyForm(),expense_date:dateFilter});setMessage("");setShowForm(true)};
 const openEdit=(e:Expense)=>{setEditing(e.id);setForm({expense_date:e.expense_date,category:e.category,description:e.description,amount:String(e.amount),payment_method:e.payment_method,receipt_url:e.receipt_url||"",notes:e.notes||""});setMessage("");setShowForm(true)};
 const save=async()=>{
  if(!userId||!form.description.trim()||!form.amount||Number(form.amount)<=0){setMessage("Enter a description and a valid amount greater than zero.");return}
  setSaving(true);setMessage("");
  const payload={expense_date:form.expense_date,category:form.category,description:form.description.trim(),amount:Number(form.amount),payment_method:form.payment_method,receipt_url:form.receipt_url.trim()||null,notes:form.notes.trim()||null,...(!editing?{created_by:userId}:{})};
  const result=editing?await supabase.from("daily_expenses").update(payload).eq("id",editing).select().single():await supabase.from("daily_expenses").insert(payload).select().single();
  if(result.error){setMessage("Unable to save expense: "+result.error.message);setSaving(false);return}
  setShowForm(false);setEditing(null);setSaving(false);await load();
 };
 const remove=async(e:Expense)=>{if(!canDelete)return;if(!window.confirm(`Delete expense "${e.description}" for ${peso.format(e.amount)}?`))return;const{error}=await supabase.from("daily_expenses").delete().eq("id",e.id);if(error)setMessage("Unable to delete expense: "+error.message);else await load()};
 const exportCsv=()=>{const rows=[["Date","Category","Description","Amount","Payment Method","Receipt URL","Notes"],...selectedExpenses.map(e=>[e.expense_date,e.category,e.description,e.amount.toFixed(2),e.payment_method,e.receipt_url||"",e.notes||""])];const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`espacio-daily-expenses-${dateFilter}.csv`;a.click();URL.revokeObjectURL(url)};
 return <main className="app-shell daily-expenses-page"><Sidebar/><section className="workspace daily-expenses-workspace">
 <header className="de-header"><div><div className="de-kicker">ESPACIO • FINANCE MANAGEMENT</div><h1>Daily Expenses</h1><p>Record and review daily operating expenses separately from sales and inventory.</p></div><div className="de-header-actions"><button className="de-btn" onClick={()=>void load()}><CalendarDays size={16}/> Refresh</button><button className="de-btn" onClick={exportCsv}><Download size={16}/> Export CSV</button><button className="de-btn de-primary" onClick={openNew}><Plus size={17}/> Add Expense</button></div></header>
 {message&&<div className="de-message" role="alert">{message}<button onClick={()=>setMessage("")}><X size={16}/></button></div>}
 <div className="de-filter"><label><CalendarDays size={17}/> Report Date <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label><label className="de-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search expense, category, payment..."/></label></div>
 <section className="de-metrics">
 <article><span className="de-metric-icon"><ShoppingCart size={19}/></span><div><small>COMPLETED SALES</small><strong>{peso.format(totalSales)}</strong><em>{dateFilter}</em></div></article>
 <article><span className="de-metric-icon expense"><Receipt size={19}/></span><div><small>TOTAL EXPENSES</small><strong>{peso.format(totalExpenses)}</strong><em>{selectedExpenses.length} recorded expenses</em></div></article>
 <article><span className="de-metric-icon net"><TrendingUp size={19}/></span><div><small>SALES MINUS EXPENSES</small><strong className={net<0?"de-negative":""}>{peso.format(net)}</strong><em>Before other costs and adjustments</em></div></article>
 </section>
 <section className="de-table-card"><header><div><h2>Expense Records</h2><p>{selectedExpenses.length} entries for {dateFilter}</p></div><span className="de-table-total">{peso.format(totalExpenses)}</span></header>
 {loading?<div className="de-empty">Loading expense records...</div>:selectedExpenses.length===0?<div className="de-empty"><Receipt size={30}/><b>No expenses recorded for this date</b><span>Add an expense to start tracking your daily costs.</span><button className="de-btn de-primary" onClick={openNew}><Plus size={16}/> Add First Expense</button></div>:<div className="de-table-scroll"><table><thead><tr><th>EXPENSE</th><th>CATEGORY</th><th>PAYMENT</th><th>AMOUNT</th><th>RECEIPT</th><th>RECORDED</th><th>ACTION</th></tr></thead><tbody>{selectedExpenses.map(e=><tr key={e.id}><td><b>{e.description}</b>{e.notes&&<small>{e.notes}</small>}</td><td><span className="de-category">{e.category}</span></td><td>{e.payment_method}</td><td className="de-amount">{peso.format(e.amount)}</td><td>{e.receipt_url?<a className="de-receipt-link" href={e.receipt_url} target="_blank" rel="noreferrer">View <ExternalLink size={12}/></a>:<span className="de-muted">—</span>}</td><td><small>{new Date(e.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</small></td><td><div className="de-row-actions">{canEdit&&<button onClick={()=>openEdit(e)} title="Edit expense"><Pencil size={15}/></button>}{canDelete&&<button className="danger" onClick={()=>void remove(e)} title="Delete expense"><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></table></div>}
 </section>
 <p className="de-footnote">Sales are based on completed POS orders for the selected date. Expenses are separate from stock purchases/inventory movements; attach a receipt link when available.</p>
 </section>
 {showForm&&<div className="de-backdrop" role="dialog" aria-modal="true" aria-labelledby="de-form-title"><div className="de-modal"><header><div><span>EXPENSE ENTRY</span><h2 id="de-form-title">{editing?"Edit Expense":"Add Daily Expense"}</h2><p>Enter the amount actually paid for this expense.</p></div><button onClick={()=>setShowForm(false)} disabled={saving}><X size={20}/></button></header><div className="de-form-grid"><label>Date<input type="date" value={form.expense_date} onChange={e=>setForm({...form,expense_date:e.target.value})} required/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="wide">Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="e.g. 2 bottles of milk, staff meal, delivery fee" required/></label><label>Amount (₱)<input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00" required/></label><label>Payment Method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>{methods.map(m=><option key={m}>{m}</option>)}</select></label><label className="wide">Receipt / Photo URL (optional)<input type="url" value={form.receipt_url} onChange={e=>setForm({...form,receipt_url:e.target.value})} placeholder="Paste a receipt or photo link"/></label><label className="wide">Notes (optional)<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} placeholder="Additional details"/></label></div><footer><button className="de-btn" onClick={()=>setShowForm(false)} disabled={saving}>Cancel</button><button className="de-btn de-primary" onClick={()=>void save()} disabled={saving}>{saving?"Saving...":editing?"Save Changes":"Save Expense"}</button></footer></div></div>}
 </main>
}
