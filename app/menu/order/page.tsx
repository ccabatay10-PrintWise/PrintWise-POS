"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Mail, Minus, Plus, ShoppingBag, UserRound, X } from "lucide-react";
import "./menu.css";

type Product = { id:string; name:string; category:string|null; description:string|null; price:number; unit:string|null; image_url:string|null; video_url:string|null };
type CartItem = { product:Product; quantity:number };

export default function WiseMenuOrder() {
  const [products,setProducts]=useState<Product[]>([]); const [cart,setCart]=useState<CartItem[]>([]); const [category,setCategory]=useState("All"); const [search,setSearch]=useState("");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [notes,setNotes]=useState(""); const [profileReady,setProfileReady]=useState(false); const [profileError,setProfileError]=useState("");
  const [loading,setLoading]=useState(true); const [sending,setSending]=useState(false); const [submitError,setSubmitError]=useState(""); const [success,setSuccess]=useState<any>(null); const [cartOpen,setCartOpen]=useState(false);

  useEffect(()=>{
    try { const saved=JSON.parse(sessionStorage.getItem("wise-menu-customer")||"null"); if(saved?.name&&saved?.email){setName(saved.name);setEmail(saved.email);setProfileReady(true);} } catch {}
    fetch("/api/menu/products").then(r=>r.json()).then(x=>setProducts(x.products||[])).catch(()=>setProducts([])).finally(()=>setLoading(false));
  },[]);

  const categories=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category).filter(Boolean) as string[]))],[products]);
  const filtered=useMemo(()=>products.filter(p=>(category==="All"||p.category===category)&&`${p.name} ${p.description||""}`.toLowerCase().includes(search.toLowerCase())),[products,category,search]);
  const total=cart.reduce((s,x)=>s+x.product.price*x.quantity,0); const count=cart.reduce((s,x)=>s+x.quantity,0);

  const continueToMenu=()=>{
    const n=name.trim(), e=email.trim().toLowerCase();
    if(!n){setProfileError("Please enter your name.");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)){setProfileError("Please enter a valid email address.");return;}
    sessionStorage.setItem("wise-menu-customer",JSON.stringify({name:n,email:e})); setName(n);setEmail(e);setProfileError("");setProfileReady(true);
  };
  const change=(id:string,d:number)=>setCart(c=>c.map(i=>i.product.id===id?{...i,quantity:i.quantity+d}:i).filter(i=>i.quantity>0));
  const add=(p:Product)=>{setSubmitError("");setCart(c=>{const x=c.find(i=>i.product.id===p.id); return x?c.map(i=>i.product.id===p.id?{...i,quantity:i.quantity+1}:i):[...c,{product:p,quantity:1}]})};

  async function submit(){
    if(sending)return;
    if(!profileReady){setSubmitError("Please complete your customer information first.");return;}
    if(!cart.length){setSubmitError("Please select at least one item.");return;}
    setSending(true); setSubmitError("");
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch("/api/menu/order",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({customer_name:name.trim(),customer_email:email.trim().toLowerCase(),notes:notes.trim(),items:cart.map(i=>({product_id:i.product.id,quantity:i.quantity,options:{}}))}),signal:controller.signal});
      const raw=await r.text();
      let x:any={}; try{x=raw?JSON.parse(raw):{}}catch{}
      if(!r.ok)throw new Error(x?.error||`Unable to place order (${r.status}). Please try again.`);
      if(!x?.ok || !x?.order_no)throw new Error(x?.error||"The order could not be completed. Please try again.");
      setSuccess(x); setCart([]); setNotes(""); setCartOpen(false);
    }catch(e:any){setSubmitError(e?.name==="AbortError"?"The request took too long. Please check your connection and try again.":(e?.message||"Unable to place order. Please try again."));}
    finally{window.clearTimeout(timeout);setSending(false)}
  }

  if(success)return <main className="wm-page"><section className="wm-success"><div className="wm-success-icon"><Check size={42}/></div><p className="wm-eyebrow">WISE MENU</p><h1>Order Received!</h1><p>Your order <b>{success.order_no}</b> has been received and sent to Incoming Orders for cashier confirmation.</p><div className="wm-success-total">₱{Number(success.total||0).toFixed(2)}</div><button type="button" onClick={()=>setSuccess(null)}>Back to Menu</button></section></main>;

  if(!profileReady)return <main className="wm-page wm-onboarding-page"><section className="wm-onboarding"><div className="wm-onboarding-brand"><div className="wm-logo">WISE <span>MENU</span></div><div className="wm-onboarding-icon"><ShoppingBag size={28}/></div></div><p className="wm-eyebrow">WELCOME</p><h1>Before you order</h1><p className="wm-onboarding-copy">Please enter your details first. This lets us identify your order and send you updates.</p><form onSubmit={e=>{e.preventDefault();continueToMenu()}}><label><UserRound size={16}/> Your Name <span>*</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" maxLength={120}/></label><label><Mail size={16}/> Email Address <span>*</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" maxLength={254}/></label>{profileError&&<div className="wm-profile-error">{profileError}</div>}<button type="submit">Continue to Menu</button></form><small className="wm-onboarding-note">Your information is used to identify your WISE MENU order.</small></section></main>;

  return <main className="wm-page"><header className="wm-header"><div><div className="wm-logo">WISE <span>MENU</span></div><small>Hi, {name}! Scan. Select. Send your order.</small></div><button type="button" className="wm-cart" onClick={()=>{setSubmitError("");setCartOpen(true)}}><ShoppingBag size={21}/><span>{count}</span></button></header><div className="wm-search"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search menu..."/></div><nav className="wm-cats">{categories.map(c=><button type="button" className={category===c?"active":""} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</nav>{loading?<div className="wm-loading">Loading menu…</div>:<section className="wm-grid">{filtered.map(p=><article className="wm-card" key={p.id}><div className="wm-media">{p.video_url?<video src={p.video_url} autoPlay muted loop playsInline preload="metadata"/>:p.image_url?<img src={p.image_url} alt=""/>:<div className="wm-placeholder">WISE</div>}<button type="button" className="wm-add" onClick={()=>add(p)}><Plus size={19}/></button></div><div className="wm-card-body"><small>{p.category||"Menu"}</small><h2>{p.name}</h2><p>{p.description||""}</p><strong>₱{Number(p.price).toFixed(2)}</strong></div></article>)}</section>}{!cartOpen&&count>0&&<button type="button" className="wm-floating-cart" onClick={()=>{setSubmitError("");setCartOpen(true)}}><ShoppingBag size={20}/> View Order <b>₱{total.toFixed(2)}</b></button>}{cartOpen&&<div className="wm-overlay"><aside className="wm-drawer"><header><div><small>WISE MENU</small><h2>Your Order</h2></div><button type="button" onClick={()=>setCartOpen(false)}><X/></button></header><div className="wm-cart-list">{cart.map(i=><div className="wm-cart-row" key={i.product.id}><div><b>{i.product.name}</b><small>₱{Number(i.product.price).toFixed(2)} each</small></div><div className="wm-qty"><button type="button" onClick={()=>change(i.product.id,-1)}><Minus size={15}/></button><b>{i.quantity}</b><button type="button" onClick={()=>change(i.product.id,1)}><Plus size={15}/></button></div></div>)}</div><div className="wm-checkout"><div className="wm-customer-confirm"><span>Ordering as</span><b>{name}</b><small>{email}</small></div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions (optional)"/>{submitError&&<div className="wm-submit-error" role="alert">{submitError}</div>}<div className="wm-total"><span>Total</span><b>₱{total.toFixed(2)}</b></div><button type="button" className="wm-submit-order" disabled={sending||!cart.length} onClick={submit}>{sending?"Processing…":"Done"}</button></div></aside></div>}</main>;
}
