"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ArrowLeft, Plus, Trash2, Save, WalletCards, ReceiptText, BriefcaseBusiness, Package, CircleDollarSign, TrendingUp, Link2, Users } from "lucide-react";
import "../pos/pos.css";
import "./project-costing.css";

type CostRow = { id: number; category: string; description: string; amount: number; inventoryId?: string; quantityUsed?: number; unitCost?: number };
type InventoryItem = { id:string; name:string; category:string; unit:string; quantity:number; unit_cost:number; is_active:boolean };
type DtfRow = { id:number; description:string; width:number; height:number; quantity:number };
type PrintingMethod = "" | "DTF Printing" | "Sublimation" | "No Printing";
const DTF_FILM_WIDTH_IN = 22;
const DTF_METER_LENGTH_IN = 39;
const DTF_METER_AREA_SQ_IN = DTF_FILM_WIDTH_IN * DTF_METER_LENGTH_IN;
const DTF_RATE_TIERS = [
  { maxMeters: 10, rate: 160, label: "1–9 meters" },
  { maxMeters: 30, rate: 150, label: "10–29 meters" },
  { maxMeters: 50, rate: 140, label: "30–49 meters" },
  { maxMeters: 100, rate: 135, label: "50–99 meters" },
  { maxMeters: Infinity, rate: 120, label: "100+ meters" },
];
const DRAFT_KEY = "printwise_project_costing_draft_v1";
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export default function ProjectCostingPage() {
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [targetMargin, setTargetMargin] = useState(25);
  const [orderNo, setOrderNo] = useState("");
  const [orderId, setOrderId] = useState("");
  const [costs, setCosts] = useState<CostRow[]>([{ id: 1, category: "Materials", description: "Item / materials", amount: 0 }]);
  const [message, setMessage] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [inventoryQty, setInventoryQty] = useState(1);
  const [printingMethod, setPrintingMethod] = useState<PrintingMethod>("DTF Printing");
  const [sublimationCostPerSqIn, setSublimationCostPerSqIn] = useState(0);
  const [sublimationWastage, setSublimationWastage] = useState(0);
  const [dtfRows, setDtfRows] = useState<DtfRow[]>([{ id: Date.now(), description: "Left Chest Logo", width: 4, height: 4, quantity: 1 }]);

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const { data, error } = await (await import("../../lib/supabase")).supabase
          .from("inventory_items").select("*").eq("is_active", true).order("category").order("name");
        if (error) throw error;
        setInventory((data ?? []).map((item:any) => ({ ...item, quantity:Number(item.quantity||0), unit_cost:Number(item.unit_cost||0) })));
      } catch {
        setMessage("Inventory could not be loaded. Please check your inventory setup.");
      }
    };
    loadInventory();
  }, []);

  useEffect(() => {
    // Restore an unsaved draft first so switching tabs, reloading, or revisiting this page never loses work.
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const saved = JSON.parse(draft);
        setProjectName(saved.projectName ?? "");
        setClient(saved.client ?? "");
        setQuantity(Math.max(1, Number(saved.quantity ?? 1)));
        setSellingPrice(Number(saved.sellingPrice ?? 0));
        setTargetMargin(Math.min(90, Math.max(1, Number(saved.targetMargin ?? 25))));
        setOrderNo(saved.orderNo ?? "");
        setOrderId(saved.orderId ?? "");
        if (Array.isArray(saved.costs) && saved.costs.length) setCosts(saved.costs);
        setSelectedInventoryId(saved.selectedInventoryId ?? "");
        setInventoryQty(Math.max(1, Number(saved.inventoryQty ?? 1)));
        setPrintingMethod(saved.printingMethod === "Sublimation" || saved.printingMethod === "No Printing" || saved.printingMethod === "DTF Printing" ? saved.printingMethod : "DTF Printing");
        setSublimationCostPerSqIn(Math.max(0, Number(saved.sublimationCostPerSqIn ?? 0)));
        setSublimationWastage(Math.max(0, Number(saved.sublimationWastage ?? 0)));
        if (Array.isArray(saved.dtfRows) && saved.dtfRows.length) setDtfRows(saved.dtfRows);
        setMessage("Unsaved draft restored automatically.");
        return;
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId") || "";
    if (!id) return;
    const raw = sessionStorage.getItem(`printwise_costing_order_${id}`);
    if (!raw) return;
    try {
      const order = JSON.parse(raw) as { id: string; order_no: string; customer_name: string | null; total: number; quantity: number; projectName: string };
      setOrderId(order.id);
      setOrderNo(order.order_no);
      setClient(order.customer_name || "Walk-in Customer");
      setSellingPrice(Number(order.total || 0));
      setQuantity(Math.max(1, Number(order.quantity || 1)));
      setProjectName(order.projectName || `Costing - ${order.order_no}`);
      setMessage(`Order ${order.order_no} was imported. Add the actual project expenses to calculate your estimated profit.`);
    } catch {
      setMessage("Unable to import the selected order.");
    }
  }, []);

  useEffect(() => {
    const draft = { projectName, client, quantity, sellingPrice, targetMargin, orderNo, orderId, costs, selectedInventoryId, inventoryQty, printingMethod, sublimationCostPerSqIn, sublimationWastage, dtfRows };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [projectName, client, quantity, sellingPrice, targetMargin, orderNo, orderId, costs, selectedInventoryId, inventoryQty, printingMethod, sublimationCostPerSqIn, sublimationWastage, dtfRows]);

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setProjectName(""); setClient(""); setQuantity(1); setSellingPrice(0); setTargetMargin(25);
    setOrderNo(""); setOrderId(""); setSelectedInventoryId(""); setInventoryQty(1); setPrintingMethod("DTF Printing"); setSublimationCostPerSqIn(0); setSublimationWastage(0); setDtfRows([{ id: Date.now(), description: "Left Chest Logo", width: 4, height: 4, quantity: 1 }]);
    setCosts([{ id: Date.now(), category: "Materials", description: "Item / materials", amount: 0 }]);
    setMessage("Draft cleared. You can start a new project costing.");
  };

  const totalExpenses = useMemo(() => costs.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [costs]);
  const netProfit = sellingPrice - totalExpenses;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
  const costPerItem = quantity > 0 ? totalExpenses / quantity : 0;
  const profitPerItem = quantity > 0 ? netProfit / quantity : 0;
  const isLoss = netProfit < 0;
  const suggestedTotalPrice = totalExpenses > 0 && targetMargin > 0 && targetMargin < 100
    ? totalExpenses / (1 - targetMargin / 100)
    : 0;
  const suggestedPricePerItem = quantity > 0 ? suggestedTotalPrice / quantity : 0;
  const suggestedProfit = suggestedTotalPrice - totalExpenses;
  const applySuggestedPrice = () => {
    if (suggestedTotalPrice <= 0) { setMessage("Add your project expenses first so PrintWise can calculate a suggested selling price."); return; }
    setSellingPrice(Number(suggestedTotalPrice.toFixed(2)));
    setMessage(`Suggested selling price applied at a ${targetMargin.toFixed(0)}% target profit margin.`);
  };
  const selectedInventoryItem = inventory.find((item) => item.id === selectedInventoryId);
  const selectedInventoryAmount = selectedInventoryItem
    ? Number(selectedInventoryItem.unit_cost || 0) * Math.max(1, Number(inventoryQty) || 1)
    : 0;

  const dtfBaseArea = useMemo(() => dtfRows.reduce((sum, row) => sum + (Math.max(0, Number(row.width)||0) * Math.max(0, Number(row.height)||0) * Math.max(0, Number(row.quantity)||0)), 0), [dtfRows]);
  // Automatic supplier pricing: customer enters only print dimensions and quantity.
  // Supplier film is fixed at 22 in × 39 in, and the rate tier is selected from the estimated meter usage.
  const dtfEstimatedMeters = dtfBaseArea / DTF_METER_AREA_SQ_IN;
  const dtfRateTier = DTF_RATE_TIERS.find((tier) => dtfEstimatedMeters < tier.maxMeters) ?? DTF_RATE_TIERS[0];
  const dtfSupplierRate = dtfRateTier.rate;
  const dtfCostPerSqIn = dtfSupplierRate / DTF_METER_AREA_SQ_IN;
  const dtfBaseCost = dtfEstimatedMeters * dtfSupplierRate;
  const dtfWastageAmount = 0;
  const dtfTotalCost = dtfBaseCost;
  const sublimationBaseCost = dtfBaseArea * Math.max(0, Number(sublimationCostPerSqIn)||0);
  const sublimationWastageAmount = sublimationBaseCost * Math.max(0, Number(sublimationWastage)||0) / 100;
  const sublimationTotalCost = sublimationBaseCost + sublimationWastageAmount;
  const updateDtfRow = (id:number, key:keyof DtfRow, value:string|number) => {
    setDtfRows(rows => rows.map(row => row.id === id ? { ...row, [key]: key === "description" ? String(value) : Math.max(0, Number(value)||0) } : row));
  };
  const addDtfRow = () => setDtfRows(rows => [...rows, { id: Date.now(), description: "", width: 0, height: 0, quantity: 1 }]);
  const removeDtfRow = (id:number) => setDtfRows(rows => rows.length > 1 ? rows.filter(row => row.id !== id) : rows);
  const removePrintingExpenses = () => setCosts(rows => rows.filter(row => !(row.category === "Printing" && (row.description.startsWith("DTF Printing —") || row.description.startsWith("Sublimation Printing —")))));
  const addDtfExpense = () => {
    if (dtfTotalCost <= 0) { setMessage("Enter valid DTF print sizes and quantities first."); return; }
    const activeRows = dtfRows.filter(row => row.width > 0 && row.height > 0 && row.quantity > 0);
    const detail = activeRows.map(row => `${row.description || "DTF Print"} ${row.width}×${row.height} in × ${row.quantity}`).join("; ");
    setCosts(rows => [...rows.filter(row => !(row.category === "Printing" && (row.description.startsWith("DTF Printing —") || row.description.startsWith("Sublimation Printing —")))), { id: Date.now(), category: "Printing", description: `DTF Printing — ${detail}`, amount: Number(dtfTotalCost.toFixed(2)) }]);
    setMessage(`DTF expense of ${money.format(dtfTotalCost)} added to Project Expenses.`);
  };

  const addSublimationExpense = () => {
    if (sublimationTotalCost <= 0) { setMessage("Enter valid print sizes, quantities, and a Sublimation cost per square inch first."); return; }
    const activeRows = dtfRows.filter(row => row.width > 0 && row.height > 0 && row.quantity > 0);
    const detail = activeRows.map(row => `${row.description || "Sublimation Print"} ${row.width}×${row.height} in × ${row.quantity}`).join("; ");
    setCosts(rows => [...rows.filter(row => !(row.category === "Printing" && (row.description.startsWith("DTF Printing —") || row.description.startsWith("Sublimation Printing —")))), { id: Date.now(), category: "Printing", description: `Sublimation Printing — ${detail}`, amount: Number(sublimationTotalCost.toFixed(2)) }]);
    setMessage(`Sublimation expense of ${money.format(sublimationTotalCost)} added to Project Expenses.`);
  };
  const handlePrintingMethodChange = (value: PrintingMethod) => {
    setPrintingMethod(value);
    removePrintingExpenses();
    setMessage(value === "No Printing" ? "Printing costs are disabled for this project." : `Printing method changed to ${value}. Previous printing expense was removed to prevent duplicate costs.`);
  };

  const updateCost = (id: number, key: keyof CostRow, value: string | number) => {
    setCosts((rows) => rows.map((row) => row.id === id ? { ...row, [key]: key === "amount" ? Number(value) || 0 : value } : row));
  };

  const addCost = () => {
    setCosts((rows) => [...rows, { id: Date.now(), category: "Other", description: "", amount: 0 }]);
  };

  const addInventoryExpense = () => {
    const item = inventory.find((x) => x.id === selectedInventoryId);
    if (!item) { setMessage("Please select an inventory item first."); return; }
    const qty = Math.max(1, Number(inventoryQty) || 1);
    if (item.quantity < qty) { setMessage(`Warning: only ${item.quantity} ${item.unit} of ${item.name} is currently in stock.`); }
    const amount = Number(item.unit_cost || 0) * qty;
    setCosts((rows) => [...rows, { id: Date.now(), category: "Materials", description: `${item.name} — ${qty} ${item.unit} × ₱${Number(item.unit_cost||0).toFixed(2)}`, amount, inventoryId:item.id, quantityUsed:qty, unitCost:Number(item.unit_cost||0) }]);
    setSelectedInventoryId(""); setInventoryQty(1);
    setMessage(`${item.name} was added using its current inventory unit cost.`);
  };

  const removeCost = (id: number) => {
    setCosts((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);
  };

  const saveEstimate = () => {
    const record = {
      id: Date.now(),
      projectName,
      client,
      quantity,
      sellingPrice,
      orderId,
      orderNo,
      costs,
      totalExpenses,
      netProfit,
      profitMargin,
      targetMargin,
      suggestedTotalPrice,
      createdAt: new Date().toISOString()
    };
    const history = JSON.parse(localStorage.getItem("printwise_project_costing") || "[]");
    const next = [record, ...history.filter((item: any) => !(orderId && item.orderId === orderId))];
    localStorage.setItem("printwise_project_costing", JSON.stringify(next));
    localStorage.removeItem(DRAFT_KEY);
    setMessage("Project costing saved successfully. Your expenses and estimated profit are now recorded.");
  };

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Package size={21} /></div><span>PRINTWISE</span></div>
      <div className="nav-label">MAIN MENU</div>
      <a className="nav-item" href="/dashboard"><ArrowLeft size={19} /><span>Dashboard</span></a>
      <a className="nav-item" href="/pos"><WalletCards size={19} /><span>Point of Sale</span></a>
      <a className="nav-item" href="/orders"><ReceiptText size={19} /><span>Orders</span></a>
      <a className="nav-item" href="/inventory"><Package size={19} /><span>Inventory</span></a>
      <a className="nav-item active" href="/project-costing"><Calculator size={19} /><span>Project Costing</span></a>
    </aside>

    <section className="workspace project-workspace">
      <header className="project-topbar">
        <div>
          <div className="project-eyebrow"><Calculator size={15} /> SMART BUSINESS TOOL</div>
          <h1>Project Costing &amp; Profit</h1>
          <p>{orderNo ? `Linked to POS Order ${orderNo}` : "Compute your real project expenses and estimated earnings before production."}</p>
        </div>
        <div className="project-topbar-badge">
          {orderNo ? <><Link2 size={17} /> POS ORDER LINKED</> : <><BriefcaseBusiness size={17} /> NEW PROJECT ESTIMATE</>}
        </div>
      </header>

      <div className="project-content">
        <section className="costing-card">
          <div className="section-heading"><div><h2>Project Information</h2><p>Enter the project details and selling value.</p></div></div>
          <div className="project-form-grid">
            <label className="project-field">Project Name<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Company Polo Shirts" /></label>
            <label className="project-field">Client<input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client or customer name" /></label>
            <label className="project-field">Quantity<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label className="project-field">Total Selling Price<input className="money-input" type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(Number(e.target.value) || 0)} /></label>
          </div>

          <div className="smart-price-box">
            <div className="smart-price-head">
              <div><div className="smart-price-kicker"><TrendingUp size={15}/> SMART PRICE SUGGESTION</div><h3>Let PrintWise recommend your selling price</h3><p>Choose your target profit margin. The suggestion is based on your actual project expenses and quantity.</p></div>
              <button type="button" className="apply-suggested-btn" onClick={applySuggestedPrice} disabled={suggestedTotalPrice <= 0}>USE SUGGESTED PRICE</button>
            </div>
            <div className="margin-options">{[20,25,30,40].map((margin)=><button type="button" key={margin} className={targetMargin===margin?"active":""} onClick={()=>setTargetMargin(margin)}>{margin}%{margin===25?<small> RECOMMENDED</small>:null}</button>)}</div>
            <div className="smart-price-grid">
              <label className="target-margin-field">Custom Target Margin<input type="number" min="1" max="90" step="1" value={targetMargin} onChange={e=>setTargetMargin(Math.min(90,Math.max(1,Number(e.target.value)||25)))} /><span>%</span></label>
              <div className="suggested-price-stat"><span>Suggested Price / Item</span><strong>{money.format(suggestedPricePerItem)}</strong></div>
              <div className="suggested-price-stat featured"><span>Suggested Total Selling Price</span><strong>{money.format(suggestedTotalPrice)}</strong></div>
              <div className="suggested-price-stat"><span>Expected Profit</span><strong>{money.format(suggestedProfit)}</strong></div>
            </div>
            {totalExpenses<=0 && <div className="smart-price-empty">Add at least one project expense to unlock an accurate selling price suggestion.</div>}
          </div>

          <div className="expense-section">
            <div className="inventory-costing-box" style={{marginBottom:18,padding:18,border:"1px solid #e5e7eb",borderRadius:16,background:"#f8fafc"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:12}}><div><h2 style={{margin:0,fontSize:18}}>Use Inventory Supply</h2><p className="expense-help" style={{margin:"4px 0 0"}}>Select a supply and PrintWise will automatically use its saved cost per unit.</p></div></div>
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 130px 170px",gap:10,alignItems:"end"}}>
                <label className="project-field">Inventory Item<select value={selectedInventoryId} onChange={e=>setSelectedInventoryId(e.target.value)}><option value="">Select a supply...</option>{inventory.map(item=><option key={item.id} value={item.id}>{item.name} — ₱{Number(item.unit_cost||0).toFixed(2)}/{item.unit} (Stock: {item.quantity})</option>)}</select></label>
                <label className="project-field">Qty Used<input type="number" min="1" value={inventoryQty} onChange={e=>setInventoryQty(Math.max(1,Number(e.target.value)||1))}/></label>
                <div style={{padding:"11px 13px",border:"1px solid #d8dee8",borderRadius:10,background:"#fff",minHeight:46,boxSizing:"border-box"}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#667085",textTransform:"uppercase",letterSpacing:".06em"}}>Auto Expense</div>
                  <div style={{fontWeight:800,fontSize:18,color:"#1f2937",marginTop:2}}>{money.format(selectedInventoryAmount)}</div>
                </div>
              </div>
              {selectedInventoryItem && <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:10,padding:"10px 12px",borderRadius:10,background:"#fff",border:"1px solid #e5e7eb",fontSize:13,color:"#667085",flexWrap:"wrap"}}>
                <span><b style={{color:"#344054"}}>Unit Cost:</b> {money.format(Number(selectedInventoryItem.unit_cost||0))} / {selectedInventoryItem.unit}</span>
                <span><b style={{color:"#344054"}}>Available Stock:</b> {selectedInventoryItem.quantity} {selectedInventoryItem.unit}</span>
                <button className="add-expense-btn" style={{padding:"9px 13px"}} type="button" onClick={addInventoryExpense}>ADD FROM INVENTORY</button>
              </div>}
            </div>

            <div className="printing-method-box">
              <div className="printing-method-head"><div><div className="dtf-kicker">PRINTING METHOD</div><h2>Choose how this project will be printed.</h2><p>Select one method. PrintWise will show only the correct calculator and prevent duplicate printing expenses.</p></div></div>
              <label className="project-field printing-method-select">Printing Method<select value={printingMethod} onChange={e=>handlePrintingMethodChange(e.target.value as PrintingMethod)}><option value="">Select Printing Method</option><option value="DTF Printing">DTF Printing</option><option value="Sublimation">Sublimation</option><option value="No Printing">No Printing</option></select></label>
            </div>

            {printingMethod === "DTF Printing" && <div className="dtf-costing-box">
              <div className="dtf-heading"><div><div className="dtf-kicker">DTF PRINTING CALCULATOR</div><h2>Mixed Print Sizes? Calculate each one separately.</h2><p>Add every print location or design size. Each row can have its own width, height, and quantity.</p></div><button type="button" className="add-expense-btn" onClick={addDtfRow}><Plus size={17}/> ADD PRINT SIZE</button></div>
              <div className="dtf-settings automatic"><div className="dtf-auto-card"><span>Fixed DTF Film Size</span><strong>{DTF_FILM_WIDTH_IN}&quot; × {DTF_METER_LENGTH_IN}&quot;</strong><small>{DTF_METER_AREA_SQ_IN.toLocaleString()} sq. in. per meter</small></div><div className="dtf-auto-card"><span>Auto Supplier Rate</span><strong>{money.format(dtfSupplierRate)} / meter</strong><small>{dtfRateTier.label} tier • {dtfEstimatedMeters.toFixed(2)} m estimated</small></div><div className="dtf-total-preview"><span>Live DTF Expense</span><strong>{money.format(dtfTotalCost)}</strong><small>{dtfBaseArea.toLocaleString()} sq. in. × {money.format(dtfCostPerSqIn)}/sq. in.</small></div></div>
              <div className="dtf-table-wrap"><table className="dtf-table"><thead><tr><th>PRINT DESCRIPTION</th><th>WIDTH (IN)</th><th>HEIGHT (IN)</th><th>QTY</th><th>TOTAL AREA</th><th>DTF COST</th><th></th></tr></thead><tbody>{dtfRows.map(row => { const area=(row.width||0)*(row.height||0)*(row.quantity||0); const cost=area*dtfCostPerSqIn; return <tr key={row.id}><td><input value={row.description} onChange={e=>updateDtfRow(row.id,"description",e.target.value)} placeholder="e.g. Left Chest Logo"/></td><td><input type="number" min="0" step="0.1" value={row.width} onChange={e=>updateDtfRow(row.id,"width",e.target.value)}/></td><td><input type="number" min="0" step="0.1" value={row.height} onChange={e=>updateDtfRow(row.id,"height",e.target.value)}/></td><td><input type="number" min="0" step="1" value={row.quantity} onChange={e=>updateDtfRow(row.id,"quantity",e.target.value)}/></td><td><b>{area.toLocaleString()} sq. in.</b></td><td><b>{money.format(cost)}</b></td><td><button className="delete-expense" type="button" title="Remove print size" onClick={()=>removeDtfRow(row.id)}><Trash2 size={17}/></button></td></tr>})}</tbody></table></div>
              <div className="dtf-summary"><span>Estimated DTF Meters: <b>{dtfEstimatedMeters.toFixed(2)} m</b></span><span>Supplier Rate: <b>{money.format(dtfSupplierRate)}/m</b></span><span className="dtf-grand">Final DTF Expense: <b>{money.format(dtfTotalCost)}</b></span><button type="button" className="apply-suggested-btn" onClick={addDtfExpense}>ADD DTF EXPENSE TO PROJECT</button></div>
            </div>}

            {printingMethod === "Sublimation" && <div className="dtf-costing-box sublimation-box">
              <div className="dtf-heading"><div><div className="dtf-kicker">SUBLIMATION CALCULATOR</div><h2>Calculate mixed sublimation print sizes automatically.</h2><p>Use the same print-size rows, but apply your Sublimation cost rate and wastage allowance.</p></div><button type="button" className="add-expense-btn" onClick={addDtfRow}><Plus size={17}/> ADD PRINT SIZE</button></div>
              <div className="dtf-settings"><label className="project-field">Sublimation Cost per sq. in. (₱)<input type="number" min="0" step="0.01" value={sublimationCostPerSqIn} onChange={e=>setSublimationCostPerSqIn(Math.max(0,Number(e.target.value)||0))}/></label><label className="project-field">Wastage Allowance (%)<input type="number" min="0" max="100" step="1" value={sublimationWastage} onChange={e=>setSublimationWastage(Math.min(100,Math.max(0,Number(e.target.value)||0)))} /></label><div className="dtf-total-preview"><span>Live Sublimation Expense</span><strong>{money.format(sublimationTotalCost)}</strong><small>{dtfBaseArea.toLocaleString()} sq. in. total area</small></div></div>
              <div className="dtf-table-wrap"><table className="dtf-table"><thead><tr><th>PRINT DESCRIPTION</th><th>WIDTH (IN)</th><th>HEIGHT (IN)</th><th>QTY</th><th>TOTAL AREA</th><th>SUBLIMATION COST</th><th></th></tr></thead><tbody>{dtfRows.map(row => { const area=(row.width||0)*(row.height||0)*(row.quantity||0); const cost=area*sublimationCostPerSqIn; return <tr key={row.id}><td><input value={row.description} onChange={e=>updateDtfRow(row.id,"description",e.target.value)} placeholder="e.g. Front Design"/></td><td><input type="number" min="0" step="0.1" value={row.width} onChange={e=>updateDtfRow(row.id,"width",e.target.value)}/></td><td><input type="number" min="0" step="0.1" value={row.height} onChange={e=>updateDtfRow(row.id,"height",e.target.value)}/></td><td><input type="number" min="0" step="1" value={row.quantity} onChange={e=>updateDtfRow(row.id,"quantity",e.target.value)}/></td><td><b>{area.toLocaleString()} sq. in.</b></td><td><b>{money.format(cost)}</b></td><td><button className="delete-expense" type="button" title="Remove print size" onClick={()=>removeDtfRow(row.id)}><Trash2 size={17}/></button></td></tr>})}</tbody></table></div>
              <div className="dtf-summary"><span>Base Sublimation Cost: <b>{money.format(sublimationBaseCost)}</b></span><span>Wastage: <b>{money.format(sublimationWastageAmount)}</b></span><span className="dtf-grand">Final Sublimation Expense: <b>{money.format(sublimationTotalCost)}</b></span><button type="button" className="apply-suggested-btn" onClick={addSublimationExpense}>ADD SUBLIMATION EXPENSE TO PROJECT</button></div>
            </div>}

            {printingMethod === "No Printing" && <div className="printing-none-state">No printing cost will be included. You can continue adding Inventory and other Project Expenses.</div>}

            <div className="expense-title-row">
              <div>
                <h2><ReceiptText size={20} /> Project Expenses</h2>
                <p className="expense-help">Add the actual costs for materials, labor, printing, delivery, and other project expenses.</p>
              </div>
              <button className="add-expense-btn" onClick={addCost}><Plus size={17} /> ADD EXPENSE</button>
            </div>
            <div className="expense-table-wrap">
              <table className="expense-table">
                <thead><tr><th>CATEGORY</th><th>DESCRIPTION</th><th>AMOUNT</th><th></th></tr></thead>
                <tbody>{costs.map((row) => <tr key={row.id}>
                  <td><select value={row.category} onChange={(e) => updateCost(row.id, "category", e.target.value)}>
                    <option>Materials</option><option>Product Base Cost</option><option>Labor</option><option>Printing</option><option>Embroidery</option><option>Delivery</option><option>Packaging</option><option>GCash Fee</option><option>Other</option>
                  </select></td>
                  <td><input value={row.description} onChange={(e) => updateCost(row.id, "description", e.target.value)} placeholder="What is this expense for?" /></td>
                  <td className="amount-cell"><input type="number" min="0" step="0.01" value={row.amount} onChange={(e) => updateCost(row.id, "amount", e.target.value)} /></td>
                  <td><button className="delete-expense" title="Remove expense" onClick={() => removeCost(row.id)}><Trash2 size={17} /></button></td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>

          {message && <div className="costing-message">✓ {message}</div>}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className="save-costing-btn" onClick={saveEstimate}><Save size={18} /> SAVE PROJECT COSTING</button>
            <button className="add-expense-btn" onClick={discardDraft} type="button">DISCARD / CLEAR DRAFT</button>
          </div>
        </section>

        <aside className="costing-card profit-card">
          <div className="profit-card-head"><h2>Profit Summary</h2><p>Live calculation based on your inputs.</p></div>
          <div className="profit-hero"><span>{isLoss ? "Estimated Loss" : "Estimated Net Profit"}</span><strong>{money.format(netProfit)}</strong><small>{isLoss ? "Your expenses are higher than your selling price." : "Estimated earnings after all project expenses."}</small></div>
          <div className="profit-rows">
            <div className="profit-row"><span>Total Project Revenue</span><b>{money.format(sellingPrice)}</b></div>
            <div className="profit-row"><span>Total Expenses</span><b>{money.format(totalExpenses)}</b></div>
            <div className={`profit-row ${isLoss ? "loss" : "highlight"}`}><span>Estimated Net Profit</span><b>{money.format(netProfit)}</b></div>
            <div className="profit-row"><span>Profit Margin</span><b className="margin-pill">{profitMargin.toFixed(2)}%</b></div>
            <div className="profit-row"><span>Cost Per Item</span><b>{money.format(costPerItem)}</b></div>
            <div className="profit-row"><span>Profit Per Item</span><b>{money.format(profitPerItem)}</b></div>
          </div>
          <div className="project-link-note">
            {orderNo ? <Link2 size={17} /> : <TrendingUp size={17} />}
            <span>{orderNo ? `This costing is connected to ${orderNo}. Saving will update the stored estimate for this project.` : "Enter your project expenses to see the estimated profit and profit margin in real time."}</span>
          </div>
        </aside>
      </div>
    </section>
  </main>;
}
