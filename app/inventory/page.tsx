"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Package, Plus, Pencil, Power, Save, Search, X, ReceiptText, ShoppingCart, Boxes, AlertTriangle, Hash } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "../pos/pos.css";
import "./inventory.css";

type InventoryItem={id:string;name:string;category:string;unit:string;quantity:number;reorder_level:number;unit_cost:number;is_active:boolean};
type Form={name:string;category:string;unit:string;quantity:string;reorder_level:string;unit_cost:string};
const empty:Form={name:"",category:"",unit:"piece",quantity:"0",reorder_level:"0",unit_cost:"0"};

export default function InventoryPage(){
 const[items,setItems]=useState<InventoryItem[]>([]),[search,setSearch]=useState(""),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[modalError,setModalError]=useState(""),[open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<Form>(empty),[saving,setSaving]=useState(false);
 const load=async()=>{setLoading(true);const{data,error}=await supabase.from("inventory_items").select("*").order("category").order("name");if(error)setMessage(`Unable to load inventory: ${error.message}`);else setItems((data??[]).map((x:any)=>({...x,quantity:Number(x.quantity||0),reorder_level:Number(x.reorder_level||0),unit_cost:Number(x.unit_cost||0)})));setLoading(false)};
 useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(!data.user)window.location.href="/pos";else load()})},[]);
 const filtered=useMemo(()=>items.filter(i=>`${i.name} ${i.category} ${i.unit}`.toLowerCase().includes(search.toLowerCase())),[items,search]);
 const openAdd=()=>{setEditing(null);setForm(empty);setMessage("");setModalError("");setOpen(true)};
 const openEdit=(i:InventoryItem)=>{setEditing(i.id);setModalError("");setForm({name:i.name,category:i.category,unit:i.unit,quantity:String(i.quantity),reorder_level:String(i.reorder_level),unit_cost:String(i.unit_cost||0)});setOpen(true)};
 const closeModal=()=>{if(!saving)setOpen(false)};
 const save=async()=>{
 const name=form.name.trim(),category=form.category.trim(),quantity=Number(form.quantity),reorder=Number(form.reorder_level),unitCost=Number(form.unit_cost);
 setModalError("");
 if(!name||!category||Number.isNaN(quantity)||quantity<0||Number.isNaN(reorder)||reorder<0||Number.isNaN(unitCost)||unitCost<0){
   setModalError("Please complete all required fields with valid values.");
   return;
 }
 setSaving(true);
 try{
   const payload={name,category,unit:form.unit.trim()||"piece",quantity,reorder_level:reorder,unit_cost:unitCost};
   const query=editing
     ? supabase.from("inventory_items").update(payload).eq("id",editing).select()
     : supabase.from("inventory_items").insert({...payload,is_active:true}).select();
   const {error}=await query;
   if(error){
     const text=`Unable to save inventory item: ${error.message}`;
     setModalError(text);
     setMessage(text);
     return;
   }
   setOpen(false);
   setEditing(null);
   setForm(empty);
   setMessage(editing?"Inventory item updated successfully.":"Inventory item added successfully.");
   await load();
 }catch(err:any){
   const text=`Unable to save inventory item: ${err?.message||"Unexpected error"}`;
   setModalError(text);
   setMessage(text);
 }finally{
   setSaving(false);
 }
};
 const toggle=async(i:InventoryItem)=>{const{error}=await supabase.from("inventory_items").update({is_active:!i.is_active}).eq("id",i.id);if(error)setMessage(error.message);else{setItems(a=>a.map(x=>x.id===i.id?{...x,is_active:!x.is_active}:x));setMessage(`${i.name} is now ${i.is_active?"Inactive":"Active"}.`)}};
 const low=items.filter(i=>i.is_active&&i.quantity<=i.reorder_level).length;
 const fieldStyle={width:"100%",height:46,border:"1px solid #d8dee8",borderRadius:10,padding:"0 13px",fontSize:15,outline:"none",background:"#fff",boxSizing:"border-box" as const};
 const labelStyle={display:"block",fontSize:14,fontWeight:700,color:"#344054",marginBottom:8};
 return <main className="app-shell inventory-page">
  <aside className="sidebar">
   <div className="brand"><div className="brand-mark"><Package size={21}/></div><span>PRINTWISE</span></div>
   <div className="nav-label">MAIN MENU</div>
   <a className="nav-item" href="/pos"><ShoppingCart size={19}/><span>Point of Sale</span></a>
   <a className="nav-item" href="/orders"><ReceiptText size={19}/><span>Orders</span></a>
   <a className="nav-item" href="/products"><Package size={19}/><span>Products & Services</span></a>
   <a className="nav-item active" href="/inventory"><Layers3 size={19}/><span>Inventory</span></a>
  </aside>
  <section className="workspace inventory-workspace">
   <header className="topbar inventory-topbar">
    <div><div className="inventory-kicker">INVENTORY MANAGEMENT</div><h1>Inventory</h1><p>Track PrintWise materials, supplies, and stock levels.</p></div>
    <button className="inventory-add-btn" onClick={openAdd}><Plus size={19}/> <span>ADD INVENTORY ITEM</span></button>
   </header>
   <div className="inventory-content">
    <section className="inventory-stats">
     <div className="inventory-stat total"><div className="stat-icon"><Boxes size={21}/></div><div><span>Total Items</span><strong>{items.length}</strong><small>All inventory records</small></div></div>
     <div className="inventory-stat active"><div className="stat-icon"><Package size={21}/></div><div><span>Active Items</span><strong>{items.filter(i=>i.is_active).length}</strong><small>Ready for use</small></div></div>
     <div className="inventory-stat low"><div className="stat-icon"><AlertTriangle size={21}/></div><div><span>Low Stock</span><strong>{low}</strong><small>Needs attention</small></div></div>
    </section>
    <section className="inventory-card">
     <div className="inventory-toolbar">
      <div className="inventory-toolbar-copy"><h2>Inventory Items</h2><p>Search, review, and manage your available materials.</p></div>
      <div className="inventory-count">{filtered.length} {filtered.length===1?"item":"items"} shown</div>
     </div>
     <div className="inventory-search"><Search size={20}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item, category, or unit..."/><kbd>⌘ K</kbd></div>
     {message&&<div className={`inventory-message ${message.toLowerCase().includes("unable")||message.toLowerCase().includes("error")?"error":"success"}`}>{message}</div>}
     <div className="inventory-table-wrap">
      <table className="inventory-table">
       <thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Unit Cost</th><th>Reorder Level</th><th>Status</th><th className="actions-col">Actions</th></tr></thead>
       <tbody>{loading?<tr><td colSpan={7}><div className="inventory-empty">Loading inventory...</div></td></tr>:filtered.length===0?<tr><td colSpan={7}><div className="inventory-empty">No inventory items found.</div></td></tr>:filtered.map(i=>{
        const isLow=i.is_active&&i.quantity<=i.reorder_level;
        return <tr key={i.id} className={isLow?"low-row":""}>
         <td><div className="item-cell"><div className="item-avatar"><Package size={18}/></div><div><b>{i.name}</b><small>{i.unit}</small></div></div></td>
         <td><span className="category-chip">{i.category}</span></td>
         <td><div className={`quantity-value ${isLow?"is-low":""}`}><b>{i.quantity}</b><span>{i.unit}</span></div></td>
         <td><b className="cost-value">₱{i.unit_cost.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</b></td>
         <td>{i.reorder_level} <span className="muted-unit">{i.unit}</span></td>
         <td><span className={`inventory-status ${i.is_active?"active":"inactive"}`}><i></i>{i.is_active?"Active":"Inactive"}</span></td>
         <td><div className="inventory-actions"><button className="inventory-icon-btn" aria-label={`Edit ${i.name}`} title="Edit item" onClick={()=>openEdit(i)}><Pencil size={16}/></button><button className={`inventory-icon-btn power ${i.is_active?"":"is-inactive"}`} aria-label={`${i.is_active?"Deactivate":"Activate"} ${i.name}`} title={i.is_active?"Deactivate item":"Activate item"} onClick={()=>toggle(i)}><Power size={16}/></button></div></td>
        </tr>})}</tbody>
      </table>
     </div>
     <div className="inventory-footer"><span>Showing <b>{filtered.length}</b> of <b>{items.length}</b> inventory items</span><span className="inventory-live"><i></i> Live database data</span></div>
    </section>
   </div>
  </section>
  {open&&<div onMouseDown={closeModal} className="inventory-modal-backdrop"><div onMouseDown={e=>e.stopPropagation()} className="inventory-modal">
   <div className="inventory-modal-head"><div className="inventory-modal-title"><div className="modal-icon"><Boxes size={24}/></div><div><h2>{editing?"Edit Inventory Item":"Add Inventory Item"}</h2><p>Keep your stock records accurate and up to date.</p></div></div><button aria-label="Close" className="inventory-close-btn" onClick={closeModal}><X size={20}/></button></div>
   <div className="inventory-modal-body">
    <div className="inventory-form-grid">
     <div className="full-field"><label style={labelStyle}>Item Name <span style={{color:"#ef2b22"}}>*</span></label><div className="input-with-icon"><Package size={18}/><input style={fieldStyle} placeholder="e.g. Glossy Photo Paper" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div></div>
     <div><label style={labelStyle}>Category <span style={{color:"#ef2b22"}}>*</span></label><input style={fieldStyle} placeholder="e.g. Printing Materials" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></div>
     <div><label style={labelStyle}>Unit</label><input style={fieldStyle} placeholder="piece, pack, roll..." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
     <div><label style={labelStyle}>Cost per Unit (₱)</label><input style={fieldStyle} type="number" min="0" step="0.01" value={form.unit_cost} onChange={e=>setForm({...form,unit_cost:e.target.value})}/></div>
     <div><label style={labelStyle}>Current Quantity</label><div className="input-with-icon"><Hash size={17}/><input style={fieldStyle} type="number" min="0" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></div></div>
     <div><label style={labelStyle}>Reorder Level</label><div className="input-with-icon"><AlertTriangle size={17}/><input style={fieldStyle} type="number" min="0" value={form.reorder_level} onChange={e=>setForm({...form,reorder_level:e.target.value})}/></div></div>
    </div>
    {modalError&&<div role="alert" className="inventory-modal-error">{modalError}</div>}
    <div className="inventory-modal-note">The item will be flagged as <b>Low Stock</b> when the quantity reaches the reorder level.</div>
    <div className="inventory-modal-actions"><button type="button" className="inventory-cancel-btn" onClick={closeModal} disabled={saving}>Cancel</button><button type="button" className="inventory-save-btn" disabled={saving} onClick={save}><Save size={18}/> {saving?"SAVING...":editing?"SAVE CHANGES":"ADD ITEM"}</button></div>
   </div>
  </div></div>}
 </main>
}
