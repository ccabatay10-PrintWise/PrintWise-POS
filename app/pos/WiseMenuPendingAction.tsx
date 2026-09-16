"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./wise-menu-pending.css";

const KEY = "wise-menu-current-sale-order";

export default function WiseMenuPendingAction(){
  const [orderId,setOrderId]=useState("");
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    const query=new URLSearchParams(window.location.search).get("wiseMenuOrder")?.trim();
    if(query){sessionStorage.setItem(KEY,query);setOrderId(query);return;}
    setOrderId(sessionStorage.getItem(KEY)||"");
  },[]);

  useEffect(()=>{
    if(!orderId)return;
    const handler=()=>setOrderId(new URLSearchParams(window.location.search).get("wiseMenuOrder")?.trim()||sessionStorage.getItem(KEY)||"");
    window.addEventListener("popstate",handler);return()=>window.removeEventListener("popstate",handler);
  },[orderId]);

  if(!orderId)return null;

  const pending=async()=>{
    if(working)return;
    setWorking(true);setMessage("");
    try{
      const {data}=await supabase.auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error("Your session has expired. Please sign in again.");
      const response=await fetch("/api/wise-menu/receiving",{method:"PATCH",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({order_id:orderId,action:"pending"})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload.ok)throw new Error(payload.error||"Unable to place the WISE MENU order on Pending.");
      sessionStorage.removeItem(KEY);
      window.location.assign("/wise-menu");
    }catch(error:any){setMessage(error?.message||"Unable to place order on Pending.");setWorking(false)}
  };

  return <div className="wise-menu-pending-wrap">
    {message&&<div className="wise-menu-pending-error">{message}</div>}
    <button type="button" className="wise-menu-pending-btn" onClick={pending} disabled={working}>
      <Clock3 size={17}/>{working?"Saving…":"Pending"}
    </button>
  </div>;
}
