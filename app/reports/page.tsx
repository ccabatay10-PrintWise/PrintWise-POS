"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, Download, FileText, Layers3, Package, ReceiptText, Search, ShoppingCart, TrendingUp, Users, Wallet, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import Sidebar from "../components/Sidebar";

type Order = { id:string; order_no:string; customer_name:string|null; total:number; amount_paid:number; status:string; created_at:string };
type Expense = { id:string; expense_date:string; category:string; description:string; amount:number; payment_method:string; notes:string|null };
type PurchasePlan = { id:string; plan_date:string; items:any[]; total_amount:number; notes:string|null };
type CashEntry = { id:string; entry_date:string; entry_type:"opening_cash"|"remittance"|"withdrawal"; amount:number; description:string|null; payment_method:string; created_at:string };
type CashOutflow = { id:string; expense_date:string; category:"Restocking"|"Other Expenses"; description:string; amount:number; payment_method:string; created_at:string };

const nav = [
  [ShoppingCart, "Point of Sale", "/pos"],
  [ReceiptText, "Orders", "/orders"],
  [Wallet, "GCash / Bayad", "/gcash-bayad"],
  [Package, "Products & Services", "/products"],
  [Users, "Customers", "/customers"],
  [Layers3, "Inventory", "/inventory"],
  [FileText, "Reports", "/reports"],
] as const;

const peso = new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP", minimumFractionDigits:2 });

export default function ReportsPage(){
  const [orders,setOrders]=useState<Order[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [range,setRange]=useState("all");
  const [reportDate,setReportDate]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`});
  const [salesExpenseFrom,setSalesExpenseFrom]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`});
  const [salesExpenseTo,setSalesExpenseTo]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(new Date(d.getFullYear(),d.getMonth()+1,0).getDate()).padStart(2,"0")}`});
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [purchasePlans,setPurchasePlans]=useState<PurchasePlan[]>([]);
  const [financeLoading,setFinanceLoading]=useState(true);
  const [cashEntries,setCashEntries]=useState<CashEntry[]>([]);
  const [cashOutflows,setCashOutflows]=useState<CashOutflow[]>([]);
  const [outflowDate,setOutflowDate]=useState(reportDate);
  const [outflowCategory,setOutflowCategory]=useState<"Restocking"|"Other Expenses">("Restocking");
  const [outflowDescription,setOutflowDescription]=useState("");
  const [outflowAmount,setOutflowAmount]=useState("");
  const [outflowPayment,setOutflowPayment]=useState("Cash");
  const [outflowSaving,setOutflowSaving]=useState(false);
  const [deletingOutflowId,setDeletingOutflowId]=useState<string|null>(null);
  const [editingOutflow,setEditingOutflow]=useState<CashOutflow|null>(null);
  const [editOutflowDate,setEditOutflowDate]=useState("");
  const [editOutflowCategory,setEditOutflowCategory]=useState<"Restocking"|"Other Expenses">("Restocking");
  const [editOutflowDescription,setEditOutflowDescription]=useState("");
  const [editOutflowAmount,setEditOutflowAmount]=useState("");
  const [editOutflowPayment,setEditOutflowPayment]=useState("Cash");
  const [editOutflowSaving,setEditOutflowSaving]=useState(false);
  const [cashEntryDate,setCashEntryDate]=useState(reportDate);
  const [cashType,setCashType]=useState<"opening_cash"|"remittance"|"withdrawal">("opening_cash");
  const [cashAmount,setCashAmount]=useState("");
  const [cashDescription,setCashDescription]=useState("");
  const [cashSaving,setCashSaving]=useState(false);
  const [cashUserId,setCashUserId]=useState<string|null>(null);
  const [showRemittance,setShowRemittance]=useState(false);
  const [remitSaving,setRemitSaving]=useState(false);
  const [remitDate,setRemitDate]=useState(reportDate);
  const [remitSales,setRemitSales]=useState({cash:"",gcash:"",bank:"",other:""});
  const [remitCounts,setRemitCounts]=useState<Record<string,string>>({"1000":"","500":"","200":"","100":"","50":"","20":"","10":"","5":"","1":""});
  const [remitGcash,setRemitGcash]=useState("");
  const [remitBank,setRemitBank]=useState("");
  const [remitOther,setRemitOther]=useState("");
  const [remitAuthorized,setRemitAuthorized]=useState("");
  const [remitPetty,setRemitPetty]=useState("");
  const remitDenominations=[1000,500,200,100,50,20,10,5,1];
  const remitCash=remitDenominations.reduce((sum,d)=>sum+d*(Number(remitCounts[String(d)]||0)||0),0);
  const remitGross=Object.values(remitSales).reduce((sum,v)=>sum+(Number(v)||0),0);
  const remitExpected=remitGross-(Number(remitAuthorized)||0)-(Number(remitPetty)||0);
  const remitActual=remitCash+(Number(remitGcash)||0)+(Number(remitBank)||0)+(Number(remitOther)||0);
  const remitVariance=remitActual-remitExpected;


  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [ordersResult,expensesResult,plansResult,cashResult,outflowsResult]=await Promise.all([
        supabase.from("pos_orders").select("id,order_no,customer_name,total,amount_paid,status,created_at").order("created_at",{ascending:false}),
        supabase.from("daily_expenses").select("id,expense_date,category,description,amount,payment_method,notes").order("expense_date",{ascending:false}),
        supabase.from("stock_purchase_plans").select("id,plan_date,items,total_amount,notes").order("plan_date",{ascending:false}),
        supabase.from("daily_cash_entries").select("id,entry_date,entry_type,amount,description,payment_method,created_at").order("entry_date",{ascending:false}).order("created_at",{ascending:false}),
        supabase.from("cash_outflows").select("id,expense_date,category,description,amount,payment_method,created_at").order("expense_date",{ascending:false}).order("created_at",{ascending:false})
      ]);
      if(ordersResult.error) setMessage(`Unable to load reports: ${ordersResult.error.message}`);
      else setOrders((ordersResult.data??[]).map((o:any)=>({...o,total:Number(o.total||0),amount_paid:Number(o.amount_paid||0)})));
      if(expensesResult.error) setMessage(v=>v||`Unable to load expenses: ${expensesResult.error.message}`);
      else setExpenses((expensesResult.data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
      if(plansResult.error) setMessage(v=>v||`Unable to load stock purchase plans: ${plansResult.error.message}`);
      else setPurchasePlans((plansResult.data??[]).map((p:any)=>({...p,items:Array.isArray(p.items)?p.items:[],total_amount:Number(p.total_amount||0)})));
      if(cashResult.error) setMessage(v=>v||`Unable to load cash entries: ${cashResult.error.message}`);
      else setCashEntries((cashResult.data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
      if(outflowsResult.error) setMessage(v=>v||`Unable to load cash outflows: ${outflowsResult.error.message}`);
      else setCashOutflows((outflowsResult.data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
      setLoading(false);setFinanceLoading(false);
    };
    supabase.auth.getUser().then(({data})=>{ if(!data.user) window.location.href="/pos"; else { setCashUserId(data.user.id); void load(); } });
  },[]);

  const filtered=useMemo(()=>{
    const now=new Date();
    const start=new Date(now);
    if(range==="today") start.setHours(0,0,0,0);
    if(range==="7days") start.setDate(now.getDate()-6);
    if(range==="30days") start.setDate(now.getDate()-29);
    return orders.filter(o=>{
      const matches=`${o.order_no} ${o.customer_name||""} ${o.status}`.toLowerCase().includes(search.toLowerCase());
      const date=range==="all"?true:new Date(o.created_at)>=start;
      return matches&&date;
    });
  },[orders,search,range]);

  const completed=filtered.filter(o=>o.status?.toLowerCase()==="completed");
  const sales=completed.reduce((sum,o)=>sum+o.total,0);
  const paid=completed.reduce((sum,o)=>sum+o.amount_paid,0);
  const average=completed.length?sales/completed.length:0;

  const reportMonth=reportDate.slice(0,7);
  const businessDate=(s:string)=>new Date(s).toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
  const salesExpenseChart=useMemo(()=>{
    if(!salesExpenseFrom||!salesExpenseTo||salesExpenseFrom>salesExpenseTo)return [];
    const start=new Date(`${salesExpenseFrom}T12:00:00`),end=new Date(`${salesExpenseTo}T12:00:00`);
    const days=Math.min(366,Math.floor((end.getTime()-start.getTime())/86400000)+1);
    return Array.from({length:Math.max(0,days)},(_,index)=>{
      const d=new Date(start);d.setDate(start.getDate()+index);
      const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const dailySales=orders.filter(o=>o.status?.toLowerCase()==="completed"&&businessDate(o.created_at)===date).reduce((n,o)=>n+o.total,0);
      const dailyOperatingExpenses=expenses.filter(e=>e.expense_date===date).reduce((n,e)=>n+e.amount,0);
      const dailyCashExpenses=cashOutflows.filter(e=>e.expense_date===date).reduce((n,e)=>n+e.amount,0);
      return {date,day:String(d.getDate()),sales:dailySales,expenses:dailyOperatingExpenses+dailyCashExpenses};
    });
  },[orders,expenses,cashOutflows,salesExpenseFrom,salesExpenseTo]);
  const chartSalesTotal=salesExpenseChart.reduce((n,d)=>n+d.sales,0);
  const chartExpensesTotal=salesExpenseChart.reduce((n,d)=>n+d.expenses,0);
  const chartMax=Math.max(1,...salesExpenseChart.flatMap(d=>[d.sales,d.expenses]));
  const financeDayOrders=orders.filter(o=>o.status?.toLowerCase()==="completed"&&businessDate(o.created_at)===reportDate);
  const financeMonthOrders=orders.filter(o=>o.status?.toLowerCase()==="completed"&&businessDate(o.created_at).startsWith(reportMonth));
  const financeDayExpenses=expenses.filter(e=>e.expense_date===reportDate),financeMonthExpenses=expenses.filter(e=>e.expense_date.startsWith(reportMonth));
  const financeDayPlans=purchasePlans.filter(p=>p.plan_date===reportDate),financeMonthPlans=purchasePlans.filter(p=>p.plan_date.startsWith(reportMonth));
  const daySales=financeDayOrders.reduce((n,o)=>n+o.total,0),dayExpenses=financeDayExpenses.reduce((n,e)=>n+e.amount,0),dayPurchases=financeDayPlans.reduce((n,p)=>n+p.total_amount,0);
  const monthSales=financeMonthOrders.reduce((n,o)=>n+o.total,0),monthExpenses=financeMonthExpenses.reduce((n,e)=>n+e.amount,0),monthPurchases=financeMonthPlans.reduce((n,p)=>n+p.total_amount,0);
  const dayCashEntries=cashEntries.filter(e=>e.entry_date===reportDate);
  const monthCashEntries=cashEntries.filter(e=>e.entry_date.startsWith(reportMonth));
  const sumCash=(rows:CashEntry[],type:CashEntry["entry_type"])=>rows.filter(e=>e.entry_type===type).reduce((n,e)=>n+e.amount,0);
  const financeDayOutflows=cashOutflows.filter(e=>e.expense_date===reportDate);
  const financeMonthOutflows=cashOutflows.filter(e=>e.expense_date.startsWith(reportMonth));
  const cashExpenseDay=financeDayOutflows.filter(e=>e.payment_method?.toLowerCase()==="cash").reduce((n,e)=>n+e.amount,0);
  const cashExpenseMonth=financeMonthOutflows.filter(e=>e.payment_method?.toLowerCase()==="cash").reduce((n,e)=>n+e.amount,0);
  const dayOpening=sumCash(dayCashEntries,"opening_cash"),dayRemittance=sumCash(dayCashEntries,"remittance"),dayWithdrawals=sumCash(dayCashEntries,"withdrawal");
  const cashEntriesUpToDate=cashEntries.filter(e=>e.entry_date<=reportDate);
  const latestOpening=cashEntriesUpToDate.filter(e=>e.entry_type==="opening_cash").sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at))[0];
  const cashPeriodStart=latestOpening?.entry_date||"0000-01-01";
  const cashEntriesSinceOpening=cashEntriesUpToDate.filter(e=>latestOpening?e.created_at>=latestOpening.created_at:e.entry_date>=cashPeriodStart);
  const totalRestockingCashExpenses=cashOutflows.filter(e=>e.expense_date<=reportDate&&e.payment_method?.toLowerCase()==="cash").reduce((n,e)=>n+e.amount,0);
  const cashExpensesSinceOpening=cashOutflows.filter(e=>e.expense_date>=cashPeriodStart&&e.expense_date<=reportDate&&e.payment_method?.toLowerCase()==="cash").reduce((n,e)=>n+e.amount,0);
  const totalOpening=latestOpening?.amount||0,totalRemittance=sumCash(cashEntriesSinceOpening,"remittance"),totalWithdrawals=sumCash(cashEntriesSinceOpening,"withdrawal");
  const actualDayCash=dayOpening+dayRemittance-dayWithdrawals-cashExpenseDay;
  const actualTotalCash=totalOpening-totalRestockingCashExpenses+totalRemittance;
  const actualMonthCash=actualTotalCash;
  const saveCashOutflow=async()=>{
    const amount=Number(outflowAmount);
    if(!cashUserId||!outflowDescription.trim()||!Number.isFinite(amount)||amount<=0){setMessage("Enter an expense description and a valid amount greater than zero.");return}
    const duplicate=cashOutflows.find(e=>e.expense_date===outflowDate&&e.category===outflowCategory&&e.description.trim().toLowerCase()===outflowDescription.trim().toLowerCase()&&e.amount===amount&&e.payment_method===outflowPayment);
    if(duplicate){setMessage("Possible duplicate expense detected. This date, description, amount, and payment method already exist. Check the records before adding again.");return}
    setOutflowSaving(true);setMessage("");
    const {error}=await supabase.from("cash_outflows").insert({expense_date:outflowDate,category:outflowCategory,description:outflowDescription.trim(),amount,payment_method:outflowPayment,created_by:cashUserId});
    if(error){setMessage("Unable to save cash expense: "+error.message);setOutflowSaving(false);return}
    setOutflowAmount("");setOutflowDescription("");setOutflowSaving(false);
    const {data,error:reloadError}=await supabase.from("cash_outflows").select("id,expense_date,category,description,amount,payment_method,created_at").order("expense_date",{ascending:false}).order("created_at",{ascending:false});
    if(reloadError)setMessage("Expense saved, but could not refresh the list: "+reloadError.message);else setCashOutflows((data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
  };
  const openEditCashOutflow=(expense:CashOutflow)=>{
    setEditingOutflow(expense);setEditOutflowDate(expense.expense_date);setEditOutflowCategory(expense.category);
    setEditOutflowDescription(expense.description);setEditOutflowAmount(String(expense.amount));setEditOutflowPayment(expense.payment_method);
  };
  const updateCashOutflow=async()=>{
    if(!editingOutflow)return;
    const amount=Number(editOutflowAmount);
    if(!editOutflowDate||!editOutflowDescription.trim()||!Number.isFinite(amount)||amount<=0){setMessage("Enter a valid date, expense description, and amount greater than zero.");return}
    setEditOutflowSaving(true);setMessage("");
    const {error}=await supabase.from("cash_outflows").update({expense_date:editOutflowDate,category:editOutflowCategory,description:editOutflowDescription.trim(),amount,payment_method:editOutflowPayment}).eq("id",editingOutflow.id);
    if(error){setMessage("Unable to update expense: "+error.message);setEditOutflowSaving(false);return}
    setCashOutflows(rows=>rows.map(e=>e.id===editingOutflow.id?{...e,expense_date:editOutflowDate,category:editOutflowCategory,description:editOutflowDescription.trim(),amount,payment_method:editOutflowPayment}:e));
    setEditingOutflow(null);setEditOutflowSaving(false);setMessage("Expense record updated successfully.");
  };
  const deleteCashOutflow=async(id:string)=>{
    if(!window.confirm("Delete this expense record? This will also add the amount back to Total Cash on Hand if it was paid in cash."))return;
    setDeletingOutflowId(id);setMessage("");
    const {error}=await supabase.from("cash_outflows").delete().eq("id",id);
    if(error){setMessage("Unable to delete expense: "+error.message);setDeletingOutflowId(null);return}
    setCashOutflows(rows=>rows.filter(e=>e.id!==id));setDeletingOutflowId(null);
  };
  const saveCashEntry=async()=>{
    const amount=Number(cashAmount);
    if(!cashUserId||!Number.isFinite(amount)||amount<=0){setMessage("Enter a valid cash amount greater than zero.");return}
    if(cashType==="opening_cash"&&cashEntries.some(e=>e.entry_date===cashEntryDate&&e.entry_type==="opening_cash")){setMessage("An opening cash entry already exists for this date. Add a remittance or withdrawal instead.");return}
    setCashSaving(true);setMessage("");
    const {error}=await supabase.from("daily_cash_entries").insert({entry_date:cashEntryDate,entry_type:cashType,amount,description:cashDescription.trim()||null,payment_method:"Cash",created_by:cashUserId});
    if(error){setMessage("Unable to save cash entry: "+error.message);setCashSaving(false);return}
    setCashAmount("");setCashDescription("");setCashSaving(false);
    const {data,error:reloadError}=await supabase.from("daily_cash_entries").select("id,entry_date,entry_type,amount,description,payment_method,created_at").order("entry_date",{ascending:false}).order("created_at",{ascending:false});
    if(reloadError)setMessage("Saved, but could not refresh cash entries: "+reloadError.message);else setCashEntries((data??[]).map((e:any)=>({...e,amount:Number(e.amount||0)})));
  };

  const printDailyRemittance=(data:any)=>{
    let offset=0,width=72;
    try{const saved=localStorage.getItem("wise_pos_receipt_alignment");if(saved){const p=JSON.parse(saved);if(Number.isFinite(Number(p.offset)))offset=Math.max(-5,Math.min(5,Number(p.offset)));if(Number.isFinite(Number(p.width)))width=Math.max(60,Math.min(76,Number(p.width)));}}catch{}
    const denom=[1000,500,200,100,50,20,10,5,1].map(d=>({d,q:Number(data.denomination_counts?.[String(d)]||0)})).filter(x=>x.q>0);
    const w=window.open("","_blank","width=420,height=720");if(!w){setMessage("Allow pop-ups to print the Daily Remittance Report.");return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Remittance Report</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{width:80mm!important;margin:0!important;padding:0!important}body{font:9px Arial,sans-serif;color:#111;line-height:1.3}.receipt{width:min(${width}mm,100%);max-width:${width}mm;margin:0 auto;padding:3mm 0;transform:translateX(${offset}mm)}header{text-align:center;border-bottom:1px dashed #222;padding:4px 0 7px}h1{font-size:14px;margin:0 0 3px}.date{text-align:center;margin:6px 0}.section{margin-top:8px}.section h2{font-size:9px;margin:0 0 4px;padding:3px;background:#244f73;color:#fff}.line{display:grid;grid-template-columns:1fr auto;gap:4px;padding:2px 0}.total{font-weight:bold;border-top:1px solid #222;padding-top:3px}.muted{color:#555}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:2px 1px}td:last-child,th:last-child{text-align:right}.sign{margin-top:18px;border-top:1px solid #222;padding-top:4px;text-align:center}</style></head><body><main class="receipt"><header><h1>ESPACIO</h1><b>DAILY REMITTANCE REPORT</b></header><div class="date">Date: ${data.report_date}<br>Printed: ${new Date().toLocaleString("en-PH")}</div><section class="section"><h2>SALES SUMMARY</h2>${Object.entries(data.payment_summary||{}).map(([k,v])=>`<div class="line"><span>${k}</span><b>${peso.format(Number(v)||0)}</b></div>`).join("")}<div class="line total"><span>TOTAL SALES</span><b>${peso.format(data.gross_sales)}</b></div></section><section class="section"><h2>DETAILED CASH COUNT</h2><table><thead><tr><th>Denomination</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${denom.map(x=>`<tr><td>₱${x.d.toLocaleString("en-PH")}</td><td>${x.q}</td><td>${peso.format(x.d*x.q)}</td></tr>`).join("")}<tr><td colspan="2"><b>TOTAL CASH</b></td><td><b>${peso.format(data.actual_cash)}</b></td></tr></tbody></table><div class="line"><span>Cash on GCash</span><b>${peso.format(data.gcash_on_hand)}</b></div><div class="line"><span>Bank Transfer</span><b>${peso.format(data.bank_transfer_on_hand)}</b></div><div class="line"><span>Other</span><b>${peso.format(data.other_on_hand)}</b></div></section><section class="section"><h2>REMITTANCE SUMMARY</h2><div class="line"><span>Gross Sales</span><b>${peso.format(data.gross_sales)}</b></div><div class="line"><span>Less: Authorized Expenses</span><b>−${peso.format(data.authorized_expenses)}</b></div><div class="line"><span>Less: Beginning / Petty</span><b>−${peso.format(data.beginning_petty)}</b></div><div class="line total"><span>Expected Remittance</span><b>${peso.format(data.expected_remittance)}</b></div><div class="line"><span>Actual Remittance</span><b>${peso.format(data.actual_remittance)}</b></div><div class="line total"><span>${data.over_short>=0?"OVER":"SHORT"}</span><b>${peso.format(Math.abs(data.over_short))}</b></div></section><div class="sign">Cashier / Staff Signature</div><div class="sign">Received by</div></main><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    w.document.close();
  };
  const saveDailyRemittance=async()=>{
    if(!cashUserId){setMessage("Please sign in again before saving the remittance.");return}
    if(!remitDate){setMessage("Select the remittance date.");return}
    if(remitGross<=0){setMessage("Enter the sales summary amounts.");return}
    if(remitCash<=0){setMessage("Enter the cash denomination quantities.");return}
    setRemitSaving(true);setMessage("");
    const payload={report_date:remitDate,payment_summary:{Cash:Number(remitSales.cash)||0,GCash:Number(remitSales.gcash)||0,"Bank Transfer":Number(remitSales.bank)||0,Other:Number(remitSales.other)||0},denomination_counts:remitCounts,gcash_on_hand:Number(remitGcash)||0,bank_transfer_on_hand:Number(remitBank)||0,other_on_hand:Number(remitOther)||0,gross_sales:remitGross,authorized_expenses:Number(remitAuthorized)||0,beginning_petty:Number(remitPetty)||0,expected_remittance:remitExpected,actual_cash:remitCash,actual_remittance:remitActual,over_short:remitVariance,created_by:cashUserId};
    const {data,error}=await supabase.from("daily_remittance_reports").insert(payload).select("*").single();
    if(error){setMessage("Unable to save Daily Remittance Report: "+error.message);setRemitSaving(false);return}
    const {error:cashError}=await supabase.from("daily_cash_entries").insert({entry_date:remitDate,entry_type:"remittance",amount:remitCash,description:"Daily Remittance Report • Cash counted",payment_method:"Cash",created_by:cashUserId});
    if(cashError){setMessage("Report saved, but cash ledger was not updated: "+cashError.message);setRemitSaving(false);printDailyRemittance(data);return}
    setCashEntries(rows=>[{id:"remit-"+data.id,entry_date:remitDate,entry_type:"remittance",amount:remitCash,description:"Daily Remittance Report • Cash counted",payment_method:"Cash",created_at:data.created_at},...rows]);
    setRemitSaving(false);setShowRemittance(false);setMessage("Daily Remittance Report saved successfully.");printDailyRemittance(data);
  };
  const printFinancialReport=(period:"daily"|"monthly")=>{
    const monthly=period==="monthly",label=monthly?reportMonth:reportDate,salesTotal=monthly?monthSales:daySales,expenseTotal=monthly?monthExpenses:dayExpenses,purchaseTotal=monthly?monthPurchases:dayPurchases,cashLeft=actualTotalCash;
    const expenseRows=(monthly?financeMonthExpenses:financeDayExpenses).map(e=>`<tr><td>${e.expense_date}</td><td>${e.description}</td><td>${e.category}</td><td class="money">${peso.format(e.amount)}</td></tr>`).join("");
    const planRows=(monthly?financeMonthPlans:financeDayPlans).map(p=>`<tr><td>${p.plan_date}</td><td>${(p.items||[]).map(i=>i.name).join(", ")}</td><td class="money">${peso.format(p.total_amount)}</td></tr>`).join("");
    const w=window.open("","_blank","width=900,height=720");if(!w){setMessage("Allow pop-ups to print the financial report.");return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ESPACIO Financial Report</title><style>@page{size:A4 portrait;margin:12mm}body{font:11px Arial,sans-serif;color:#111}header{text-align:center;border-bottom:2px solid #222;padding:12px;margin-bottom:12px}h1{font-size:20px;margin:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{border:1px solid #bbb;padding:10px}.metric b,.metric strong{display:block;margin-bottom:5px}.cash{border:2px solid #333;background:#f0f7f1}h2{font-size:13px;margin:18px 0 7px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}.money{text-align:right;white-space:nowrap}</style></head><body><main class="receipt"><header><h1>ESPACIO Café &amp; Restaurant</h1><b>${monthly?"MONTHLY":"DAILY"} FINANCIAL REPORT — ${label}</b></header><div class="grid"><div class="metric"><b>COMPLETED SALES</b><strong>${peso.format(salesTotal)}</strong></div><div class="metric"><b>TOTAL EXPENSES</b><strong>${peso.format(expenseTotal)}</strong></div><div class="metric"><b>SALES MINUS EXPENSES</b><strong>${peso.format(salesTotal-expenseTotal)}</strong></div><div class="metric"><b>NEXT-DAY STOCK PURCHASES</b><strong>${peso.format(purchaseTotal)}</strong></div><div class="metric cash"><b>ACTUAL CASH ON HAND</b><strong>${peso.format(cashLeft)}</strong></div></div><h2>Expense Details</h2><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>${expenseRows||"<tr><td colspan=\"4\">No expenses.</td></tr>"}</tbody></table><h2>Next-Day Stock Purchase Plans</h2><table><thead><tr><th>Purchase Date</th><th>Items</th><th>Total</th></tr></thead><tbody>${planRows||"<tr><td colspan=\"3\">No saved plans.</td></tr>"}</tbody></table><p>Actual cash on hand is calculated from recorded opening cash and remittances, less cash-paid expenses and withdrawals. Stock purchase plans are estimates until recorded as actual expenses.</p><script>window.onload=()=>{window.focus();window.print();};<\\/script></body></html>`);w.document.close();
  };
  const printReceiptReport=(period:"daily"|"monthly")=>{
    const monthly=period==="monthly",label=monthly?reportMonth:reportDate;
    const salesTotal=monthly?monthSales:daySales,expenseTotal=monthly?monthExpenses:dayExpenses,purchaseTotal=monthly?monthPurchases:dayPurchases,cashLeft=actualTotalCash;
    const reportExpenses=(monthly?financeMonthOutflows:financeDayOutflows);
    const reportPlans=(monthly?financeMonthPlans:financeDayPlans);
    const reportCashEntries=(monthly?monthCashEntriesSince:dayCashEntries);
    const rows=(items:CashOutflow[])=>items.map(e=>`<div class="line"><span>${e.description}<small>${e.category} • ${e.payment_method} • ${e.expense_date}</small></span><b>${peso.format(e.amount)}</b></div>`).join("");
    const plans=reportPlans.map(p=>`<div class="line"><span>Stock plan<small>${p.plan_date} • ${(p.items||[]).map(i=>i.name).join(", ")}</small></span><b>${peso.format(p.total_amount)}</b></div>`).join("");
    const cash=reportCashEntries.map(e=>`<div class="line"><span>${e.entry_type==="opening_cash"?"Opening cash":e.entry_type==="remittance"?"Remittance":"Withdrawal"}<small>${e.description||e.entry_date}</small></span><b>${e.entry_type==="withdrawal"?"−":"+"}${peso.format(e.amount)}</b></div>`).join("");
    let receiptAlignment=0,receiptContentWidth=72;
    try{const saved=localStorage.getItem("wise_pos_receipt_alignment");if(saved){const parsed=JSON.parse(saved);if(Number.isFinite(Number(parsed.offset)))receiptAlignment=Math.max(-5,Math.min(5,Number(parsed.offset)));if(Number.isFinite(Number(parsed.width)))receiptContentWidth=Math.max(60,Math.min(76,Number(parsed.width)));}}catch{}
    const w=window.open("","_blank","width=420,height=720");if(!w){setMessage("Allow pop-ups to print the 80mm receipt report.");return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ESPACIO ${monthly?"Monthly":"Daily"} Report</title><style>
      @page{size:80mm auto;margin:0}*{box-sizing:border-box}
      html,body{width:80mm!important;min-width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important}
      body{font:9px Arial,Helvetica,sans-serif;color:#111;line-height:1.3;text-align:left}
      .receipt{display:block;width:min(${receiptContentWidth}mm,100%);max-width:${receiptContentWidth}mm;margin-left:auto!important;margin-right:auto!important;position:relative;left:0;transform:translateX(${receiptAlignment}mm);padding:3mm 0;box-sizing:border-box;overflow-wrap:anywhere}
      header{display:block;width:100%;text-align:center;padding:4px 0 7px;border-bottom:1px dashed #333}
      h1{font-size:14px;line-height:1.2;margin:0 0 3px}header b{font-size:10px}
      .date{width:100%;text-align:center;margin:5px 0 8px;font-size:8px;line-height:1.35}
      .section{width:100%;margin-top:8px;clear:both}.section h2{font-size:9px;line-height:1.2;margin:0 0 4px;padding:0 0 3px;border-bottom:1px solid #333;text-transform:uppercase}
      .line{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:5px;width:100%;padding:3px 0;border-bottom:1px dotted #bbb;align-items:start}
      .line span{display:block;min-width:0;overflow-wrap:anywhere;word-break:normal;text-align:left}
      .line b{display:block;min-width:19mm;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
      small{display:block;color:#555;font-size:7px;line-height:1.25;margin-top:1px}
      .totals .line{border:0;padding:2px 0}.balance{width:100%;border-top:1px dashed #111;border-bottom:1px dashed #111;margin-top:5px;padding:7px 2px;font-size:12px;line-height:1.4;font-weight:bold;text-align:center}
      .note{width:100%;font-size:7px;line-height:1.3;margin-top:7px;text-align:left;overflow-wrap:anywhere}
      .footer{width:100%;text-align:center;border-top:1px dashed #333;margin-top:8px;padding-top:5px;font-size:8px}
      @media print{@page{size:80mm auto;margin:0}html,body{width:80mm!important;min-width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.receipt{margin-left:auto!important;margin-right:auto!important}}
    </style></head><body><header><h1>ESPACIO Café &amp; Restaurant</h1><b>${monthly?"MONTHLY":"DAILY"} FINANCIAL REPORT</b></header><div class="date">Report Period: ${label}<br>Printed: ${new Date().toLocaleString("en-PH")}</div>
      <div class="section totals"><h2>Financial Summary</h2><div class="line"><span>Completed Sales</span><b>${peso.format(salesTotal)}</b></div><div class="line"><span>Total Expenses</span><b>${peso.format(expenseTotal)}</b></div><div class="line"><span>Sales Less Expenses</span><b>${peso.format(salesTotal-expenseTotal)}</b></div><div class="line"><span>Next-Day Stock Plans</span><b>${peso.format(purchaseTotal)}</b></div><div class="balance">ACTUAL CASH ON HAND<br>${peso.format(cashLeft)}</div></div>
      <div class="section"><h2>Cash Entries</h2>${cash||"<div>No cash entries.</div>"}</div>
      <div class="section"><h2>Expenses</h2>${rows(reportExpenses)||"<div>No expenses recorded.</div>"}</div>
      <div class="section"><h2>Stock Purchase Plans</h2>${plans||"<div>No saved plans.</div>"}</div>
      <div class="note">Cash balance reflects recorded opening cash and remittances, less cash-paid expenses and withdrawals. Daily Expenses are excluded from this cash ledger. Only cash-paid restocking and other expenses entered here are deducted.</div><div class="footer">ESPACIO • Thank you!</div></main>
      <script>window.onload=()=>{window.focus();window.print();};<\/script></body></html>`);w.document.close();
  };
  const exportCsv=()=>{
    const rows=[["Order No.","Customer","Date & Time","Total","Paid","Status"],...filtered.map(o=>[o.order_no,o.customer_name||"Walk-in Customer",new Date(o.created_at).toLocaleString(),o.total.toFixed(2),o.amount_paid.toFixed(2),o.status])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`printwise-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const rangeLabel={all:"All Time",today:"Today",["7days"]:"Last 7 Days",["30days"]:"Last 30 Days"}[range]||"All Time";
  const formatDate=(date:string)=>new Date(date).toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});

  return <main className="app-shell reports-page">
    <Sidebar />

    <section className="workspace reports-workspace">
      <header className="reports-header">
        <div>
          <div className="report-kicker">BUSINESS INSIGHTS</div>
          <h1>Reports & Analytics</h1>
          <p>Monitor cash on hand, daily remittances, expenses, and financial performance.</p>
        </div>
      </header>

      <div className="reports-content">
        <section className="metrics-grid">
          <div className="metric-card sales-card"><div className="metric-icon"><TrendingUp size={22}/></div><div><span>Total Sales</span><strong>{peso.format(sales)}</strong><small>Completed orders only</small></div></div>
          <div className="metric-card orders-card"><div className="metric-icon"><ReceiptText size={22}/></div><div><span>Completed Orders</span><strong>{completed.length}</strong><small>Transactions in this period</small></div></div>
          <div className="metric-card paid-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Total Paid</span><strong>{peso.format(paid)}</strong><small>Successfully collected</small></div></div>
          <div className="metric-card average-card"><div className="metric-icon"><BarChart3 size={22}/></div><div><span>Average Sale</span><strong>{peso.format(average)}</strong><small>Average per completed order</small></div></div>
        </section>

        <section className="report-table-card sales-expense-tracker">
          <div className="table-topbar">
            <div><h2>Monthly Sales & Expenses Tracker</h2><p>Daily comparison of completed POS sales against recorded operating and cash expenses.</p></div>
            <div className="sales-expense-date-filters"><label>DATE FROM<input type="date" value={salesExpenseFrom} max={salesExpenseTo||undefined} onChange={e=>setSalesExpenseFrom(e.target.value)}/></label><label>DATE TO<input type="date" value={salesExpenseTo} min={salesExpenseFrom||undefined} onChange={e=>setSalesExpenseTo(e.target.value)}/></label></div>
          </div>
          <div className="sales-expense-summary">
            <div><span>TOTAL SALES</span><strong>{peso.format(chartSalesTotal)}</strong></div>
            <div><span>TOTAL EXPENSES</span><strong>{peso.format(chartExpensesTotal)}</strong></div>
            <div><span>SALES LESS EXPENSES</span><strong className={chartSalesTotal-chartExpensesTotal>=0?"chart-positive":"chart-negative"}>{peso.format(chartSalesTotal-chartExpensesTotal)}</strong></div>
          </div>
          <div className="sales-expense-chart-wrap">
            <div className="sales-expense-legend"><span><i className="sales-legend"/>Sales</span><span><i className="expenses-legend"/>Expenses</span></div>
            <div className="sales-expense-chart" style={{gridTemplateColumns:`repeat(${Math.max(1,salesExpenseChart.length)},minmax(0,1fr))`}}>{salesExpenseChart.map(d=><div className="sales-expense-day" key={d.date} title={`${d.date} • Sales: ${peso.format(d.sales)} • Expenses: ${peso.format(d.expenses)}`}>
              <div className="sales-expense-bars"><div className="sales-bar" style={{height:`${d.sales/chartMax*100}%`}}/><div className="expenses-bar" style={{height:`${d.expenses/chartMax*100}%`}}/></div>
              <span className="sales-expense-day-label">{Number(d.day)%2===1||d.day==="01"?d.day:""}</span>
            </div>)}</div>
            <div className="sales-expense-axis"><span>01</span><span>15</span><span>{salesExpenseChart.length.toString().padStart(2,"0")}</span></div>
            {!chartSalesTotal&&!chartExpensesTotal&&<div className="sales-expense-empty">No sales or expenses recorded for this month yet.</div>}
          </div>
          <p className="sales-expense-note">Expenses combine Daily Expenses and Restocking & Other Expenses records. Stock purchase plans are shown separately in Financial Reports and are not added again here.</p>
        </section>

        <section className="report-table-card cash-control-panel">
          <div className="table-topbar"><div><h2>Cash on Hand & Daily Remittance</h2><p>Record opening cash, add daily remittances, and record cash withdrawals. Record restocking purchases and other cash expenses here; Daily Expenses are tracked separately.</p></div><div className="cash-entry-form">
            <input aria-label="Cash entry date" title="Date remitted / cash entry date" type="date" value={cashEntryDate} onChange={e=>setCashEntryDate(e.target.value)}/>
            <select value={cashType} onChange={e=>setCashType(e.target.value as any)}><option value="opening_cash">Opening Cash on Hand</option><option value="remittance">Add Daily Remittance</option><option value="withdrawal">Cash Withdrawal</option></select>
            <input type="number" min="0.01" step="0.01" placeholder="Amount (₱)" value={cashAmount} onChange={e=>setCashAmount(e.target.value)}/>
            <input placeholder="Description (optional)" value={cashDescription} onChange={e=>setCashDescription(e.target.value)}/>
            <button className="export-btn" disabled={cashSaving} onClick={()=>void saveCashEntry()}>{cashSaving?"Saving...":"Save Cash Entry"}</button><button className="export-btn" type="button" onClick={()=>{setRemitDate(cashEntryDate||reportDate);setShowRemittance(true)}}>Daily Remittance Report</button>
          </div></div>
          <div className="cash-balance-grid">
            <div><span>Opening Cash (Recorded)</span><strong>{peso.format(totalOpening)}</strong></div><div><span>Total Remittances Since Opening</span><strong className="cash-positive">+{peso.format(totalRemittance)}</strong></div><div><span>Total Restocking & Other Cash Expenses</span><strong className="cash-negative">−{peso.format(totalRestockingCashExpenses)}</strong></div><div><span>Total Cash Withdrawals</span><strong className="cash-negative">−{peso.format(totalWithdrawals)}</strong></div><div className="cash-balance-total"><span>Total Cash on Hand • {reportDate}</span><strong>{peso.format(actualTotalCash)}</strong></div>
          </div>
          <div className="cash-ledger-scroll"><table className="reports-table"><thead><tr><th>DATE</th><th>TIME</th><th>ENTRY</th><th>DESCRIPTION</th><th>AMOUNT</th></tr></thead><tbody>{cashEntries.filter(e=>e.entry_date<=reportDate).length?[...cashEntries].filter(e=>e.entry_date<=reportDate).sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at)).map(e=><tr key={e.id}><td>{e.entry_date}</td><td>{new Date(e.created_at).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})}</td><td>{e.entry_type==="opening_cash"?"Opening Cash":e.entry_type==="remittance"?"Daily Remittance":"Withdrawal"}</td><td>{e.description||"—"}</td><td className="money-cell">{e.entry_type==="withdrawal"?"−": "+"}{peso.format(e.amount)}</td></tr>):<tr><td colSpan={5}>No cash entries recorded up to this date.</td></tr>}</tbody></table></div>
          <div className="cash-expense-heading"><b>Restocking & Other Expenses • All Records</b><span>Showing expenses from all dates. These are separate from Daily Expenses.</span></div>
          <div className="cash-entry-form cash-outflow-form">
            <input aria-label="Expense date" title="Expense date" type="date" value={outflowDate} onChange={e=>setOutflowDate(e.target.value)}/>
            <select value={outflowCategory} onChange={e=>setOutflowCategory(e.target.value as any)}><option value="Restocking">Restocking Items</option><option value="Other Expenses">Other Expenses</option></select>
            <input placeholder="Expense description (e.g. Eggs, Coffee Beans)" value={outflowDescription} onChange={e=>setOutflowDescription(e.target.value)}/>
            <input type="number" min="0.01" step="0.01" placeholder="Amount (₱)" value={outflowAmount} onChange={e=>setOutflowAmount(e.target.value)}/>
            <select value={outflowPayment} onChange={e=>setOutflowPayment(e.target.value)}><option>Cash</option><option>GCash</option><option>Bank</option></select>
            <button className="export-btn" disabled={outflowSaving} onClick={()=>void saveCashOutflow()}>{outflowSaving?"Saving...":"Add Expense"}</button>
          </div>
          <div className="cash-expense-scroll"><table className="reports-table"><thead><tr><th>DATE</th><th>EXPENSE</th><th>CATEGORY</th><th>PAYMENT</th><th>AMOUNT</th><th>ACTION</th></tr></thead><tbody>{cashOutflows.length?[...cashOutflows].sort((a,b)=>b.expense_date.localeCompare(a.expense_date)||b.created_at.localeCompare(a.created_at)).map(e=><tr key={e.id}><td>{e.expense_date}</td><td>{e.description}</td><td>{e.category}</td><td>{e.payment_method}</td><td className="money-cell">{peso.format(e.amount)}</td><td><button className="export-btn" type="button" onClick={()=>openEditCashOutflow(e)}>View</button></td></tr>):<tr><td colSpan={6}>No restocking or other expenses recorded yet.</td></tr>}</tbody></table></div>
          <div className="cash-month-summary"><b>Total Cash on Hand • As of {reportDate}</b><strong>{peso.format(actualTotalCash)}</strong><span>Opening Cash − all recorded cash-paid restocking/other expenses up to the report date + daily remittances since the latest opening. Daily Expenses are excluded.</span></div>
        </section>
        {showRemittance&&<div role="presentation" onClick={()=>setShowRemittance(false)} style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(15,23,42,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
          <section role="dialog" aria-modal="true" aria-labelledby="daily-remittance-title" onClick={e=>e.stopPropagation()} style={{width:"min(900px,100%)",maxHeight:"92vh",overflowY:"auto",background:"#fff",borderRadius:14,padding:20,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h2 id="daily-remittance-title" style={{margin:0}}>Daily Remittance Report</h2><p style={{margin:"4px 0 12px",color:"#64748b"}}>Enter sales summary and count the cash on hand before remitting.</p></div><button type="button" className="payroll-btn light" onClick={()=>setShowRemittance(false)}>×</button></div>
            <label style={{display:"grid",gap:5,maxWidth:220,marginBottom:12}}>Remittance Date<input type="date" value={remitDate} onChange={e=>setRemitDate(e.target.value)}/></label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
              <div style={{border:"1px solid #dbe4ee",borderRadius:10,padding:12}}><h3>Sales Summary</h3>{([{k:"cash",l:"Cash"},{k:"gcash",l:"GCash"},{k:"bank",l:"Bank Transfer"},{k:"other",l:"Other"}] as const).map(x=><label key={x.k} style={{display:"grid",gridTemplateColumns:"1fr 130px",alignItems:"center",gap:8,margin:"8px 0"}}>{x.l}<input type="number" min="0" step="0.01" value={remitSales[x.k]} onChange={e=>setRemitSales(s=>({...s,[x.k]:e.target.value}))} placeholder="₱0.00"/></label>)}<div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #dbe4ee",paddingTop:8,fontWeight:800}}>TOTAL SALES <span>{peso.format(remitGross)}</span></div></div>
              <div style={{border:"1px solid #dbe4ee",borderRadius:10,padding:12}}><h3>Detailed Cash Count</h3><div style={{display:"grid",gridTemplateColumns:"1fr 90px 110px",gap:6,fontSize:12,fontWeight:700}}><span>Denomination</span><span>Quantity</span><span>Amount</span>{remitDenominations.map(d=><Fragment key={d}><span>₱{d.toLocaleString("en-PH")}</span><input aria-label={`Quantity of ₱${d}`} type="number" min="0" step="1" value={remitCounts[String(d)]} onChange={e=>setRemitCounts(s=>({...s,[String(d)]:e.target.value}))}/><b>{peso.format(d*(Number(remitCounts[String(d)]||0)||0))}</b></Fragment>)}</div><div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #dbe4ee",paddingTop:8,marginTop:8,fontWeight:800}}>TOTAL CASH <span>{peso.format(remitCash)}</span></div>
              <label style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:8,marginTop:10,alignItems:"center"}}>GCash on hand<input type="number" min="0" step="0.01" value={remitGcash} onChange={e=>setRemitGcash(e.target.value)}/></label><label style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:8,marginTop:8,alignItems:"center"}}>Bank transfer<input type="number" min="0" step="0.01" value={remitBank} onChange={e=>setRemitBank(e.target.value)}/></label><label style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:8,marginTop:8,alignItems:"center"}}>Other<input type="number" min="0" step="0.01" value={remitOther} onChange={e=>setRemitOther(e.target.value)}/></label></div>
            </div>
            <div style={{border:"1px solid #dbe4ee",borderRadius:10,padding:12,marginTop:14}}><h3>Remittance Summary</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}><label>Authorized Expenses (₱)<input type="number" min="0" step="0.01" value={remitAuthorized} onChange={e=>setRemitAuthorized(e.target.value)}/></label><label>Beginning / Petty (₱)<input type="number" min="0" step="0.01" value={remitPetty} onChange={e=>setRemitPetty(e.target.value)}/></label></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginTop:12}}><div>Gross Sales <b>{peso.format(remitGross)}</b></div><div>Expected Remittance <b>{peso.format(remitExpected)}</b></div><div>Actual Remittance <b>{peso.format(remitActual)}</b></div><div style={{color:remitVariance<0?"#dc2626":"#047857"}}>{remitVariance<0?"SHORT":"OVER"} <b>{peso.format(Math.abs(remitVariance))}</b></div></div></div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><button className="export-btn" type="button" onClick={()=>setShowRemittance(false)}>Cancel</button><button className="export-btn" type="button" disabled={remitSaving} onClick={()=>void saveDailyRemittance()}>{remitSaving?"Saving...":"Save & Print Report"}</button></div>
          </section>
        </div>}
        {editingOutflow&&<div role="presentation" onClick={()=>setEditingOutflow(null)} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-cash-expense-title" onClick={e=>e.stopPropagation()} style={{width:"min(520px,100%)",background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.25)",padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18}}>
              <div><h2 id="edit-cash-expense-title" style={{margin:0,fontSize:20}}>Expense Details</h2><p style={{margin:"5px 0 0",color:"#64748b",fontSize:13}}>View and update this restocking or other expense record.</p></div>
              <button type="button" className="text-danger" aria-label="Close" onClick={()=>setEditingOutflow(null)}><X size={20}/></button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Expense Date<input type="date" value={editOutflowDate} onChange={e=>setEditOutflowDate(e.target.value)} /></label>
              <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Category<select value={editOutflowCategory} onChange={e=>setEditOutflowCategory(e.target.value as "Restocking"|"Other Expenses")}><option value="Restocking">Restocking Items</option><option value="Other Expenses">Other Expenses</option></select></label>
              <label style={{gridColumn:"1 / -1",display:"grid",gap:6,fontSize:13,fontWeight:600}}>Expense Description<input value={editOutflowDescription} onChange={e=>setEditOutflowDescription(e.target.value)} /></label>
              <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Amount (₱)<input type="number" min="0.01" step="0.01" value={editOutflowAmount} onChange={e=>setEditOutflowAmount(e.target.value)} /></label>
              <label style={{display:"grid",gap:6,fontSize:13,fontWeight:600}}>Payment Method<select value={editOutflowPayment} onChange={e=>setEditOutflowPayment(e.target.value)}><option>Cash</option><option>GCash</option><option>Bank</option></select></label>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}>
              <button type="button" className="export-btn" onClick={()=>setEditingOutflow(null)} disabled={editOutflowSaving}>Cancel</button>
              <button type="button" className="export-btn" onClick={()=>void updateCashOutflow()} disabled={editOutflowSaving}>{editOutflowSaving?"Saving...":"Save Changes"}</button>
            </div>
          </section>
        </div>}
        <section className="report-table-card finance-report-panel">
          <div className="table-topbar"><div><h2>Daily & Monthly Financial Reports</h2><p>Completed sales, expenses, next-day stock purchases, and estimated cash left.</p></div>
            <div className="table-actions"><label className="range-select"><CalendarDays size={18}/><input aria-label="Financial report date" type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} /></label><button className="export-btn finance-print" onClick={()=>printFinancialReport("daily")}><FileText size={17}/> Print Daily</button><button className="export-btn" onClick={()=>printFinancialReport("monthly")}><FileText size={17}/> Print Monthly</button><button className="export-btn finance-print" onClick={()=>printReceiptReport("daily")}><ReceiptText size={17}/> 80mm Daily Receipt</button><button className="export-btn finance-print" onClick={()=>printReceiptReport("monthly")}><ReceiptText size={17}/> 80mm Monthly Receipt</button></div></div>
          {financeLoading?<div className="loading-state">Loading financial summary...</div>:<div className="finance-report-content"><div className="finance-report-period"><b>Daily Summary</b><span>{reportDate}</span></div>
            <section className="metrics-grid finance-metrics">
              <div className="metric-card sales-card"><div className="metric-icon"><TrendingUp size={22}/></div><div><span>Completed Sales</span><strong>{peso.format(daySales)}</strong><small>{financeDayOrders.length} completed orders</small></div></div>
              <div className="metric-card"><div className="metric-icon"><ReceiptText size={22}/></div><div><span>Total Expenses</span><strong>{peso.format(dayExpenses)}</strong><small>{financeDayExpenses.length} expense entries</small></div></div>
              <div className="metric-card average-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Sales Minus Expenses</span><strong>{peso.format(daySales-dayExpenses)}</strong><small>Before stock purchases</small></div></div>
              <div className="metric-card orders-card"><div className="metric-icon"><Package size={22}/></div><div><span>Next-Day Stock Purchase</span><strong>{peso.format(dayPurchases)}</strong><small>{financeDayPlans.length} saved plans</small></div></div>
              <div className="metric-card paid-card"><div className="metric-icon"><Wallet size={22}/></div><div><span>Actual Cash on Hand</span><strong>{peso.format(daySales-dayExpenses-dayPurchases)}</strong><small>Opening cash + remittance − restocking/other cash expenses − withdrawals</small></div></div>
            </section><div className="finance-report-period"><b>Monthly Summary</b><span>{reportMonth}</span></div>
            <div className="table-wrap"><table className="reports-table"><thead><tr><th>FINANCIAL SUMMARY</th><th>AMOUNT</th></tr></thead><tbody><tr><td>Completed Sales</td><td className="money-cell">{peso.format(monthSales)}</td></tr><tr><td>Total Expenses</td><td className="money-cell">{peso.format(monthExpenses)}</td></tr><tr><td>Sales Minus Expenses</td><td className="money-cell">{peso.format(monthSales-monthExpenses)}</td></tr><tr><td>Next-Day Stock Purchase Plans</td><td className="money-cell">{peso.format(monthPurchases)}</td></tr><tr><td><b>Total Cash on Hand</b></td><td className="money-cell"><b>{peso.format(actualTotalCash)}</b></td></tr></tbody></table></div>
            <p className="finance-report-note">Cash left is an estimate based on completed POS sales minus recorded expenses and saved purchase plans. Opening cash, withdrawals, non-POS income, and unpaid balances are not included.</p></div>}
        </section>
      </div>

      <style>{`
        .sales-expense-date-filters{display:flex;gap:10px;align-items:center}.sales-expense-date-filters label{display:grid;gap:4px;font-size:9px;font-weight:800;letter-spacing:.06em;color:#718096}.sales-expense-date-filters input{height:38px;border:1px solid #d8e1ec;border-radius:8px;padding:0 10px;color:#253247;background:#fff;font:inherit;font-size:12px}
        .sales-expense-tracker{margin-bottom:22px}
        .sales-expense-tracker .table-topbar{align-items:center}
        .sales-expense-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:18px 24px 10px}
        .sales-expense-summary>div{background:#f8fafc;border:1px solid #e7ecf2;border-radius:12px;padding:13px 15px}
        .sales-expense-summary span{display:block;color:#7a8796;font-size:10px;font-weight:800;letter-spacing:.07em}
        .sales-expense-summary strong{display:block;color:#202938;font-size:20px;margin-top:5px}
        .sales-expense-summary .chart-positive{color:#08764e}.sales-expense-summary .chart-negative{color:#d43a35}
        .sales-expense-chart-wrap{padding:12px 24px 18px}
        .sales-expense-legend{display:flex;gap:18px;justify-content:flex-end;font-size:11px;color:#64748b;margin-bottom:10px}
        .sales-expense-legend span{display:flex;align-items:center;gap:6px}.sales-expense-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
        .sales-legend{background:#168b68}.expenses-legend{background:#e45b55}
        .sales-expense-chart{height:210px;display:grid;grid-template-columns:repeat(31,minmax(0,1fr));gap:4px;align-items:end;border-bottom:1px solid #dce3ec;padding:8px 2px 0}
        .sales-expense-day{height:100%;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
        .sales-expense-bars{height:calc(100% - 18px);width:100%;display:flex;align-items:flex-end;justify-content:center;gap:2px}
        .sales-bar,.expenses-bar{width:min(44%,12px);min-height:0;border-radius:3px 3px 0 0;transition:height .2s}
        .sales-bar{background:#168b68}.expenses-bar{background:#e45b55}
        .sales-expense-day-label{height:18px;font-size:9px;color:#8491a2;line-height:18px}
        .sales-expense-axis{display:flex;justify-content:space-between;color:#8491a2;font-size:10px;padding:3px 0}
        .sales-expense-empty{text-align:center;color:#8792a1;font-size:12px;padding:8px}
        .sales-expense-note{margin:0;padding:0 24px 16px;color:#8792a1;font-size:11px}
        .reports-workspace{background:#f5f7fb;min-height:100vh}.cash-control-panel{margin-bottom:22px}.cash-entry-form{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.cash-entry-form input,.cash-entry-form select{height:42px;border:1px solid #dce3ec;border-radius:9px;padding:0 10px;min-width:135px;max-width:190px;background:#fff;color:#263244}.cash-entry-form button{padding:11px 14px}.cash-balance-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:18px 22px}.cash-balance-grid>div{border:1px solid #e7ecf2;border-radius:12px;padding:13px;background:#fbfcfe}.cash-balance-grid span{display:block;color:#7a8796;font-size:11px;font-weight:700;text-transform:uppercase}.cash-balance-grid strong{display:block;margin-top:6px;font-size:18px;color:#243041}.cash-balance-grid .cash-positive{color:#12845d}.cash-balance-grid .cash-negative{color:#d43a35}.cash-balance-grid .cash-balance-total{background:#eef8f2;border-color:#cde8d8}.cash-balance-grid .cash-balance-total strong{font-size:23px;color:#08764e}.cash-expense-heading{display:flex;justify-content:space-between;align-items:center;padding:12px 22px 8px;border-top:1px solid #edf0f4;color:#344054;font-size:13px}.cash-expense-heading a{color:#d9231e;font-weight:700;font-size:12px;text-decoration:none}.cash-expense-scroll{max-height:190px;overflow-y:auto;border-bottom:1px solid #edf0f4}.cash-expense-scroll thead{position:sticky;top:0;background:#f8fafc;z-index:1}.cash-expense-scroll table{margin:0}.cash-ledger-scroll{max-height:220px;overflow-y:auto;border-top:1px solid #edf0f4}.cash-ledger-scroll thead{position:sticky;top:0;background:#f8fafc;z-index:1}.cash-ledger-scroll table{margin:0}.cash-month-summary{display:flex;align-items:center;gap:16px;padding:15px 22px;background:#f8fafc;border-top:1px solid #edf0f4}.cash-month-summary strong{font-size:20px;color:#08764e}.cash-month-summary span{font-size:11px;color:#8792a1}.finance-report-panel{margin-bottom:22px}.finance-report-panel .table-actions{flex-wrap:wrap}.finance-report-panel .table-actions input{border:0;background:transparent;color:#334155;font:600 14px Arial;max-width:150px}.finance-report-content{padding:20px 24px 24px}.finance-report-period{display:flex;justify-content:space-between;align-items:center;padding:4px 0 12px;color:#273449;font-size:14px}.finance-report-period span{color:#7a8796;font-size:12px}.finance-metrics{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:22px}.finance-report-note{font-size:12px;color:#8792a1;margin:14px 0 0}.finance-report-panel .export-btn{padding:12px 15px;font-size:12px;border-radius:10px}.finance-report-panel .finance-print{background:#334155;box-shadow:none}.finance-report-panel .range-select{padding:0 9px}.finance-report-panel .range-select input{min-width:125px}.reports-header{min-height:122px;padding:28px 34px;border-bottom:1px solid #e8ecf2;background:linear-gradient(135deg,#fff 0%,#f9fafc 100%);display:flex;align-items:center;justify-content:space-between;gap:20px}.report-kicker{font-size:11px;font-weight:800;letter-spacing:.14em;color:#e32620;margin-bottom:5px}.reports-header h1{margin:0;font-size:32px;letter-spacing:-.03em;color:#1f2937}.reports-header p{margin:7px 0 0;color:#718096;font-size:15px}.export-btn{border:0;border-radius:14px;background:#ed1c16;color:#fff;font-weight:800;font-size:14px;letter-spacing:.04em;padding:16px 22px;display:flex;align-items:center;gap:9px;box-shadow:0 10px 24px rgba(237,28,22,.22);cursor:pointer;transition:.2s}.export-btn:hover{transform:translateY(-2px);background:#d91510}.reports-content{padding:28px 34px 40px}.metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:22px}.metric-card{background:#fff;border:1px solid #e8ecf2;border-radius:18px;padding:19px;display:flex;gap:14px;align-items:flex-start;box-shadow:0 4px 18px rgba(17,24,39,.035);position:relative;overflow:hidden}.metric-card:after{content:"";position:absolute;left:0;top:0;width:4px;height:100%;background:#e32620}.metric-icon{width:44px;height:44px;border-radius:13px;background:#fff1f0;color:#e32620;display:grid;place-items:center;flex:0 0 auto}.orders-card .metric-icon{background:#f1f5ff;color:#4f6fd8}.paid-card .metric-icon{background:#ecfdf5;color:#169b6b}.average-card .metric-icon{background:#fff8e7;color:#d99100}.metric-card span{display:block;font-size:12px;font-weight:700;color:#7a8796;text-transform:uppercase;letter-spacing:.06em}.metric-card strong{display:block;font-size:24px;line-height:1.25;color:#202938;margin:5px 0 3px;letter-spacing:-.02em}.metric-card small{color:#9aa4b2;font-size:12px}.report-table-card{background:#fff;border:1px solid #e8ecf2;border-radius:20px;box-shadow:0 8px 30px rgba(17,24,39,.045);overflow:hidden}.table-topbar{padding:22px 24px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:18px}.table-topbar h2{margin:0;color:#243041;font-size:19px}.table-topbar p{margin:5px 0 0;color:#8b96a5;font-size:13px}.table-actions{display:flex;align-items:center;gap:10px}.search-field{height:46px;min-width:320px;border:1px solid #dfe5ec;border-radius:12px;background:#f9fafb;display:flex;align-items:center;padding:0 13px;gap:10px;color:#8b96a5}.search-field input{border:0!important;background:transparent!important;outline:0;width:100%;font-size:14px;color:#334155}.search-field button{border:0;background:transparent;color:#8b96a5;cursor:pointer;padding:3px}.range-select{height:46px;border:1px solid #dfe5ec;border-radius:12px;padding:0 12px;display:flex;align-items:center;gap:8px;color:#6b7785;background:#fff}.range-select select{border:0;outline:0;background:transparent;color:#334155;font-weight:600;font-size:14px;cursor:pointer}.table-wrap{overflow-x:auto}.reports-table{width:100%;border-collapse:collapse;min-width:850px}.reports-table th{text-align:left;padding:15px 24px;background:#fafbfc;color:#8a95a4;font-size:11px;letter-spacing:.07em;font-weight:800;border-bottom:1px solid #edf0f4}.reports-table td{padding:17px 24px;border-bottom:1px solid #eef1f4;color:#3b4756;font-size:14px}.reports-table tbody tr{transition:.15s}.reports-table tbody tr:hover{background:#fcfcfd}.order-cell b{display:block;color:#273344;font-size:14px}.order-cell span{display:block;color:#9aa4b2;font-size:11px;margin-top:4px}.customer-cell{display:flex;align-items:center;gap:9px;font-weight:600}.customer-avatar{width:30px;height:30px;border-radius:50%;background:#fff0ef;color:#df251f;display:grid;place-items:center;font-size:12px;font-weight:800}.date-cell{color:#647184!important;white-space:nowrap}.money-cell{font-weight:700;color:#263244!important;white-space:nowrap}.paid-money{color:#0c8a61!important}.status-pill{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:12px;font-weight:700;text-transform:capitalize}.status-pill.completed{background:#eaf8f1;color:#16855f}.loading-state,.empty-report{padding:58px 20px;text-align:center;color:#7d8998}.loader{width:26px;height:26px;border:3px solid #edf0f3;border-top-color:#e32620;border-radius:50%;margin:0 auto 12px;animation:spin .8s linear infinite}.empty-report{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-report b{color:#374151;font-size:15px}.empty-icon{width:52px;height:52px;border-radius:16px;background:#fff1f0;color:#e32620;display:grid;place-items:center;margin-bottom:2px}.table-footer{display:flex;justify-content:space-between;gap:12px;padding:14px 24px;color:#9aa4b2;font-size:12px;background:#fbfcfd}.table-footer b{color:#4b5563}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:1150px){.metrics-grid{grid-template-columns:repeat(2,1fr)}.table-topbar{align-items:flex-start;flex-direction:column}.table-actions{width:100%}.search-field{flex:1;min-width:0}}@media(max-width:700px){.sales-expense-summary{grid-template-columns:1fr;padding:14px}.sales-expense-chart-wrap{padding:10px 14px 14px}.sales-expense-chart{gap:2px;height:170px}.sales-expense-note{padding:0 14px 14px}.sales-expense-tracker .table-topbar{align-items:flex-start}.sales-expense-date-filters{flex-wrap:wrap}.sales-expense-date-filters input{max-width:145px}.cash-balance-grid{grid-template-columns:repeat(2,minmax(0,1fr));padding:14px}.cash-balance-grid .cash-balance-total{grid-column:1/-1}.cash-entry-form{width:100%}.cash-entry-form input,.cash-entry-form select{max-width:none;flex:1;min-width:120px}.cash-month-summary{align-items:flex-start;flex-direction:column;gap:5px}.reports-header{padding:22px 18px;align-items:flex-start;flex-direction:column}.reports-header h1{font-size:26px}.export-btn{width:100%;justify-content:center}.reports-content{padding:18px}.metrics-grid{grid-template-columns:1fr;gap:12px}.table-actions{flex-direction:column;align-items:stretch}.range-select{justify-content:flex-start}.table-footer{flex-direction:column}.report-table-card{border-radius:16px}.table-topbar{padding:18px}}
      `}</style>
    </section>
  </main>;
}