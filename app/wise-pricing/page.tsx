"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";

type Product={id:string;name:string;sku:string|null;category:string|null;price:number};
type Profile={id?:string;product_id:string;target_margin_percent:number;waste_percent:number;labor_cost_per_unit:number;overhead_cost_per_unit:number;rounding_increment:number;minimum_price:number;currency:string;is_active:boolean};
type Break={id?:string;product_id:string;min_quantity:number;target_margin_percent:number|null;fixed_unit_price:number|null};
type Result={material_cost:number;waste_cost:number;labor_cost:number;overhead_cost:number;total_cost:number;target_margin_percent:number;raw_price:number;recommended_unit_price:number;recommended_total_price:number;pricing_method:string;currency:string;recipe_item_count:number};

const blankProfile=(product_id:string):Profile=>({product_id,target_margin_percent:50,waste_percent:0,labor_cost_per_unit:0,overhead_cost_per_unit:0,rounding_increment:1,minimum_price:0,currency:"PHP",is_active:true});
const money=(n:number)=>`₱${Number(n||0).toFixed(2)}`;

export default function WisePricingPage(){
 const [products,setProducts]=useState<Product[]>([]);
 const [productId,setProductId]=useState("");
 const [profile,setProfile]=useState<Profile>(blankProfile(""));
 const [breaks,setBreaks]=useState<Break[]>([]);
 const [qty,setQty]=useState(1);
 const [measurement,setMeasurement]=useState(1);
 const [result,setResult]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const selected=useMemo(()=>products.find(p=>p.id===productId),[products,productId]);

 useEffect(()=>{void loadProducts()},[]);
 async function loadProducts(){
   setLoading(true);
   const {data,error:e}=await supabase.from("products").select("id,name,sku,category,price").eq("is_active",true).order("name");
   if(e){setError(e.message);setLoading(false);return}
   const list=(data||[]) as Product[]; setProducts(list);
   const id=list[0]?.id||""; setProductId(id);
   if(id) await loadProductPricing(id);
   setLoading(false);
 }
 async function loadProductPricing(id:string){
   const {data:p}=await supabase.from("wise_pricing_profiles").select("*").eq("product_id",id).maybeSingle();
   setProfile(p?{...blankProfile(id),...p}:blankProfile(id));
   const {data:b}=await supabase.from("wise_pricing_quantity_breaks").select("*").eq("product_id",id).order("min_quantity");
   setBreaks((b||[]) as Break[]);
 }
 async function chooseProduct(id:string){setProductId(id);setResult(null);setMessage("");setError("");await loadProductPricing(id)}
 async function calculate(){
   if(!productId)return;
   setBusy(true);setError("");setMessage("");
   const {data,e}=await supabase.rpc("wise_calculate_price",{p_product_id:productId,p_quantity:Number(qty)||1,p_measurement_factor:Number(measurement)||1});
   if(e)setError(e.message); else setResult(data as Result);
   setBusy(false);
 }
 async function saveProfile(){
   if(!productId)return;
   setBusy(true);setError("");setMessage("");
   const {error:e}=await supabase.from("wise_pricing_profiles").upsert({...profile,product_id:productId},{onConflict:"product_id"});
   if(e)setError(e.message);else setMessage("WISE Pricing rules saved.");
   setBusy(false);
 }
 function addBreak(){setBreaks(b=>[...b,{product_id:productId,min_quantity:10,target_margin_percent:40,fixed_unit_price:null}])}
 async function saveBreak(b:Break){
   setBusy(true);setError("");
   const payload={product_id:productId,min_quantity:Number(b.min_quantity),target_margin_percent:b.fixed_unit_price?null:b.target_margin_percent==null?null:Number(b.target_margin_percent),fixed_unit_price:b.fixed_unit_price==null||b.fixed_unit_price===0?null:Number(b.fixed_unit_price)};
   const {data,e}=await supabase.from("wise_pricing_quantity_breaks").upsert(b.id?{...payload,id:b.id}:payload,{onConflict:"product_id,min_quantity"}).select().single();
   if(e)setError(e.message);else{setBreaks(bs=>bs.map(x=>x===b?data as Break:x));setMessage("Quantity pricing saved.")}
   setBusy(false);
 }
 async function deleteBreak(b:Break){if(b.id)await supabase.from("wise_pricing_quantity_breaks").delete().eq("id",b.id);setBreaks(bs=>bs.filter(x=>x!==b))}
 if(loading)return <main className="app-shell"><Sidebar/><section className="workspace"><div style={{padding:40,display:"flex",gap:10,alignItems:"center"}}><Loader2/>Loading WISE Pricing...</div></section></main>;

 const card={background:"#fff",border:"1px solid #e3e7eb",borderRadius:16,padding:20,boxShadow:"0 8px 25px rgba(20,30,40,.04)"};
 const input={width:"100%",boxSizing:"border-box" as const,padding:"10px 12px",border:"1px solid #dfe4e8",borderRadius:9,fontSize:14};
 const button={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px 14px",borderRadius:9,border:"1px solid #dfe4e8",fontWeight:800,fontSize:11,cursor:"pointer" as const,background:"#fff"};

 return <main className="app-shell"><Sidebar/><section className="workspace" style={{padding:"28px 32px",maxWidth:1600}}>
  <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",marginBottom:20}}>
   <div><div style={{fontSize:11,fontWeight:850,letterSpacing:".12em",color:"#b92020",display:"flex",alignItems:"center",gap:7}}><Calculator size={15}/> WISE PRICING ENGINE</div><h1 style={{margin:"7px 0 5px",fontSize:32}}>WISE Pricing</h1><p style={{margin:0,color:"#6b7280",maxWidth:800}}>Generate a selling price from real material costs, recipe quantities, measurements, labor, waste, overhead and quantity breaks.</p></div>
   <a href="/wise-kitchen/recipes" style={{...button,textDecoration:"none",color:"#3d444b"}}>Open Recipe Manager <ExternalLink size={15}/></a>
  </header>
  {error&&<div style={{padding:12,background:"#fff0f0",color:"#a11d1d",borderRadius:9,marginBottom:12}}>{error}</div>}
  {message&&<div style={{padding:12,background:"#edf9f1",color:"#267246",borderRadius:9,marginBottom:12}}>{message}</div>}

  <div style={{display:"grid",gridTemplateColumns:"1fr 1.3fr 1fr",gap:16}}>
   <section style={card}><h2>1. Select Product</h2><p style={{color:"#737a81",fontSize:12}}>WISE reads the product recipe and current inventory unit costs.</p>
    <select value={productId} onChange={e=>void chooseProduct(e.target.value)} style={input}>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.sku?" · "+p.sku:""}</option>)}</select>
    {selected&&<div style={{marginTop:16,padding:12,borderRadius:10,background:"#f7f8f9",display:"flex",justifyContent:"space-between"}}><span>Current POS price</span><b>{money(selected.price)}</b></div>}
   </section>

   <section style={card}><h2>2. Pricing Rules</h2><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    {[
      ["Target Margin %","target_margin_percent"],["Waste %","waste_percent"],["Labor / Unit","labor_cost_per_unit"],["Overhead / Unit","overhead_cost_per_unit"],["Minimum Price","minimum_price"],["Round Up To","rounding_increment"]
    ].map(([label,key])=><label key={key} style={{fontSize:11,fontWeight:750,color:"#59616a"}}>{label}<input type="number" min="0" value={Number(profile[key as keyof Profile])||0} onChange={e=>setProfile(p=>({...p,[key]:Number(e.target.value)}))} style={{...input,marginTop:6}}/></label>)}
   </div>
   <button style={{...button,marginTop:14}} onClick={saveProfile} disabled={busy}><Save size={16}/> Save Rules</button>
   </section>

   <section style={card}><h2>3. Calculate</h2><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    <label style={{fontSize:11,fontWeight:750,color:"#59616a"}}>Quantity<input type="number" min="1" step="1" value={qty} onChange={e=>setQty(Number(e.target.value))} style={{...input,marginTop:6}}/></label>
    <label style={{fontSize:11,fontWeight:750,color:"#59616a"}}>Measurement Factor<input type="number" min=".0001" step=".01" value={measurement} onChange={e=>setMeasurement(Number(e.target.value))} style={{...input,marginTop:6}}/></label>
   </div>
   <p style={{fontSize:11,color:"#7a8188"}}>Example: 3 ft × 5 ft = 15 sq.ft. Use 15 as the measurement factor for a dimension-based job.</p>
   <button onClick={calculate} disabled={busy||!productId} style={{...button,width:"100%",background:"#bf1d1d",color:"#fff",borderColor:"#bf1d1d"}}>{busy?<Loader2/>:<Calculator size={17}/>} CALCULATE WISE PRICE</button>
   </section>
  </div>

  <div style={{display:"grid",gridTemplateColumns:"1.65fr 1fr",gap:16,marginTop:16}}>
   <section style={card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><h2>Quantity Pricing</h2><p style={{color:"#737a81",fontSize:12}}>Give bulk orders their own margin or fixed unit price.</p></div><button style={button} onClick={addBreak}><Plus size={16}/> Add Break</button></div>
    {breaks.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 86px",gap:10,fontSize:10,fontWeight:800,color:"#777f87",padding:"10px 0"}}><span>Minimum Qty</span><span>Margin %</span><span>Fixed Unit Price</span><span/></div>}
    {breaks.map((b,i)=><div key={b.id||"new-"+i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 86px",gap:10,alignItems:"center",padding:"8px 0",borderTop:"1px solid #edf0f2"}}>
      <input type="number" min="1" value={b.min_quantity} onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,min_quantity:Number(e.target.value)}:x))} style={input}/>
      <input type="number" min="0" max="99.99" value={b.target_margin_percent??""} placeholder="e.g. 40" onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,target_margin_percent:e.target.value===""?null:Number(e.target.value),fixed_unit_price:null}:x))} style={input}/>
      <input type="number" min="0" value={b.fixed_unit_price??""} placeholder="Optional" onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,fixed_unit_price:e.target.value===""?null:Number(e.target.value),target_margin_percent:null}:x))} style={input}/>
      <div><button style={{...button,padding:8}} onClick={()=>void saveBreak(b)}><Save size={15}/></button><button style={{...button,padding:8,color:"#b92020",marginLeft:5}} onClick={()=>void deleteBreak(b)}><Trash2 size={15}/></button></div>
    </div>)}
    {!breaks.length&&<div style={{padding:22,textAlign:"center",color:"#858c93",fontSize:12,background:"#fafbfb",borderRadius:10}}>No quantity breaks yet. WISE will use the main pricing rule.</div>}
   </section>

   <aside style={{...card,background:"linear-gradient(160deg,#fff,#fff7f7)",minHeight:280}}>
    <div style={{fontSize:10,fontWeight:900,letterSpacing:".13em",color:"#b92020"}}>WISE RECOMMENDED PRICE</div>
    {result?<><div style={{fontSize:42,fontWeight:900,marginTop:8}}>{money(result.recommended_unit_price)}</div><div style={{fontSize:12,color:"#6e757c"}}>{money(result.recommended_total_price)} total for {result.quantity} unit{result.quantity===1?"":"s"}</div>
      <div style={{marginTop:18}}>{[["Materials / Recipe",result.material_cost],["Waste",result.waste_cost],["Labor",result.labor_cost],["Overhead",result.overhead_cost],["Total Cost",result.total_cost]].map(([label,value],i)=><div key={String(label)} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #eceff1",fontSize:12,fontWeight:i===4?850:400}}><span>{label}</span><b>{money(Number(value))}</b></div>)}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}><span style={{background:"#f1f3f4",padding:"6px 9px",borderRadius:999,fontSize:10,fontWeight:800}}>Margin: {result.target_margin_percent}%</span><span style={{background:"#f1f3f4",padding:"6px 9px",borderRadius:999,fontSize:10,fontWeight:800}}>Method: {result.pricing_method}</span></div>
      <small style={{display:"block",marginTop:13,color:"#747c84"}}>Recipe items: {result.recipe_item_count}. Update inventory costs and recipe quantities to keep this price current.</small>
    </>:<div style={{padding:22,textAlign:"center",color:"#858c93",fontSize:12,background:"#fafbfb",borderRadius:10,marginTop:20}}>Run Calculate to generate a price from the product's live recipe and inventory costs.</div>}
   </aside>
  </div>
 <style jsx global>{`
  section.workspace{overflow-x:hidden!important;background:#f6f7f9!important;}
  section.workspace>div[style*="max-width:1600px"]{max-width:1380px!important;width:100%!important;margin:0 auto!important;padding:22px 28px 40px!important;box-sizing:border-box!important;}
  section.workspace>div[style*="max-width:1600px"]>header{margin-bottom:16px!important;}
  section.workspace>div[style*="max-width:1600px"]>header h1{font-size:30px!important;letter-spacing:-.02em!important;}
  section.workspace>div[style*="max-width:1600px"]>header p{font-size:13px!important;max-width:700px!important;}
  section.workspace>div[style*="max-width:1600px"]>div[style*="grid-template-columns:1fr 1.3fr 1fr"]{grid-template-columns:minmax(240px,.9fr) minmax(420px,1.4fr) minmax(280px,1fr)!important;gap:14px!important;}
  section.workspace>div[style*="max-width:1600px"]>div[style*="grid-template-columns:1.65fr 1fr"]{grid-template-columns:minmax(0,1.55fr) minmax(330px,.85fr)!important;gap:14px!important;margin-top:14px!important;}
  section.workspace .wp-polish{display:none!important;}
  section.workspace h2{letter-spacing:-.01em;}
  section.workspace input,section.workspace select{transition:border-color .15s,box-shadow .15s;}
  section.workspace input:focus,section.workspace select:focus{outline:none!important;border-color:#c81c1c!important;box-shadow:0 0 0 3px rgba(200,28,28,.08)!important;}
  @media(max-width:1250px){section.workspace>div[style*="max-width:1600px"]>div[style*="grid-template-columns:1fr 1.3fr 1fr"]{grid-template-columns:1fr 1.35fr!important;}section.workspace>div[style*="max-width:1600px"]>div[style*="grid-template-columns:1.65fr 1fr"]{grid-template-columns:1fr!important;}}
  @media(max-width:800px){section.workspace>div[style*="max-width:1600px"]{padding:18px 14px 30px!important;}section.workspace>div[style*="max-width:1600px"]>div[style*="grid-template-columns:1fr 1.3fr 1fr"]{grid-template-columns:1fr!important;}section.workspace>div[style*="max-width:1600px"]>header{flex-direction:column!important;}}
`}</style></section></main>;
}
