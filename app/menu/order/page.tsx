"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Mail, Minus, Plus, Search, ShoppingBag, UserRound, Utensils, X } from "lucide-react";
import "./menu.css";
import "./menu-enhancements.css";

type Product = { id:string; name:string; category:string|null; description:string|null; price:number; unit:string|null; image_url:string|null; video_url:string|null };
type CartItem = { product:Product; quantity:number };
type PendingOrder = { order_no:string; order_id:string; total:number; order_type:"dine_in"|"take_out"; status:string };

export default function WiseMenuOrder() {
  const [products,setProducts]=useState<Product[]>([]),[cart,setCart]=useState<CartItem[]>([]),[category,setCategory]=useState("All"),[search,setSearch]=useState("");
  const [name,setName]=useState(""),[email,setEmail]=useState(""),[notes,setNotes]=useState(""),[profileReady,setProfileReady]=useState(false),[profileError,setProfileError]=useState("");
  const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[submitError,setSubmitError]=useState(""),[success,setSuccess]=useState<any>(null),[cartOpen,setCartOpen]=useState(false);
  const [productOpen,setProductOpen]=useState<Product|null>(null),[selectedQty,setSelectedQty]=useState(1),[pendingOrder,setPendingOrder]=useState<PendingOrder|null>(null),[orderType,setOrderType]=useState<"dine_in"|"take_out">("take_out");

  useEffect(()=>{
    try{
      const saved=JSON.parse(sessionStorage.getItem("wise-menu-customer")||"null");
      const pending=JSON.parse(sessionStorage.getItem("wise-menu-pending-order")||"null");
      if(saved?.name&&saved?.email){setName(saved.name);setEmail(saved.email);setProfileReady(true)}
      if(pending?.order_no)setPendingOrder(pending);
    }catch{}
    fetch("/api/menu/products").then(r=>r.json()).then(x=>setProducts(x.products||[])).catch(()=>setProducts([])).finally(()=>setLoading(false))
  },[]);

  useEffect(()=>{
    if(productOpen||cartOpen){document.body.style.overflow="hidden";return()=>{document.body.style.overflow=""}}
    document.body.style.overflow="";
  },[productOpen,cartOpen]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setProductOpen(null);setCartOpen(false)}};
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[]);

  const categories=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean) as string[]))],[products]);
  const filtered=useMemo(()=>products.filter(p=>(category==="All"||p.category===category)&&`${p.name} ${p.description||""}`.toLowerCase().includes(search.toLowerCase())),[products,category,search]);
  const total=cart.reduce((s,x)=>s+x.product.price*x.quantity,0),count=cart.reduce((s,x)=>s+x.quantity,0);
  const continueToMenu=()=>{const n=name.trim(),e=email.trim().toLowerCase();if(!n){setProfileError("Please enter your name.");return}if(!/^\S+@\S+\.\S+$/.test(e)){setProfileError("Please enter a valid email address.");return}sessionStorage.setItem("wise-menu-customer",JSON.stringify({name:n,email:e}));setName(n);setEmail(e);setProfileError("");setProfileReady(true)};
  const change=(id:string,d:number)=>setCart(c=>c.map(i=>i.product.id===id?{...i,quantity:i.quantity+d}:i).filter(i=>i.quantity>0));
  const add=(p:Product,quantity=1,openOrder=false)=>{setSubmitError("");setCart(c=>{const x=c.find(i=>i.product.id===p.id);return x?c.map(i=>i.product.id===p.id?{...i,quantity:i.quantity+quantity}:i):[...c,{product:p,quantity}]});setProductOpen(null);setSelectedQty(1);if(openOrder)setCartOpen(true)};
  const openProduct=(p:Product)=>{setSelectedQty(1);setProductOpen(p)};

  async function submit(){
    if(sending)return;
    if(!profileReady){setSubmitError("Please complete your customer information first.");return}
    if(!cart.length){setSubmitError("Please select at least one item.");return}
    setSending(true);setSubmitError("");
    const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch("/api/menu/order",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({customer_name:name.trim(),customer_email:email.trim().toLowerCase(),notes:notes.trim(),order_type:orderType,items:cart.map(i=>({product_id:i.product.id,quantity:i.quantity,options:{}}))}),signal:controller.signal});
      const raw=await r.text();let x:any={};try{x=raw?JSON.parse(raw):{}}catch{}
      if(!r.ok)throw new Error(x?.error||`Unable to place order (${r.status}). Please try again.`);
      if(!x?.ok||!x?.order_no)throw new Error(x?.error||"The order could not be completed. Please try again.");
      const pending:PendingOrder={order_no:x.order_no,order_id:x.order_id,total:Number(x.total||total),order_type:orderType,status:"pending"};
      sessionStorage.setItem("wise-menu-pending-order",JSON.stringify(pending));setPendingOrder(pending);setSuccess(x);setCart([]);setNotes("");setCartOpen(false);
    }catch(e:any){setSubmitError(e?.name==="AbortError"?"The request took too long. Please check your connection and try again.":(e?.message||"Unable to place order. Please try again."))}
    finally{window.clearTimeout(timeout);setSending(false)}
  }

  if(success)return <main className="wm-page"><section className="wm-success"><div className="wm-success-icon"><Check size={42}/></div><p className="wm-eyebrow">WISE MENU</p><h1>Order Submitted!</h1><p>Your order <b>{success.order_no}</b> is now <b>Pending</b> and has been sent to the cashier for confirmation.</p><div className="wm-pending-card"><span>ORDER STATUS</span><b>Pending</b><small>{orderType==="dine_in"?"Dine In":"Take Out"} · ₱{Number(success.total||0).toFixed(2)}</small></div><button type="button" onClick={()=>setSuccess(null)}>Back to Menu</button></section></main>;

  if(!profileReady)return <main className="wm-page wm-onboarding-page"><section className="wm-onboarding"><div className="wm-onboarding-brand"><div><div className="wm-logo">WISE <span>MENU</span></div><small>Order. Print. Pick Up.</small></div><div className="wm-onboarding-icon"><ShoppingBag size={28}/></div></div><div className="wm-progress"><span className="active">1</span><i/><span>2</span><i/><span>3</span></div><p className="wm-eyebrow">YOUR INFORMATION</p><h1>Tell us about yourself</h1><p className="wm-onboarding-copy">Enter your details first so we can identify your order and keep you updated.</p><form onSubmit={e=>{e.preventDefault();continueToMenu()}}><label><UserRound size={16}/> Full Name <em>*</em><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" maxLength={120}/></label><label><Mail size={16}/> Email Address <em>*</em><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" maxLength={254}/></label>{profileError&&<div className="wm-profile-error">{profileError}</div>}<button type="submit">Continue <ChevronRight size={18}/></button></form><small className="wm-onboarding-note">Your information is only used for this WISE MENU order.</small></section></main>;

  return <main className="wm-page">
    <header className="wm-header"><div className="wm-brand-block"><div><div className="wm-logo">WISE <span>MENU</span></div><small>Hi, {name}! What would you like today?</small></div></div><div className="wm-header-actions"><button type="button" className="wm-cart" onClick={()=>{setSubmitError("");setCartOpen(true)}}><ShoppingBag size={21}/><span>{count}</span></button></div></header>
    <div className="wm-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products or services..."/></div>
    <div className="wm-layout"><aside className="wm-category-sidebar"><div className="wm-category-title">MENU</div>{categories.map((c,i)=><button type="button" className={category===c?"active":""} key={c} onClick={()=>setCategory(c)}><span className="wm-cat-icon">{i===0?<Utensils size={17}/>:<span>{c.charAt(0)}</span>}</span><b>{c}</b></button>)}</aside><section className="wm-content"><div className="wm-content-head"><div><span className="wm-eyebrow">WISE MENU</span><h1>{category}</h1><p>{filtered.length} {filtered.length===1?"item":"items"}</p></div></div>{loading?<div className="wm-loading">Loading menu…</div>:filtered.length===0?<div className="wm-empty"><ShoppingBag size={30}/><b>No products found</b><span>Try another category or search.</span></div>:<section className="wm-grid">{filtered.map(p=><article id={`wm-product-${p.id}`} className="wm-card" key={p.id}><button type="button" className="wm-media" onClick={()=>openProduct(p)} aria-label={`View ${p.name}`}>{p.video_url?<video src={p.video_url} autoPlay muted loop playsInline preload="metadata"/>:p.image_url?<img src={p.image_url} alt={p.name}/>:<div className="wm-placeholder">WISE MENU</div>}<span className="wm-view-chip">View</span></button><div className="wm-card-body"><small>{p.category||"Menu"}</small><h2>{p.name}</h2><p>{p.description||""}</p><div className="wm-card-bottom"><strong>₱{Number(p.price).toFixed(2)}</strong><button type="button" onClick={()=>add(p)}><Plus size={17}/> Add to Cart</button></div></div></article>)}</section>}</section></div>
    {count>0&&<button type="button" className="wm-floating-cart" onClick={()=>{setSubmitError("");setCartOpen(true)}}><ShoppingBag size={20}/> My Order <b>{count}</b><strong>₱{total.toFixed(2)}</strong></button>}

    {productOpen&&<div className="wm-product-overlay" role="dialog" aria-modal="true" aria-label={`${productOpen.name} product details`} onMouseDown={e=>{if(e.target===e.currentTarget)setProductOpen(null)}}><section className="wm-product-modal"><button type="button" className="wm-modal-close" onClick={()=>setProductOpen(null)} aria-label="Close product"><X size={20}/></button><div className="wm-product-media">{productOpen.video_url?<video src={productOpen.video_url} autoPlay muted loop playsInline controls preload="metadata"/>:productOpen.image_url?<img src={productOpen.image_url} alt={productOpen.name}/>:<div className="wm-product-placeholder">WISE MENU</div>}</div><div className="wm-product-info"><small>{productOpen.category||"Menu"}</small><h2>{productOpen.name}</h2><p>{productOpen.description||"Quality service from WISE MENU."}</p><strong>₱{Number(productOpen.price).toFixed(2)} <small>{productOpen.unit||"per item"}</small></strong><div className="wm-modal-qty"><button type="button" onClick={()=>setSelectedQty(q=>Math.max(1,q-1))}><Minus size={18}/></button><b>{selectedQty}</b><button type="button" onClick={()=>setSelectedQty(q=>q+1)}><Plus size={18}/></button></div><button type="button" className="wm-add-cart-large" onClick={()=>add(productOpen,selectedQty,true)}><ShoppingBag size={18}/> Add to Cart · ₱{(Number(productOpen.price)*selectedQty).toFixed(2)}</button></div></section></div>}

    {cartOpen&&<div className="wm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setCartOpen(false)}}><aside className="wm-drawer" role="dialog" aria-modal="true"><header><div><small>WISE MENU</small><h2>My Order <span>({count} items)</span></h2></div><button type="button" onClick={()=>setCartOpen(false)} aria-label="Close order"><X/></button></header><div className="wm-cart-list">{cart.map(i=><div className="wm-cart-row" key={i.product.id}><div><b>{i.product.name}</b><small>₱{Number(i.product.price).toFixed(2)} each</small></div><div className="wm-qty"><button type="button" onClick={()=>change(i.product.id,-1)}><Minus size={15}/></button><b>{i.quantity}</b><button type="button" onClick={()=>change(i.product.id,1)}><Plus size={15}/></button></div></div>)}</div><div className="wm-checkout"><div className="wm-section-label">HOW WOULD YOU LIKE TO RECEIVE YOUR ORDER?</div><div className="wm-order-type"><button type="button" className={orderType==="dine_in"?"active":""} onClick={()=>setOrderType("dine_in")}><Utensils size={20}/><b>Dine In</b><small>Enjoy here</small></button><button type="button" className={orderType==="take_out"?"active":""} onClick={()=>setOrderType("take_out")}><ShoppingBag size={20}/><b>Take Out</b><small>Take it with you</small></button></div><div className="wm-customer-confirm"><span>ORDERING AS</span><b>{name}</b><small>{email}</small></div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions (optional)"/>{submitError&&<div className="wm-submit-error" role="alert">{submitError}</div>}<div className="wm-total"><span>Total</span><b>₱{total.toFixed(2)}</b></div><button type="button" className="wm-submit-order" disabled={sending||!cart.length} onClick={submit}>{sending?"Submitting…":"Done"}<ChevronRight size={18}/></button></div></aside></div>}
  </main>;
}
