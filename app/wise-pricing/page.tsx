"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, ChefHat, Loader2, Plus, Save, Trash2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { supabase } from "../../lib/supabase";

type Product={id:string;name:string;sku:string|null;category:string|null;price:number};
type Profile={id?:string;product_id:string;target_margin_percent:number;waste_percent:number;labor_cost_per_unit:number;overhead_cost_per_unit:number;packaging_cost_per_unit:number;rounding_increment:number;minimum_price:number;currency:string;is_active:boolean;pricing_mode:string;default_channel:string;notes:string|null};
type Break={id?:string;product_id:string;min_quantity:number;target_margin_percent:number|null;fixed_unit_price:number|null};
type Result={material_cost:number;waste_cost:number;labor_cost:number;overhead_cost:number;packaging_cost:number;total_cost:number;target_margin_percent:number;raw_price:number;recommended_unit_price:number;recommended_total_price:number;food_cost_percent:number;pricing_method:string;currency:string;recipe_item_count:number;quantity:number;channel:string};

const blankProfile=(product_id:string):Profile=>({product_id,target_margin_percent:65,waste_percent:3,labor_cost_per_unit:0,overhead_cost_per_unit:0,packaging_cost_per_unit:0,rounding_increment:1,minimum_price:0,currency:"PHP",is_active:true,pricing_mode:"restaurant",default_channel:"dine_in",notes:null});
const money=(n:number)=>`₱${Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const label=(c:string)=>c==="dine_in"?"Dine-in":c==="takeout"?"Takeout":"Catering";

export default function WisePricingPage(){
 const [products,setProducts]=useState<Product[]>([]);
 const [productId,setProductId]=useState("");
 const [profile,setProfile]=useState<Profile>(blankProfile(""));
 const [breaks,setBreaks]=useState<Break[]>([]);
 const [qty,setQty]=useState(1),[measurement,setMeasurement]=useState(1),[channel,setChannel]=useState("dine_in");
 const [result,setResult]=useState<Result|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const selected=useMemo(()=>products.find(p=>p.id===productId),[products,productId]);

 useEffect(()=>{void loadProducts()},[]);
 async function loadProducts(){
   setLoading(true);setError("");
   const {data,error:e}=await supabase.from("products").select("id,name,sku,category,price").eq("is_active",true).order("name");
   if(e){setError(e.message);setLoading(false);return}
   const list=(data||[]) as Product[];setProducts(list);
   const id=list[0]?.id||"";setProductId(id);
   if(id) await loadProductPricing(id);
   setLoading(false);
 }
 async function loadProductPricing(id:string){
   const {data:p,error:pe}=await supabase.from("wise_pricing_profiles").select("*").eq("product_id",id).maybeSingle();
   if(pe){setError(pe.message);return}
   const next=p?{...blankProfile(id),...p}:{...blankProfile(id)};
   setProfile(next);setChannel(next.default_channel||"dine_in");
   const {data:b,error:be}=await supabase.from("wise_pricing_quantity_breaks").select("*").eq("product_id",id).order("min_quantity");
   if(be){setError(be.message);return}setBreaks((b||[]) as Break[]);
 }
 async function chooseProduct(id:string){setProductId(id);setResult(null);setMessage("");setError("");await loadProductPricing(id)}
 async function calculate(){
   if(!productId)return;
   setBusy(true);setError("");setMessage("");
   const {data,error:e}=await supabase.rpc("wise_calculate_price",{p_product_id:productId,p_quantity:Math.max(1,Number(qty)||1),p_measurement_factor:Math.max(.0001,Number(measurement)||1),p_channel:channel});
   if(e)setError(e.message);else setResult(data as Result);
   setBusy(false);
 }
 async function saveProfile(){
   if(!productId)return;
   setBusy(true);setError("");setMessage("");
   const payload={...profile,product_id:productId,pricing_mode:"restaurant",default_channel:channel,target_margin_percent:Math.min(99.99,Math.max(0,Number(profile.target_margin_percent)||0)),waste_percent:Math.max(0,Number(profile.waste_percent)||0),labor_cost_per_unit:Math.max(0,Number(profile.labor_cost_per_unit)||0),overhead_cost_per_unit:Math.max(0,Number(profile.overhead_cost_per_unit)||0),packaging_cost_per_unit:Math.max(0,Number(profile.packaging_cost_per_unit)||0),rounding_increment:Math.max(0,Number(profile.rounding_increment)||0),minimum_price:Math.max(0,Number(profile.minimum_price)||0)};
   const {error:e}=await supabase.from("wise_pricing_profiles").upsert(payload,{onConflict:"product_id"});
   if(e)setError(e.message);else setMessage("Espacio pricing rules saved.");
   setBusy(false);
 }
 function addBreak(){setBreaks(b=>[...b,{product_id:productId,min_quantity:10,target_margin_percent:55,fixed_unit_price:null}])}
 async function saveBreak(b:Break){
   setBusy(true);setError("");
   const payload={product_id:productId,min_quantity:Math.max(1,Number(b.min_quantity)||1),target_margin_percent:b.fixed_unit_price?null:b.target_margin_percent==null?null:Math.min(99.99,Math.max(0,Number(b.target_margin_percent))),fixed_unit_price:b.fixed_unit_price==null||b.fixed_unit_price===0?null:Math.max(0,Number(b.fixed_unit_price))};
   const {data,error:e}=await supabase.from("wise_pricing_quantity_breaks").upsert(b.id?{...payload,id:b.id}:payload,{onConflict:"product_id,min_quantity"}).select().single();
   if(e)setError(e.message);else{setBreaks(bs=>bs.map(x=>x===b?data as Break:x));setMessage("Catering quantity price saved.")}
   setBusy(false);
 }
 async function deleteBreak(b:Break){if(b.id)await supabase.from("wise_pricing_quantity_breaks").delete().eq("id",b.id);setBreaks(bs=>bs.filter(x=>x!==b))}
 if(loading)return <main className="app-shell"><Sidebar/><section className="workspace espac-pricing"><div className="loading"><Loader2/>Loading Espacio Pricing…</div></section></main>;

 return <main className="app-shell"><Sidebar/><section className="workspace espac-pricing">
  <header className="ep-header"><div><div className="ep-kicker"><ChefHat size={15}/> ESPACIO COFFEE & RESTAURANT</div><h1>WISE Pricing</h1><p>Smart menu pricing based on your actual recipe, inventory cost, waste, labor, overhead and packaging.</p></div><div className="ep-badge">₱ PHP · RESTAURANT MODE</div></header>
  {error&&<div className="ep-alert error">{error}</div>}{message&&<div className="ep-alert success">{message}</div>}

  <div className="ep-grid">
   <section className="ep-card product-card"><div className="step">01</div><h2>Menu Item</h2><p>Select an Espacio menu item. WISE reads its WISE KITCHEN recipe.</p>
    <select value={productId} onChange={e=>void chooseProduct(e.target.value)} className="ep-input">{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.category?" · "+p.category:""}</option>)}</select>
    {selected&&<div className="current-price"><span>Current POS price</span><b>{money(selected.price)}</b></div>}
    <a href="/wise-kitchen/recipes" className="recipe-link"><ChefHat size={15}/> Edit recipe in WISE KITCHEN</a>
   </section>

   <section className="ep-card"><div className="step">02</div><h2>Espacio Costing Rules</h2><p>Set the real operating costs used to calculate your target gross margin.</p>
    <div className="rule-grid">
      <Field label="Target Gross Margin %" value={profile.target_margin_percent} onChange={v=>setProfile(p=>({...p,target_margin_percent:v}))} suffix="%" />
      <Field label="Expected Waste %" value={profile.waste_percent} onChange={v=>setProfile(p=>({...p,waste_percent:v}))} suffix="%" />
      <Field label="Labor / Serving" value={profile.labor_cost_per_unit} onChange={v=>setProfile(p=>({...p,labor_cost_per_unit:v}))} prefix="₱" />
      <Field label="Overhead / Serving" value={profile.overhead_cost_per_unit} onChange={v=>setProfile(p=>({...p,overhead_cost_per_unit:v}))} prefix="₱" />
      <Field label="Packaging / Serving" value={profile.packaging_cost_per_unit} onChange={v=>setProfile(p=>({...p,packaging_cost_per_unit:v}))} prefix="₱" />
      <Field label="Minimum Selling Price" value={profile.minimum_price} onChange={v=>setProfile(p=>({...p,minimum_price:v}))} prefix="₱" />
      <Field label="Round Price Up To" value={profile.rounding_increment} onChange={v=>setProfile(p=>({...p,rounding_increment:v}))} prefix="₱" />
    </div>
    <button className="ep-btn secondary" onClick={saveProfile} disabled={busy}><Save size={15}/> Save Rules</button>
   </section>

   <section className="ep-card calculate-card"><div className="step">03</div><h2>Pricing Scenario</h2><p>Choose how this item will be sold. Takeout automatically adds packaging cost.</p>
    <div className="channel-grid">{["dine_in","takeout","catering"].map(c=><button key={c} className={channel===c?"active":""} onClick={()=>{setChannel(c);setResult(null)}}>{label(c)}</button>)}</div>
    <div className="scenario-grid">
      <Field label="Quantity / Servings" value={qty} onChange={setQty} />
      <Field label="Measurement Factor" value={measurement} onChange={setMeasurement} step="0.01" />
    </div>
    <div className="hint">For normal menu pricing, keep Measurement Factor at <b>1</b>. Use it when one recipe serving is multiplied by a known measurement.</div>
    <button className="calculate" onClick={calculate} disabled={busy||!productId}>{busy?<Loader2/>:<Calculator size={17}/>} CALCULATE ESPACIO PRICE</button>
   </section>
  </div>

  <div className="ep-lower">
   <section className="ep-card"><div className="section-head"><div><div className="step small">04</div><h2>Catering & Bulk Pricing</h2><p>Optional quantity breaks for trays, events and large orders.</p></div><button className="ep-btn secondary" onClick={addBreak}><Plus size={15}/> Add Break</button></div>
    {breaks.length>0&&<div className="break-head"><span>Minimum Qty</span><span>Gross Margin %</span><span>Fixed Unit Price</span><span/></div>}
    {breaks.map((b,i)=><div className="break-row" key={b.id||"new-"+i}><input type="number" min="1" value={b.min_quantity} onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,min_quantity:Number(e.target.value)}:x))} className="ep-input"/><input type="number" min="0" max="99.99" value={b.target_margin_percent??""} placeholder="e.g. 55" onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,target_margin_percent:e.target.value===""?null:Number(e.target.value),fixed_unit_price:null}:x))} className="ep-input"/><input type="number" min="0" value={b.fixed_unit_price??""} placeholder="Optional" onChange={e=>setBreaks(bs=>bs.map(x=>x===b?{...x,fixed_unit_price:e.target.value===""?null:Number(e.target.value),target_margin_percent:null}:x))} className="ep-input"/><div className="row-actions"><button className="icon-btn" onClick={()=>void saveBreak(b)}><Save size={14}/></button><button className="icon-btn danger" onClick={()=>void deleteBreak(b)}><Trash2 size={14}/></button></div></div>)}
    {!breaks.length&&<div className="empty-break">No catering breaks configured. Main Espacio pricing rules will be used.</div>}
   </section>

   <aside className="ep-card result-card"><div className="result-kicker">ESPACIO RECOMMENDED SELLING PRICE</div>{result?<><div className="hero-price">{money(result.recommended_unit_price)}</div><div className="hero-sub">{money(result.recommended_total_price)} total · {label(result.channel)} · {result.quantity} serving{result.quantity===1?"":"s"}</div><div className="metrics"><Metric label="Recipe / Materials" value={result.material_cost}/><Metric label="Waste" value={result.waste_cost}/><Metric label="Labor" value={result.labor_cost}/><Metric label="Overhead" value={result.overhead_cost}/><Metric label="Packaging" value={result.packaging_cost}/><Metric label="Total Cost" value={result.total_cost} strong/></div><div className="chips"><span>Gross Margin {result.target_margin_percent}%</span><span>Food Cost {result.food_cost_percent}%</span></div><div className="method">{result.pricing_method==="catering_quantity_break"?"Catering quantity price":"Cost + gross margin"} · {result.recipe_item_count} recipe ingredients</div></>:<div className="result-empty"><Calculator size={28}/><b>Your price will appear here</b><span>Calculate after selecting the menu item and costing rules.</span></div>}</aside>
  </div>

  <div className="ep-note"><b>Important:</b> WISE uses the inventory item's unit cost and converts common recipe units automatically (g ↔ kg, ml ↔ L, oz ↔ g, fl oz ↔ ml). Keep recipe measurements accurate in WISE KITCHEN.</div>

  <style jsx global>{`
    .espac-pricing{background:#f5f6f7!important;min-height:100vh!important;padding:22px 28px 40px!important;box-sizing:border-box!important;overflow:auto!important}
    .espac-pricing .ep-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin:0 0 18px!important;padding:0!important}
    .ep-kicker{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:900;letter-spacing:.14em;color:#9f1d22}.ep-header h1{font-size:31px;letter-spacing:-.03em;margin:7px 0 4px}.ep-header p{margin:0;color:#687078;font-size:13px}.ep-badge{font-size:10px;font-weight:900;background:#fff;border:1px solid #e2e5e8;border-radius:999px;padding:9px 12px;color:#626970;white-space:nowrap}
    .ep-alert{padding:11px 13px;border-radius:10px;margin-bottom:12px;font-size:12px}.ep-alert.error{background:#fff0f0;color:#a11d1d}.ep-alert.success{background:#eef9f1;color:#277246}
    .ep-grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(430px,1.45fr) minmax(300px,1fr);gap:14px}.ep-card{background:#fff;border:1px solid #e1e5e8;border-radius:15px;padding:18px;box-shadow:0 6px 22px rgba(24,30,35,.035);min-width:0}.ep-card h2{margin:3px 0 5px;font-size:17px}.ep-card p{margin:0 0 14px;color:#747b82;font-size:11px;line-height:1.5}.step{font-size:9px;font-weight:900;letter-spacing:.15em;color:#a41e23}.step.small{margin-bottom:3px}
    .ep-input{width:100%;min-height:40px;padding:9px 10px;border:1px solid #dfe3e6;border-radius:8px;background:#fff;color:#343a40;font-size:13px;box-sizing:border-box}.ep-input:focus{outline:none;border-color:#b51f24;box-shadow:0 0 0 3px rgba(181,31,36,.08)}
    .current-price{display:flex;justify-content:space-between;align-items:center;background:#f7f8f9;border-radius:9px;padding:11px;margin-top:12px;font-size:11px}.current-price b{font-size:15px}.recipe-link{display:flex;align-items:center;gap:6px;color:#8f1b20;text-decoration:none;font-size:11px;font-weight:800;margin-top:13px}
    .rule-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:13px}.rule-grid label{font-size:10px;font-weight:800;color:#5e666e}.rule-grid input{margin-top:5px}
    .field-wrap{position:relative}.field-wrap input{margin-top:5px}.field-label{font-size:10px;font-weight:800;color:#5e666e}.field-prefix,.field-suffix{position:absolute;top:31px;font-size:11px;color:#777;pointer-events:none}.field-prefix{left:9px}.field-suffix{right:9px}.has-prefix{padding-left:24px}.has-suffix{padding-right:24px}
    .ep-btn{border:1px solid #dfe3e6;background:#fff;border-radius:8px;padding:9px 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:900;cursor:pointer}.ep-btn.secondary:hover{border-color:#bd252a}
    .channel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.channel-grid button{border:1px solid #dfe3e6;background:#fafbfb;border-radius:8px;padding:10px 5px;font-size:10px;font-weight:900;cursor:pointer}.channel-grid button.active{background:#a91e23;color:#fff;border-color:#a91e23}
    .scenario-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.scenario-grid .field-wrap{margin-bottom:11px}.hint{font-size:10px;line-height:1.5;color:#7a8289;background:#f7f8f9;padding:9px;border-radius:8px;margin-bottom:11px}.calculate{width:100%;min-height:42px;border:0;border-radius:9px;background:#a91e23;color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.calculate:disabled{opacity:.65;cursor:wait}
    .ep-lower{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(330px,.8fr);gap:14px;margin-top:14px}.section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}.section-head h2{margin:0 0 4px}.break-head,.break-row{display:grid;grid-template-columns:1fr 1fr 1fr 80px;gap:8px;align-items:center}.break-head{font-size:9px;font-weight:900;color:#7b838a;padding:10px 0 7px}.break-row{padding:8px 0;border-top:1px solid #eef0f2}.row-actions{display:flex;gap:4px}.icon-btn{width:32px;height:32px;border:1px solid #dfe3e6;background:#fff;border-radius:7px;display:grid;place-items:center;cursor:pointer}.icon-btn.danger{color:#a91e23}.empty-break{padding:20px;text-align:center;background:#fafbfb;border-radius:9px;color:#838b92;font-size:11px}
    .result-card{background:linear-gradient(155deg,#fff,#fff7f7)}.result-kicker{font-size:9px;font-weight:900;letter-spacing:.14em;color:#a31e23}.hero-price{font-size:42px;font-weight:950;letter-spacing:-.04em;margin-top:5px}.hero-sub{font-size:11px;color:#70777e}.metrics{margin-top:13px}.metrics>div{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eceff1;font-size:11px}.metrics .strong{font-weight:900}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}.chips span{background:#f0f2f3;padding:6px 8px;border-radius:999px;font-size:9px;font-weight:900}.method{font-size:9px;color:#7b8289;margin-top:11px}.result-empty{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;color:#7d858c;font-size:11px}.result-empty svg{color:#b9bec2}.loading{display:flex;gap:8px;align-items:center;padding:30px}
    .ep-note{margin-top:12px;padding:11px 13px;border:1px dashed #d9dde0;border-radius:10px;color:#727a82;font-size:10px;background:#fafbfb}
    @media(max-width:1250px){.ep-grid{grid-template-columns:1fr 1.35fr}.ep-grid>.calculate-card{grid-column:1/-1}.ep-lower{grid-template-columns:1fr}.result-card{min-height:0}}
    @media(max-width:800px){.espac-pricing{padding:15px 13px 28px!important}.ep-header{flex-direction:column!important}.ep-grid,.ep-lower{grid-template-columns:1fr}.ep-grid>.calculate-card{grid-column:auto}.rule-grid,.scenario-grid{grid-template-columns:1fr}.break-head,.break-row{grid-template-columns:1fr 1fr}.break-head span:nth-child(3),.break-row .ep-input:nth-child(3){display:none}.break-head span:last-child{display:none}.ep-badge{white-space:normal}.hero-price{font-size:36px}}
  `}</style>
 </section></main>;
}

function Field({label:fieldLabel,value,onChange,prefix,suffix,step="0.01"}:{label:string;value:number;onChange:(v:number)=>void;prefix?:string;suffix?:string;step?:string}){
 return <label className="field-wrap"><span className="field-label">{fieldLabel}</span>{prefix&&<span className="field-prefix">{prefix}</span>}<input className={prefix?"ep-input has-prefix":suffix?"ep-input has-suffix":"ep-input"} type="number" min="0" step={step} value={Number.isFinite(Number(value))?value:0} onChange={e=>onChange(Number(e.target.value))}/>{suffix&&<span className="field-suffix">{suffix}</span>}</label>
}
function Metric({label:metricLabel,value,strong=false}:{label:string;value:number;strong?:boolean}){return <div className={strong?"strong":""}><span>{metricLabel}</span><b>{money(value)}</b></div>}
